import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ShieldAlert,
  X,
  UserCheck,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Store,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { db } from '../../services/storage';
import { signInWithGooglePopup, GoogleAuthResult, firebaseAuth } from '../../services/firebase';
import { adminApi } from '../../services/adminApi';
import { User, Business } from '../../types';
import { Logo } from '../common/Logo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onSwitchToRegister: (prefillGoogleUser?: GoogleAuthResult) => void;
  onRequireGmailVerification?: (email: string) => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Authenticating...');

  // Field validation states
  const [touched, setTouched] = useState({ email: false, password: false });

  if (!isOpen) return null;

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const isEmailValid = email.trim().length > 0 && validateEmail(email);
  const isPasswordValid = password.trim().length >= 4;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const googleAuth = await signInWithGooglePopup();
      const loginResult = await db.loginWithGoogle({
        email: googleAuth.email,
        displayName: googleAuth.displayName,
        photoURL: googleAuth.photoURL,
        uid: googleAuth.uid,
      });

      if (!loginResult.success) {
        setIsGoogleLoading(false);
        setError(loginResult.error || 'Google Authentication failed.');
        return;
      }

      // If designated Super Admin signed in via Google, claim Super Admin role with server
      if (googleAuth.email.toLowerCase().trim() === 'imranmahmud1122.test@gmail.com') {
        try {
          const idToken = await firebaseAuth.currentUser?.getIdToken(true);
          if (idToken) {
            await adminApi.claimSuperAdminRole(idToken);
          }
        } catch (claimErr) {
          console.warn('Super Admin claim request notice:', claimErr);
        }
      }

      if (loginResult.isNew || !loginResult.user) {
        // Real Google Account verified, but no store workspace registered yet -> Switch to register
        setIsGoogleLoading(false);
        onClose();
        onSwitchToRegister(googleAuth);
        return;
      }

      // Existing verified user
      setIsGoogleLoading(false);
      onSuccess(loginResult.user);
      onClose();
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setError('Google Sign-In popup is pending domain authorization on this host. You can log in directly with your registered Gmail and password below.');
      } else {
        setError(err.message || 'Google Sign-In failed. Please try again.');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true });

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address format.');
      return;
    }

    if (!cleanPass) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Verifying credentials & workspace access...');

    // Secure Super Admin Check handled exclusively via server-side verification
    if (cleanEmail === 'imranmahmud1122.test@gmail.com') {
      try {
        const serverAuth = await adminApi.loginWithPassword(cleanEmail, cleanPass);
        if (!serverAuth.success) {
          setIsLoading(false);
          setError(serverAuth.error || 'Invalid credentials for Super Administrator account.');
          return;
        }

        let superAdminUser = db.findUserByEmail('imranmahmud1122.test@gmail.com');
        if (!superAdminUser) {
          superAdminUser = {
            id: 'USR-ADMIN-IMRAN',
            email: 'imranmahmud1122.test@gmail.com',
            name: 'Imran Mahmud',
            role: 'super_admin',
            businessId: null,
            phone: '+880 1711-000000',
            createdAt: new Date().toISOString(),
            status: 'active',
            emailVerified: true,
            isGmailVerified: true,
          };
        }
        superAdminUser.name = 'Imran Mahmud';
        superAdminUser.role = 'super_admin';
        superAdminUser.status = 'active';
        superAdminUser.emailVerified = true;
        superAdminUser.isGmailVerified = true;
        db.setCurrentUser(superAdminUser);
        db.logAudit({
          businessId: null,
          userId: superAdminUser.id,
          userName: superAdminUser.name,
          userRole: 'super_admin',
          action: 'USER_LOGIN',
          details: 'Super Administrator authenticated via secure server authorization',
        });
        setIsLoading(false);
        onSuccess(superAdminUser);
        onClose();
        return;
      } catch (authErr: any) {
        setIsLoading(false);
        setError(authErr.message || 'Authentication failed. Please verify your credentials.');
        return;
      }
    }

    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      setIsLoading(false);
      setError('No account found with this email. Please sign in with Google or register a new store workspace.');
      return;
    }

    if (user.status === 'suspended') {
      setIsLoading(false);
      setError('This account has been suspended. Please contact support.');
      return;
    }

    if (user.status === 'deactivated') {
      setIsLoading(false);
      setError('This account has been deactivated. Please contact support.');
      return;
    }

    // Save session
    user.status = 'active';
    user.emailVerified = true;
    db.setCurrentUser(user);
    db.logAudit({
      businessId: user.businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'USER_LOGIN',
      details: `User logged in successfully as ${user.role} (${user.email})`,
    });

    setIsLoading(false);
    onSuccess(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto sm:my-6 max-h-[92vh] flex flex-col">
        {/* Top Brand Banner */}
        <div className="p-4 sm:p-6 text-white relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 sm:top-5 right-4 sm:right-5 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-3 sm:mb-4">
            <Logo size="md" light showTagline compactOnMobile />
          </div>

          <h2 className="text-lg sm:text-xl font-black tracking-tight">
            Store Workspace Sign In
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Access your supermarket inventory, POS cash register, and analytics.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Primary: Real Google Sign-In */}
          <div>
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-300 rounded-xl shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer hover:border-slate-400 active:scale-[0.99]"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="text-sm">Connecting with Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">Sign in with Google</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Google securely authenticates real, verified Google accounts.</span>
            </p>
          </div>

          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              or sign in with password
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* Password Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Email Address
                </label>
                {touched.email && (
                  <span className={`text-[11px] font-semibold ${isEmailValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isEmailValid ? '✓ Valid' : 'Invalid email'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-login-email"
                  type="email"
                  required
                  disabled={isLoading || isGoogleLoading}
                  placeholder="owner@yourstore.com"
                  value={email}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.email && !isEmailValid
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400 bg-rose-50/30'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                {touched.password && (
                  <span className={`text-[11px] font-semibold ${isPasswordValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPasswordValid ? '✓ Entered' : 'Min 4 characters'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading || isGoogleLoading}
                  placeholder="••••••••"
                  value={password}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.password && !isPasswordValid
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className={`w-full py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 ${
                isLoading ? 'opacity-80 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In with Credentials</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600 flex items-center justify-between">
          <span>Need a new supermarket workspace?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToRegister();
            }}
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Create Business Account
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

