import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  Store,
  MapPin,
  Phone,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Printer
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { db } from '../../services/storage';
import { formatCurrency } from '../../utils/codeGenerators';

interface TrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderId?: string;
  initialPhone?: string;
}

const ORDER_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'Pending', label: 'Order Placed', description: 'Order received and logged in system' },
  { status: 'Confirmed', label: 'Confirmed', description: 'Store owner approved the order' },
  { status: 'Processing', label: 'Packed & Processing', description: 'Items packed and sealed in warehouse' },
  { status: 'Ready', label: 'Ready for Dispatch', description: 'Ready for courier pickup' },
  { status: 'Out for Delivery', label: 'Out for Delivery', description: 'Courier is delivering to your address' },
  { status: 'Delivered', label: 'Delivered', description: 'Successfully handed over to customer' },
];

export const TrackOrderModal: React.FC<TrackOrderModalProps> = ({
  isOpen,
  onClose,
  initialOrderId = '',
  initialPhone = '',
}) => {
  const [orderIdInput, setOrderIdInput] = useState(initialOrderId);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialOrderId && initialPhone) {
      setOrderIdInput(initialOrderId);
      setPhoneInput(initialPhone);
      handleSearch(initialOrderId, initialPhone);
    }
  }, [initialOrderId, initialPhone, isOpen]);

  if (!isOpen) return null;

  const handleSearch = (ordId = orderIdInput, ph = phoneInput) => {
    setErrorMessage('');
    if (!ordId.trim()) {
      setErrorMessage('Please enter your Order ID');
      return;
    }
    if (!ph.trim()) {
      setErrorMessage('Please enter your registered phone number');
      return;
    }

    setIsLoading(true);
    setSearched(true);
    setTimeout(() => {
      const match = db.trackOrder(ordId, ph);
      if (match) {
        setFoundOrder(match);
      } else {
        setFoundOrder(null);
        setErrorMessage('No matching order found. Please verify your Order ID and phone number.');
      }
      setIsLoading(false);
    }, 200);
  };

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'Cancelled') return -1;
    const idx = ORDER_STEPS.findIndex((s) => s.status === status);
    return idx !== -1 ? idx : 0;
  };

  const currentStepIdx = foundOrder ? getStepIndex(foundOrder.orderStatus) : -1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Live Order Tracking</h2>
              <p className="text-xs text-slate-500">Track delivery status & timeline in real-time</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Search Inputs Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. ORD-2026-1001"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +880 1711-223344"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Tip: Enter the exact phone number entered during checkout.
              </span>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5"
              >
                {isLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Track Order
              </button>
            </div>
          </form>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {foundOrder && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Status Header Badge */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Order ID:</span>
                    <span className="font-mono font-bold text-emerald-400">{foundOrder.orderId}</span>
                  </div>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    Store: {foundOrder.storeNameSnapshot}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      foundOrder.orderStatus === 'Delivered'
                        ? 'bg-emerald-500 text-white'
                        : foundOrder.orderStatus === 'Cancelled'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {foundOrder.orderStatus}
                  </span>
                </div>
              </div>

              {/* Visual Progress Timeline (If not cancelled) */}
              {foundOrder.orderStatus === 'Cancelled' ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-1">
                  <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <h4 className="text-sm font-bold text-rose-900">This Order was Cancelled</h4>
                  <p className="text-xs text-rose-600">
                    If you did not request this cancellation, please reach out to store support.
                  </p>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-5">
                    Delivery Progression
                  </h4>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {ORDER_STEPS.map((step, idx) => {
                      const isPassed = currentStepIdx >= idx;
                      const isCurrent = currentStepIdx === idx;

                      return (
                        <div key={step.status} className="relative flex items-start gap-3">
                          <div
                            className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              isPassed
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  isCurrent
                                    ? 'text-emerald-700 font-extrabold'
                                    : isPassed
                                    ? 'text-slate-900'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-pulse">
                                  Current Status
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Status History Log */}
              {foundOrder.statusHistory && foundOrder.statusHistory.length > 0 && (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Status Audit Activity
                  </h4>
                  <div className="space-y-2 text-xs">
                    {foundOrder.statusHistory.map((hist, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-xl flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-800">
                            {hist.previousStatus} → <span className="text-emerald-700">{hist.newStatus}</span>
                          </div>
                          {hist.notes && <p className="text-[11px] text-slate-500 mt-0.5">"{hist.notes}"</p>}
                        </div>
                        <div className="text-right text-[10px] text-slate-400 shrink-0">
                          <div>{new Date(hist.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>{new Date(hist.changedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items & Delivery Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-900 block mb-1">Customer & Delivery</span>
                  <div><strong>Name:</strong> {foundOrder.customerName}</div>
                  <div><strong>Phone:</strong> {foundOrder.customerPhone}</div>
                  <div><strong>Address:</strong> {foundOrder.deliveryAddress}</div>
                  {foundOrder.customerNote && <div><strong>Note:</strong> {foundOrder.customerNote}</div>}
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-900 block mb-1">Financial Details</span>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(foundOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span className="font-semibold">{formatCurrency(foundOrder.deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-emerald-700">{formatCurrency(foundOrder.totalAmount)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-0.5">
                    Payment: <strong className="uppercase">{foundOrder.paymentMethod.replace(/_/g, ' ')}</strong> ({foundOrder.paymentStatus})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
