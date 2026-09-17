import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Edit,
  Eye,
  History,
  Truck,
  SlidersHorizontal,
  QrCode,
  Globe,
  Lock,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Tag,
  Plus,
  PackagePlus,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Business, User } from '../../types';
import { formatCurrency, formatShortDate } from '../../utils/codeGenerators';
import { printProductCatalog } from '../../utils/printHelper';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { BulkImportModal } from './BulkImportModal';

interface ProductListProps {
  businessId: string;
  business: Business | null;
  currentUser: User;
  dataVersion?: number;
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenStockHistory: (product: Product) => void;
  onOpenReceiveStock: (product: Product) => void;
  onOpenStockAdjustment: (product: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  businessId,
  business,
  currentUser,
  dataVersion,
  onOpenAddProduct,
  onOpenEditProduct,
  onOpenProductDetail,
  onOpenStockHistory,
  onOpenReceiveStock,
  onOpenStockAdjustment,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'created'>('name');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const loadProducts = async () => {
    // Immediate initial sync render from local cache
    const list = db.getProducts(businessId);
    setProducts(list);

    // Direct Firestore query using businessId
    if (businessId) {
      try {
        setIsRefreshing(true);
        const liveProducts = await db.fetchProductsFromFirestore(businessId);
        if (liveProducts && liveProducts.length > 0) {
          setProducts(liveProducts);
        } else {
          setProducts(db.getProducts(businessId));
        }
      } catch (err: any) {
        console.error('[ProductList] Firestore query error:', err);
        const isPermission =
          err?.code === 'permission-denied' ||
          err?.message?.includes('permission-denied') ||
          err?.message?.includes('Missing or insufficient permissions');

        if (isPermission) {
          toast.security(
            `Unable to retrieve product inventory for store "${business?.name || businessId}". Access was rejected by Firestore security rules.`,
            'Permission Denied'
          );
        }
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadProducts();

    const handleStorageUpdate = () => {
      setProducts(db.getProducts(businessId));
    };

    window.addEventListener('spm_storage_update', handleStorageUpdate);
    window.addEventListener('spm_product_update', handleStorageUpdate);
    return () => {
      window.removeEventListener('spm_storage_update', handleStorageUpdate);
      window.removeEventListener('spm_product_update', handleStorageUpdate);
    };
  }, [businessId, dataVersion]);

  const currency = business?.currencySymbol || '৳';
  const categories = ['ALL', ...db.getCategories()];

  const handleDeleteConfirm = async () => {
    if (productToDelete) {
      try {
        setIsDeleting(true);
        await db.deleteProduct(businessId, productToDelete.id, currentUser);
        toast.success(`Product "${productToDelete.name}" was permanently deleted.`);
        setProductToDelete(null);
        await loadProducts();
      } catch (err: any) {
        console.error('Failed to delete product:', err);
        toast.error(err?.message || 'Failed to delete product.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const filteredProducts = products.filter((p) => {
    if (p.status === 'archived') return false;

    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;

    if (stockFilter === 'IN_STOCK' && p.currentStock <= p.minStockLevel) return false;
    if (stockFilter === 'LOW_STOCK' && (p.currentStock <= 0 || p.currentStock > p.minStockLevel)) return false;
    if (stockFilter === 'OUT_OF_STOCK' && p.currentStock > 0) return false;

    const isProdPublic = p.isPublished !== undefined ? p.isPublished : (p.isPublic ?? true);
    if (visibilityFilter === 'PUBLIC' && !isProdPublic) return false;
    if (visibilityFilter === 'PRIVATE' && isProdPublic) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode.toLowerCase().includes(q);
      const matchBrand = p.brand?.toLowerCase().includes(q);
      const matchSupplier = p.supplier?.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchBarcode && !matchBrand && !matchSupplier) return false;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'stock_asc') return a.currentStock - b.currentStock;
    if (sortBy === 'stock_desc') return b.currentStock - a.currentStock;
    if (sortBy === 'price_desc') return b.sellingPrice - a.sellingPrice;
    if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const exportToCSV = () => {
    const headers = ['Product ID', 'Name', 'SKU', 'Barcode', 'Category', 'Brand', 'Purchase Price', 'Selling Price', 'Opening Stock', 'Received', 'Sold', 'Adjustments', 'Current Stock', 'Unit', 'Supplier', 'Expiry Date'];
    const rows = sortedProducts.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      p.barcode,
      p.category,
      p.brand || '',
      p.purchasePrice,
      p.sellingPrice,
      p.openingStock,
      p.totalReceived,
      p.totalSold,
      p.stockAdjustments,
      p.currentStock,
      p.unit,
      p.supplier || '',
      p.expiryDate || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${business?.slug || 'store'}_inventory_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{t('productCatalogTitle', 'Product Catalog & Inventory')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('productCatalogSubtitle', 'Manage product master data, pricing, live balances, QR barcodes, and stock movements.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCSV}
            className="px-3 py-2 sm:px-3.5 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> <span className="hidden xs:inline">{t('exportCSV', 'Export CSV')}</span><span className="xs:hidden">CSV</span>
          </button>
          <button
            onClick={() => printProductCatalog(products, business)}
            className="px-3 py-2 sm:px-3.5 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer no-print"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" /> <span className="hidden xs:inline">{t('print', 'Print / Save PDF')}</span><span className="xs:hidden">Print</span>
          </button>
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="px-3 py-2 sm:px-3.5 sm:py-2.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer no-print"
            title="Bulk Import Products via CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> <span className="hidden xs:inline">Bulk Import</span><span className="xs:hidden">Import</span>
          </button>
          <button
            id="btn-add-new-product"
            onClick={onOpenAddProduct}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('addProduct', 'Add Product')}
          </button>
        </div>
      </div>

      {/* Filter & Search Tooling Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-2 md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name, SKU, barcode, brand, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-1 md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Filter */}
          <div className="sm:col-span-1 md:col-span-2">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Stock: All</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-2 md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="stock_asc">Stock: Low to High</option>
              <option value="stock_desc">Stock: High to Low</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="created">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Visibility Quick Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-semibold text-slate-700">Visibility:</span>
            <button
              onClick={() => setVisibilityFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                visibilityFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setVisibilityFilter('PUBLIC')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                visibilityFilter === 'PUBLIC' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-3 h-3" /> Public
            </button>
            <button
              onClick={() => setVisibilityFilter('PRIVATE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                visibilityFilter === 'PRIVATE' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Lock className="w-3 h-3" /> Private
            </button>
          </div>

          <span className="text-[11px] text-slate-400 sm:text-right">
            Showing <strong>{sortedProducts.length}</strong> of <strong>{products.length}</strong> products
          </span>
        </div>
      </div>

      {/* Mobile Card View (Optimized for Android & iPhone) */}
      <div className="block lg:hidden space-y-3">
        {sortedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p className="text-sm font-semibold text-slate-600">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting your search query or filters.</p>
          </div>
        ) : (
          sortedProducts.map((p) => {
            const isLow = p.currentStock > 0 && p.currentStock <= p.minStockLevel;
            const isOut = p.currentStock <= 0;

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
              >
                {/* Top Row: Thumbnail, Name, Category, Stock Status */}
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400 stroke-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold truncate">
                        {p.category}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          isOut
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isLow ? `Low: ${p.currentStock}` : `${p.currentStock} ${p.unit}`}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm mt-1 truncate">
                      {p.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      SKU: <span className="font-mono text-slate-600 font-bold">{p.sku}</span> • {p.barcode}
                    </p>
                  </div>
                </div>

                {/* Middle Row: Pricing & Stock Equation */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Retail Price</span>
                    <span className="font-black text-emerald-700 text-sm">{formatCurrency(p.sellingPrice, currency)}</span>
                    <span className="text-[10px] text-slate-400 ml-1">Cost: {formatCurrency(p.purchasePrice, currency)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Inventory Balance</span>
                    <span className="font-bold text-slate-800 text-xs">{p.currentStock} {p.unit}</span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      Op:{p.openingStock} + In:{p.totalReceived} - Out:{p.totalSold}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Quick Action Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenProductDetail(p)}
                      title="View Product & QR / Barcode Label"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px]">Barcode</span>
                    </button>
                    <button
                      onClick={() => onOpenReceiveStock(p)}
                      title="Receive Shipment"
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Receive</span>
                    </button>
                    <button
                      onClick={() => onOpenStockAdjustment(p)}
                      title="Stock Adjustment"
                      className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Adjust</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenEditProduct(p)}
                      title="Edit Product"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setProductToDelete(p)}
                      title="Delete Product"
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Products Data Table (Desktop & Laptop View) */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Product Details</th>
                <th className="py-3.5 px-4">SKU / Barcode</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Cost Price</th>
                <th className="py-3.5 px-4 text-right">Retail Price</th>
                <th className="py-3.5 px-4 text-center">Stock Breakdown</th>
                <th className="py-3.5 px-4 text-center">Remaining Stock</th>
                <th className="py-3.5 px-4 text-center">Expiry</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Package className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-800">
                          {products.length === 0 ? 'No Products in this Catalog' : 'No Products Match Filters'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {products.length === 0
                            ? 'Get started by creating your first product with automated barcode, stock balance, and pricing.'
                            : 'Try adjusting your search keywords, category filters, or visibility flags.'}
                        </p>
                      </div>
                      {products.length === 0 && (
                        <button
                          onClick={onOpenAddProduct}
                          className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                          Add Product Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p) => {
                  const isLow = p.currentStock > 0 && p.currentStock <= p.minStockLevel;
                  const isOut = p.currentStock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300 m-auto mt-2.5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                              {p.isPublic ? (
                                <Globe className="w-3 h-3 text-emerald-600" title="Visible on Public Catalog" />
                              ) : (
                                <Lock className="w-3 h-3 text-slate-400" title="Private Product" />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 line-clamp-1">{p.brand || 'No Brand'} • {p.supplier || 'No Supplier'}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU / Barcode */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-slate-900 font-bold block">{p.sku}</span>
                        <span className="text-[10px] text-slate-400">{p.barcode}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {p.category}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatCurrency(p.purchasePrice, currency)}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                        {formatCurrency(p.sellingPrice, currency)}
                      </td>

                      {/* Stock Equation Breakdown */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="text-[10px] text-slate-500 font-mono">
                          <span>Op:{p.openingStock}</span> + <span className="text-emerald-700 font-semibold">In:{p.totalReceived}</span> - <span className="text-rose-600 font-semibold">Sold:{p.totalSold}</span>
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOut ? (
                            <>
                              <AlertOctagon className="w-3 h-3" /> Out of Stock (0)
                            </>
                          ) : isLow ? (
                            <>
                              <AlertTriangle className="w-3 h-3" /> Low: {p.currentStock} {p.unit}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> {p.currentStock} {p.unit}
                            </>
                          )}
                        </span>
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4 text-center text-slate-500">
                        {formatShortDate(p.expiryDate)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenProductDetail(p)}
                            title="View Product & QR / Barcode Label"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenReceiveStock(p)}
                            title="Receive Inward Stock"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenStockHistory(p)}
                            title="Stock Movement Ledger"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenEditProduct(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            title="Delete Product"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">
              Permanently Delete {productToDelete.name}?
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this product? This action will remove the record from Cloud Firestore and your local inventory database immediately. This action cannot be undone.
            </p>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                onClick={() => !isDeleting && setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        businessId={businessId}
        currentUser={currentUser}
        onImportSuccess={loadProducts}
      />
    </div>
  );
};
