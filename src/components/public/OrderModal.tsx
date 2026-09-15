import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Store,
  MapPin,
  Phone,
  User as UserIcon,
  FileText,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Package
} from 'lucide-react';
import { Product, Business } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';
import { db } from '../../services/storage';

interface OrderModalProps {
  product: Product & { businessName?: string };
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (order: any) => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  product,
  isOpen,
  onClose,
  onOrderSuccess,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [zilla, setZilla] = useState('');
  const [thana, setThana] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'mobile_banking' | 'card'>('cash_on_delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const business: Business | undefined = db.getBusinessById(product.businessId);
  const deliveryCharge = business?.deliveryCharge !== undefined ? business.deliveryCharge : 60;
  const subtotal = product.sellingPrice * quantity;
  const totalAmount = subtotal + deliveryCharge;
  const maxAvailable = product.currentStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/[^0-9]/g, '').length < 6) {
      setErrorMessage('Please enter a valid phone number');
      return;
    }
    if (!zilla.trim()) {
      setErrorMessage('Please enter your Zilla / District (জেলা)');
      return;
    }
    if (!thana.trim()) {
      setErrorMessage('Please enter your Thana / Upazila (থানা)');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMessage('Please enter your full delivery address');
      return;
    }
    if (quantity <= 0 || quantity > maxAvailable) {
      setErrorMessage(`Please select a quantity between 1 and ${maxAvailable}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = db.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        zilla: zilla.trim(),
        thana: thana.trim(),
        deliveryAddress: `${deliveryAddress.trim()}, Thana: ${thana.trim()}, District: ${zilla.trim()}`,
        paymentMethod,
        items: [
          {
            productId: product.id,
            quantity,
          },
        ],
      });

      onOrderSuccess(result.masterOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Direct Express Order</h2>
              <p className="text-xs text-slate-500">Fast home delivery from verified store</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product Summary Snapshot Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mb-0.5">
                <Store className="w-3.5 h-3.5" />
                <span className="truncate">{product.businessName || business?.name || 'Supermarket'}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 truncate">{product.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="font-extrabold text-slate-900">
                  {formatCurrency(product.sellingPrice)}
                  <span className="text-slate-500 font-normal"> / {product.unit}</span>
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
                  {product.currentStock} {product.unit} in stock
                </span>
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Select Order Quantity</span>
              <span className="text-[11px] text-slate-500">Max available: {maxAvailable} {product.unit}</span>
            </div>

            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center font-extrabold text-sm text-slate-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(maxAvailable, quantity + 1))}
                disabled={quantity >= maxAvailable}
                className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold flex items-center justify-center text-sm transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Customer Information Form */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
              Customer & Delivery Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvir Rahman"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +880 1711-223344"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zilla / District (জেলা) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dhaka (ঢাকা)"
                  value={zilla}
                  onChange={(e) => setZilla(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thana / Upazila (থানা) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Banani / Mirpur"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Delivery Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="House, Road, Area (e.g. House 14, Road 5, Block B)"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  💵 Cash On Delivery
                </div>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Pay upon delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mobile_banking')}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  paymentMethod === 'mobile_banking'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  📱 bKash / Nagad
                </div>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Mobile banking</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  paymentMethod === 'card'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  💳 Debit / Credit Card
                </div>
                <span className="text-[10px] text-slate-500 font-normal block mt-0.5">Visa / Mastercard</span>
              </button>
            </div>
          </div>

          {/* Pricing Calculation Summary */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Items Subtotal ({quantity} {product.unit})</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Delivery Fee ({business?.name || 'Local Shipping'})</span>
              <span className="font-semibold">{formatCurrency(deliveryCharge)}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
              <span className="text-white">Total Amount Due</span>
              <span className="text-emerald-400 text-base">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || maxAvailable <= 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Place Order ({formatCurrency(totalAmount)})
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              🔒 Order data is sent directly to {product.businessName || 'the store owner'}. Stock is updated instantly.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
