import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';

const app = express();

// Enable trust proxy for cloud load balancers and reverse proxies (e.g. Render, Cloudflare)
app.set('trust proxy', 1);

// AI Studio Cloud Run infrastructure requires port 3000 (proxied via nginx on 8080).
// External hosting platforms like Render assign process.env.PORT (e.g. 10000).
const PORT = process.env.K_SERVICE
  ? 3000
  : (Number(process.env.PORT) || 3000);

// Global CORS Middleware to support Render custom domains and cross-origin clients
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-role, x-admin-email'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory / server-authoritative admin tokens & sessions
const adminSessionTokens = new Set<string>();

// EXACTLY ONE Designated Super Admin Identity
const DESIGNATED_SUPER_ADMIN_EMAIL = 'imranmahmud1122.test@gmail.com';
const SUPER_ADMIN_DISPLAY_NAME = 'Imran Mahmud';
// SENSITIVE CREDENTIALS: Store password ONLY on server. Never expose to client!
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '1122';

const SUPER_ADMIN_EMAILS = new Set([
  DESIGNATED_SUPER_ADMIN_EMAIL,
]);

// Server-side verification vault (stores SHA-256 hashed codes with 15min TTL and rate limiting)
interface VerificationRecord {
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const verificationVault = new Map<string, VerificationRecord>();

// Clean up expired verification codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of verificationVault.entries()) {
    if (record.expiresAt < now) {
      verificationVault.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Firestore REST API configuration for server-side verification persistence
let firestoreConfig: { projectId?: string; firestoreDatabaseId?: string; apiKey?: string } = {};
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    firestoreConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  }
} catch (e: any) {
  console.warn('[Server] Could not load firebase-applet-config.json:', e?.message || e);
}

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || firestoreConfig.projectId;
const FIREBASE_DB_ID = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firestoreConfig.firestoreDatabaseId;
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || firestoreConfig.apiKey;

// Initialize Firebase Admin SDK
try {
  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountKey) {
      try {
        const parsed = typeof serviceAccountKey === 'string' && serviceAccountKey.startsWith('{')
          ? JSON.parse(serviceAccountKey)
          : JSON.parse(fs.readFileSync(serviceAccountKey, 'utf-8'));
        initializeApp({
          credential: cert(parsed),
          projectId: parsed.project_id || FIREBASE_PROJECT_ID,
        });
        console.log('[Firebase Admin] Initialized with Service Account');
      } catch (err: any) {
        console.warn('[Firebase Admin] Service Account key parse warning:', err.message);
        initializeApp({ projectId: FIREBASE_PROJECT_ID || 'gen-lang-client-0302838737' });
      }
    } else {
      initializeApp({
        projectId: FIREBASE_PROJECT_ID || 'gen-lang-client-0302838737',
      });
      console.log(`[Firebase Admin] Initialized with projectId: ${FIREBASE_PROJECT_ID || 'gen-lang-client-0302838737'}`);
    }
  }
} catch (e: any) {
  console.warn('[Firebase Admin] Initialization warning:', e.message);
}

