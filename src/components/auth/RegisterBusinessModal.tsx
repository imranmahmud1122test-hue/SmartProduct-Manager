import React, { useState, useRef } from 'react';
import {
  Store,
  Mail,
  User as UserIcon,
  Phone,
  MapPin,
  Lock,
  Upload,
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { db } from '../../services/storage';
import { User, Business } from '../../types';
import { Logo } from '../common/Logo';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (business: Business, user: User) => void;
  onSwitchToLogin: () => void;
}

export const RegisterBusinessModal: React.FC<RegisterBusinessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
}) => {
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [businessType, setBusinessType] = useState<Business['businessType']>('Supermarket');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Provisioning Workspace...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field validation tracking
  const [touched, setTouched] = useState({
    ownerName: false,
    businessName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  if (!isOpen) return null;

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const isEmailValid = email.trim().length > 0 && validateEmail(email);
  const isPasswordLengthValid = password.length >= 6;
  const isPasswordMatching = password.length > 0 && password === confirmPassword;

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
    setTouched({
      ownerName: true,
      businessName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    const cleanEmail = email.trim().toLowerCase();
    if (!ownerName.trim()) {
      setError('Please provide the Owner Full Name.');
      return;
    }
    if (!businessName.trim()) {
      setError('Please enter your Supermarket or Business Name.');
      return;
    }
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setError('Please enter a valid email address (e.g., owner@mart.com).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    const existing = db.findUserByEmail(cleanEmail);
    if (existing) {
      setError('An account with this email address already exists. Please log in instead.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Allocating isolated tenant partition...');

    await new Promise((resolve) => setTimeout(resolve, 400));
    setLoadingStep('Initializing POS cash register & barcode schema...');
    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      const { user, business } = db.registerBusiness({
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        email: cleanEmail,
        password: password.trim(),
        phone: phone.trim() || '+880 1700-000000',
        address: address.trim() || 'Dhaka, Bangladesh',
        businessType,
        currencySymbol: currencySymbol.trim() || '৳',
        logoUrl: logoUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80',
      });

      db.setCurrentUser(user);
      setIsLoading(false);
      onSuccess(business, user);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-emerald-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-3">
            <Logo size="md" light showTagline />
          </div>

          <h2 className="text-2xl font-black tracking-tight">Register New Supermarket Workspace</h2>
          <p className="text-xs text-emerald-200/90 mt-1">
            Create an independent, tenant-isolated inventory, barcode generator, and POS cash register portal.
          </p>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Owner Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Owner Full Name <span className="text-rose-500">*</span>
                </label>
                {touched.ownerName && ownerName.trim().length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600">✓ Valid</span>
                )}
              </div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-owner-name"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="e.g. David Harris"
                  value={ownerName}
                  onBlur={() => setTouched((prev) => ({ ...prev, ownerName: true }))}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.ownerName && !ownerName.trim()
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Business Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Supermarket / Store Name <span className="text-rose-500">*</span>
                </label>
                {touched.businessName && businessName.trim().length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600">✓ Valid</span>
                )}
              </div>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-business-name"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="e.g. Metro Supermarket & Mart"
                  value={businessName}
                  onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.businessName && !businessName.trim()
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Email Address (Login ID) <span className="text-rose-500">*</span>
                </label>
                {touched.email && (
                  <span className={`text-[11px] font-semibold ${isEmailValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isEmailValid ? '✓ Valid format' : 'Invalid email'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-email"
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="owner@supermarket.com"
                  value={email}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.email && !isEmailValid
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400 bg-rose-50/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-phone"
                  type="tel"
                  disabled={isLoading}
                  placeholder="+880 1812-345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="Supermarket">Supermarket & Mart</option>
                <option value="Grocery Store">Grocery Store</option>
                <option value="Department Store">Department Store</option>
                <option value="Organic Market">Organic Food Market</option>
                <option value="Convenience Store">Convenience Store</option>
                <option value="Wholesale Mart">Wholesale Mart</option>
                <option value="Hypermarket">Hypermarket</option>
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-address"
                  type="text"
                  disabled={isLoading}
                  placeholder="e.g. Gulshan 2 Commercial Area, Dhaka"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Password <span className="text-rose-500">*</span>
                </label>
                {touched.password && (
                  <span className={`text-[11px] font-semibold ${isPasswordLengthValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPasswordLengthValid ? '✓ Strong' : 'Min 6 chars'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  placeholder="At least 6 characters"
                  value={password}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.password && !isPasswordLengthValid
                      ? 'border-amber-300 focus:ring-2 focus:ring-amber-400'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                {touched.confirmPassword && (
                  <span className={`text-[11px] font-semibold ${isPasswordMatching ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isPasswordMatching ? '✓ Matched' : 'Does not match'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white text-slate-900 transition-all ${
                    touched.confirmPassword && !isPasswordMatching
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-400 bg-rose-50/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Logo Upload / Image Preview */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Store Logo & Branding (Optional)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs relative group">
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
                  <ImageIcon className="w-7 h-7 text-slate-300" />
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
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-700 rounded-xl shadow-2xs flex items-center gap-2 transition-all hover:bg-slate-50"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  {logoPreview ? 'Change Logo File' : 'Upload Store Logo (PNG / JPG)'}
                </button>
                <p className="text-[11px] text-slate-400 mt-1.5">Max size: 3MB. Square orientation recommended.</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-register"
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 rounded-2xl transition-all flex items-center justify-center gap-2 ${
                isLoading ? 'opacity-85 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Create Supermarket Workspace & Launch</span>
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
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            Sign In to Existing Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
