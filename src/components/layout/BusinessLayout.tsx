import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ScanBarcode,
  Truck,
  FileText,
  Settings,
  LogOut,
  Building2,
  Globe,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Plus,
  LifeBuoy,
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  AlertTriangle,
  ExternalLink,
  ClipboardList
} from 'lucide-react';
import { Business, User } from '../../types';
import { Logo } from '../common/Logo';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { HelpSupportModal } from '../common/HelpSupportModal';
import { db } from '../../services/storage';

interface BusinessLayoutProps {
  business: Business | null;
  currentUser: User;
  activeTab: 'dashboard' | 'products' | 'orders' | 'pos' | 'scanner' | 'reports' | 'suppliers' | 'settings';
  onNavigate: (tab: 'dashboard' | 'products' | 'orders' | 'pos' | 'scanner' | 'reports' | 'suppliers' | 'settings') => void;
  onLogout: () => void;
  onOpenPublicView: () => void;
  onOpenAddProduct: () => void;
  isSuperAdminSwitched?: boolean;
  onReturnToSuperAdmin?: () => void;
  children: React.ReactNode;
}

export const BusinessLayout: React.FC<BusinessLayoutProps> = ({
  business,
  currentUser,
  activeTab,
  onNavigate,
  onLogout,
  onOpenPublicView,
  onOpenAddProduct,
  isSuperAdminSwitched,
  onReturnToSuperAdmin,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportModalTab, setSupportModalTab] = useState<'contact' | 'report'>('contact');
  const { t } = useLanguage();

  const supportSettings = db.getSupportSettings();

  const pendingOrdersCount = React.useMemo(() => {
    if (!business) return 0;
    const orders = db.getOrdersByOwner(currentUser.id, business.id);
    return orders.filter((o) => o.orderStatus === 'Pending').length;
  }, [business, currentUser.id]);

  const openSupport = (tab: 'contact' | 'report' = 'contact') => {
    setSupportModalTab(tab);
    setIsSupportOpen(true);
  };

  const navItems = [
    { id: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'products', label: t('productsAndStock', 'Products & Stock'), icon: Package },
    { id: 'orders', label: 'Orders', icon: ClipboardList, badge: pendingOrdersCount },
    { id: 'pos', label: t('posRegister', 'POS Register'), icon: ShoppingBag },
    { id: 'scanner', label: t('barcodeScanner', 'Barcode Scanner'), icon: ScanBarcode },
    { id: 'suppliers', label: t('suppliers', 'Suppliers'), icon: Truck },
    { id: 'reports', label: t('reportsAndAudits', 'Reports & Audits'), icon: FileText },
    { id: 'settings', label: t('storeSettings', 'Store Settings'), icon: Settings },
  ] as const;

  const waNumberClean = supportSettings.whatsappNumber.replace(/[^0-9]/g, '');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Super Admin Switch Notice (if active) */}
      {isSuperAdminSwitched && (
        <div className="bg-purple-900 text-purple-100 text-xs py-2 px-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-purple-700 px-2 py-0.5 rounded-sm uppercase tracking-wider">
              {t('superAdminView', 'Super Admin View')}
            </span>
            <span>{t('managingWorkspace', 'You are managing workspace')} <strong>{business?.name}</strong> ({business?.id}).</span>
          </div>
          <button
            onClick={onReturnToSuperAdmin}
            className="px-3 py-1 bg-white text-purple-900 font-bold rounded-lg text-xs hover:bg-purple-50 transition-colors cursor-pointer"
          >
            {t('returnToSuperAdmin', '← Return to Super Admin Hub')}
          </button>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Store Identity */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <Logo size="sm" variant="mark" />
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                    {business?.name || t('brandName', 'Smart Product Manager')}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {business?.id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  {t('brandTagline', 'Smart Stock | Smart Business')} • {business?.id}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Station */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Switcher */}
            <LanguageSwitcher variant="header" />

            {/* Public Store Preview Link */}
            <button
              onClick={onOpenPublicView}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={t('viewPublicCatalog', 'View public stock page')}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">{t('publicCatalog', 'Public Stock Page')}</span>
            </button>

            {/* Quick Add Product Button */}
            <button
              onClick={onOpenAddProduct}
              className="hidden sm:flex px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t('addProduct', 'Product')}
            </button>

            {/* User Profile Card & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-emerald-400 font-bold text-xs flex items-center justify-center shadow-2xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight">{currentUser.name}</span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">{currentUser.role}</span>
              </div>
              <button
                onClick={onLogout}
                title={t('logout', 'Sign out of account')}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar */}
        <div className="hidden lg:block border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {'badge' in item && typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex">
          <div className="w-64 bg-white h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="font-extrabold text-sm text-slate-900">SPM Menu</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={() => {
                  openSupport('contact');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2 px-3 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <LifeBuoy className="w-4 h-4 text-emerald-600" /> Help & Support (সাহায্য)
              </button>

              <div className="flex justify-between items-center px-1 mb-2">
                <span className="text-xs text-slate-500 font-semibold">{t('language', 'Language')}</span>
                <LanguageSwitcher variant="pill" />
              </div>

              <button
                onClick={() => {
                  onOpenPublicView();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2 px-3 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-600" /> {t('publicCatalog', 'Public Stock Page')}
              </button>
              <button
                onClick={onLogout}
                className="w-full py-2 px-3 bg-rose-50 text-rose-700 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> {t('logout', 'Log Out')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>

      {/* Comprehensive Professional Help & Support Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 py-10 mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <Logo size="sm" light showTagline />
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart Product Manager (SPM) is a full-stack multi-tenant supermarket & retail inventory management ecosystem.
              </p>
            </div>

            {/* Col 2: Help & Support Links */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4" /> Help & Support (সাহায্য)
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => openSupport('contact')}
                    className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Contact Support Center</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openSupport('report')}
                    className="hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Report a Problem (সমস্যা রিপোর্ট)</span>
                  </button>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${waNumberClean}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>WhatsApp Support ({supportSettings.whatsappNumber})</span>
                  </a>
                </li>
                <li>
                  <a
                    href={supportSettings.facebookMessengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-400 transition-colors flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>Facebook Messenger Support</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Direct Contact Hotlines */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Phone className="w-4 h-4" /> Direct Contact
              </h3>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-rose-400" />
                  <span>Email: {supportSettings.supportEmail}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hotline: {supportSettings.supportPhone}</span>
                </li>
                <li className="text-[11px] text-slate-500 pt-1">
                  Support hours: Sat - Thu (9:00 AM - 9:00 PM)
                </li>
              </ul>
            </div>

            {/* Col 4: Quick Action Box */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Need Quick Technical Help?
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Facing login, product barcode, or receipt print issues? Submit a problem report for immediate callback.
              </p>
              <button
                onClick={() => openSupport('report')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Submit Support Ticket</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} Smart Product Manager (SPM). All rights reserved.</p>
            <div className="flex items-center space-x-4">
              <button onClick={() => openSupport('contact')} className="hover:text-slate-300 cursor-pointer">
                WhatsApp Support
              </button>
              <span>•</span>
              <button onClick={() => openSupport('contact')} className="hover:text-slate-300 cursor-pointer">
                Messenger Support
              </button>
              <span>•</span>
              <button onClick={() => openSupport('report')} className="hover:text-slate-300 cursor-pointer">
                Report a Problem
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Help & Support Modal */}
      <HelpSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        currentUser={currentUser}
        currentBusiness={business}
        initialTab={supportModalTab}
      />
    </div>
  );
};