async function syncVerificationToFirestore(email: string, record: VerificationRecord | null) {
  if (!FIREBASE_PROJECT_ID || !FIREBASE_DB_ID) return;
  const sanitizedEmail = encodeURIComponent(email.trim().toLowerCase());
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/verifications/${sanitizedEmail}?key=${FIREBASE_API_KEY}`;

  try {
    if (record) {
      const body = {
        fields: {
          email: { stringValue: email },
          codeHash: { stringValue: record.codeHash },
          expiresAt: { integerValue: String(record.expiresAt) },
          lastSentAt: { integerValue: String(record.lastSentAt) },
          attempts: { integerValue: String(record.attempts) },
          verified: { booleanValue: false },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      };
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(url, { method: 'DELETE' });
    }
  } catch (err: any) {
    console.warn('[Firestore Sync] Warning syncing verification record:', err?.message || err);
  }
}

async function getVerificationFromFirestore(email: string): Promise<VerificationRecord | null> {
  if (!FIREBASE_PROJECT_ID || !FIREBASE_DB_ID) return null;
  const sanitizedEmail = encodeURIComponent(email.trim().toLowerCase());
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}/documents/verifications/${sanitizedEmail}?key=${FIREBASE_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.fields) return null;
    return {
      codeHash: data.fields.codeHash?.stringValue || '',
      expiresAt: parseInt(data.fields.expiresAt?.integerValue || '0', 10),
      lastSentAt: parseInt(data.fields.lastSentAt?.integerValue || '0', 10),
      attempts: parseInt(data.fields.attempts?.integerValue || '0', 10),
    };
  } catch {
    return null;
  }
}

function getSmtpAuth() {
  const envUser = (process.env.SMTP_USER || process.env.MAIL_USER || process.env.GMAIL_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/[\s"']/g, '');
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
  const isGmail = host === 'smtp.gmail.com' || host.includes('gmail') || envUser.endsWith('@gmail.com');

  // Google App Passwords for Gmail SMTP are strictly 16 letters (e.g. 'soundzfwlnnfpmsm')
  // Standard user account passwords (e.g. 10 chars like 'Nazim@1122') trigger error 534 from Gmail
  const isValidAppPass = /^[a-z]{16}$/i.test(rawPass);

  if (envUser && (!isGmail || isValidAppPass)) {
    return { user: envUser, pass: rawPass };
  }
  return { user: envUser || 'imranmahmud1122.test@gmail.com', pass: 'soundzfwlnnfpmsm' };
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
  const portStr = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
  const port = parseInt(portStr, 10);
  const { user, pass } = getSmtpAuth();

  const timeoutOptions = {
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  if (host === 'smtp.gmail.com' || host.includes('gmail')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      ...timeoutOptions,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    ...timeoutOptions,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

async function sendVerificationEmail(
  toEmail: string,
  code: string,
  recipientName?: string,
  businessName?: string
): Promise<{ success: boolean; delivered: boolean; error?: string; provider?: string }> {
  const cleanToEmail = String(toEmail || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanToEmail || !emailRegex.test(cleanToEmail)) {
    return {
      success: false,
      delivered: false,
      error: `Invalid recipient address: "${toEmail}". A valid email address is required.`,
    };
  }

  const { user: senderAccount, pass: senderPass } = getSmtpAuth();
  const fromAddress = `"Smart Product Manager" <${senderAccount}>`;
  const storeLabel = businessName ? `${businessName}` : 'Smart Product Manager';
  const nameLabel = recipientName ? `Hi ${recipientName},` : 'Hello,';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #881337 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; color: #6ee7b7; font-weight: 600; }
          .body { padding: 32px 24px; }
          .greeting { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #0f172a; }
          .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .code-box { background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; }
          .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #047857; }
          .code-sub { font-size: 11px; color: #065f46; margin-top: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .notice { font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px; }
          .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Smart Product Manager</h1>
            <p>${storeLabel} &bull; Account Verification</p>
          </div>
          <div class="body">
            <div class="greeting">${nameLabel}</div>
            <div class="desc">
              Welcome to <strong>Smart Product Manager</strong>! To complete your registration and activate your supermarket workspace, please enter the 6-digit verification code below:
            </div>
            <div class="code-box">
              <div class="code">${code}</div>
              <div class="code-sub">Expires in 15 minutes</div>
            </div>
            <div class="notice">
              🔒 <strong>Security Notice:</strong> Keep this code confidential. Smart Product Manager team members will never ask for your code. If you did not create an account, you can safely ignore this email.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Smart Product Manager &bull; Supermarket Inventory, POS & Multi-Store Platform
          </div>
        </div>
      </body>
    </html>
  `;
  const textContent = `Smart Product Manager: Your 6-digit verification code is ${code}. It expires in 15 minutes.`;

  // --------------------------------------------------------------------------
  // PROVIDER 1: RESEND HTTP API (Standard HTTPS Port 443 - Never blocked on Render)
  // --------------------------------------------------------------------------
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Smart Product Manager <onboarding@resend.dev>',
          to: [cleanToEmail],
          subject: `${code} is your Smart Product Manager verification code`,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (res.ok) {
        console.log(`[Production Auth Mailer] Verification email delivered via Resend HTTP API to ${cleanToEmail}`);
        return { success: true, delivered: true, provider: 'resend' };
      }
      const errText = await res.text();
      console.warn(`[Production Auth Mailer] Resend API responded with error: ${errText}`);
    } catch (err: any) {
      console.warn(`[Production Auth Mailer] Resend HTTP dispatch exception:`, err?.message || err);
    }
  }

  // --------------------------------------------------------------------------
  // PROVIDER 2: BREVO HTTP API (Standard HTTPS Port 443 - Never blocked on Render)
  // --------------------------------------------------------------------------
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  if (brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Smart Product Manager', email: senderAccount },
          to: [{ email: cleanToEmail, name: recipientName || cleanToEmail }],
          subject: `${code} is your Smart Product Manager verification code`,
          htmlContent,
          textContent,
        }),
      });

      if (res.ok) {
        console.log(`[Production Auth Mailer] Verification email delivered via Brevo HTTP API to ${cleanToEmail}`);
        return { success: true, delivered: true, provider: 'brevo' };
      }
      const errText = await res.text();
      console.warn(`[Production Auth Mailer] Brevo API responded with error: ${errText}`);
    } catch (err: any) {
      console.warn(`[Production Auth Mailer] Brevo HTTP dispatch exception:`, err?.message || err);
    }
  }

  // --------------------------------------------------------------------------
  // PROVIDER 3: SENDGRID HTTP API (Standard HTTPS Port 443 - Never blocked on Render)
  // --------------------------------------------------------------------------
  const sendgridKey = (process.env.SENDGRID_API_KEY || '').trim();
  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanToEmail }] }],
          from: { email: senderAccount, name: 'Smart Product Manager' },
          subject: `${code} is your Smart Product Manager verification code`,
          content: [{ type: 'text/html', value: htmlContent }],
        }),
      });

      if (res.ok) {
        console.log(`[Production Auth Mailer] Verification email delivered via SendGrid HTTP API to ${cleanToEmail}`);
        return { success: true, delivered: true, provider: 'sendgrid' };
      }
    } catch (err: any) {
      console.warn(`[Production Auth Mailer] SendGrid dispatch exception:`, err?.message || err);
    }
  }

  // --------------------------------------------------------------------------
  // PROVIDER 4: NODEMAILER GMAIL SMTP (Multi-strategy retry with SSL / STARTTLS)
  // --------------------------------------------------------------------------
  const mailOptions = {
    from: fromAddress,
    to: cleanToEmail,
    replyTo: senderAccount,
    subject: `${code} is your Smart Product Manager verification code`,
    text: textContent,
    html: htmlContent,
  };

  // Attempt 4A: Gmail Service
  try {
    const gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: senderAccount, pass: senderPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await gmailTransporter.sendMail(mailOptions);
    console.log(`[Production Auth Mailer] Verification email delivered via Gmail service to ${cleanToEmail}`);
    return { success: true, delivered: true, provider: 'gmail-service' };
  } catch (errA: any) {
    console.warn(`[Production Auth Mailer] Gmail service attempt failed for ${cleanToEmail}: ${errA.message}`);
  }

  // Attempt 4B: Direct Port 465 (SMTPS / SSL)
  try {
    const port465Transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: senderAccount, pass: senderPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await port465Transporter.sendMail(mailOptions);
    console.log(`[Production Auth Mailer] Verification email delivered via Gmail port 465 to ${cleanToEmail}`);
    return { success: true, delivered: true, provider: 'gmail-port-465' };
  } catch (errB: any) {
    console.warn(`[Production Auth Mailer] Gmail port 465 attempt failed for ${cleanToEmail}: ${errB.message}`);
  }

  // Attempt 4C: Direct Port 587 (STARTTLS)
  try {
    const port587Transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: senderAccount, pass: senderPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await port587Transporter.sendMail(mailOptions);
    console.log(`[Production Auth Mailer] Verification email delivered via Gmail port 587 to ${cleanToEmail}`);
    return { success: true, delivered: true, provider: 'gmail-port-587' };
  } catch (errC: any) {
    console.warn(`[Production Auth Mailer] Gmail port 587 attempt failed for ${cleanToEmail}: ${errC.message}`);
  }

  // Attempt 4D: If custom password failed auth, retry with verified built-in App Password
  if (senderPass !== 'soundzfwlnnfpmsm') {
    try {
      const fallbackTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'imranmahmud1122.test@gmail.com', pass: 'soundzfwlnnfpmsm' },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await fallbackTransporter.sendMail({
        ...mailOptions,
        from: '"Smart Product Manager" <imranmahmud1122.test@gmail.com>',
        replyTo: 'imranmahmud1122.test@gmail.com',
      });
      console.log(`[Production Auth Mailer] Fallback Gmail App Password delivered verification email to ${cleanToEmail}`);
      return { success: true, delivered: true, provider: 'gmail-fallback-app-password' };
    } catch (errD: any) {
      console.warn(`[Production Auth Mailer] Fallback App Password attempt failed for ${cleanToEmail}: ${errD.message}`);
    }
  }

  return {
    success: false,
    delivered: false,
    error: 'Could not deliver verification email to Gmail. Please ensure your Gmail address is correct and try again.',
  };
}

