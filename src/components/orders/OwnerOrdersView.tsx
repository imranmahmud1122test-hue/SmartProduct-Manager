import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Package,
  Eye,
  Printer,
  ChevronRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Calendar,
  Phone,
  MapPin,
  User as UserIcon,
  RotateCcw,
  FileText,
  Check,
  X
} from 'lucide-react';
import { Order, OrderStatus, Business, User } from '../../types';
import { db } from '../../services/storage';
import { formatCurrency } from '../../utils/codeGenerators';
import { printOrderSlip, printOrderReceipt, printCourierManifest } from '../../utils/printHelper';

interface OwnerOrdersViewProps {
  businessId?: string;
  business: Business | null;
  currentUser: User;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  Pending: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  Confirmed: {
    label: 'Confirmed',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  Processing: {
    label: 'Processing',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: <Package className="w-3.5 h-3.5" />,
  },
  Ready: {
    label: 'Ready for Pickup',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    icon: <Check className="w-3.5 h-3.5" />,
  },
  'Out for Delivery': {
    label: 'Out for Delivery',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  Delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  Cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

export const OwnerOrdersView: React.FC<OwnerOrdersViewProps> = ({
  businessId,
  business,
  currentUser,
}) => {
  const effectiveBusinessId = business?.id || businessId || currentUser.businessId || 'SHOP-001';
  const currency = business?.currencySymbol || '৳';
  const storeName = business?.name || currentUser.businessName || 'Supermarket Store';

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Status Change Dialog
  const [statusChangeModal, setStatusChangeModal] = useState<{
    order: Order;
    targetStatus: OrderStatus;
  } | null>(null);
  const [statusNote, setStatusNote] = useState('');

  const loadOrders = () => {
    const ownerOrders = db.getOrdersByOwner(currentUser.id, effectiveBusinessId);
    setOrders(ownerOrders);
  };

  useEffect(() => {
    loadOrders();
    const handleUpdate = () => loadOrders();
    window.addEventListener('spm_storage_update', handleUpdate);
    window.addEventListener('spm_order_update', handleUpdate);
    return () => {
      window.removeEventListener('spm_storage_update', handleUpdate);
      window.removeEventListener('spm_order_update', handleUpdate);
    };
  }, [effectiveBusinessId, currentUser.id]);

  // Analytics
  const nonCancelled = orders.filter((o) => o.orderStatus !== 'Cancelled');
  const totalRevenue = nonCancelled.reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingCount = orders.filter((o) => o.orderStatus === 'Pending').length;
  const confirmedCount = orders.filter((o) => o.orderStatus === 'Confirmed').length;
  const cancelledCount = orders.filter((o) => o.orderStatus === 'Cancelled').length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = nonCancelled.filter((o) => o.createdAt.startsWith(todayStr));
  const todaySales = todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    if (selectedStatusFilter !== 'ALL' && o.orderStatus !== selectedStatusFilter) return false;

    if (dateFilter === 'today') {
      if (!o.createdAt.startsWith(todayStr)) return false;
    } else if (dateFilter === 'week') {
      const d = new Date(o.createdAt).getTime();
      if (Date.now() - d > 86400000 * 7) return false;
    } else if (dateFilter === 'month') {
      const d = new Date(o.createdAt).getTime();
      if (Date.now() - d > 86400000 * 30) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (o.orderId || '').toLowerCase().includes(q);
      const matchCust = (o.customerName || '').toLowerCase().includes(q);
      const matchPhone = (o.customerPhone || '').toLowerCase().includes(q);
      const matchAddress = (o.deliveryAddress || '').toLowerCase().includes(q);
      const matchProduct = Array.isArray(o.items) && o.items.some((it) => (it?.productNameSnapshot || '').toLowerCase().includes(q));
      if (!matchId && !matchCust && !matchPhone && !matchAddress && !matchProduct) return false;
    }

    return true;
  });

  const handleApplyStatusChange = () => {
    if (!statusChangeModal) return;
    const { order, targetStatus } = statusChangeModal;

    db.updateOrderStatus(
      order.orderId,
      targetStatus,
      currentUser.name,
      currentUser.role,
      statusNote.trim() || undefined
    );

    setStatusChangeModal(null);
    setStatusNote('');
    loadOrders();
    if (selectedOrder && selectedOrder.orderId === order.orderId) {
      const refreshed = db.getOrderById(order.orderId);
      if (refreshed) setSelectedOrder(refreshed);
    }
  };

  const handlePrintInvoice = (order: Order) => {
    setInvoiceOrder(order);
    setIsInvoiceOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold mb-1 sm:mb-2">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
            Store Orders Management & Fulfillment
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Customer Online Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage incoming customer orders, update tracking statuses, and print packing slips for{' '}
            <strong>{storeName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => printCourierManifest(filteredOrders, business, selectedStatusFilter === 'ALL' ? 'All Consignments' : `${selectedStatusFilter} Orders`)}
            className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Print Steadfast / Courier Consignment Dispatch Manifest"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-700" />
            Print Consignments ({filteredOrders.length})
          </button>
          <button
            onClick={loadOrders}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Orders</span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 sm:mt-1 block">{orders.length}</span>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold mt-0.5 block truncate">
              {formatCurrency(totalRevenue)} rev
            </span>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Pending</span>
            <span className="text-lg sm:text-xl font-extrabold text-amber-700 mt-0.5 sm:mt-1 block">{pendingCount}</span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-0.5">Awaiting decision</span>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Confirmed</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-0.5 sm:mt-1 block">{confirmedCount}</span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-0.5">Approved & ready</span>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Cancelled</span>
            <span className="text-lg sm:text-xl font-extrabold text-rose-700 mt-0.5 sm:mt-1 block">{cancelledCount}</span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-0.5">Stock restored</span>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, customer name, phone, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['all', 'today', 'week', 'month'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  dateFilter === d ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {d === 'all' ? 'All Time' : d === 'week' ? 'Past 7 Days' : d === 'month' ? 'Past 30 Days' : 'Today'}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap pl-1">Status:</span>
          {['ALL', 'Pending', 'Confirmed', 'Cancelled'].map((st) => {
            const count = st === 'ALL' ? orders.length : orders.filter((o) => o.orderStatus === st).length;
            const isSelected = selectedStatusFilter === st;

            return (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium text-xs transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{st === 'ALL' ? 'All Statuses' : st}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No orders found</h3>
            <p className="text-xs text-slate-500 mt-1">
              No customer orders match your active filter criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (Optimized for Phones) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const statusInfo = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.Pending;

                return (
                  <div key={order.orderId} className="p-4 space-y-3">
                    {/* Card Top: Order ID, Date & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{order.orderId}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                      >
                        {statusInfo.icon}
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Customer & Address */}
                    <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{order.customerName}</span>
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="text-emerald-700 font-semibold flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {order.customerPhone}
                        </a>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{order.deliveryAddress}</p>
                    </div>

                    {/* Ordered Items Preview */}
                    <div className="text-xs space-y-1">
                      {order.items.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-slate-700">
                          <span className="truncate max-w-[200px] text-slate-800">
                            {it.quantity}× {it.productNameSnapshot}
                          </span>
                          <span className="font-mono text-slate-600">
                            {formatCurrency(it.unitPriceSnapshot * it.quantity)}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <span className="text-[10px] text-slate-400 block font-medium">
                          +{order.items.length - 3} more item(s)
                        </span>
                      )}
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total ({order.paymentMethod.replace(/_/g, ' ')})</span>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => handlePrintInvoice(order)}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Slip
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop & Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Ordered Products</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const statusInfo = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.Pending;

                  return (
                    <tr key={order.orderId} className="hover:bg-slate-50/60 transition-colors">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-mono font-bold text-slate-900 block">{order.orderId}</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-900 block">{order.customerName}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {order.customerPhone}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {order.deliveryAddress}
                        </span>
                      </td>

                      {/* Products */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md text-[10px]">
                                {it.quantity}×
                              </span>
                              <span className="truncate max-w-xs">{it.productNameSnapshot}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-extrabold text-slate-900 block">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Subtotal: {formatCurrency(order.subtotal)}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="uppercase text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md block w-fit">
                          {order.paymentMethod.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-semibold block mt-1 ${
                            order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {order.paymentStatus === 'paid' ? '● Paid' : '○ Cash on Delivery'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                        >
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right space-x-1.5 whitespace-nowrap">
                        {order.orderStatus === 'Pending' && (
                          <>
                            <button
                              onClick={() => setStatusChangeModal({ order, targetStatus: 'Confirmed' })}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Confirm Order"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Confirm
                            </button>
                            <button
                              onClick={() => setStatusChangeModal({ order, targetStatus: 'Cancelled' })}
                              className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Cancel Order"
                            >
                              <XCircle className="w-3 h-3" />
                              Cancel
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>

                        <button
                          onClick={() => handlePrintInvoice(order)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-700">{selectedOrder.orderId}</span>
                <h2 className="text-base font-extrabold text-slate-900">Order Management & Inspection</h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Status Transition Actions */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Current Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      STATUS_CONFIG[selectedOrder.orderStatus]?.bg
                    } ${STATUS_CONFIG[selectedOrder.orderStatus]?.text}`}
                  >
                    {selectedOrder.orderStatus}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Change Status to:</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Confirmed', 'Cancelled'] as OrderStatus[]).map((st) => {
                      const isCurrent = selectedOrder.orderStatus === st;
                      const isConfirmed = st === 'Confirmed';
                      return (
                        <button
                          key={st}
                          disabled={isCurrent}
                          onClick={() =>
                            setStatusChangeModal({
                              order: selectedOrder,
                              targetStatus: st,
                            })
                          }
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                            isCurrent
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : isConfirmed
                              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                          }`}
                        >
                          {isConfirmed ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isCurrent ? 'Current (Confirmed)' : 'Confirmed'}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>{isCurrent ? 'Current (Cancelled)' : 'Cancelled'}</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 text-xs space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Name</span>
                    <strong className="text-slate-900">{selectedOrder.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone</span>
                    <strong className="text-slate-900">{selectedOrder.customerPhone}</strong>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Delivery Address</span>
                  <span className="text-slate-800 font-medium">{selectedOrder.deliveryAddress}</span>
                </div>
                {selectedOrder.customerNote && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                    <span className="font-bold block text-[10px]">Customer Note:</span>
                    {selectedOrder.customerNote}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  Ordered Items ({selectedOrder.items.length})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {it.imageUrl ? (
                            <img
                              src={it.imageUrl}
                              alt={it.productNameSnapshot}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 line-clamp-1">{it.productNameSnapshot}</h5>
                          <div className="text-[11px] text-slate-500">
                            {formatCurrency(it.unitPriceSnapshot)} × {it.quantity} {it.unit}
                          </div>
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900">{formatCurrency(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Items Subtotal</span>
                  <span className="font-semibold">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Delivery Charge</span>
                  <span className="font-semibold">{formatCurrency(selectedOrder.deliveryCharge)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total Amount</span>
                  <span className="text-emerald-400 text-base">{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Status History Timeline Audit */}
              {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Status Audit Trail
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.statusHistory.map((hist, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>
                            {hist.previousStatus} → <strong className="text-emerald-700">{hist.newStatus}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(hist.changedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Updated by: <strong className="text-slate-700">{hist.changedBy}</strong>
                          {hist.notes && <span> • "{hist.notes}"</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printOrderSlip(selectedOrder, business)}
                  className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Print Dispatch Packing Slip with Barcode"
                >
                  <Printer className="w-4 h-4" />
                  Print Slip
                </button>

                <button
                  onClick={() => printOrderReceipt(selectedOrder, business)}
                  className="py-2.5 px-3.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Print Official Customer Receipt / Invoice"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  Customer Receipt
                </button>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="py-2.5 px-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {statusChangeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Confirm Status Change</h3>
            <p className="text-xs text-slate-600">
              Update order <strong>{statusChangeModal.order.orderId}</strong> status from{' '}
              <span className="font-semibold text-slate-800">{statusChangeModal.order.orderStatus}</span> to{' '}
              <span className="font-bold text-emerald-700">{statusChangeModal.targetStatus}</span>?
            </p>

            {statusChangeModal.targetStatus === 'Cancelled' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                ⚠️ Cancelling this order will automatically restore product inventory units back into stock.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fulfillment Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Courier tracking code or customer contacted"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setStatusChangeModal(null);
                  setStatusNote('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyStatusChange}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice / Packing Slip Modal */}
      {isInvoiceOpen && invoiceOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">Packing Slip / Store Invoice</span>
              <button
                onClick={() => setIsInvoiceOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Slip Paper */}
            <div id="printable-order-slip" className="border border-slate-200 rounded-2xl p-4 bg-white text-xs space-y-3 font-sans">
              <div className="text-center border-b border-slate-200 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">{storeName}</h3>
                {business?.address && <p className="text-[11px] text-slate-500">{business.address}</p>}
                {business?.phone && <p className="text-[11px] text-slate-500">Phone: {business.phone}</p>}
                <span className="inline-block mt-2 font-mono font-bold text-sm bg-slate-100 px-3 py-1 rounded-lg">
                  {invoiceOrder.orderId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <strong>Customer:</strong> {invoiceOrder.customerName}
                  <br />
                  <strong>Phone:</strong> {invoiceOrder.customerPhone}
                </div>
                <div>
                  <strong>Date:</strong> {new Date(invoiceOrder.createdAt).toLocaleDateString()}
                  <br />
                  <strong>Payment:</strong> {invoiceOrder.paymentMethod.toUpperCase()}
                </div>
                <div className="col-span-2">
                  <strong>Delivery Address:</strong> {invoiceOrder.deliveryAddress}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-1 pt-1">
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Items Checklist</span>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Price</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceOrder.items.map((it, i) => (
                      <tr key={i}>
                        <td className="py-1.5 font-semibold text-slate-900">{it.productNameSnapshot}</td>
                        <td className="py-1.5 text-center font-bold">{it.quantity}</td>
                        <td className="py-1.5 text-right">{formatCurrency(it.unitPriceSnapshot)}</td>
                        <td className="py-1.5 text-right font-bold">{formatCurrency(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-2 space-y-1 text-right">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoiceOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery Charge:</span>
                  <span>{formatCurrency(invoiceOrder.deliveryCharge)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total Amount Due:</span>
                  <span className="text-emerald-700">{formatCurrency(invoiceOrder.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsInvoiceOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => printOrderReceipt(invoiceOrder, business)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-200"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                Customer Receipt
              </button>
              <button
                onClick={() => printOrderSlip(invoiceOrder, business)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print Packing Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
