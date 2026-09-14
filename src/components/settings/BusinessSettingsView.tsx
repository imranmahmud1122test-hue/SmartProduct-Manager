import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { db } from '../../services/storage';
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
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [taxRate, setTaxRate] = useState<number>(5.0);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isPublicStoreEnabled, setIsPublicStoreEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staff management
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('pass123');
  const [staffRole, setStaffRole] = useState<'manager' | 'staff'>('staff');

  useEffect(() => {
    if (business) {
      setName(business.name);
      setCurrencySymbol(business.currencySymbol || '৳');
      setTaxRate(business.taxRate ?? 5.0);
      setPhone(business.phone || '');
      setEmail(business.email || '');
      setAddress(business.address || '');
      setIsPublicStoreEnabled(business.isPublicStoreEnabled ?? true);
    }

    // Load staff
    const users = db.getUsers().filter((u) => u.businessId === businessId);
    setStaffList(users);
  }, [business, businessId]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);

    if (!name.trim()) {
      setError('Business Name cannot be empty.');
      return;
    }

    try {
      const updated = db.updateBusiness(businessId, {
        name: name.trim(),
        currencySymbol: currencySymbol.trim() || '৳',
        taxRate: Number(taxRate) || 0,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        isPublicStoreEnabled,
      });

      onBusinessUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Business Settings & Security</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure store profile, currency, tax rates, staff accounts, and public catalog visibility.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Business Profile Settings */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-extrabold text-slate-900">Store Profile & Financial Settings</h3>
            </div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
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
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Private Business Identifier</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{businessId}</span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Tenant Isolated
              </span>
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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
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

            {/* Language Preference Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700">
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

              <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
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
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('save', 'Save Changes')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Staff & Access Management */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
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