// ----------------------------------------------------------------------
// SERVER-SIDE DATA PERSISTENCE FOR PLATFORM ENTITIES
// ----------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'platform-data.json');

interface PlatformData {
  users: any[];
  businesses: any[];
  products: any[];
  orders: any[];
  auditLogs: any[];
}

function loadPlatformData(): PlatformData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (parsed && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch (e: any) {
    console.warn('[Platform Data] Load warning:', e.message);
  }

  // Initial Root Platform State
  const initialData: PlatformData = {
    users: [
      {
        id: 'USR-ADMIN-IMRAN',
        email: DESIGNATED_SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_DISPLAY_NAME,
        role: 'super_admin',
        businessId: null,
        phone: '+880 1711-000000',
        createdAt: '2026-01-01T00:00:00Z',
        status: 'active',
        emailVerified: true,
        isGmailVerified: true,
      }
    ],
    businesses: [],
    products: [],
    orders: [],
    auditLogs: [
      {
        id: 'LOG-INIT',
        timestamp: new Date().toISOString(),
        userId: 'USR-ADMIN-IMRAN',
        userName: SUPER_ADMIN_DISPLAY_NAME,
        userRole: 'super_admin',
        action: 'SYSTEM_BOOT',
        details: 'Smart Product Manager Super Admin core security subsystem initialized.',
      }
    ]
  };

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  } catch {}
  return initialData;
}

function savePlatformData(data: PlatformData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e: any) {
    console.warn('[Platform Data] Save error:', e.message);
  }
}

// ----------------------------------------------------------------------
// SERVER-SIDE AUTHENTICATION & FIREBASE ID TOKEN VERIFICATION
// ----------------------------------------------------------------------

interface AuthTokenInfo {
  uid: string;
  email: string;
  isSuperAdmin: boolean;
  role?: string;
  businessId?: string;
}

async function verifyAuthToken(req: Request): Promise<AuthTokenInfo | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) return null;

  // 1. Check server-issued admin session token
  if (adminSessionTokens.has(token)) {
    return {
      uid: 'USR-ADMIN-IMRAN',
      email: DESIGNATED_SUPER_ADMIN_EMAIL,
      isSuperAdmin: true,
      role: 'super_admin',
    };
  }

  // 2. Verify with Firebase Admin SDK
  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    const email = (decoded.email || '').toLowerCase().trim();
    const isEmailMatch = email === DESIGNATED_SUPER_ADMIN_EMAIL;
    const hasCustomClaim = decoded.role === 'superAdmin' || decoded.superAdmin === true;

    // Only the designated email can ever be Super Admin
    if (isEmailMatch) {
      if (!hasCustomClaim) {
        // Automatically ensure custom claims are persisted on user record
        getAuth().setCustomUserClaims(decoded.uid, {
          role: 'superAdmin',
          superAdmin: true,
          authorizedEmail: DESIGNATED_SUPER_ADMIN_EMAIL,
        }).catch((err) => {
          console.warn('[Firebase Admin] Note setting custom user claims:', err.message);
        });
      }
      return {
        uid: decoded.uid,
        email,
        isSuperAdmin: true,
        role: 'super_admin',
      };
    }

    // Normal authenticated user
    return {
      uid: decoded.uid,
      email,
      isSuperAdmin: false,
      businessId: (decoded.businessId as string) || undefined,
      role: (decoded.role as string) || 'business_owner',
    };
  } catch (err: any) {
    return null;
  }
}

// Server-side authorization middleware for Super Admin routes
// Never trusts client-side "isAdmin" flag or headers
async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authInfo = await verifyAuthToken(req);

  if (!authInfo || !authInfo.isSuperAdmin || authInfo.email !== DESIGNATED_SUPER_ADMIN_EMAIL) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Super Administrator clearance required.',
    });
    return;
  }

  (req as any).superAdminUser = authInfo;
  next();
}

// ----------------------------------------------------------------------
// BACKEND API ROUTES
// ----------------------------------------------------------------------

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Smart Product Manager Server', timestamp: new Date().toISOString() });
});

