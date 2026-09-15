import React, { useRef } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Printer,
  ShoppingBag,
  Store,
  MapPin,
  Phone,
  ArrowRight,
  Truck,
  Download,
  Share2
} from 'lucide-react';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/codeGenerators';

interface OrderConfirmationModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderId: string, phone: string) => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  order,
  isOpen,
  onClose,
  onTrackOrder,
}) => {
  const [copied, setCopied] = React.useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Top Celebration Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight">Order Placed Successfully!</h2>
          <p className="text-xs text-emerald-100 mt-1 max-w-sm mx-auto">
            Your order has been safely recorded and transmitted to the seller. We are preparing it for delivery!
          </p>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Order ID & Quick Copy Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Your Order ID</span>
              <span className="text-lg font-mono font-extrabold text-slate-900 tracking-wide">{order.orderId}</span>
            </div>

            <button
              onClick={handleCopyId}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              {copied ? 'Copied to Clipboard!' : 'Copy Order ID'}
            </button>
          </div>

          {/* Printable Receipt Summary Box */}
          <div ref={receiptRef} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-900">{order.storeNameSnapshot}</span>
                <span className="text-[11px] text-slate-500 block">Status: <strong className="text-emerald-600 font-semibold">{order.orderStatus}</strong></span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>

            {/* Customer Details */}
            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <div><strong>Customer:</strong> {order.customerName} ({order.customerPhone})</div>
              <div><strong>Delivery To:</strong> {order.deliveryAddress}</div>
              {order.customerNote && <div><strong>Note:</strong> {order.customerNote}</div>}
              <div><strong>Payment:</strong> <span className="uppercase font-semibold text-slate-800">{order.paymentMethod.replace(/_/g, ' ')}</span></div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ordered Products</span>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {item.quantity}×
                    </span>
                    <span className="font-semibold text-slate-800 line-clamp-1">{item.productNameSnapshot}</span>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Charge</span>
                <span className="font-medium">{formatCurrency(order.deliveryCharge)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                <span>Total Amount Due</span>
                <span className="text-emerald-700 text-base">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => onTrackOrder(order.orderId, order.customerPhone)}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Live Track This Order
            </button>

            <button
              onClick={handlePrintReceipt}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs border border-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print / Save Receipt
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 text-center transition-colors"
          >
            ← Return to Marketplace Catalog
          </button>
        </div>
      </div>
    </div>
  );
};
