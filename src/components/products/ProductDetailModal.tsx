import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  QrCode,
  ScanBarcode,
  Printer,
  Download,
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  Layers,
  History,
  Building2,
  CheckCircle2,
  Tag,
  Share2
} from 'lucide-react';
import { Product, Business } from '../../types';
import { formatCurrency, formatDate, formatShortDate, generateQRCodeDataUrl, renderBarcodeToCanvas, computeProductStockAnalysis } from '../../utils/codeGenerators';
import { printShelfLabel } from '../../utils/printHelper';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  business: Business | null;
  onOpenStockHistory: (product: Product) => void;
  onOpenStockReceive: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  business,
  onOpenStockHistory,
  onOpenStockReceive,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (product) {
      const qrData = JSON.stringify({
        store: business?.name || product.businessId,
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.sellingPrice,
        stock: product.currentStock,
        unit: product.unit,
      });

      generateQRCodeDataUrl(qrData, { width: 300 }).then(setQrCodeUrl);

      // Render barcode canvas
      setTimeout(() => {
        if (barcodeCanvasRef.current && product.barcode) {
          renderBarcodeToCanvas(barcodeCanvasRef.current, product.barcode);
        }
      }, 50);
    }
  }, [product, business]);

  if (!isOpen || !product) return null;

  const analysis = computeProductStockAnalysis(product);
  const currency = business?.currencySymbol || '৳';
  const totalSalesRevenue = product.totalSold * product.sellingPrice;
  const estimatedProfit = (product.sellingPrice - product.purchasePrice) * product.totalSold;

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `QR_${product.sku}_${product.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handlePrintLabel = () => {
    printShelfLabel(product, business, qrCodeUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div id="product-detail-modal-card" className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 my-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white relative shrink-0 flex items-center justify-between no-print">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                  {product.category}
                </span>
                <span className="text-xs text-slate-400">SKU: {product.sku}</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight mt-0.5">{product.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Printable Shelf Label Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Package className="w-10 h-10 text-slate-300 m-auto mt-5" />
                )}
              </div>
              <div>
                <span className="text-xs text-slate-500 font-semibold">{business?.name || 'Supermarket'}</span>
                <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-1">{product.description}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xl font-extrabold text-emerald-600">
                    {formatCurrency(product.sellingPrice, currency)}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">/ {product.unit}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 no-print">
              <button
                onClick={handleDownloadQR}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Download QR
              </button>
              <button
                onClick={handlePrintLabel}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                Print Shelf Label
              </button>
            </div>
          </div>

          {/* Core Stock Equation Box */}
          <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-md border border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Live Transactional Inventory Ledger
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${analysis.statusBadgeColor}`}>
                {analysis.recommendation}
              </span>
            </div>

            {/* Strict Stock Formula Representation */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-400 block font-medium">Opening Stock</span>
                <span className="text-lg font-bold text-slate-200">{product.openingStock}</span>
              </div>
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-[11px] text-emerald-400 block font-medium">Total Received (+)</span>
                <span className="text-lg font-bold text-emerald-400">+{product.totalReceived}</span>
              </div>
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-[11px] text-amber-400 block font-medium">Adjustments (±)</span>
                <span className="text-lg font-bold text-amber-300">
                  {product.stockAdjustments > 0 ? `+${product.stockAdjustments}` : product.stockAdjustments}
                </span>
              </div>
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-[11px] text-rose-400 block font-medium">Total Sold (-)</span>
                <span className="text-lg font-bold text-rose-400">-{product.totalSold}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 bg-emerald-950/80 rounded-xl border border-emerald-600/50">
                <span className="text-[11px] text-emerald-300 block font-bold">Current Stock</span>
                <span className="text-2xl font-black text-emerald-400">{product.currentStock}</span>
                <span className="text-[10px] text-emerald-300 block">{product.unit}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div>
                Min Stock Alert: <strong className="text-slate-200">{product.minStockLevel} {product.unit}</strong> | Max Capacity: <strong className="text-slate-200">{product.maxStockLevel} {product.unit}</strong>
              </div>
              <div className="flex gap-2 no-print">
                <button
                  onClick={() => {
                    onClose();
                    onOpenStockReceive(product);
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                >
                  + Inward Stock
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenStockHistory(product);
                  }}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition-colors flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> Full History
                </button>
              </div>
            </div>
          </div>

          {/* Section: QR Code & Barcode Render */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-2">
                <QrCode className="w-4 h-4 text-emerald-600" /> High Resolution QR Code
              </span>
              {qrCodeUrl && (
                <img
                  src={qrCodeUrl}
                  alt="Product QR"
                  className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-xl shadow-xs"
                />
              )}
              <span className="text-[11px] text-slate-400 mt-2 font-mono">Scan to inspect available stock</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-2">
                <ScanBarcode className="w-4 h-4 text-cyan-600" /> Standard Product Barcode
              </span>
              <div className="bg-white p-2 border border-slate-200 rounded-xl shadow-xs flex items-center justify-center min-h-[144px]">
                <canvas ref={barcodeCanvasRef} className="max-w-full" />
              </div>
              <span className="text-[11px] text-slate-400 mt-2 font-mono">Barcode: {product.barcode}</span>
            </div>
          </div>

          {/* Section: Product Performance & Profitability */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Product Financial Performance
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Unit Cost (Buy)</span>
                <span className="text-base font-bold text-slate-800">{formatCurrency(product.purchasePrice, currency)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Unit Retail (Sell)</span>
                <span className="text-base font-bold text-emerald-700">{formatCurrency(product.sellingPrice, currency)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Total Revenue</span>
                <span className="text-base font-bold text-slate-900">{formatCurrency(totalSalesRevenue, currency)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Estimated Profit</span>
                <span className="text-base font-bold text-emerald-600">{formatCurrency(estimatedProfit, currency)}</span>
              </div>
            </div>
          </div>

          {/* Additional Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Supplier</span>
              <span className="font-semibold text-slate-800">{product.supplier || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Batch Number</span>
              <span className="font-mono font-semibold text-slate-800">{product.batchNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Expiry Date</span>
              <span className="font-semibold text-slate-800">{formatShortDate(product.expiryDate)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Catalog Visibility</span>
              <span className="font-semibold text-emerald-600">{product.isPublic ? 'Public Catalog' : 'Private'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Created On</span>
              <span className="font-semibold text-slate-800">{formatShortDate(product.createdAt)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Last Restock / Change</span>
              <span className="font-semibold text-slate-800">{formatShortDate(product.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={handlePrintLabel}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print Label / Save PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
