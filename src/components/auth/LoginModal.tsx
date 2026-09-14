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
  Store
} from 'lucide-react';
import { db } from '../../services/storage';
import { User } from '../../types';
import { Logo } from '../common/Logo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
}

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
  const [loadingText, setLoadingText] = useState('Authenticating...');

  // Field validation states
  const [touched, setTouched] = useState({ email: false, password: false });

  if (!isOpen) return null;

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const isEmailValid = email.trim().length > 0 && validateEmail(email);
  const isPasswordValid = password.trim().length >= 4;

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
      setError('Please enter a valid email address format (e.g., name@domain.com).');
      return;
    }

    if (!cleanPass) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Verifying credentials & workspace access...');

    // Short realistic authorization delay
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Automated Super Admin Check for imranmahmud1122.test@gmail.com with password 1122
    if (cleanEmail === 'imranmahmud1122.test@gmail.com') {
      if (cleanPass !== '1122') {
        setIsLoading(false);
        setError('Incorrect password for this account.');
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
        };
      }
      superAdminUser.role = 'super_admin';
      db.setCurrentUser(superAdminUser);
      db.logAudit({
        businessId: null,
        userId: superAdminUser.id,
        userName: superAdminUser.name,
        userRole: 'super_admin',
        action: 'USER_LOGIN',
        details: 'User authenticated with platform authorization',
      });
      setIsLoading(false);
      onSuccess(superAdminUser);
      onClose();
      return;
    }

    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      setIsLoading(false);
      setError('No account found with this email. Please check your credentials or create a new store workspace.');
      return;
    }

    if (user.status === 'suspended') {
      setIsLoading(false);
      setError('This account has been suspended. Please contact support.');
      return;
    }

    // Save session
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

  const autofillDemo = (type: 'metro' | 'metro_cashier' | 'valley') => {
    setError(null);
    if (type === 'metro') {
      setEmail('owner@metro.com');
      setPassword('metro123');
    } else if (type === 'metro_cashier') {
      setEmail('cashier@metro.com');
      setPassword('cashier123');
    } else if (type === 'valley') {
      setEmail('owner@freshvalley.com');
      setPassword('valley123');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Top Brand Banner */}
        <div className="p-6 text-white relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-4">
            <Logo size="md" light showTagline />
          </div>

          <h2 className="text-xl font-black tracking-tight">
            Store Workspace Sign In
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Access your supermarket inventory, POS cash register, and analytics.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Field with validation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Email Address
              </label>
              {touched.email && (
                <span className={`text-[11px] font-semibold ${isEmailValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {isEmailValid ? '✓ Valid format' : 'Invalid email format'}
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-login-email"
                type="email"
                required
                disabled={isLoading}
                placeholder="owner@metro.com"
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
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* Password Field with show/hide toggle */}
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
                disabled={isLoading}
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
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
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

          {/* Quick Demo Accounts */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                Store Demo Accounts:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                id="btn-autofill-metro"
                onClick={() => autofillDemo('metro')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl border border-emerald-200 font-medium text-left transition-all truncate"
              >
                <span className="font-bold block">Metro Owner</span>
                <span className="text-[10px] text-emerald-700">owner@metro.com</span>
              </button>
              <button
                type="button"
                id="btn-autofill-cashier"
                onClick={() => autofillDemo('metro_cashier')}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl border border-blue-200 font-medium text-left transition-all truncate"
              >
                <span className="font-bold block">Cashier Staff</span>
                <span className="text-[10px] text-blue-700">cashier@metro.com</span>
              </button>
              <button
                type="button"
                id="btn-autofill-valley"
                onClick={() => autofillDemo('valley')}
                className="col-span-full px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-xl border border-teal-200 font-medium text-left transition-all flex items-center justify-between"
              >
                <div>
                  <span className="font-bold block">Fresh Valley Organic</span>
                  <span className="text-[10px] text-teal-700">owner@freshvalley.com</span>
                </div>
                <span className="text-[10px] text-teal-700 font-mono">SHOP-002</span>
              </button>
            </div>
          </div>

          <button
            id="btn-submit-login"
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 ${
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
                <span>Sign In to Store Workspace</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600 flex items-center justify-between">
          <span>Need a new supermarket workspace?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToRegister();
            }}
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            Create Business Account
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
