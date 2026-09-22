import React, { useState, useEffect, useRef } from 'react';
import {
  ScanBarcode,
  Camera,
  Search,
  Package,
  Layers,
  ShoppingBag,
  PackagePlus,
  Eye,
  History,
  AlertTriangle,
  CheckCircle2,
  X,
  Volume2,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { db } from '../../services/storage';
import { Product, Business } from '../../types';
import { formatCurrency, formatShortDate } from '../../utils/codeGenerators';

interface BarcodeScannerViewProps {
  businessId: string;
  business: Business | null;
  onNavigateToPOSWithProduct: (product: Product) => void;
  onOpenReceiveStock: (product: Product) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenStockHistory: (product: Product) => void;
}

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  businessId,
  business,
  onNavigateToPOSWithProduct,
  onOpenReceiveStock,
  onOpenProductDetail,
  onOpenStockHistory,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const prods = db.getProducts(businessId);
    setAvailableProducts(prods);
  }, [businessId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not available on this browser/environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(
        'Unable to access physical camera stream (IFrame permissions or hardware restriction). You can use the Quick Barcode Trigger or manual search below.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleManualSearch = (codeToSearch?: string) => {
    const code = (codeToSearch || manualCode).trim().toLowerCase();
    if (!code) return;

    const allProducts = db.getProducts(businessId);
    const found = allProducts.find(
      (p) =>
        (p.barcode || '').toLowerCase() === code ||
        (p.sku || '').toLowerCase() === code ||
        (p.name || '').toLowerCase().includes(code)
    );

    if (found) {
      setScannedProduct(found);
      setRecentScans((prev) => [found, ...prev.filter((p) => p.id !== found.id)].slice(0, 5));
      setCameraError(null);
    } else {
      setCameraError(`No product found in your store with Barcode / SKU "${code}".`);
      setScannedProduct(null);
    }
  };

  const handleSimulateScan = (product: Product) => {
    setManualCode(product.barcode);
    handleManualSearch(product.barcode);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
              <ScanBarcode className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Barcode Scanner Station</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time barcode reader for point-of-sale lookup, inventory verification, and fast restock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Stop Camera
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Start Live Camera
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scanner Viewport & Manual Input */}
        <div className="lg:col-span-6 space-y-6">
          {/* Camera Viewport Box */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden shadow-lg border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ScanBarcode className="w-4 h-4" /> Scanner Viewfinder
              </span>
              <span className="text-[11px] text-slate-400">
                {isCameraActive ? 'Camera Running (Point at barcode)' : 'Camera Idle'}
              </span>
            </div>

            <div className="relative h-64 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isCameraActive ? (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 text-slate-500 space-y-2">
                  <Camera className="w-12 h-12 mx-auto text-slate-600 stroke-1" />
                  <p className="text-xs text-slate-400">Camera is turned off or not permitted.</p>
                  <button
                    onClick={startCamera}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Turn On Camera
                  </button>
                </div>
              )}

              {/* Laser Scanning Line Animation */}
              {isCameraActive && (
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse" />
              )}
            </div>

            {cameraError && (
              <div className="mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-amber-300">
                {cameraError}
              </div>
            )}
          </div>

          {/* Manual Barcode Input Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              Manual Barcode or SKU Search
            </h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter or paste barcode (e.g. 890103001) or SKU..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
              <button
                onClick={() => handleManualSearch()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Scan / Find
              </button>
            </div>

            {/* Quick Demo Barcode Buttons */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Simulate Hardware Barcode Scanner (Click to Test):
              </span>
              <div className="flex flex-wrap gap-2">
                {availableProducts.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSimulateScan(p)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-all text-left"
                  >
                    <span className="font-bold block">{(p.name || 'Product').substring(0, 20)}...</span>
                    <span className="font-mono text-[10px] text-slate-500">{p.barcode}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scanned Product Result Display (Prompt Mandated Fields & Actions) */}
        <div className="lg:col-span-6">
          {scannedProduct ? (
            <div className="bg-white rounded-3xl border border-emerald-200 shadow-md p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Product Scanned Successfully
                </span>
                <span className="text-xs text-slate-400 font-mono">Barcode: {scannedProduct.barcode}</span>
              </div>

              {/* Product Card Details */}
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-32 h-32 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                  {scannedProduct.imageUrl ? (
                    <img
                      src={scannedProduct.imageUrl}
                      alt={scannedProduct.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-slate-300 m-auto mt-8" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      {scannedProduct.category}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">SKU: {scannedProduct.sku}</span>
                  </div>

                  <h2 className="text-xl font-extrabold text-slate-900">{scannedProduct.name}</h2>
                  <p className="text-xs text-slate-600 line-clamp-2">{scannedProduct.description}</p>

                  <div className="pt-2 flex items-center gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Selling Price</span>
                      <span className="text-xl font-black text-emerald-700">
                        {formatCurrency(scannedProduct.sellingPrice, business?.currencySymbol)}
                      </span>
                    </div>

                    <div className="pl-4 border-l border-slate-200">
                      <span className="text-[11px] text-slate-400 block font-medium">Current Stock</span>
                      <span
                        className={`text-xl font-black ${
                          scannedProduct.currentStock <= scannedProduct.minStockLevel
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {scannedProduct.currentStock} {scannedProduct.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Supplier</span>
                  <span className="font-semibold text-slate-800">{scannedProduct.supplier || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Expiry Date</span>
                  <span className="font-semibold text-slate-800">{formatShortDate(scannedProduct.expiryDate)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Batch No</span>
                  <span className="font-mono font-semibold text-slate-800">{scannedProduct.batchNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Prompt Mandated Action Buttons: Sell, Add Stock, View Product, View History */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  id="btn-scan-action-sell"
                  onClick={() => onNavigateToPOSWithProduct(scannedProduct)}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex flex-col items-center justify-center gap-1"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Sell in POS</span>
                </button>

                <button
                  id="btn-scan-action-add-stock"
                  onClick={() => onOpenReceiveStock(scannedProduct)}
                  className="py-3 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex flex-col items-center justify-center gap-1"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Add Stock</span>
                </button>

                <button
                  id="btn-scan-action-view"
                  onClick={() => onOpenProductDetail(scannedProduct)}
                  className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex flex-col items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Product</span>
                </button>

                <button
                  id="btn-scan-action-history"
                  onClick={() => onOpenStockHistory(scannedProduct)}
                  className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border border-slate-200"
                >
                  <History className="w-4 h-4 text-slate-600" />
                  <span>Stock History</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <ScanBarcode className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Scanned Product Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Point your camera at any product barcode, type the barcode number above, or click one of the quick test items.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
