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
  ExternalLink,
  Truck,
  Plus,
  Minus,
  SlidersHorizontal,
  CreditCard,
  MapPin,
  FileText
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Business, CartItem, Order } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';
import { Logo } from '../common/Logo';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { HelpSupportModal } from '../common/HelpSupportModal';
import { OrderModal } from './OrderModal';
import { OrderConfirmationModal } from './OrderConfirmationModal';
import { TrackOrderModal } from './TrackOrderModal';
import { CartDrawer } from './CartDrawer';

interface PublicLandingProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onQuickLogin?: (role: 'metro_owner' | 'valley_owner') => void;
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
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'stock'>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [inspectProduct, setInspectProduct] = useState<(Product & { businessName?: string }) | null>(null);

  // Cart and Order state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [directOrderProduct, setDirectOrderProduct] = useState<(Product & { businessName?: string }) | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [trackParams, setTrackParams] = useState<{ orderId?: string; phone?: string }>({});

  // Support modal state
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportModalTab, setSupportModalTab] = useState<'contact' | 'report'>('contact');

  const { t } = useLanguage();
  const supportSettings = db.getSupportSettings();

  const loadData = () => {
    setBusinesses(db.getBusinesses().filter((b) => b.status === 'active'));
    setPublicProducts(db.getPublicProducts());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('spm_storage_update', handleUpdate);
    window.addEventListener('spm_order_update', handleUpdate);
    return () => {
      window.removeEventListener('spm_storage_update', handleUpdate);
      window.removeEventListener('spm_order_update', handleUpdate);
    };
  }, []);

  const openSupport = (tab: 'contact' | 'report' = 'contact') => {
    setSupportModalTab(tab);
    setIsSupportOpen(true);
  };

  const waNumberClean = supportSettings.whatsappNumber.replace(/[^0-9]/g, '');

  // Cart operations
  const handleAddToCart = (product: Product & { businessName?: string }) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveCartItem(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Filter and sort products
  let filteredProducts = publicProducts.filter((p) => {
    if (selectedBusinessFilter !== 'ALL' && p.businessId !== selectedBusinessFilter) return false;
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (inStockOnly && p.currentStock <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      const matchStore = (p.businessName || '').toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSku && !matchCat && !matchStore) return false;
    }
    return true;
  });

  if (sortBy === 'price_asc') {
    filteredProducts = [...filteredProducts].sort((a, b) => a.sellingPrice - b.sellingPrice);
  } else if (sortBy === 'price_desc') {
    filteredProducts = [...filteredProducts].sort((a, b) => b.sellingPrice - a.sellingPrice);
  } else if (sortBy === 'stock') {
    filteredProducts = [...filteredProducts].sort((a, b) => b.currentStock - a.currentStock);
  }

  const categories = ['ALL', ...Array.from(new Set(publicProducts.map((p) => p.category)))];

  const features = [
    {
      icon: <Layers className="w-6 h-6 text-emerald-600" />,
      title: 'Unified Multi-Vendor Catalog',
      description: 'Customers can seamlessly browse, compare, and order from multiple verified supermarkets in one combined marketplace.',
    },
    {
      icon: <Truck className="w-6 h-6 text-indigo-600" />,
      title: 'Live Order Tracking',
      description: 'Transparent 6-stage order tracking (Pending, Confirmed, Packed, Ready, In Transit, Delivered) with phone verification.',
    },
    {
      icon: <ShoppingBag className="w-6 h-6 text-emerald-600" />,
      title: 'High-Speed Supermarket POS',
      description: 'Rapid cash register with search-as-you-type, barcode auto-detection, cash/card/digital payments, and thermal receipt printing.',
    },
    {
      icon: <ScanBarcode className="w-6 h-6 text-cyan-600" />,
      title: 'Live Barcode Scanner',
      description: 'Camera-based and hardware barcode scanning. Instant product retrieval, rapid checkout, and quick stock replenishment.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-indigo-600" />,
      title: 'Dynamic QR Code Engine',
      description: 'Instant QR generation for every product. Download or print shelf tags and product labels with high-resolution vector encoding.',
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      title: 'Intelligent Low Stock Alerts',
      description: 'Automated velocity analysis recommending restock based on real daily sales run-rate and user-defined safety thresholds.',
    },
    {
      icon: <Building2 className="w-6 h-6 text-teal-600" />,
      title: 'Strict Multi-Tenant Isolation',
      description: 'Dedicated business workspaces (SHOP-001, SHOP-002). One store owner can never view or modify another store’s private data.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-violet-600" />,
      title: 'Enterprise Security & Audits',
      description: 'Role-based access control, cryptographic session tokens, and tamper-evident audit trails for every order and transaction.',
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

            {/* Track Order Button */}
            <button
              onClick={() => {
                setTrackParams({});
                setIsTrackOrderOpen(true);
              }}
              className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-700 bg-slate-100/80 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4 mr-1.5 text-emerald-600" />
              Track Order
            </button>

            {/* Shopping Bag Drawer Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="View Shopping Bag"
            >
              <ShoppingBag className="w-5 h-5 text-slate-700" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center animate-bounce shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>

            {currentUser ? (
              <button
                onClick={onReturnToDashboard}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Go to Workspace ({currentUser.name})
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-200/60 bg-gradient-to-b from-emerald-50/40 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-6 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Multi-Vendor Supermarket Marketplace & Retail OS
            </div>

            <div className="flex justify-center mb-6">
              <Logo size="xl" variant="full" showTagline={true} />
            </div>

            <p className="mt-4 text-lg sm:text-xl text-slate-600 font-normal leading-relaxed">
              Order fresh products directly from top supermarkets with fast home delivery, or register your own supermarket to manage products, inventory, POS, and online sales.
            </p>

            {/* Main Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                id="btn-hero-public-stock"
                href="#public-stock"
                className="px-6 py-3.5 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 rounded-xl transition-all flex items-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Shop Products Online
              </a>
              <button
                onClick={() => {
                  setTrackParams({});
                  setIsTrackOrderOpen(true);
                }}
                className="px-6 py-3.5 text-base font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs rounded-xl transition-all flex items-center gap-2"
              >
                <Truck className="w-5 h-5 text-emerald-600" />
                Track an Order
              </button>
              <button
                id="btn-hero-register"
                onClick={onOpenRegister}
                className="px-6 py-3.5 text-base font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-2"
              >
                <Store className="w-5 h-5" />
                Register as Store Owner
              </button>
            </div>

            {/* Quick Demo Accounts Banner */}
            <div className="mt-10 p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 text-left max-w-2xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Quick Sandbox Access (1-Click Instant Login)
                </span>
                <span className="text-[11px] text-slate-400">Strict Tenant Separation</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  id="btn-quick-metro"
                  onClick={() => onQuickLogin?.('metro_owner')}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-600 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-400">Metro Supermarket</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/90 border border-emerald-800/60 px-1.5 py-0.5 rounded">SHOP-001</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">David Harris (Store Owner)</div>
                  <div className="text-[10px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                    <span>Full Store Management • POS Register • Inventory</span>
                  </div>
                </button>
                <button
                  id="btn-quick-valley"
                  onClick={() => onQuickLogin?.('valley_owner')}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-teal-950/80 border border-slate-700 hover:border-teal-600 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-teal-400">Fresh Valley Organics</span>
                    <span className="text-[10px] font-mono text-teal-400 bg-teal-950/90 border border-teal-800/60 px-1.5 py-0.5 rounded">SHOP-002</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Sarah Jenkins (Store Owner)</div>
                  <div className="text-[10px] text-teal-400 font-medium mt-1.5 flex items-center gap-1">
                    <span>Full Store Management • POS Register • Inventory</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Public Products & Marketplace Catalog Section */}
      <section id="public-stock" className="py-16 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                Live Multi-Vendor Supermarket Catalog
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Public Stock & Product Catalog
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Browse real-time available stock across all approved supermarkets. Click <strong>"Order Now"</strong> for fast direct checkout or add items to your shopping bag!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setTrackParams({});
                  setIsTrackOrderOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                Track Existing Order
              </button>

              <button
                id="btn-public-register-banner"
                onClick={onOpenRegister}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                List Your Supermarket
              </button>
            </div>
          </div>

          {/* Filters & Search Control Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="relative md:col-span-6">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-public-search"
                  type="text"
                  placeholder="Search products by name, brand, SKU, category, or store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Business / Store Selector */}
              <div className="md:col-span-3">
                <select
                  id="select-public-business"
                  value={selectedBusinessFilter}
                  onChange={(e) => setSelectedBusinessFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="ALL">All Stores ({businesses.length})</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting Selector */}
              <div className="md:col-span-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="stock">Highest Stock</option>
                </select>
              </div>
            </div>

            {/* Category Pills & In-Stock Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap pl-1">Category:</span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No products found</h3>
              <p className="text-sm text-slate-500 mt-1">Try resetting your filters or searching for another keyword.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setSelectedBusinessFilter('ALL');
                  setInStockOnly(false);
                }}
                className="mt-4 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl"
              >
                Reset All Filters
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
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col group justify-between"
                  >
                    <div>
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
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs">
                          <Store className="w-3 h-3 text-emerald-400" />
                          <span className="truncate max-w-28">{product.businessName}</span>
                        </div>

                        {/* Availability Tag */}
                        <div className="absolute top-3 right-3">
                          {inStock ? (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs ${
                                isLow
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {isLow ? `${product.currentStock} left (Low)` : `${product.currentStock} in stock`}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shadow-xs">
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 sm:p-5 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {product.category}
                          </span>
                          <span className="text-[11px] text-slate-400">SKU: {product.sku}</span>
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base line-clamp-1">
                          {product.name}
                        </h3>

                        <p className="text-xs text-slate-500 line-clamp-2 min-h-8">
                          {product.description || 'Verified supermarket fresh inventory item.'}
                        </p>

                        <div className="pt-2 flex items-baseline justify-between">
                          <div>
                            <span className="text-lg font-black text-slate-900">
                              {formatCurrency(product.sellingPrice)}
                            </span>
                            <span className="text-xs text-slate-400 font-normal"> / {product.unit}</span>
                          </div>
                          <button
                            onClick={() => setInspectProduct(product)}
                            className="text-xs font-semibold text-slate-500 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Order & Cart Action Bar */}
                    <div className="p-4 pt-0 grid grid-cols-2 gap-2 border-t border-slate-100 mt-2">
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!inStock}
                        className="w-full py-2 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
                        Add to Bag
                      </button>

                      <button
                        onClick={() => setDirectOrderProduct(product)}
                        disabled={!inStock}
                        className="w-full py-2 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Order Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              Built from the ground up with mathematical stock balance integrity, barcode hardware support, multi-vendor marketplace architecture, and multi-tenant isolation.
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

      {/* Public Inspect Product Modal */}
      {inspectProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 my-auto">
            <div className="relative w-full h-64 sm:h-72 bg-slate-100 shrink-0">
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
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-slate-900 transition-colors z-10"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {inspectProduct.category}
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-emerald-600" />
                    Store: <strong className="text-slate-800">{inspectProduct.businessName}</strong>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">{inspectProduct.name}</h2>
                
                {inspectProduct.description && inspectProduct.description.trim().length > 0 && (
                  <div className="mt-3 p-4 sm:p-4.5 bg-slate-50/90 border border-slate-200/90 rounded-2xl">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Product Details & Description
                    </div>
                    <div className="text-sm sm:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                      {inspectProduct.description}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">Brand</span>
                  <span className="font-semibold text-slate-800">{inspectProduct.brand || 'Standard'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">SKU</span>
                  <span className="font-semibold text-slate-800">{inspectProduct.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">Barcode</span>
                  <span className="font-mono font-semibold text-slate-800">{inspectProduct.barcode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">Stock Level</span>
                  <span
                    className={`font-semibold ${
                      inspectProduct.currentStock > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {inspectProduct.currentStock > 0 ? `${inspectProduct.currentStock} ${inspectProduct.unit}` : 'Out of Stock'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Unit Price</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatCurrency(inspectProduct.sellingPrice)}
                    <span className="text-xs text-slate-500 font-normal"> / {inspectProduct.unit}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      handleAddToCart(inspectProduct);
                      setInspectProduct(null);
                    }}
                    disabled={inspectProduct.currentStock <= 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-4 h-4 text-slate-600" />
                    Add to Bag
                  </button>

                  <button
                    onClick={() => {
                      setDirectOrderProduct(inspectProduct);
                      setInspectProduct(null);
                    }}
                    disabled={inspectProduct.currentStock <= 0}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Order Modal */}
      {directOrderProduct && (
        <OrderModal
          product={directOrderProduct}
          isOpen={!!directOrderProduct}
          onClose={() => setDirectOrderProduct(null)}
          onOrderSuccess={(order) => {
            setDirectOrderProduct(null);
            setConfirmedOrder(order);
          }}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCartItems([])}
        onCheckoutSuccess={(masterOrder) => {
          setIsCartOpen(false);
          setConfirmedOrder(masterOrder);
        }}
      />

      {/* Order Confirmation Celebration Modal */}
      <OrderConfirmationModal
        order={confirmedOrder}
        isOpen={!!confirmedOrder}
        onClose={() => setConfirmedOrder(null)}
        onTrackOrder={(orderId, phone) => {
          setConfirmedOrder(null);
          setTrackParams({ orderId, phone });
          setIsTrackOrderOpen(true);
        }}
      />

      {/* Live Track Order Modal */}
      <TrackOrderModal
        isOpen={isTrackOrderOpen}
        onClose={() => setIsTrackOrderOpen(false)}
        initialOrderId={trackParams.orderId}
        initialPhone={trackParams.phone}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <Logo size="md" light showTagline />
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart Product Manager (SPM) is a multi-vendor supermarket marketplace and retail OS providing stock control, barcode POS, and direct customer delivery.
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
