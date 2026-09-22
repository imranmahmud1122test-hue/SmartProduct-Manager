import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building2,
  Users,
  ShieldCheck,
  Globe,
  Lock,
  CheckCircle2,
  DollarSign,
  Percent,
  Plus,
  UserCheck,
  X,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { db } from '../../services/storage';
import { compressFile, compressImageDataUrl } from '../../utils/imageCompressor';
import { Business, User } from '../../types';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';

interface BusinessSettingsViewProps {
  businessId: string;
  business: Business | null;
  currentUser: User;
  onBusinessUpdated: (business: Business) => void;
}

export const BusinessSettingsView: React.FC<BusinessSettingsViewProps> = ({
  businessId,
  business,
  currentUser,
  onBusinessUpdated,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [taxRate, setTaxRate] = useState<number>(5.0);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [businessType, setBusinessType] = useState<Business['businessType']>('Supermarket');
  const [isPublicStoreEnabled, setIsPublicStoreEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Staff management
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('pass123');
  const [staffRole, setStaffRole] = useState<'manager' | 'staff'>('staff');

  useEffect(() => {
    const activeBiz =
      business ||
      db.getBusinessById(businessId) ||
      (currentUser.businessId === businessId
        ? {
            id: businessId,
            name: currentUser.businessName || 'My Store',
            ownerName: currentUser.name || 'Store Owner',
            ownerId: currentUser.id,
            email: currentUser.email,
            phone: '',
            address: '',
            businessType: 'Supermarket' as const,
            logoUrl: '',
            currencySymbol: '৳',
            taxRate: 5.0,
            status: 'active' as const,
            createdAt: new Date().toISOString(),
            isPublicStoreEnabled: true,
            emailVerified: true,
          }
        : null);

    if (activeBiz) {
      setName(activeBiz.name || '');
      setLogoUrl(activeBiz.logoUrl || '');
      setCurrencySymbol(activeBiz.currencySymbol || '৳');
      setTaxRate(activeBiz.taxRate ?? 5.0);
      setPhone(activeBiz.phone || '');
      setEmail(activeBiz.email || '');
      setAddress(activeBiz.address || '');
      setDescription(activeBiz.description || '');
      setBusinessType(activeBiz.businessType || 'Supermarket');
      setIsPublicStoreEnabled(activeBiz.isPublicStoreEnabled ?? true);
    }

    // Load staff
    const users = db.getUsers().filter((u) => u.businessId === businessId);
    setStaffList(users);
  }, [
    business?.id,
    business?.name,
    business?.logoUrl,
    business?.currencySymbol,
    business?.taxRate,
    business?.phone,
    business?.email,
    business?.address,
    business?.description,
    business?.businessType,
    business?.isPublicStoreEnabled,
    businessId,
    currentUser.businessId,
    currentUser.businessName,
  ]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Selected file is not a valid image format. Please select a PNG, JPG, or WEBP image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Shop logo image file must be smaller than 5MB.');
        return;
      }
      try {
        const compressed = await compressFile(file, 600, 600, 0.75);
        setLogoUrl(compressed);
      } catch (_) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    if (!name.trim()) {
      setError('Shop Name cannot be empty.');
      setIsSaving(false);
      return;
    }

    try {
      const finalLogoUrl = logoUrl ? await compressImageDataUrl(logoUrl, 600, 600, 0.75) : '';
      const updated = await db.updateShopProfile(
        businessId,
        {
          name: name.trim(),
          logoUrl: finalLogoUrl,
          currencySymbol: currencySymbol.trim() || '৳',
          taxRate: Number(taxRate) || 0,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          description: description.trim(),
          businessType,
          isPublicStoreEnabled,
        },
        currentUser
      );

      onBusinessUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('[Shop Profile Save Error]', err);
      setError(err.message || 'Failed to save shop profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;

    try {
      db.addUser({
        email: staffEmail.trim(),
        password: staffPassword.trim(),
        name: staffName.trim(),
        role: staffRole,
        businessId,
      });

      setIsAddStaffOpen(false);
      setStaffName('');
      setStaffEmail('');
      const users = db.getUsers().filter((u) => u.businessId === businessId);
      setStaffList(users);
    } catch (err: any) {
      setError(err.message || 'Failed to add staff.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Business Settings & Security</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure store profile, currency, tax rates, staff accounts, and public catalog visibility.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Business Profile Settings */}
        <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-extrabold text-slate-900">Store Profile & Financial Settings</h3>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-slate-800">
            {/* Business ID Read-only */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Private Business Identifier</span>
                <span className="font-mono font-bold text-slate-900 text-sm break-all">{businessId}</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-[11px] flex items-center gap-1 self-start sm:self-auto shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" /> Tenant Isolated
              </span>
            </div>

            {/* Business Logo Upload & Setting */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-2">Business / Store Logo</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Logo Preview */}
                <div className="relative shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Store Logo Preview"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-2xl flex items-center justify-center border border-slate-200 shadow-xs">
                      {name ? name.charAt(0).toUpperCase() : 'S'}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Upload Logo</span>
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Logo</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="url"
                      placeholder="Or paste direct logo image URL (e.g., https://...)"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    If no logo is set, your store will automatically use your initial letter as the fallback.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supermarket / Shop Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['৳', '$', '€', '₹', '£', 'AED'].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setCurrencySymbol(sym)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all ${
                        currencySymbol === sym
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Sales Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Business Type / Category</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as Business['businessType'])}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Supermarket">Supermarket & Mart</option>
                  <option value="Grocery Store">Grocery & Daily Essentials</option>
                  <option value="Organic Market">Fresh Organic Market</option>
                  <option value="Department Store">Departmental Store</option>
                  <option value="Wholesale & Retail">Wholesale & Retail Hub</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store About / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh organic groceries and daily essentials with fast home delivery."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Read-Only Security & Ownership Credentials Box */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Immutable Ownership Credentials
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  VERIFIED OWNER
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[10px]">Permanent Shop ID:</span>
                  <span className="font-mono font-bold text-white">{businessId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Owner User ID:</span>
                  <span className="font-mono font-bold text-white">{currentUser.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Owner Account Email:</span>
                  <span className="font-mono font-bold text-emerald-400">{currentUser.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Account Role:</span>
                  <span className="font-bold text-white uppercase">{currentUser.role}</span>
                </div>
              </div>
              <p className="text-slate-400 text-[10px] leading-relaxed pt-1 border-t border-slate-800/80">
                For security protection, permanent user ID, owner identity, user role, and verification status are strictly locked. You can update only your own shop profile details.
              </p>
            </div>

            {/* Language Preference Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('language', 'Language')} / ভাষা
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Select English or বাংলা for your store interface
                  </span>
                </div>
              </div>

              <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('bn')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    language === 'bn'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  বাংলা
                </button>
              </div>
            </div>

            {/* Public Store Visibility Toggle */}
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  {isPublicStoreEnabled ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('publicStoreCatalog', 'Public Catalog Visibility')}
                  </span>
                  <span className="text-[11px] text-slate-600 block">
                    {t('publicStoreDescription', 'Allow external shoppers to browse your product catalog and view live stock availability.')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPublicStoreEnabled(!isPublicStoreEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-end sm:self-auto ${
                  isPublicStoreEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublicStoreEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                {isSaving ? 'Saving Shop Profile...' : t('save', 'Save Shop Profile')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Staff & Access Management */}
        <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-extrabold text-slate-900">Staff Accounts</h3>
            </div>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Staff
            </button>
          </div>

          <div className="space-y-3">
            {staffList.map((st) => (
              <div
                key={st.id}
                className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-2xs">
                    {st.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">{st.name}</h5>
                    <span className="text-slate-400 text-[11px] block">{st.email}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      st.role === 'owner'
                        ? 'bg-purple-100 text-purple-800'
                        : st.role === 'manager'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {st.role}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tenant Isolation Info Box */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 text-xs space-y-1.5 mt-6">
            <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Tenant Isolation Security Policy
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              All staff members belonging to this store are strictly isolated within workspace <strong>{businessId}</strong>. They cannot access or see products, sales, or suppliers belonging to any other business owner on the platform.
            </p>
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Add New Staff Member</h3>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="alex@shop.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Permissions</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">Staff / Cashier (POS & Scanner)</option>
                  <option value="manager">Store Manager (Products, Stock & Reports)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