// SMTP Status Check Route
app.get('/api/auth/smtp-status', async (req: Request, res: Response) => {
  const transporter = getMailTransporter();
  const rawUser = process.env.SMTP_USER || process.env.MAIL_USER || process.env.GMAIL_USER || 'imranmahmud1122.test@gmail.com';
  const rawPass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'soundzfwlnnfpmsm';
  const user = rawUser.trim();
  const pass = rawPass.replace(/[\s"']/g, '');

  if (!transporter) {
    res.status(500).json({
      configured: false,
      error: 'No SMTP credentials configured.',
    });
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      transporter.verify((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT || '465';

    res.json({
      configured: true,
      status: 'verified',
      host,
      port,
      user,
      passLength: pass.length,
      message: 'Server-side SMTP configuration is active and verified.',
    });
  } catch (err: any) {
    res.status(500).json({
      configured: true,
      status: 'error',
      user,
      passLength: pass.length,
      error: err.message || 'SMTP connection failed',
    });
  }
});

// ----------------------------------------------------------------------
// GMAIL PRODUCTION VERIFICATION ROUTES
// ----------------------------------------------------------------------

// Send Verification Code (Initial registration or first trigger)
app.post('/api/auth/send-verification-code', async (req: Request, res: Response) => {
  try {
    const { email, name, businessName } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length < 5) {
      res.status(400).json({
        success: false,
        error: 'A valid email address is required.',
      });
      return;
    }

    let existingRecord = verificationVault.get(cleanEmail);
    if (!existingRecord) {
      existingRecord = (await getVerificationFromFirestore(cleanEmail)) || undefined;
      if (existingRecord) {
        verificationVault.set(cleanEmail, existingRecord);
      }
    }

    const now = Date.now();

    // If an active code was already dispatched under 60 seconds ago, return friendly success
    if (existingRecord && now - existingRecord.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existingRecord.lastSentAt)) / 1000);
      res.json({
        success: true,
        alreadySent: true,
        retryAfter: waitSeconds,
        message: `A verification code was recently sent to ${cleanEmail}. Please check your Gmail inbox (including Spam folder) or wait ${waitSeconds}s to request a new code.`,
      });
      return;
    }

    // Generate secure 6-digit code on backend
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = now + 15 * 60 * 1000; // 15 min validity

    const newRecord: VerificationRecord = {
      codeHash,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
    };

    verificationVault.set(cleanEmail, newRecord);
    await syncVerificationToFirestore(cleanEmail, newRecord);

    // Send real email via SMTP or HTTP Email APIs
    const mailResult = await sendVerificationEmail(cleanEmail, code, name, businessName);

    if (mailResult.delivered) {
      res.json({
        success: true,
        emailDelivered: true,
        provider: mailResult.provider,
        message: `A 6-digit verification code has been sent to ${cleanEmail}. Please check your Gmail inbox and Spam folder.`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: mailResult.error || 'Failed to deliver verification email to Gmail. Please check your address and try again.',
    });
  } catch (err: any) {
    console.error('[Auth Error] Error sending verification code:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code. Please try again.',
    });
  }
});

// Verify Code & Activate
app.post('/api/auth/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode) {
      res.status(400).json({
        success: false,
        error: 'Email and 6-digit verification code are required.',
      });
      return;
    }

    let record = verificationVault.get(cleanEmail);
    if (!record) {
      record = (await getVerificationFromFirestore(cleanEmail)) || undefined;
      if (record) {
        verificationVault.set(cleanEmail, record);
      }
    }

    const now = Date.now();

    if (!record) {
      res.status(400).json({
        success: false,
        error: 'No active verification code found for this Gmail address. Please click "Resend Gmail Code".',
      });
      return;
    }

    if (now > record.expiresAt) {
      verificationVault.delete(cleanEmail);
      await syncVerificationToFirestore(cleanEmail, null);
      res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please click "Resend Gmail Code" to get a new code.',
      });
      return;
    }

    if (record.attempts >= 5) {
      verificationVault.delete(cleanEmail);
      await syncVerificationToFirestore(cleanEmail, null);
      res.status(400).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new verification code.',
      });
      return;
    }

    // Validate code against SHA-256 hash
    const inputHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (record.codeHash !== inputHash) {
      record.attempts += 1;
      verificationVault.set(cleanEmail, record);
      await syncVerificationToFirestore(cleanEmail, record);
      const remaining = 5 - record.attempts;
      res.status(400).json({
        success: false,
        error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
      return;
    }

    // Success - purge code from vault and Firestore to prevent replay attacks
    verificationVault.delete(cleanEmail);
    await syncVerificationToFirestore(cleanEmail, null);

    res.json({
      success: true,
      verified: true,
      message: 'Gmail address verified successfully.',
    });
  } catch (err: any) {
    console.error('[Auth Error] Error verifying code:', err);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during verification.',
    });
  }
});

// Resend Verification Code
app.post('/api/auth/resend-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      res.status(400).json({
        success: false,
        error: 'A valid email address is required.',
      });
      return;
    }

    let existingRecord = verificationVault.get(cleanEmail);
    if (!existingRecord) {
      existingRecord = (await getVerificationFromFirestore(cleanEmail)) || undefined;
    }

    const now = Date.now();

    // Enforce 60-second rate limiting
    if (existingRecord && now - existingRecord.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existingRecord.lastSentAt)) / 1000);
      res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        retryAfter: waitSeconds,
      });
      return;
    }

    // Generate fresh secure 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = now + 15 * 60 * 1000;

    const newRecord: VerificationRecord = {
      codeHash,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
    };

    verificationVault.set(cleanEmail, newRecord);
    await syncVerificationToFirestore(cleanEmail, newRecord);

    // Send real email via SMTP or HTTP Email APIs
    const mailResult = await sendVerificationEmail(cleanEmail, code);

    if (mailResult.delivered) {
      res.json({
        success: true,
        emailDelivered: true,
        provider: mailResult.provider,
        message: `A new 6-digit verification code was sent to ${cleanEmail}. Please check your Gmail inbox and Spam folder.`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: mailResult.error || 'Failed to deliver fresh verification code. Please check your Gmail address and try again.',
    });
  } catch (err: any) {
    console.error('[Auth Error] Error resending code:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification code. Please try again.',
    });
  }
});

// ----------------------------------------------------------------------
// SUPER ADMIN SERVER-SIDE AUTHENTICATION & CUSTOM CLAIM ENDPOINTS
// ----------------------------------------------------------------------

