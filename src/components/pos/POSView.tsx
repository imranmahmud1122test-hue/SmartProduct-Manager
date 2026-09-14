import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Smartphone,
  Printer,
  X,
  Package,
  AlertCircle,
  Receipt,
  Layers,
  Sparkles,
  Copy,
  Check,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from '../../services/storage';
import { Product, Sale, User, Business } from '../../types';
import { formatCurrency, formatDate, renderBarcodeToCanvas } from '../../utils/codeGenerators';
import { printThermalReceipt } from '../../utils/printHelper';
import { useLanguage } from '../../context/LanguageContext';

interface POSViewProps {
  businessId: string;
  business: Business | null;
  currentUser: User;
  initialProductToAdd?: Product | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const POSView: React.FC<POSViewProps> = ({
  businessId,
  business,
  currentUser,
  initialProductToAdd,
}) => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const barcodeCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (completedSale && barcodeCanvasRef.current) {
      renderBarcodeToCanvas(barcodeCanvasRef.current, completedSale.invoiceNumber, 'CODE128');
    }
  }, [completedSale]);

  const handlePrintReceipt = () => {
    if (completedSale) {
      printThermalReceipt(completedSale, business, completedSale.cashierName || currentUser.name);
    } else {
      window.print();
    }
  };

  const getReceiptPlainText = (): string => {
    if (!completedSale) return '';
    return [
      business?.name || 'Smart Product Manager',
      business?.address || 'Supermarket Address',
      business?.phone ? `Tel: ${business.phone}` : '',
      '----------------------------------------',
      `INVOICE #${completedSale.invoiceNumber}`,
      `Date: ${formatDate(completedSale.createdAt)}`,
      `Cashier: ${completedSale.cashierName}`,
      '----------------------------------------',
      ...completedSale.items.map(
        (it) => `${it.productName} (x${it.quantity}) - ${formatCurrency(it.subtotal, currency)}`
      ),
      '----------------------------------------',
      `Subtotal: ${formatCurrency(completedSale.subtotal, currency)}`,
      completedSale.discount > 0 ? `Discount: -${formatCurrency(completedSale.discount, currency)}` : '',
      `Tax: ${formatCurrency(completedSale.tax, currency)}`,
      `TOTAL PAID: ${formatCurrency(completedSale.totalAmount, currency)}`,
      `Payment Method: ${completedSale.paymentMethod.toUpperCase()}`,
      completedSale.changeAmount > 0
        ? `Change Returned: ${formatCurrency(completedSale.changeAmount, currency)}`
        : '',
      '========================================',
      'Thank you for shopping with us!'
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopyReceipt = () => {
    const text = getReceiptPlainText();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    });
  };

  const handleDownloadReceipt = () => {
    if (!completedSale) return;
    const text = getReceiptPlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${completedSale.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reloadProducts = () => {
    const prods = db.getProducts(businessId).filter((p) => p.status === 'active');
    setProducts(prods);
  };

  useEffect(() => {
    reloadProducts();
  }, [businessId]);

  useEffect(() => {
    if (initialProductToAdd) {
      addToCart(initialProductToAdd);
    }
  }, [initialProductToAdd]);

  const currency = business?.currencySymbol || '৳';
  const taxRate = business?.taxRate || 5.0;

  // Cart calculations
  const subtotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const changeAmount = Math.max(0, Math.round(((receivedAmount || totalAmount) - totalAmount) * 100) / 100);

  const addToCart = (product: Product) => {
    setError(null);
    if (product.currentStock <= 0) {
      setError(`"${product.name}" is currently Out of Stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          setError(`Cannot add more. Available stock for "${product.name}" is ${product.currentStock}.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setError(null);
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const targetQty = item.quantity + delta;
            if (targetQty > item.product.currentStock) {
              setError(`Maximum available stock for "${item.product.name}" is ${item.product.currentStock}.`);
              return item;
            }
            return { ...item, quantity: targetQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setReceivedAmount(0);
    setCustomerName('');
    setCustomerPhone('');
    setError(null);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim().toLowerCase();
    const found = products.find(
      (p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code
    );

    if (found) {
      addToCart(found);
      setBarcodeInput('');
    } else {
      setError(`No product with Barcode/SKU "${barcodeInput}" found.`);
    }
  };

  const handleCheckout = () => {
    setError(null);
    if (cart.length === 0) {
      setError('Cart is empty. Please add items to checkout.');
      return;
    }

    try {
      const sale = db.processSale(
        businessId,
        {
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          customerName: customerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim(),
          discount: discountAmount,
          paymentMethod,
          receivedAmount: receivedAmount || totalAmount,
          notes: `POS Cashier Transaction - ${currentUser.name}`,
        },
        currentUser
      );

      // Trigger celebrate confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}

      setCompletedSale(sale);
      clearCart();
      reloadProducts();
    } catch (err: any) {
      setError(err.message || 'Checkout failed.');
    }
  };

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchBarcode) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('posTitle', 'Point of Sale (POS Register)')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('posSubtitle', 'Live Checkout • Automatic Inventory Decrements • Receipt Printing')}
            </p>
          </div>
        </div>

        {/* Barcode Quick Scan Bar */}
        <form onSubmit={handleBarcodeSubmit} className="flex gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('scanBarcodePlaceholder', 'Scan/type barcode + press Enter...')}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            + {t('addProduct', 'Add')}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* POS Two-Column Grid: Catalog on Left, Register Cart on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selector Catalog */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Category Tabs */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('searchProductPlaceholder', 'Search products by name, SKU, or category...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
                  {cat === 'ALL' ? t('allCategories', 'All Items') : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const inStock = p.currentStock > 0;
              const isLow = inStock && p.currentStock <= p.minStockLevel;

              return (
                <button
                  key={p.id}
                  onClick={() => inStock && addToCart(p)}
                  disabled={!inStock}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                    inStock
                      ? 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md cursor-pointer'
                      : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="relative h-24 w-full bg-slate-100 rounded-xl overflow-hidden mb-2">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <span
                      className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        !inStock
                          ? 'bg-rose-600 text-white'
                          : isLow
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-900/80 text-white'
                      }`}
                    >
                      {inStock ? `${p.currentStock} ${p.unit}` : 'Out of Stock'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">{p.category}</span>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600">
                      {p.name}
                    </h4>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatCurrency(p.sellingPrice, currency)}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active POS Cash Register Cart */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">{t('cart', 'Register Cart')}</h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('clearCart', 'Clear Cart')}
                </button>
              )}
            </div>

            {/* Customer Details Inputs */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input
                type="text"
                placeholder={`${t('customerName', 'Customer Name')} (Optional)`}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <input
                type="tel"
                placeholder={`${t('customerPhone', 'Customer Phone')} (Optional)`}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 mb-4">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                  <p className="text-xs font-semibold text-slate-600">{t('cartEmpty', 'Your register cart is empty. Click or scan products to add.')}</p>
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = item.product.sellingPrice * item.quantity;
                  const remainingStock = item.product.currentStock - item.quantity;

                  return (
                    <div
                      key={item.product.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 line-clamp-1">{item.product.name}</h4>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                          <span>{formatCurrency(item.product.sellingPrice, currency)} / {item.product.unit}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">
                            Remaining: {remainingStock}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-extrabold text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-slate-900 block">
                          {formatCurrency(lineTotal, currency)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-[10px] text-rose-500 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment & Totals Section */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            {/* Calculation Lines */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart.reduce((a, c) => a + c.quantity, 0)} items)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal, currency)}</span>
              </div>

              <div className="flex justify-between text-slate-600 items-center">
                <span>Discount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-right font-semibold text-rose-600 text-xs"
                />
              </div>

              <div className="flex justify-between text-slate-600">
                <span>{t('tax', 'Tax')} ({taxRate}%)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(taxAmount, currency)}</span>
              </div>

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>{t('total', 'Total')}</span>
                <span className="text-emerald-700 text-xl font-black">{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                {t('paymentMethod', 'Payment Method')}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> {t('cash', 'Cash')}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    paymentMethod === 'card'
                      ? 'bg-blue-50 text-blue-800 border-blue-400 ring-2 ring-blue-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" /> {t('card', 'Card / POS')}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_banking')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    paymentMethod === 'mobile_banking'
                      ? 'bg-purple-50 text-purple-800 border-purple-400 ring-2 ring-purple-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-purple-600" /> {t('mobilePay', 'Mobile Pay')}
                </button>
              </div>
            </div>

            {/* Cash Received & Change Calculator */}
            {paymentMethod === 'cash' && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-0.5">{t('cashReceived', 'Cash Received')}</label>
                  <input
                    type="number"
                    min={totalAmount}
                    step="0.01"
                    placeholder={totalAmount.toFixed(2)}
                    value={receivedAmount || ''}
                    onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">{t('changeDue', 'Change Due')}</span>
                  <span className="text-base font-extrabold text-emerald-700 block">
                    {formatCurrency(changeAmount, currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              id="btn-pos-complete-sale"
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {t('completeSale', 'Complete Sale')} ({formatCurrency(totalAmount, currency)})
            </button>
          </div>
        </div>
      </div>

      {/* POS Receipt Modal with Thermal Print Layout */}
      {completedSale && (
        <div id="receipt-modal-backdrop" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="receipt-modal-card" className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Thermal Receipt Body */}
            <div id="printable-receipt" className="font-mono text-xs space-y-3 text-slate-900">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="font-extrabold text-sm uppercase">{business?.name || 'Smart Product Manager'}</h3>
                <p className="text-[11px] text-slate-500">{business?.address || 'Supermarket Address'}</p>
                <p className="text-[11px] text-slate-500">Tel: {business?.phone || 'N/A'}</p>
                <div className="mt-2 text-[10px] text-slate-400">
                  <span>INVOICE #{completedSale.invoiceNumber}</span>
                  <span className="block">{formatDate(completedSale.createdAt)}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-slate-300 pb-3 space-y-1.5">
                {completedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div>
                      <span className="font-semibold block">{it.productName}</span>
                      <span className="text-[10px] text-slate-500">{it.quantity} x {formatCurrency(it.unitPrice, currency)}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(it.subtotal, currency)}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(completedSale.subtotal, currency)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(completedSale.discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Tax:</span>
                  <span>{formatCurrency(completedSale.tax, currency)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-200 pt-1">
                  <span>Total Paid:</span>
                  <span>{formatCurrency(completedSale.totalAmount, currency)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Payment Method:</span>
                  <span className="uppercase">{completedSale.paymentMethod}</span>
                </div>
                {completedSale.changeAmount > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-700 font-bold">
                    <span>Change Returned:</span>
                    <span>{formatCurrency(completedSale.changeAmount, currency)}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400 space-y-1">
                <canvas ref={barcodeCanvasRef} className="mx-auto max-w-[180px] h-9 mb-1" />
                <p>Thank you for shopping with us!</p>
                <p>Cashier: {completedSale.cashierName}</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex flex-col gap-2 no-print">
              <div className="flex gap-2">
                <button
                  id="btn-pos-print-receipt"
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" /> {t('printReceipt', 'Print / Save PDF')}
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                >
                  {t('done', 'Done')}
                </button>
              </div>

              {/* Utility actions for copy & text download */}
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer text-[11px]"
                >
                  {copiedReceipt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiedReceipt ? 'Copied' : 'Copy Text'}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  Save .txt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
