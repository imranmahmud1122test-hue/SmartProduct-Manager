import React, { useState, useEffect } from 'react';
import {
  Store,
  QrCode,
  ScanBarcode,
  TrendingUp,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  Search,
  Eye,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  ChevronRight,
  DollarSign,
  Activity,
  Sparkles,
  ShoppingBag,
  LifeBuoy,
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Business } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';
import { Logo } from '../common/Logo';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { HelpSupportModal } from '../common/HelpSupportModal';

interface PublicLandingProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onQuickLogin?: (role: 'metro_owner' | 'metro_cashier' | 'valley_owner') => void;
  currentUser?: any;
  onReturnToDashboard?: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({
  onOpenLogin,
  onOpenRegister,
  onQuickLogin,
  currentUser,
  onReturnToDashboard,
}) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [publicProducts, setPublicProducts] = useState<(Product & { businessName?: string })[]>([]);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [inspectProduct, setInspectProduct] = useState<(Product & { businessName?: string }) | null>(null);
  
  // Support modal state
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportModalTab, setSupportModalTab] = useState<'contact' | 'report'>('contact');
  
  const { t } = useLanguage();
  const supportSettings = db.getSupportSettings();

  const openSupport = (tab: 'contact' | 'report' = 'contact') => {
    setSupportModalTab(tab);
    setIsSupportOpen(true);
  };

  const waNumberClean = supportSettings.whatsappNumber.replace(/[^0-9]/g, '');

  useEffect(() => {
    setBusinesses(db.getBusinesses().filter((b) => b.status === 'active'));
    setPublicProducts(db.getPublicProducts());
  }, []);

  const filteredProducts = publicProducts.filter((p) => {
    if (selectedBusinessFilter !== 'ALL' && p.businessId !== selectedBusinessFilter) return false;
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = p.brand.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSku && !matchCat) return false;
    }
    return true;
  });

  const categories = ['ALL', ...Array.from(new Set(publicProducts.map((p) => p.category)))];

  const features = [
    {
      icon: <Layers className="w-6 h-6 text-emerald-600" />,
      title: 'Product & Stock Lifecycle',
      description: 'Strict transactional inventory model: Opening Stock + Received + Adjustments - Sales = Current Stock. Full audit trails for every unit movement.',
    },
    {
      icon: <ScanBarcode className="w-6 h-6 text-cyan-600" />,
      title: 'Live Barcode Scanner',
      description: 'Camera-based and hardware barcode scanning. Instant product retrieval, rapid POS checkout, and quick stock count replenishment.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-indigo-600" />,
      title: 'Dynamic QR Code Engine',
      description: 'Instant QR generation for every product. Download or print shelf tags and product labels with high-resolution vector encoding.',
    },
    {
      icon: <ShoppingBag className="w-6 h-6 text-emerald-600" />,
      title: 'High-Speed Supermarket POS',
      description: 'Rapid cash register with search-as-you-type, barcode auto-detection, cash/card/digital payments, automated stock decrement, and thermal receipt printing.',
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      title: 'Intelligent Low Stock Alerts',
      description: 'Automated velocity analysis recommending restock based on real daily sales run-rate and user-defined safety thresholds.',
    },
    {
      icon: <FileSpreadsheet className="w-6 h-6 text-blue-600" />,
      title: 'Executive Financial Reports',
      description: 'Real-time sales breakdown, product profit margins, supplier orders, inventory valuations, and CSV/PDF export capabilities.',
    },
    {
      icon: <Building2 className="w-6 h-6 text-teal-600" />,
      title: 'Strict Multi-Tenant Architecture',
      description: 'Dedicated isolated business workspaces (SHOP-001, SHOP-002). One business owner can never access another business’s stock or sales.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-violet-600" />,
      title: 'Enterprise Security & Audit Logs',
      description: 'Role-based access control, cryptographic session tokens, and tamper-evident audit trails for every inventory transaction and sale.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo size="md" showTagline={true} />
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <LanguageSwitcher variant="header" />

            <a
              href="#public-stock"
              className="hidden md:inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-100 transition-colors"
            >
              <Eye className="w-4 h-4 mr-1.5 text-slate-500" />
              {t('viewPublicCatalog', 'View Public Catalog')}
            </a>
            <button
              id="btn-nav-login"
              onClick={onOpenLogin}
              className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-xl transition-all cursor-pointer"
            >
              {t('signIn', 'Sign In')}
            </button>
            <button
              id="btn-nav-register"
              onClick={onOpenRegister}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {t('registerBusiness', 'Register Store')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200/60 bg-gradient-to-b from-emerald-50/40 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-6 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Multi-Business Cloud Supermarket & Retail OS
            </div>

            <div className="flex justify-center mb-6">
              <Logo size="xl" variant="full" showTagline={true} />
            </div>

            <p className="mt-4 text-lg sm:text-xl text-slate-600 font-normal leading-relaxed">
              Complete inventory control, barcode/QR tracking, real-time POS cash register, and tenant-isolated operations for supermarkets, grocery stores, and retail marts.
            </p>

            {/* Main Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                id="btn-hero-register"
                onClick={onOpenRegister}
                className="px-6 py-3.5 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 rounded-xl transition-all flex items-center gap-2"
              >
                <Store className="w-5 h-5" />
                Create Business Account
              </button>
              <button
                id="btn-hero-login"
                onClick={onOpenLogin}
                className="px-6 py-3.5 text-base font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm rounded-xl transition-all"
              >
                Login to Your Workspace
              </button>
              <a
                id="btn-hero-public-stock"
                href="#public-stock"
                className="px-6 py-3.5 text-base font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-2"
              >
                <Eye className="w-5 h-5" />
                View Public Products / Stock
              </a>
            </div>

            {/* Quick Demo Accounts Banner */}
            <div className="mt-10 p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 text-left max-w-2xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Quick Sandbox Access (1-Click Instant Login)
                </span>
                <span className="text-[11px] text-slate-400">Strict Tenant Separation</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  id="btn-quick-metro"
                  onClick={() => onQuickLogin?.('metro_owner')}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-600 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-400">Metro Supermarket</div>
                  <div className="text-[11px] text-slate-400">Owner (SHOP-001)</div>
                  <div className="text-[10px] text-emerald-500 font-mono mt-1">6 Products • POS Ready</div>
                </button>
                <button
                  id="btn-quick-cashier"
                  onClick={() => onQuickLogin?.('metro_cashier')}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-blue-950/80 border border-slate-700 hover:border-blue-600 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-slate-100 group-hover:text-blue-400">Rahim (Cashier Staff)</div>
                  <div className="text-[11px] text-slate-400">Terminal Checkout Role</div>
                  <div className="text-[10px] text-blue-400 font-mono mt-1">POS & Sales Register</div>
                </button>
                <button
                  id="btn-quick-valley"
                  onClick={() => onQuickLogin?.('valley_owner')}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-teal-950/80 border border-slate-700 hover:border-teal-600 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-slate-100 group-hover:text-teal-400">Fresh Valley Organics</div>
                  <div className="text-[11px] text-slate-400">Owner (SHOP-002)</div>
                  <div className="text-[10px] text-teal-400 font-mono mt-1">Isolated Tenant Data</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Capabilities Grid */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise Grade Supermarket Operations
            </h2>
            <p className="mt-3 text-slate-600">
              Built from the ground up with mathematical stock balance integrity, barcode hardware support, and multi-tenant security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 hover:bg-white hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Products & Stock Overview Section */}
      <section id="public-stock" className="py-16 lg:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-semibold mb-2">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                Public Catalog (Read-Only • Safe Permitted Stock)
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Public Stock & Product Overview
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Browse available stock from participating supermarkets. Private sales logs, cost prices, and business reports are strictly protected.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-public-register-banner"
                onClick={onOpenRegister}
                className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1"
              >
                List Your Supermarket
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-public-search"
                  type="text"
                  placeholder="Search products by name, brand, SKU, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Business Filter */}
              <div className="w-full md:w-64">
                <select
                  id="select-public-business"
                  value={selectedBusinessFilter}
                  onChange={(e) => setSelectedBusinessFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="ALL">All Supermarkets ({businesses.length})</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 font-semibold whitespace-nowrap pl-1">Category:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No public products match your search</h3>
              <p className="text-sm text-slate-500 mt-1">Try resetting the category filter or changing your keyword.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedBusinessFilter('ALL');
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                const inStock = product.currentStock > 0;
                const isLow = product.currentStock > 0 && product.currentStock <= product.minStockLevel;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col group"
                  >
                    {/* Image Container */}
                    <div className="relative h-48 bg-slate-100 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Package className="w-12 h-12 stroke-[1.5]" />
                        </div>
                      )}

                      {/* Store Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1">
                        <Store className="w-3 h-3 text-emerald-400" />
                        {product.businessName}
                      </div>

                      {/* Availability Tag */}
                      <div className="absolute top-3 right-3">
                        {inStock ? (
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              isLow
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isLow ? 'Limited Stock' : 'In Stock'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-emerald-600">{product.category}</span>
                        <span>SKU: {product.sku}</span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base line-clamp-1 mb-1">
                        {product.name}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">
                        {product.description || 'No description provided.'}
                      </p>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Public Retail Price</span>
                          <span className="text-lg font-extrabold text-slate-900">
                            {formatCurrency(product.sellingPrice)}
                          </span>
                          <span className="text-xs text-slate-500 font-normal"> / {product.unit}</span>
                        </div>

                        <button
                          onClick={() => setInspectProduct(product)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Public Inspect Product Modal */}
      {inspectProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="relative h-56 bg-slate-100">
              {inspectProduct.imageUrl ? (
                <img
                  src={inspectProduct.imageUrl}
                  alt={inspectProduct.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Package className="w-16 h-16 stroke-1" />
                </div>
              )}
              <button
                onClick={() => setInspectProduct(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {inspectProduct.category}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Store: <strong className="text-slate-800">{inspectProduct.businessName}</strong>
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 mb-2">{inspectProduct.name}</h2>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">{inspectProduct.description}</p>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Brand</span>
                  <span className="font-semibold text-slate-800">{inspectProduct.brand || 'Standard'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">SKU</span>
                  <span className="font-semibold text-slate-800">{inspectProduct.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Barcode</span>
                  <span className="font-mono font-semibold text-slate-800">{inspectProduct.barcode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Availability</span>
                  <span
                    className={`font-semibold ${
                      inspectProduct.currentStock > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {inspectProduct.currentStock > 0 ? `Available (${inspectProduct.currentStock} ${inspectProduct.unit})` : 'Out of Stock'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Public Retail Price</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatCurrency(inspectProduct.sellingPrice)}
                  </span>
                </div>

                <button
                  onClick={() => setInspectProduct(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <Logo size="md" light showTagline />
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart Product Manager (SPM) is a multi-tenant supermarket governance platform providing strict stock accounting, barcode POS, and live public catalogs.
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
                  24/7 Response for technical & account inquiries.
                </li>
              </ul>
            </div>

            {/* Col 4: Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">Platform Access</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onOpenLogin}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl text-left transition-colors cursor-pointer"
                >
                  Sign In to Workspace →
                </button>
                <button
                  onClick={onOpenRegister}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl text-left transition-colors cursor-pointer"
                >
                  Register New Supermarket →
                </button>
              </div>
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

      {/* Help & Support Modal */}
      <HelpSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        currentUser={currentUser}
        initialTab={supportModalTab}
      />
    </div>
  );
};
