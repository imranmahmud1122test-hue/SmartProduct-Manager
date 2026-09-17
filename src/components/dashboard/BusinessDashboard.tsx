import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  DollarSign,
  Plus,
  ScanBarcode,
  Truck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  History,
  ClipboardList,
  Trash2
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Sale, InventoryMovement, Business, User, Order } from '../../types';
import { formatCurrency, formatDate, computeProductStockAnalysis } from '../../utils/codeGenerators';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

interface BusinessDashboardProps {
  businessId: string;
  business: Business | null;
  currentUser: User;
  onNavigate: (tab: 'products' | 'orders' | 'pos' | 'scanner' | 'reports' | 'suppliers' | 'settings') => void;
  onOpenAddProduct: () => void;
  onOpenReceiveStock: (product?: Product) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenStockHistory: (product: Product) => void;
  onOpenStockAdjustment: (product?: Product) => void;
}

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  businessId,
  business,
  currentUser,
  onNavigate,
  onOpenAddProduct,
  onOpenReceiveStock,
  onOpenProductDetail,
  onOpenStockHistory,
  onOpenStockAdjustment,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentMovements, setRecentMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const syncFromCache = () => {
    const prods = db.getProducts(businessId);
    setProducts(prods);
    const sls = db.getSales(businessId);
    setSales(sls);
    const ords = db.getOrdersByOwner(currentUser.id, businessId);
    setOrders(ords);
    const movs = db.getMovements(businessId);
    setRecentMovements(movs.slice(0, 6));
  };

  const loadDashboardData = async () => {
    // 1. Synchronous initial render from local cache
    syncFromCache();

    // 2. Direct Firestore query by businessId for latest live products
    if (businessId) {
      try {
        setIsLoadingProducts(true);
        const liveProds = await db.fetchProductsFromFirestore(businessId);
        if (liveProds && liveProds.length > 0) {
          setProducts(liveProds);
        }
      } catch (err: any) {
        console.error('[BusinessDashboard] Error fetching products from Firestore:', err);
        const isPermission =
          err?.code === 'permission-denied' ||
          err?.message?.includes('permission-denied') ||
          err?.message?.includes('Missing or insufficient permissions');

        if (isPermission) {
          toast.security(
            `Unable to load products for store "${business?.name || businessId}". Firestore security rules prevented access.`,
            'Permission Denied'
          );
        }
      } finally {
        setIsLoadingProducts(false);
      }
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleStorageUpdate = () => {
      syncFromCache();
    };

    window.addEventListener('spm_storage_update', handleStorageUpdate);
    window.addEventListener('spm_order_update', handleStorageUpdate);
    return () => {
      window.removeEventListener('spm_storage_update', handleStorageUpdate);
      window.removeEventListener('spm_order_update', handleStorageUpdate);
    };
  }, [businessId, currentUser.id]);

  const handleDeleteMovement = (movId: string, productName: string) => {
    if (window.confirm(`Are you sure you want to delete this stock movement entry for "${productName}"?`)) {
      db.deleteMovement(movId);
      toast.success('Stock movement record deleted successfully.');
      syncFromCache();
    }
  };

  const currency = business?.currencySymbol || '৳';

  // Metrics calculation
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === 'active');
  const totalStockUnits = activeProducts.reduce((acc, p) => acc + (p.currentStock > 0 ? p.currentStock : 0), 0);
  const totalReceivedUnits = activeProducts.reduce((acc, p) => acc + p.totalReceived, 0);
  const totalSoldUnits = activeProducts.reduce((acc, p) => acc + p.totalSold, 0);
  const totalOpeningStock = activeProducts.reduce((acc, p) => acc + p.openingStock, 0);
  const totalAdjustments = activeProducts.reduce((acc, p) => acc + p.stockAdjustments, 0);

  // Today's metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter((s) => s.createdAt.startsWith(todayStr));
  const todayRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
  const todayUnitsSold = todaySales.reduce((acc, s) => acc + s.items.reduce((ia, item) => ia + item.quantity, 0), 0);

  // Online orders metrics
  const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending');
  const totalOrderRevenue = orders
    .filter((o) => o.orderStatus !== 'Cancelled')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  // Stock status lists
  const lowStockProducts = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel);
  const outOfStockProducts = activeProducts.filter((p) => p.currentStock <= 0);

  // Expiring soon (within next 30 days)
  const expiringProducts = activeProducts.filter((p) => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate);
    const now = new Date();
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 45;
  });

  // Best selling products
  const bestSellers = [...activeProducts].sort((a, b) => b.totalSold - a.totalSold).slice(0, 4);

  // New products added in the last 14 days
  const newProducts = activeProducts.filter((p) => {
    const d = new Date(p.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 14;
  });

  return (
    <div className="space-y-6">
      {/* Workspace Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-xs border border-white/15">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              {t('workspaceOverview', 'Private Business Workspace')}: {businessId}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              {business?.name || 'Supermarket Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-xl font-normal leading-relaxed">
              {t('welcomeBack', 'Welcome back')}, <strong className="text-white">{currentUser.name}</strong>. {t('dashboardSubtext', 'Real-time stock equation balancing and POS cash management are active.')}
            </p>
          </div>

          {/* Quick Action Station */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
            <button
              id="btn-dash-orders"
              onClick={() => onNavigate('orders')}
              className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Orders</span>
              {pendingOrders.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-amber-400 text-[10px] font-black">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              id="btn-dash-pos"
              onClick={() => onNavigate('pos')}
              className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" /> <span className="hidden xs:inline">{t('openPOS', 'Open POS')}</span><span className="xs:hidden">POS</span>
            </button>
            <button
              id="btn-dash-receive-stock"
              onClick={() => onOpenReceiveStock()}
              className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-4 h-4" /> {t('receiveStock', 'Receive Stock')}
            </button>
            <button
              id="btn-dash-add-product"
              onClick={onOpenAddProduct}
              className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t('addProduct', 'Add Product')}
            </button>
          </div>
        </div>
      </div>

      {/* CORE STOCK EQUATION OVERVIEW BAR (Prompt Mandate #3 & #8) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Total Store Inventory Equation</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Formula: Opening + Received + Adjustments - Sold = Remaining Current Stock
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenStockAdjustment()}
            className="text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust Stock
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 text-center">
          <div className="p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] sm:text-xs text-slate-500 block font-medium">Opening Stock</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800">{totalOpeningStock}</span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-0.5">initial units</span>
          </div>

          <div className="p-3 sm:p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
            <span className="text-[11px] sm:text-xs text-emerald-800 block font-medium">Received (+)</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700">+{totalReceivedUnits}</span>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 block mt-0.5">shipments</span>
          </div>

          <div className="p-3 sm:p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80">
            <span className="text-[11px] sm:text-xs text-amber-800 block font-medium">Adjustments (±)</span>
            <span className="text-xl sm:text-2xl font-black text-amber-700">
              {totalAdjustments >= 0 ? `+${totalAdjustments}` : totalAdjustments}
            </span>
            <span className="text-[10px] sm:text-[11px] text-amber-600 block mt-0.5">audits & writeoffs</span>
          </div>

          <div className="p-3 sm:p-4 bg-rose-50/60 rounded-2xl border border-rose-200/80">
            <span className="text-[11px] sm:text-xs text-rose-800 block font-medium">Total Sold (-)</span>
            <span className="text-xl sm:text-2xl font-black text-rose-700">-{totalSoldUnits}</span>
            <span className="text-[10px] sm:text-[11px] text-rose-600 block mt-0.5">via POS checkout</span>
          </div>

          <div className="col-span-2 sm:col-span-1 lg:col-span-1 p-3 sm:p-4 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-2xl border border-slate-800 shadow-md">
            <span className="text-[11px] sm:text-xs text-emerald-400 block font-bold">Remaining Current Stock</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{totalStockUnits}</span>
            <span className="text-[10px] sm:text-[11px] text-slate-300 block mt-0.5">active available units</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Online Orders Card */}
        <div
          onClick={() => onNavigate('orders')}
          className="p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block group-hover:text-amber-700">Online Orders</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">{orders.length}</span>
            <span className="text-[10px] sm:text-[11px] text-amber-600 font-bold">{pendingOrders.length} pending</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Total Products */}
        <div className="p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">Total Products</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">{totalProducts}</span>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-medium">+{newProducts.length} new items</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Today's Sales Revenue */}
        <div className="p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">Today's POS</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 block truncate">
              {formatCurrency(todayRevenue, currency)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">{todaySales.length} sales</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">Low Stock</span>
            <span className={`text-xl sm:text-2xl font-black mt-0.5 block ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {lowStockProducts.length}
            </span>
            <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium">Below safety</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">Out of Stock</span>
            <span className={`text-2xl font-black mt-0.5 block ${outOfStockProducts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {outOfStockProducts.length}
            </span>
            <span className="text-[11px] text-rose-600 font-medium">Needs urgent restock</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two-Column Section: Restock Recommendation Engine & Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Restock Recommendation Engine (Prompt Mandate #15) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-extrabold text-slate-900">Restock Recommendations</h3>
            </div>
            <span className="text-xs text-slate-400">Based on real sales run-rate</span>
          </div>

          <div className="space-y-3">
            {[...outOfStockProducts, ...lowStockProducts].slice(0, 4).length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                <span className="text-xs font-bold text-slate-700">All product stock levels are healthy</span>
                <p className="text-[11px] text-slate-400 mt-0.5">No immediate replenishment needed.</p>
              </div>
            ) : (
              [...outOfStockProducts, ...lowStockProducts].slice(0, 4).map((item) => {
                const analysis = computeProductStockAnalysis(item);

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 hover:bg-amber-50/40 rounded-2xl border border-slate-200/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300 m-auto mt-3" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Current Stock: <strong className="text-rose-600">{item.currentStock} {item.unit}</strong></span>
                          <span>•</span>
                          <span>Min: {item.minStockLevel} {item.unit}</span>
                          <span>•</span>
                          <span>Daily Sales: {analysis.dailySalesRate}/day</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${analysis.statusBadgeColor}`}>
                        {analysis.recommendation}
                      </span>
                      <button
                        onClick={() => onOpenReceiveStock(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                      >
                        + Restock
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Best Selling Products (Prompt Mandate #3 & #13) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-extrabold text-slate-900">Best Selling Products</h3>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Full Report →
            </button>
          </div>

          <div className="space-y-3">
            {bestSellers.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">
                    #{idx + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-slate-900 line-clamp-1">{item.name}</h5>
                    <span className="text-slate-400 text-[11px]">{item.category}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-emerald-700 block">
                    {item.totalSold} {item.unit} sold
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {formatCurrency(item.totalSold * item.sellingPrice, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Stock Movements Stream */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-extrabold text-slate-900">Recent Stock Movements</h3>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View All Ledger Movements <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentMovements.map((mov) => (
            <div
              key={mov.id}
              className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 relative group hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    mov.type === 'RECEIVING'
                      ? 'bg-emerald-100 text-emerald-800'
                      : mov.type === 'SALE'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {mov.type === 'RECEIVING' ? '+ INWARD LOAD' : mov.type === 'SALE' ? '- POS SALE' : mov.type}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">{formatDate(mov.createdAt)}</span>
                  <button
                    onClick={() => handleDeleteMovement(mov.id, mov.productName)}
                    title="Delete Stock Movement Record"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 line-clamp-1">{mov.productName}</h4>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                <span>Ref: {mov.referenceId || 'N/A'}</span>
                <span>
                  Prev: <strong>{mov.previousStock}</strong> → New: <strong className="text-emerald-700">{mov.newStock}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