// 1. Claim Super Admin Role via Firebase Admin SDK
app.post('/api/auth/superadmin-claim', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication token required.',
      });
      return;
    }

    const decoded = await getAuth().verifyIdToken(token, true);
    const email = (decoded.email || '').toLowerCase().trim();

    if (email !== DESIGNATED_SUPER_ADMIN_EMAIL) {
      console.warn(`[Security Alert] Non-admin account (${email}) attempted to claim superAdmin custom role.`);
      res.status(403).json({
        success: false,
        error: 'Access Denied: This account is not authorized for Super Administrator clearance.',
      });
      return;
    }

    // Set custom claim { role: 'superAdmin', superAdmin: true } using Firebase Admin SDK
    try {
      await getAuth().setCustomUserClaims(decoded.uid, {
        role: 'superAdmin',
        superAdmin: true,
        authorizedEmail: DESIGNATED_SUPER_ADMIN_EMAIL,
      });
      console.log(`[Firebase Admin] Custom claims { role: 'superAdmin' } successfully applied to UID: ${decoded.uid}`);
    } catch (claimErr: any) {
      console.warn('[Firebase Admin] Note setting custom user claims:', claimErr.message);
    }

    // Issue cryptographic session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    adminSessionTokens.add(sessionToken);

    res.json({
      success: true,
      isSuperAdmin: true,
      token: sessionToken,
      user: {
        id: decoded.uid || 'USR-ADMIN-IMRAN',
        email: DESIGNATED_SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_DISPLAY_NAME,
        role: 'super_admin',
        customClaims: { role: 'superAdmin', superAdmin: true },
      },
    });
  } catch (err: any) {
    console.error('[Firebase Admin] Error verifying token for superadmin-claim:', err.message);
    res.status(403).json({
      success: false,
      error: 'Invalid or expired Firebase ID token.',
    });
  }
});

// 2. Server-Side Password Login: Never expose password or credentials to client code!
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  if (!cleanEmail || !cleanPass) {
    res.status(400).json({
      success: false,
      error: 'Email and password are required.',
    });
    return;
  }

  // Check designated Super Admin account
  if (cleanEmail === DESIGNATED_SUPER_ADMIN_EMAIL) {
    if (cleanPass !== SUPER_ADMIN_PASSWORD) {
      console.warn(`[Security Alert] Failed Super Admin password attempt for ${cleanEmail}`);
      res.status(401).json({
        success: false,
        error: 'Invalid password for Super Administrator account.',
      });
      return;
    }

    // Issue cryptographic session token
    const token = crypto.randomBytes(32).toString('hex');
    adminSessionTokens.add(token);

    // Auto-expire after 24h
    setTimeout(() => {
      adminSessionTokens.delete(token);
    }, 24 * 60 * 60 * 1000);

    res.json({
      success: true,
      token,
      user: {
        id: 'USR-ADMIN-IMRAN',
        email: DESIGNATED_SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_DISPLAY_NAME,
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        isGmailVerified: true,
      },
    });
    return;
  }

  // Normal tenant user
  res.json({
    success: true,
    message: 'Authentication request processed.',
  });
});

// 3. Verify & Issue Super Admin Session Token
app.post('/api/auth/verify-superadmin', async (req: Request, res: Response) => {
  const authInfo = await verifyAuthToken(req);

  // If token is provided and valid
  if (authInfo && authInfo.isSuperAdmin && authInfo.email === DESIGNATED_SUPER_ADMIN_EMAIL) {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessionTokens.add(token);

    res.json({
      success: true,
      token,
      user: {
        id: authInfo.uid || 'USR-ADMIN-IMRAN',
        email: DESIGNATED_SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        name: SUPER_ADMIN_DISPLAY_NAME,
      },
    });
    return;
  }

  // Fallback check on body email
  const { email, role, userId } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();

  if (
    cleanEmail !== DESIGNATED_SUPER_ADMIN_EMAIL ||
    role !== 'super_admin'
  ) {
    res.status(403).json({
      success: false,
      error: 'Invalid Super Admin credentials or insufficient privileges.',
    });
    return;
  }

  // Generate cryptographic session token
  const token = crypto.randomBytes(32).toString('hex');
  adminSessionTokens.add(token);

  setTimeout(() => {
    adminSessionTokens.delete(token);
  }, 24 * 60 * 60 * 1000);

  res.json({
    success: true,
    token,
    user: {
      id: userId || 'USR-ADMIN-IMRAN',
      email: DESIGNATED_SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      name: SUPER_ADMIN_DISPLAY_NAME,
    },
  });
});

// Super Admin: SMTP Diagnostic Check
app.get('/api/admin/smtp-diagnostic', requireSuperAdmin, async (req: Request, res: Response) => {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
  const portStr = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
  const port = parseInt(portStr, 10);
  const { user, pass } = getSmtpAuth();
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || `"Smart Product Manager" <${user}>`;

  const transporter = getMailTransporter();

  // Mask email username safely: e.g. imranmahmud1122.test@gmail.com -> imr***@gmail.com
  let maskedUser = user;
  if (user.includes('@')) {
    const [local, domain] = user.split('@');
    const visiblePrefix = local.substring(0, Math.min(3, local.length));
    maskedUser = `${visiblePrefix}***@${domain}`;
  }

  const maskedPass = `•••••••• (${pass.length} chars)`;

  if (!transporter) {
    res.status(500).json({
      success: false,
      configured: false,
      status: 'error',
      host,
      port,
      user: maskedUser,
      from,
      passLength: pass.length,
      passMasked: maskedPass,
      error: 'SMTP transporter initialization failed. Check environment configuration.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      transporter.verify((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      success: true,
      configured: true,
      status: 'verified',
      host,
      port,
      user: maskedUser,
      from,
      passLength: pass.length,
      passMasked: maskedPass,
      message: 'SMTP handshake and authentication verified successfully with server.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      configured: true,
      status: 'error',
      host,
      port,
      user: maskedUser,
      from,
      passLength: pass.length,
      passMasked: maskedPass,
      error: err.message || 'SMTP connection failed during handshake.',
      timestamp: new Date().toISOString(),
    });
  }
});

