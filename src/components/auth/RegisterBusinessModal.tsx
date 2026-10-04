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
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { db } from '../../services/storage';
import { GoogleAuthResult } from '../../services/firebase';
import { User, Business } from '../../types';
import { Logo } from '../common/Logo';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (business: Business, user: User) => void;
  onSwitchToLogin: () => void;
  prefillGoogleUser?: GoogleAuthResult | null;
}

export const RegisterBusinessModal: React.FC<RegisterBusinessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
  prefillGoogleUser,
}) => {
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
        setOwnerName(prefillGoogleUser.displayName || '');
        setManualEmail(prefillGoogleUser.email || '');
        setManualPassword('');
        if (prefillGoogleUser.photoURL) {
          setLogoPreview(prefillGoogleUser.photoURL);
          setLogoUrl(prefillGoogleUser.photoURL);
        }
      } else {
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

    const cleanOwnerName = ownerName.trim();
    if (!cleanOwnerName) {
      setError('Please enter your Full Name.');
      return;
    }

    const cleanBizName = businessName.trim();
    if (!cleanBizName) {
      setError('Please enter your Supermarket or Business Name.');
      return;
    }

    const cleanEmail = manualEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your Gmail address.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid Gmail or email address.');
      return;
    }

    const cleanPassword = manualPassword.trim();
    if (!cleanPassword) {
      setError('Please create your password for the account.');
      return;
    }

    if (cleanPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Provisioning your store workspace & database partition...');

    try {
      const { user, business } = await db.registerBusiness({
        ownerName: cleanOwnerName,
        businessName: cleanBizName,
        email: cleanEmail,
        password: cleanPassword,
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
            Fill up all boxes below to register your store. Instant workspace activation.
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

          {/* Section 1: Owner Identity & Account Credentials */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
              1. Owner Identity &amp; Credentials
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Owner Gmail / Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
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
                  <option value="Supermarket">Supermarket &amp; Mart</option>
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
              disabled={isLoading}
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
