import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  Mail,
  User as UserIcon,
  Phone,
  MapPin,
  Upload,
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  Image as ImageIcon,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { db } from '../../services/storage';
import { signInWithGooglePopup, GoogleAuthResult } from '../../services/firebase';
import { User, Business } from '../../types';
import { Logo } from '../common/Logo';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (business: Business, user: User) => void;
  onSwitchToLogin: () => void;
  prefillGoogleUser?: GoogleAuthResult | null;
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

export const RegisterBusinessModal: React.FC<RegisterBusinessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
  prefillGoogleUser,
}) => {
  const [googleUser, setGoogleUser] = useState<GoogleAuthResult | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [businessType, setBusinessType] = useState<Business['businessType']>('Supermarket');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Creating Supermarket Workspace...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual email/password fields - strictly empty by default to protect privacy
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset form whenever modal opens or switches
  useEffect(() => {
    if (isOpen) {
      if (prefillGoogleUser) {
        setGoogleUser(prefillGoogleUser);
        setOwnerName(prefillGoogleUser.displayName || '');
        setManualEmail(prefillGoogleUser.email || '');
        setManualPassword('');
        if (prefillGoogleUser.photoURL) {
          setLogoPreview(prefillGoogleUser.photoURL);
          setLogoUrl(prefillGoogleUser.photoURL);
        }
      } else {
        setGoogleUser(null);
        setOwnerName('');
        setBusinessName('');
        setManualEmail('');
        setManualPassword('');
        setShowPassword(false);
        setPhone('');
        setAddress('');
        setLogoUrl('');
        setLogoPreview(null);
        setError(null);
      }
    }
  }, [isOpen, prefillGoogleUser]);

  if (!isOpen) return null;

  const handleConnectGoogle = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const authResult = await signInWithGooglePopup();
      setGoogleUser(authResult);
      if (authResult.displayName && !ownerName) {
        setOwnerName(authResult.displayName);
      }
      if (authResult.email && !manualEmail) {
        setManualEmail(authResult.email);
      }
      if (authResult.photoURL && !logoUrl) {
        setLogoPreview(authResult.photoURL);
        setLogoUrl(authResult.photoURL);
      }
      setIsGoogleLoading(false);
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setError('Google Sign-In popup is pending domain authorization on this host. You can register and verify your Gmail address directly below.');
      } else {
        setError(err.message || 'Google Authentication failed. Please try again.');
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError('Image file must be less than 3MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setLogoUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setLogoPreview(null);
    setLogoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Please enter your Supermarket or Business Name.');
      return;
    }

    const activeGoogleUser = googleUser;
    const cleanEmail = (activeGoogleUser?.email || manualEmail || '').trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your Gmail address.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid Gmail or email address.');
      return;
    }

    if (!activeGoogleUser && !manualPassword.trim()) {
      setError('Please create your password for the account.');
      return;
    }

    const finalOwnerName = ownerName.trim() || activeGoogleUser?.displayName || cleanEmail.split('@')[0] || 'Store Owner';

    setIsLoading(true);
    setLoadingStep('Provisioning your store workspace & database partition...');

    try {
      if (activeGoogleUser && activeGoogleUser.uid) {
        // Authenticated with Google OAuth popup UID
        const { user, business } = await db.registerBusinessWithGoogle({
          googleUser: {
            email: activeGoogleUser.email,
            displayName: finalOwnerName,
            photoURL: activeGoogleUser.photoURL,
            uid: activeGoogleUser.uid.trim(),
          },
          businessName: businessName.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || 'Dhaka, Bangladesh',
          businessType,
          currencySymbol: currencySymbol.trim() || '৳',
          logoUrl: logoUrl.trim() || undefined,
        });

        setIsLoading(false);
        onClose();
        onSuccess(business, user);
      } else {
        // Direct Registration with Gmail or Account Email
        const { user, business } = await db.registerBusiness({
          ownerName: finalOwnerName,
          businessName: businessName.trim(),
          email: cleanEmail,
          password: manualPassword.trim() || '123456',
          phone: phone.trim() || undefined,
          address: address.trim() || 'Dhaka, Bangladesh',
          businessType,
          currencySymbol: currencySymbol.trim() || '৳',
          logoUrl: logoUrl.trim() || undefined,
          authProvider: cleanEmail.endsWith('@gmail.com') ? 'google' : 'password',
        });

        setIsLoading(false);
        onClose();
        onSuccess(business, user);
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Workspace registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-auto sm:my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 sm:top-5 right-4 sm:right-5 text-emerald-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-3">
            <Logo size="md" light showTagline compactOnMobile />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Register Supermarket Workspace</h2>
          <p className="text-xs text-emerald-200/90 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Verified authentication via Google Account. Instant store activation.
          </p>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} autoComplete="off" data-lpignore="true" className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Google Authentication Verification & Account Setup */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Owner Identity & Verification
              </span>
              {googleUser && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Google Verified Account
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3 min-w-0">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName}
                      className="w-10 h-10 rounded-full border border-emerald-300 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                      {googleUser.displayName?.[0] || 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {googleUser.displayName || 'Google Account'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate font-mono">
                      {googleUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  id="btn-register-google"
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isGoogleLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-300 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:border-slate-400"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span className="text-xs">Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span className="text-xs">One-Click Google Sign-In Verification</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Or Register With Your Gmail / Email Directly
                  </span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Owner Gmail / Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-reg-email"
                        name="owner_registration_email"
                        type="email"
                        required
                        disabled={isLoading}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-form-type="other"
                        placeholder="Enter your Gmail address"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="input-reg-password"
                        name="owner_registration_password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isLoading}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-form-type="other"
                        placeholder="Create your password"
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Store Workspace Details */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
              2. Supermarket Store Profile
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Owner Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Owner Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-reg-owner-name"
                    name="owner_full_name"
                    type="text"
                    required
                    disabled={isLoading}
                    autoComplete="off"
                    data-lpignore="true"
                    placeholder="Enter your full name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Supermarket / Business Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supermarket / Store Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-reg-business-name"
                    name="store_business_name"
                    type="text"
                    required
                    disabled={isLoading}
                    autoComplete="off"
                    data-lpignore="true"
                    placeholder="Enter store name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store / Business Type</label>
                <select
                  id="select-reg-business-type"
                  disabled={isLoading}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as Business['businessType'])}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                >
                  <option value="Supermarket">Supermarket & Mart</option>
                  <option value="Grocery Store">Grocery Store</option>
                  <option value="Electronics">Electronics Store</option>
                  <option value="Department Store">Department Store</option>
                  <option value="Organic Market">Organic Food Market</option>
                  <option value="Convenience Store">Convenience Store</option>
                  <option value="Wholesale Mart">Wholesale Mart</option>
                  <option value="Hypermarket">Hypermarket</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Primary Currency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Primary Currency</label>
                <select
                  id="select-reg-currency"
                  disabled={isLoading}
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                >
                  <option value="৳">৳ (BDT) - Bangladeshi Taka (Default)</option>
                  <option value="$">$ (USD) - US Dollar</option>
                  <option value="€">€ (EUR) - Euro</option>
                  <option value="₹">₹ (INR) - Indian Rupee</option>
                  <option value="£">£ (GBP) - British Pound</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                </select>
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-reg-phone"
                    name="contact_phone_number"
                    type="tel"
                    disabled={isLoading}
                    autoComplete="off"
                    data-lpignore="true"
                    placeholder="Enter phone number (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Store Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-reg-address"
                    name="store_location_address"
                    type="text"
                    disabled={isLoading}
                    autoComplete="off"
                    data-lpignore="true"
                    placeholder="Enter store address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logo Upload / Image Preview */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Store Logo / Branding (Optional)
            </label>
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs relative group">
                {logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute inset-0 bg-rose-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-700 rounded-xl shadow-2xs flex items-center gap-2 transition-all hover:bg-slate-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  {logoPreview ? 'Change Logo File' : 'Upload Store Logo (PNG / JPG)'}
                </button>
                <p className="text-[10px] text-slate-400 mt-1">Max size: 3MB. Square orientation recommended.</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-register"
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className={`w-full py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLoading ? 'opacity-85 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Supermarket Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600 shrink-0 flex items-center justify-between">
          <span>Already have a supermarket workspace?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToLogin();
            }}
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Sign In to Existing Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