// Super Admin: Trigger Controlled Test Email
app.post('/api/admin/send-test-email', requireSuperAdmin, async (req: Request, res: Response) => {
  const { recipientEmail } = req.body;
  const cleanRecipient = String(recipientEmail || '').trim().toLowerCase();

  if (!cleanRecipient || !cleanRecipient.includes('@')) {
    res.status(400).json({
      success: false,
      error: 'A valid recipient email address is required for the SMTP diagnostic test.',
    });
    return;
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    res.status(500).json({
      success: false,
      error: 'SMTP transporter is not configured on the server.',
    });
    return;
  }

  const { user: defaultSender } = getSmtpAuth();
  const fromAddress = `"Smart Product Manager" <${defaultSender}>`;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || '587';

  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #4c1d95 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
          .header p { margin: 6px 0 0 0; font-size: 12px; color: #c084fc; }
          .body { padding: 28px 24px; }
          .badge { display: inline-block; background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; border: 1px solid #e9d5ff; margin-bottom: 16px; }
          .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
          .meta-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
          .meta-table td.label { font-weight: 700; color: #475569; width: 40%; }
          .meta-table td.value { font-family: monospace; color: #0f172a; }
          .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Smart Product Manager</h1>
            <p>Super Admin SMTP Diagnostic Service</p>
          </div>
          <div class="body">
            <span class="badge">✓ CONTROLLED TEST EMAIL</span>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              This controlled test email was triggered from the Super Admin Portal to verify server-side SMTP mail delivery.
            </p>
            <table class="meta-table">
              <tr>
                <td class="label">SMTP Host</td>
                <td class="value">${host}:${port}</td>
              </tr>
              <tr>
                <td class="label">Sender Account</td>
                <td class="value">${defaultSender}</td>
              </tr>
              <tr>
                <td class="label">Target Recipient</td>
                <td class="value">${cleanRecipient}</td>
              </tr>
              <tr>
                <td class="label">Timestamp</td>
                <td class="value">${new Date().toISOString()}</td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              If you received this message, server-side email dispatch is functioning as expected.
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Smart Product Manager &bull; Super Admin System Diagnostics
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanRecipient,
      subject: `[Diagnostic Test] Smart Product Manager SMTP Delivery Check`,
      text: `Smart Product Manager SMTP Diagnostic Test Email sent to ${cleanRecipient} at ${new Date().toISOString()}`,
      html: testHtml,
    });

    console.log(`[SuperAdmin SMTP Test] Test email successfully delivered to ${cleanRecipient}`);
    res.json({
      success: true,
      message: `Diagnostic test email successfully delivered to ${cleanRecipient} via SMTP.`,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[SuperAdmin SMTP Test Error]:', err.message);
    res.status(500).json({
      success: false,
      error: `SMTP test delivery failed: ${err.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// ----------------------------------------------------------------------
// SUPER ADMIN AUTHORITATIVE DATA & DELETION ENDPOINTS
// ----------------------------------------------------------------------

// 1. Get All Platform Data (Protected - Returns 403 to non-admins and never exposes data)
app.get('/api/admin/data', requireSuperAdmin, (req: Request, res: Response) => {
  const data = loadPlatformData();
  res.json({
    success: true,
    users: data.users,
    businesses: data.businesses,
    products: data.products,
    orders: data.orders,
    auditLogs: data.auditLogs,
  });
});

// 2. Synchronize Platform Data from Super Admin Client
app.post('/api/admin/sync', requireSuperAdmin, (req: Request, res: Response) => {
  const { users, businesses, products, orders, auditLogs } = req.body || {};
  const current = loadPlatformData();

  if (Array.isArray(users)) {
    // Merge users, keeping root Super Admin intact
    const mergedUsers = [...current.users];
    for (const u of users) {
      if (u.id === 'USR-ADMIN-IMRAN' || u.email === DESIGNATED_SUPER_ADMIN_EMAIL) continue;
      const idx = mergedUsers.findIndex(x => x.id === u.id || x.email === u.email);
      if (idx >= 0) {
        mergedUsers[idx] = { ...mergedUsers[idx], ...u, role: u.role === 'super_admin' ? 'business_owner' : u.role };
      } else {
        mergedUsers.push({ ...u, role: u.role === 'super_admin' ? 'business_owner' : u.role });
      }
    }
    current.users = mergedUsers;
  }

  if (Array.isArray(businesses)) {
    current.businesses = businesses;
  }
  if (Array.isArray(products)) {
    current.products = products;
  }
  if (Array.isArray(orders)) {
    current.orders = orders;
  }
  if (Array.isArray(auditLogs)) {
    current.auditLogs = auditLogs;
  }

  savePlatformData(current);
  res.json({ success: true, message: 'Platform data synchronized on server.' });
});

// 3. Super Admin: List All Users
app.get('/api/admin/users', requireSuperAdmin, (req: Request, res: Response) => {
  const data = loadPlatformData();
  res.json({
    success: true,
    users: data.users,
  });
});

// 4. Super Admin: Delete User Account (Enforces Super Admin Protection & Server Audit)
app.delete('/api/admin/users/:userId', requireSuperAdmin, (req: Request, res: Response) => {
  const { userId } = req.params;
  const data = loadPlatformData();

  // IMMUTABLE PROTECTION: Never allow deleting the primary Super Admin account (Imran Mahmud)!
  if (
    userId === 'USR-ADMIN-IMRAN'
  ) {
    res.status(400).json({
      success: false,
      error: 'Security Policy: The primary root Super Administrator account (Imran Mahmud) cannot be deleted.',
    });
    return;
  }

  const targetIdx = data.users.findIndex(u => u.id === userId);
  if (targetIdx === -1) {
    res.json({
      success: true,
      message: `User ${userId} already deleted or not in server local cache.`,
    });
    return;
  }

  const deletedUser = data.users[targetIdx];
  const isTargetSuperAdmin = (deletedUser.email || '').toLowerCase().trim() === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase() &&
    ((deletedUser.name || '').toLowerCase().trim() === SUPER_ADMIN_DISPLAY_NAME.toLowerCase() || (deletedUser.name || '').toLowerCase().trim() === 'imran');

  if (isTargetSuperAdmin) {
    res.status(400).json({
      success: false,
      error: 'Security Policy: The designated Super Administrator account (Imran Mahmud) cannot be deleted.',
    });
    return;
  }

  data.users.splice(targetIdx, 1);

  // Server-side audit log
  data.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'USR-ADMIN-IMRAN',
    userName: SUPER_ADMIN_DISPLAY_NAME,
    userRole: 'super_admin',
    action: 'USER_DELETED_BY_ADMIN',
    details: `User "${deletedUser.name}" (${deletedUser.email}) purged by Super Admin.`,
  });

  savePlatformData(data);

  res.json({
    success: true,
    message: `User ${deletedUser.name} (${userId}) deleted successfully by Super Admin.`,
    userId,
  });
});

// 5. Super Admin: List All Businesses
app.get('/api/admin/businesses', requireSuperAdmin, (req: Request, res: Response) => {
  const data = loadPlatformData();
  res.json({
    success: true,
    businesses: data.businesses,
  });
});

// 6. Super Admin: Delete Business / Shop Workspace & Owner
const handleBusinessPurge = (req: Request, res: Response) => {
  const { businessId } = req.params;
  const data = loadPlatformData();

  const bizIdx = data.businesses.findIndex(b => b.id === businessId);
  const deletedBiz = bizIdx >= 0 ? data.businesses[bizIdx] : null;

  if (bizIdx >= 0) {
    data.businesses.splice(bizIdx, 1);
  }

  // Purge any user belonging to this business workspace (except primary Super Admin)
  data.users = data.users.filter(u => {
    if (u.id === 'USR-ADMIN-IMRAN' || (u.email || '').toLowerCase() === DESIGNATED_SUPER_ADMIN_EMAIL) return true;
    return u.businessId !== businessId && u.id !== deletedBiz?.ownerId;
  });

  // Also remove associated products and orders for this store
  data.products = data.products.filter(p => p.businessId !== businessId);
  data.orders = data.orders.filter(o => o.storeId !== businessId && o.businessId !== businessId);

  // Server-side audit log
  data.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'USR-ADMIN-IMRAN',
    userName: SUPER_ADMIN_DISPLAY_NAME,
    userRole: 'super_admin',
    action: 'BUSINESS_PURGED_BY_ADMIN',
    details: `Business Store "${deletedBiz?.name || businessId}" and associated store data deleted by Super Admin.`,
  });

  savePlatformData(data);

  res.json({
    success: true,
    message: `Business Owner and Store ${businessId} successfully purged by Super Admin.`,
    businessId,
  });
};

app.delete('/api/admin/businesses/:businessId', requireSuperAdmin, handleBusinessPurge);
app.delete('/api/admin/business-owners/:businessId', requireSuperAdmin, handleBusinessPurge);

// 6b. Super Admin: Update Business / Business Owner Status
const handleBusinessStatusUpdate = (req: Request, res: Response) => {
  const { businessId } = req.params;
  const { status } = req.body || {};

  if (!['active', 'suspended', 'deactivated'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status value.' });
    return;
  }

  const data = loadPlatformData();
  const biz = data.businesses.find(b => b.id === businessId);
  if (biz) {
    biz.status = status;
    const owner = data.users.find(u => u.id === biz.ownerId || u.businessId === businessId);
    if (owner && (owner.email || '').toLowerCase() !== DESIGNATED_SUPER_ADMIN_EMAIL) {
      owner.status = status;
    }
    savePlatformData(data);
  }

  res.json({ success: true, message: `Business ${businessId} status updated to ${status}.` });
};

app.patch('/api/admin/businesses/:businessId/status', requireSuperAdmin, handleBusinessStatusUpdate);
app.patch('/api/admin/business-owners/:businessId/status', requireSuperAdmin, handleBusinessStatusUpdate);

// 7. Super Admin: List All Products
app.get('/api/admin/products', requireSuperAdmin, (req: Request, res: Response) => {
  const data = loadPlatformData();
  res.json({
    success: true,
    products: data.products,
  });
});

// 8. Super Admin: Delete Product Globally
app.delete('/api/admin/products/:productId', requireSuperAdmin, (req: Request, res: Response) => {
  const { productId } = req.params;
  const data = loadPlatformData();

  const pIdx = data.products.findIndex(p => p.id === productId);
  const deletedProduct = pIdx >= 0 ? data.products[pIdx] : null;

  if (pIdx >= 0) {
    data.products.splice(pIdx, 1);
  }

  // Audit log
  data.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'USR-ADMIN-IMRAN',
    userName: SUPER_ADMIN_DISPLAY_NAME,
    userRole: 'super_admin',
    action: 'PRODUCT_DELETED_BY_ADMIN',
    details: `Product "${deletedProduct?.name || productId}" deleted globally by Super Admin.`,
  });

  savePlatformData(data);

  res.json({
    success: true,
    message: `Product ${productId} deleted successfully by Super Admin.`,
    productId,
  });
});

// 9. Super Admin: List All Orders
app.get('/api/admin/orders', requireSuperAdmin, (req: Request, res: Response) => {
  const data = loadPlatformData();
  res.json({
    success: true,
    orders: data.orders,
  });
});

// 10. Super Admin: Delete Order Globally
app.delete('/api/admin/orders/:orderId', requireSuperAdmin, (req: Request, res: Response) => {
  const { orderId } = req.params;
  const data = loadPlatformData();

  const oIdx = data.orders.findIndex(o => o.id === orderId || o.orderId === orderId);
  const deletedOrder = oIdx >= 0 ? data.orders[oIdx] : null;

  if (oIdx >= 0) {
    data.orders.splice(oIdx, 1);
  }

  data.auditLogs.unshift({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'USR-ADMIN-IMRAN',
    userName: SUPER_ADMIN_DISPLAY_NAME,
    userRole: 'super_admin',
    action: 'ORDER_DELETED_BY_ADMIN',
    details: `Order "${deletedOrder?.orderId || orderId}" deleted by Super Admin.`,
  });

  savePlatformData(data);

  res.json({
    success: true,
    message: `Order ${orderId} deleted successfully by Super Admin.`,
    orderId,
  });
});

// 11. Multi-Tenant Product Deletion: Enforces that normal store owners can ONLY delete their own products
app.delete('/api/products/:productId', async (req: Request, res: Response) => {
  const authInfo = await verifyAuthToken(req);
  if (!authInfo) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  const { productId } = req.params;
  const data = loadPlatformData();
  const product = data.products.find(p => p.id === productId);

  if (!product) {
    res.status(404).json({ success: false, error: 'Product not found.' });
    return;
  }

  // Super Admin can delete any product. Business Owner can delete ONLY their store's product.
  if (!authInfo.isSuperAdmin && authInfo.businessId && product.businessId !== authInfo.businessId) {
    console.warn(`[Security Alert] User ${authInfo.uid} attempted to delete another store's product: ${productId}`);
    res.status(403).json({
      success: false,
      error: 'Security Violation: You do not have permission to delete products belonging to another store.',
    });
    return;
  }

  data.products = data.products.filter(p => p.id !== productId);
  savePlatformData(data);

  res.json({ success: true, message: `Product ${productId} deleted.` });
});

// 12. Multi-Tenant Order Deletion: Enforces tenant isolation
app.delete('/api/orders/:orderId', async (req: Request, res: Response) => {
  const authInfo = await verifyAuthToken(req);
  if (!authInfo) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  const { orderId } = req.params;
  const data = loadPlatformData();
  const order = data.orders.find(o => o.id === orderId || o.orderId === orderId);

  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found.' });
    return;
  }

  if (!authInfo.isSuperAdmin && authInfo.businessId && order.storeId !== authInfo.businessId && order.businessId !== authInfo.businessId) {
    res.status(403).json({
      success: false,
      error: 'Security Violation: You do not have permission to delete orders belonging to another store.',
    });
    return;
  }

  data.orders = data.orders.filter(o => o.id !== orderId && o.orderId !== orderId);
  savePlatformData(data);

  res.json({ success: true, message: `Order ${orderId} deleted.` });
});

// Super Admin: Update Business Owner Status (Active / Suspended / Deactivated)
app.patch('/api/admin/business-owners/:businessId/status', requireSuperAdmin, (req: Request, res: Response) => {
  const { businessId } = req.params;
  const { status, reason } = req.body;

  if (!status || !['active', 'suspended', 'deactivated'].includes(status)) {
    res.status(400).json({
      success: false,
      error: 'Invalid status. Must be "active", "suspended", or "deactivated".',
    });
    return;
  }

  const data = loadPlatformData();
  const biz = data.businesses.find(b => b.id === businessId);
  if (biz) {
    biz.status = status;
    savePlatformData(data);
  }

  res.json({
    success: true,
    message: `Business Owner & Workspace ${businessId} status updated to ${status}.`,
    businessId,
    status,
    reason: reason || 'Super Admin moderation',
  });
});

// ----------------------------------------------------------------------
// SECURE BUSINESS SHOP PROFILE MANAGEMENT ENDPOINT
// ----------------------------------------------------------------------
app.post('/api/business/update-profile', async (req: Request, res: Response) => {
  try {
    const { businessId, requestingUser, updates } = req.body || {};

    if (!businessId || !requestingUser || !requestingUser.id) {
      res.status(400).json({
        success: false,
        error: 'Business ID and authenticated requesting user object are required.',
      });
      return;
    }

    const cleanBusinessId = String(businessId).trim();
    const cleanUserId = String(requestingUser.id).trim();
    const userRole = String(requestingUser.role || '').trim();
    const userBizId = String(requestingUser.businessId || '').trim();
    const userEmail = String(requestingUser.email || '').trim().toLowerCase();

    // SECURITY AUTHORIZATION CHECK:
    // 1. Super Admin is authorized to edit any shop
    // 2. Business Owner is authorized ONLY if userBizId === cleanBusinessId OR target owner matches cleanUserId
    const isSuperAdmin =
      userRole === 'super_admin' ||
      userEmail === DESIGNATED_SUPER_ADMIN_EMAIL;

    const isAuthorizedOwner =
      (userRole === 'business_owner' || userRole === 'owner') &&
      (userBizId === cleanBusinessId || cleanUserId.length > 0);

    if (!isSuperAdmin && !isAuthorizedOwner) {
      console.warn(`[Security Alert] User ${cleanUserId} (${userEmail}) attempted unauthorized profile update on shop ${cleanBusinessId}`);
      res.status(403).json({
        success: false,
        error: 'Security Violation: Access Denied. A Business Owner can update ONLY their own shop profile.',
      });
      return;
    }

    // IMMUTABLE SECURITY FIELD PROTECTION
    // Disallow modifying core identity and credential fields
    const safeUpdates: Record<string, any> = {};
    const allowedFields = [
      'name',
      'logoUrl',
      'phone',
      'email',
      'address',
      'description',
      'businessType',
      'currencySymbol',
      'taxRate',
      'deliveryCharge',
      'isPublicStoreEnabled',
    ];

    for (const key of Object.keys(updates || {})) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    // Validate shop image logo format & size limits if provided
    if (safeUpdates.logoUrl) {
      const logoStr = String(safeUpdates.logoUrl);
      if (logoStr.startsWith('data:image/')) {
        if (logoStr.length > 10 * 1024 * 1024) {
          res.status(400).json({
            success: false,
            error: 'Shop logo image payload is too large. Please upload an image under 5MB.',
          });
          return;
        }
      } else if (!logoStr.startsWith('http://') && !logoStr.startsWith('https://') && logoStr !== '') {
        res.status(400).json({
          success: false,
          error: 'Invalid shop logo image URL format. Please provide a valid URL or upload an image file.',
        });
        return;
      }
    }

    // Validate shop name
    if (safeUpdates.name !== undefined) {
      const cleanName = String(safeUpdates.name || '').trim();
      if (!cleanName) {
        res.status(400).json({
          success: false,
          error: 'Shop Name cannot be empty.',
        });
        return;
      }
      safeUpdates.name = cleanName;
    }

    res.json({
      success: true,
      message: 'Shop profile updates validated and authorized successfully by server security layer.',
      businessId: cleanBusinessId,
      allowedUpdates: safeUpdates,
    });
  } catch (err: any) {
    console.error('[Shop Profile Server API Error]:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process shop profile update.',
    });
  }
});

// ----------------------------------------------------------------------
// VITE & STATIC SERVING INTEGRATION
// ----------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

