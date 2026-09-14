import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

/**
 * Generate a high quality QR Code as a Data URL
 */
export async function generateQRCodeDataUrl(text: string, options?: { width?: number; margin?: number; color?: { dark: string; light: string } }): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 250,
      margin: options?.margin ?? 2,
      color: options?.color || {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR Code Data URL:', err);
    return '';
  }
}

/**
 * Render barcode directly to a canvas element
 */
export function renderBarcodeToCanvas(canvas: HTMLCanvasElement, barcodeValue: string, format: 'CODE128' | 'EAN13' | 'UPC' = 'CODE128'): void {
  try {
    JsBarcode(canvas, barcodeValue, {
      format: format,
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      font: 'monospace',
      lineColor: '#0f172a',
      background: '#ffffff',
      margin: 10,
    });
  } catch (err) {
    // If format fails (e.g., EAN13 checksum mismatch), fallback to CODE128
    try {
      JsBarcode(canvas, barcodeValue, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        font: 'monospace',
        lineColor: '#0f172a',
        background: '#ffffff',
        margin: 10,
      });
    } catch (fallbackErr) {
      console.error('Failed to render barcode:', fallbackErr);
    }
  }
}

/**
 * Currency formatter with symbol (defaults to BDT - ৳)
 */
export function formatCurrency(amount: number, symbol: string = '৳'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const sym = (symbol || '৳').trim();
  return `${sym} ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Date formatter
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return 'N/A';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return 'N/A';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Analyze actual sales history and stock to compute restock recommendations
 */
export interface RestockAnalysis {
  isLowStock: boolean;
  isOutOfStock: boolean;
  recommendation: 'Urgent Restock' | 'Restock Soon' | 'Normal' | 'Overstocked';
  dailySalesRate: number;
  estimatedDaysRemaining: number | string;
  statusBadgeColor: string;
}

export function computeProductStockAnalysis(product: {
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  totalSold: number;
  createdAt: string;
}): RestockAnalysis {
  const isOutOfStock = product.currentStock <= 0;
  const isLowStock = product.currentStock <= product.minStockLevel;

  // Calculate days active
  const createdDate = new Date(product.createdAt);
  const now = new Date();
  const daysActive = Math.max(1, Math.round((now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24)));
  const dailySalesRate = Math.round((product.totalSold / daysActive) * 10) / 10;

  let estimatedDaysRemaining: number | string = 'N/A';
  if (dailySalesRate > 0) {
    estimatedDaysRemaining = Math.max(0, Math.round(product.currentStock / dailySalesRate));
  }

  let recommendation: RestockAnalysis['recommendation'] = 'Normal';
  let statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (isOutOfStock) {
    recommendation = 'Urgent Restock';
    statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isLowStock) {
    recommendation = 'Restock Soon';
    statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (product.currentStock >= product.maxStockLevel && product.maxStockLevel > 0) {
    recommendation = 'Overstocked';
    statusBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return {
    isLowStock,
    isOutOfStock,
    recommendation,
    dailySalesRate,
    estimatedDaysRemaining,
    statusBadgeColor,
  };
}
