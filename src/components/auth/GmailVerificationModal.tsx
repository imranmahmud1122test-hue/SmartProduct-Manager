import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  ArrowRight,
  Inbox,
  Send,
  HelpCircle
} from 'lucide-react';
import { db } from '../../services/storage';
import { User, Business } from '../../types';

interface GmailVerificationModalProps {
  isOpen: boolean;
  email?: string;
  initialEmail?: string;
  onClose: () => void;
  onSuccess?: (user: User, business: Business | null) => void;
  onVerified?: (user: User, business: Business) => void;
  onSwitchToRegister?: () => void;
  onSwitchToLogin?: () => void;
}

export const GmailVerificationModal: React.FC<GmailVerificationModalProps> = ({
  isOpen,
  email,
  initialEmail,
  onClose,
  onSuccess,
  onVerified,
  onSwitchToRegister,
  onSwitchToLogin,
}) => {
  const [currentEmail, setCurrentEmail] = useState<string>(email || initialEmail || '');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      const target = (email || initialEmail || '').trim().toLowerCase();
      setCurrentEmail(target);
      setError(null);
      setDigits(['', '', '', '', '', '']);

      if (target && target.endsWith('@gmail.com')) {
        // Guarantee verification code is dispatched upon modal open
        fetch('/api/auth/send-verification-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: target }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setResendSuccess(data.message || `A 6-digit verification code was sent to ${target}. Please check your Gmail inbox (including Spam / Junk folders).`);
              setResendCooldown(data.retryAfter || 60);
            }
          })
          .catch((err) => {
            console.warn('Auto send code warning:', err);
            setResendSuccess(`A 6-digit verification code was sent to ${target}. Please check your Gmail inbox.`);
            setResendCooldown(60);
          });
      } else {
        setResendSuccess(null);
        setResendCooldown(0);
      }

      // Auto-focus first input box
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [isOpen, email, initialEmail]);

  // Resend countdown timer
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    if (error) setError(null);
    if (resendSuccess) setResendSuccess(null);

    // Filter only numeric input
    const cleanVal = value.replace(/\D/g, '');

    // Handling pasted multi-digit strings (e.g. 6 digits paste)
    if (cleanVal.length > 1) {
      const pastedDigits = cleanVal.slice(0, 6).split('');
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedDigits[i] || '';
      }
      setDigits(newDigits);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    // Auto move to next input
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedData[i] || '';
      }
      setDigits(newDigits);
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const enteredCode = digits.join('').trim();

    if (enteredCode.length !== 6) {
      setError('Please enter the 6-digit verification code sent to your Gmail inbox.');
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIdx = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
      inputRefs.current[targetIdx]?.focus();
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await db.verifyGmailCode(currentEmail, enteredCode);

      if (!result.success || !result.user) {
        setIsVerifying(false);
        setError(result.error || 'Invalid verification code. Please check your Gmail inbox or request a new code.');
        return;
      }

      setIsVerifying(false);
      if (onVerified && result.business) {
        onVerified(result.user, result.business);
      } else if (onSuccess) {
        onSuccess(result.user, result.business || null);
      }
      onClose();
    } catch (err: any) {
      setIsVerifying(false);
      setError(err.message || 'Verification failed. Please check your internet connection.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(null);

    try {
      const result = await db.resendGmailCode(currentEmail);
      setIsResending(false);

      if (result.success) {
        setResendCooldown(60);
        setResendSuccess(`A fresh 6-digit verification code was sent to ${currentEmail}.`);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Unable to resend code. Please try again shortly.');
      }
    } catch (err: any) {
      setIsResending(false);
      setError('Network error while resending verification code. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto sm:my-6 max-h-[95vh] flex flex-col">
        {/* Header with Gmail Accent */}
        <div className="p-4 bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-white text-rose-600 flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300">
              Mandatory Gmail Verification
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black tracking-tight">Verify Your Gmail Address</h2>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Your account remains inactive until your Gmail address is verified.
          </p>
        </div>

        {/* Body Form */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-slate-800">
          {/* Target Email Box */}
          <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Verification Code Sent To</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block font-mono">
                {currentEmail || 'yourname@gmail.com'}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-[11px] text-slate-600">
            <Inbox className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Please check your Gmail inbox and enter the 6-digit verification code sent from <strong>Smart Product Manager</strong>.
            </span>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="block font-semibold">{error}</span>
                {error.includes('expired') || error.includes('Invalid') || error.includes('not found') ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isResending || resendCooldown > 0}
                    className="mt-1 text-[11px] font-bold text-rose-800 underline hover:text-rose-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    Click here to resend a new verification email
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-start gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resendSuccess}</span>
            </div>
          )}

          {/* 6-Digit OTP Input Boxes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 text-center mb-1.5 uppercase tracking-wider">
              Enter 6-Digit Verification Code
            </label>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  id={`gmail-otp-input-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="w-9 h-11 sm:w-11 sm:h-12 text-center text-lg font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 transition-all shadow-2xs"
                />
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            id="btn-verify-gmail"
            disabled={isVerifying}
            onClick={() => handleVerify()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Activating Account...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify Gmail & Activate Account</span>
              </>
            )}
          </button>

          {/* Prominent Resend Verification Button & Box */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Send className="w-3 h-3 text-rose-600" />
                Didn't receive email?
              </span>
              <button
                type="button"
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <HelpCircle className="w-3 h-3" />
                {showTroubleshoot ? 'Hide tips' : 'Inbox tips'}
              </button>
            </div>

            <button
              type="button"
              id="btn-resend-verification"
              disabled={resendCooldown > 0 || isResending}
              onClick={handleResendCode}
              className={`w-full py-2 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                resendCooldown > 0 || isResending
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 shadow-2xs'
              }`}
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Sending New Verification Email...</span>
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend available in {resendCooldown}s</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>

            {showTroubleshoot && (
              <div className="pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 space-y-1">
                <p>&bull; Check your Gmail <strong>Spam</strong>, <strong>Junk</strong>, and <strong>Updates</strong> folders.</p>
                <p>&bull; Codes are valid for 15 minutes. If expired, click <strong>Resend Verification Email</strong> above.</p>
                <p>&bull; Make sure <em>{currentEmail}</em> is spelled accurately.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600 shrink-0 flex items-center justify-between">
          <span>Wrong Gmail address?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSwitchToRegister) onSwitchToRegister();
              else if (onSwitchToLogin) onSwitchToLogin();
            }}
            className="font-bold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Register with another Gmail
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

