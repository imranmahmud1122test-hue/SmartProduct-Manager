import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Store,
  CreditCard,
  User as UserIcon,
  MapPin,
  Phone,
  AlertCircle,
  CheckCircle2,
  Package
} from 'lucide-react';
import { CartItem, Business } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';
import { db } from '../../services/storage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckoutSuccess: (masterOrder: any) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckoutSuccess,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'mobile_banking' | 'card'>('cash_on_delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Group cart items by store
  const itemsByStore = new Map<string, { storeName: string; deliveryCharge: number; items: CartItem[] }>();
  const allBusinesses = db.getBusinesses();
  const bizMap = new Map<string, Business>(allBusinesses.map((b) => [b.id, b]));

  for (const item of cartItems) {
    const storeId = item.product.businessId;
    const biz = bizMap.get(storeId);
    const storeName = item.product.businessName || biz?.name || 'Supermarket';
    const deliveryCharge = biz?.deliveryCharge !== undefined ? biz.deliveryCharge : 60;

    if (!itemsByStore.has(storeId)) {
      itemsByStore.set(storeId, {
        storeName,
        deliveryCharge,
        items: [],
      });
    }
    itemsByStore.get(storeId)!.items.push(item);
  }

  const subtotal = cartItems.reduce((acc, it) => acc + it.product.sellingPrice * it.quantity, 0);
  const totalDeliveryCharges = Array.from(itemsByStore.values()).reduce((acc, group) => acc + group.deliveryCharge, 0);
  const grandTotal = subtotal + totalDeliveryCharges;

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (cartItems.length === 0) {
      setErrorMessage('Your shopping bag is empty.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/[^0-9]/g, '').length < 6) {
      setErrorMessage('Please enter a valid phone number');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMessage('Please enter your full delivery address');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = db.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        deliveryAddress: deliveryAddress.trim(),
        customerNote: customerNote.trim() || undefined,
        paymentMethod,
        items: cartItems.map((ci) => ({
          productId: ci.product.id,
          quantity: ci.quantity,
        })),
      });

      onClearCart();
      onCheckoutSuccess(result.masterOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Shopping Bag</h2>
              <p className="text-xs text-slate-500">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} from {itemsByStore.size}{' '}
                {itemsByStore.size === 1 ? 'store' : 'stores'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Your bag is empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Explore our public catalog and click "Add to Bag" or "Order Now" on any product.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors"
              >
                Explore Products
              </button>
            </div>
          ) : (
            <>
              {/* Items grouped by store */}
              <div className="space-y-4">
                {Array.from(itemsByStore.entries()).map(([storeId, group]) => (
                  <div key={storeId} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Store className="w-3.5 h-3.5 text-emerald-600" />
                        {group.storeName}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Delivery: {formatCurrency(group.deliveryCharge)}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 p-2">
                      {group.items.map((it) => (
                        <div key={it.product.id} className="p-2.5 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {it.product.imageUrl ? (
                              <img
                                src={it.product.imageUrl}
                                alt={it.product.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-300" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{it.product.name}</h4>
                            <div className="text-[11px] text-slate-500">
                              {formatCurrency(it.product.sellingPrice)} / {it.product.unit}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(it.product.id, it.quantity - 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-slate-800">{it.quantity}</span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(it.product.id, it.quantity + 1)}
                              disabled={it.quantity >= it.product.currentStock}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right min-w-16">
                            <div className="text-xs font-bold text-slate-900">
                              {formatCurrency(it.product.sellingPrice * it.quantity)}
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(it.product.id)}
                              className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Checkout Form */}
              <form id="cart-checkout-form" onSubmit={handleCheckout} className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Delivery & Contact Information
                </h3>

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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="House, Road, Block, City (e.g. Banani, Dhaka)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Special Delivery Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ring bell or leave at security desk"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Payment Options */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash_on_delivery')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${
                        paymentMethod === 'cash_on_delivery'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      💵 Cash on Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mobile_banking')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${
                        paymentMethod === 'mobile_banking'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      📱 bKash / Nagad
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${
                        paymentMethod === 'card'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      💳 Card Payment
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer with totals and action */}
        {cartItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Products Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Charges ({itemsByStore.size} store{itemsByStore.size > 1 ? 's' : ''})</span>
                <span className="font-semibold">{formatCurrency(totalDeliveryCharges)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total Amount Due</span>
                <span className="text-emerald-700 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              form="cart-checkout-form"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Place Marketplace Order ({formatCurrency(grandTotal)})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
