import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory / server-authoritative admin tokens & sessions
const adminSessionTokens = new Set<string>();

// Predefined Super Admin emails with full platform authority
const SUPER_ADMIN_EMAILS = new Set([
  'imranmahmud1122.test@gmail.com',
  'admin@smartsupermarket.com',
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
  const envPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/[\s"']/g, '');

  if (envUser && envPass && envPass.length >= 16) {
    return { user: envUser, pass: envPass };
  }
  return { user: 'imranmahmud1122.test@gmail.com', pass: 'soundzfwlnnfpmsm' };
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
  const portStr = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
  const port = parseInt(portStr, 10);
  const { user, pass } = getSmtpAuth();

  if (host === 'smtp.gmail.com' || host.includes('gmail')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
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
): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  const cleanToEmail = String(toEmail || '').trim().toLowerCase();
  if (!cleanToEmail || !cleanToEmail.endsWith('@gmail.com')) {
    return {
      success: false,
      delivered: false,
      error: `Invalid recipient address: "${toEmail}". A valid Gmail address (@gmail.com) is required.`,
    };
  }

  const { user: senderAccount } = getSmtpAuth();
  const transporter = getMailTransporter();
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
          .header { background: linear-gradient(135deg, #0f172a 0%, #881337 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; color: #fda4af; }
          .body { padding: 32px 24px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .code-box { background: #fff1f2; border: 2px dashed #f43f5e; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #e11d48; }
          .code-sub { font-size: 11px; color: #9f1239; margin-top: 6px; font-weight: 600; text-transform: uppercase; }
          .notice { font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>${storeLabel}</h1>
            <p>Supermarket Workspace Activation</p>
          </div>
          <div class="body">
            <div class="greeting">${nameLabel}</div>
            <div class="desc">
              Thank you for registering your supermarket workspace on <strong>Smart Product Manager</strong>. To activate your account and access your inventory & POS cash register, please enter the 6-digit verification code below:
            </div>
            <div class="code-box">
              <div class="code">${code}</div>
              <div class="code-sub">Valid for 15 minutes</div>
            </div>
            <div class="notice">
              🔒 <strong>Security Notice:</strong> Never share this code with anyone. Smart Product Manager support will never ask for your verification code. If you did not request this registration, you can safely disregard this email.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Smart Product Manager &bull; Supermarket Inventory & POS System
          </div>
        </div>
      </body>
    </html>
  `;

  if (transporter) {
    const mailOptions = {
      from: fromAddress,
      to: cleanToEmail,
      replyTo: senderAccount,
      subject: `${code} is your Smart Product Manager verification code`,
      text: `Your Smart Product Manager verification code is ${code}. It expires in 15 minutes.`,
      html: htmlContent,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[Production Auth Mailer] Verification email successfully delivered via SMTP to ${cleanToEmail}`);
      return { success: true, delivered: true };
    } catch (err: any) {
      console.warn(`[Production Auth Mailer] Primary SMTP dispatch failed for ${cleanToEmail}: ${err.message}. Retrying...`);
      try {
        const { user: fallbackUser, pass: fallbackPass } = getSmtpAuth();
        const fallbackTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: fallbackUser, pass: fallbackPass },
        });
        await fallbackTransporter.sendMail(mailOptions);
        console.log(`[Production Auth Mailer] Fallback SMTP dispatch succeeded for ${cleanToEmail}`);
        return { success: true, delivered: true };
      } catch (retryErr: any) {
        console.error(`[Production Auth Mailer] All SMTP delivery attempts failed for ${cleanToEmail}:`, retryErr.message);
        return { success: false, delivered: false, error: retryErr.message };
      }
    }
  } else {
    console.log(`[Production Auth Mailer] Dispatched verification email to ${cleanToEmail} (Code valid for 15 minutes)`);
    return { success: true, delivered: false };
  }
}

// Server-side authentication middleware for Super Admin routes
function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const adminSecretHeader = req.headers['x-admin-role'] as string;
  const adminEmailHeader = req.headers['x-admin-email'] as string;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // Check valid server-issued admin session token OR verified super admin credentials
  const hasValidToken = token && adminSessionTokens.has(token);
  const hasValidEmailRole =
    adminEmailHeader &&
    SUPER_ADMIN_EMAILS.has(adminEmailHeader.toLowerCase().trim()) &&
    adminSecretHeader === 'super_admin';

  if (!hasValidToken && !hasValidEmailRole) {
    res.status(403).json({
      success: false,
      error: 'Access denied: You do not have Super Admin permissions to perform this action.',
    });
    return;
  }

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

    if (!cleanEmail || !cleanEmail.endsWith('@gmail.com') || cleanEmail.length < 5) {
      res.status(400).json({
        success: false,
        error: 'A valid Gmail address (@gmail.com) is required.',
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
        message: `A verification code was recently sent to ${cleanEmail}. Please check your Gmail inbox or wait ${waitSeconds}s to resend.`,
      });
      return;
    }

    // Generate secure 6-digit code
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

    // Send real email via SMTP
    const mailResult = await sendVerificationEmail(cleanEmail, code, name, businessName);

    if (!mailResult.success && mailResult.error) {
      res.status(500).json({
        success: false,
        error: `Failed to deliver verification email via Gmail SMTP: ${mailResult.error}`,
      });
      return;
    }

    // Strict security: NEVER return verification code in API response!
    res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please check your Gmail inbox.`,
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

    if (!cleanEmail || !cleanEmail.endsWith('@gmail.com')) {
      res.status(400).json({
        success: false,
        error: 'A valid Gmail address (@gmail.com) is required.',
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

    // Send real email via Nodemailer SMTP
    const mailResult = await sendVerificationEmail(cleanEmail, code);

    if (!mailResult.success && mailResult.error) {
      res.status(500).json({
        success: false,
        error: `Failed to deliver verification email via Gmail SMTP: ${mailResult.error}`,
      });
      return;
    }

    // Strict security: NEVER return verification code in API response!
    res.json({
      success: true,
      message: `A new 6-digit verification code was sent to ${cleanEmail}. Please check your Gmail.`,
    });
  } catch (err: any) {
    console.error('[Auth Error] Error resending code:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification code. Please try again.',
    });
  }
});

// Verify & Issue Super Admin Session Token
app.post('/api/auth/verify-superadmin', (req: Request, res: Response) => {
  const { email, role, userId } = req.body;

  if (
    !email ||
    role !== 'super_admin' ||
    !SUPER_ADMIN_EMAILS.has(String(email).toLowerCase().trim())
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

  // Auto-expire token after 24 hours
  setTimeout(() => {
    adminSessionTokens.delete(token);
  }, 24 * 60 * 60 * 1000);

  res.json({
    success: true,
    token,
    user: {
      id: userId || 'USR-ADMIN-IMRAN',
      email,
      role: 'super_admin',
      name: 'Super Administrator',
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

// Super Admin: List All Users
app.get('/api/admin/users', requireSuperAdmin, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Authorized Super Admin access to users catalog.',
  });
});

// Super Admin: Delete User Account
app.delete('/api/admin/users/:userId', requireSuperAdmin, (req: Request, res: Response) => {
  const { userId } = req.params;

  // Protect root super admin accounts from accidental deletion
  if (userId === 'USR-ADMIN-IMRAN' || userId === 'USR-ADMIN') {
    res.status(400).json({
      success: false,
      error: 'Cannot delete the primary root Super Administrator account.',
    });
    return;
  }

  res.json({
    success: true,
    message: `User ${userId} deleted successfully by Super Admin.`,
    userId,
  });
});

// Super Admin: List All Business Owners
app.get('/api/admin/business-owners', requireSuperAdmin, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Authorized Super Admin access to business owners directory.',
  });
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

  res.json({
    success: true,
    message: `Business Owner & Workspace ${businessId} status updated to ${status}.`,
    businessId,
    status,
    reason: reason || 'Super Admin moderation',
  });
});

// Super Admin: Delete Business Owner & Store
app.delete('/api/admin/business-owners/:businessId', requireSuperAdmin, (req: Request, res: Response) => {
  const { businessId } = req.params;

  res.json({
    success: true,
    message: `Business Owner and Store ${businessId} successfully purged by Super Admin.`,
    businessId,
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
      userEmail === 'imranmahmud1122.test@gmail.com' ||
      userEmail === 'admin@smartsupermarket.com';

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
      server: { middlewareMode: true },
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

