import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Package,
  DollarSign,
  TrendingUp,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  ShieldCheck,
  Activity,
  Calendar,
  LogOut,
  MessageCircle,
  Mail,
  Phone,
  Settings,
  Headphones,
  LifeBuoy,
  Save,
  Filter,
  Clock,
  ExternalLink,
  Check,
  AlertTriangle,
  ClipboardList,
  Truck,
  MapPin
} from 'lucide-react';
import { db } from '../../services/storage';
import { Business, User, SupportSettings, SupportTicket, Order } from '../../types';
import { formatCurrency, formatDate } from '../../utils/codeGenerators';
import { Logo } from '../common/Logo';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';

interface SuperAdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchToBusiness: (business: Business) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUser,
  onLogout,
  onSwitchToBusiness,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'workspaces' | 'orders' | 'support_settings' | 'support_tickets'>('workspaces');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderBusinessFilter, setOrderBusinessFilter] = useState<string>('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [inspectOrder, setInspectOrder] = useState<Order | null>(null);
  const { t } = useLanguage();

  // Support Settings state
  const [supportSettings, setSupportSettings] = useState<SupportSettings>(() => db.getSupportSettings());
  const [isSettingsSaved, setIsSettingsSaved] = useState(false);

  // Support Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // New business fields
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('৳');

  const loadData = () => {
    setBusinesses(db.getBusinesses());
    setSupportSettings(db.getSupportSettings());
    setTickets(db.getSupportTickets());
    setOrders(db.getAllOrders());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('spm_order_update', handleUpdate);
    window.addEventListener('spm_storage_update', handleUpdate);
    return () => {
      window.removeEventListener('spm_order_update', handleUpdate);
      window.removeEventListener('spm_storage_update', handleUpdate);
    };
  }, []);

  const stats = db.getPlatformStats();
  const logs = db.getAuditLogs();

  const handleToggleStatus = (biz: Business) => {
    const nextStatus = biz.status === 'active' ? 'suspended' : 'active';
    db.updateBusiness(biz.id, { status: nextStatus });
    loadData();
  };

  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    db.registerBusiness({
      name: name.trim(),
      ownerName: ownerName.trim() || 'Store Owner',
      email: email.trim(),
      password: 'password123',
      phone: phone.trim(),
      currencySymbol: currencySymbol.trim() || '৳',
    });

    setIsAddOpen(false);
    setName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    loadData();
  };

  const handleSaveSupportSettings = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSupportSettings(supportSettings);
    setIsSettingsSaved(true);
    setTimeout(() => setIsSettingsSaved(false), 3000);
    loadData();
  };

  const handleTicketStatusChange = (id: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    db.updateSupportTicketStatus(id, newStatus);
    loadData();
  };

  const filteredBusinesses = businesses.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.email.toLowerCase().includes(q);
  });

  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === 'all') return true;
    return t.status === ticketFilter;
  });

  const openTicketsCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Super Admin Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo size="sm" variant="mark" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-tight text-white">Smart Product Manager</h1>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30">
                  Super Admin Panel
                </span>
              </div>
              <p className="text-[11px] text-slate-400">SPM Multi-Tenant Governance & Support Settings Hub</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageSwitcher variant="header" />
            <span className="text-xs text-slate-400 hidden sm:inline">
              {currentUser.name}
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> {t('logout', 'Logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1 w-full">
        {/* Navigation Tabs for Super Admin */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveAdminTab('workspaces')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeAdminTab === 'workspaces'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Workspaces ({businesses.length})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('orders')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative ${
                activeAdminTab === 'orders'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <span>Marketplace Orders</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-amber-300 text-[10px] font-black">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveAdminTab('support_settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeAdminTab === 'support_settings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Support Contact Settings</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('support_tickets')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative ${
                activeAdminTab === 'support_tickets'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Headphones className="w-4 h-4 text-amber-400" />
              <span>Support Tickets</span>
              {openTicketsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black">
                  {openTicketsCount}
                </span>
              )}
            </button>
          </div>

          {activeAdminTab === 'workspaces' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Provision New Business
            </button>
          )}
        </div>

        {/* TAB 1: Workspaces Overview & Metrics */}
        {activeAdminTab === 'workspaces' && (
          <div className="space-y-8">
            {/* Platform Overview KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Registered Businesses</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{stats.totalBusinesses}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">Independent Tenants</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Total System Products</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{stats.totalProducts}</span>
                  <span className="text-[11px] text-blue-600 font-medium">Across all shops</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Total Completed Orders</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{stats.totalSalesCount}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">Platform-wide sales</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Platform Total Revenue</span>
                  <span className="text-3xl font-black text-emerald-700 mt-1 block">
                    {formatCurrency(stats.totalRevenue)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Cumulative Gross</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Businesses Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Registered Supermarkets & Shops</h2>
                  <p className="text-xs text-slate-500">List of independent tenant businesses hosted on this platform.</p>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search business by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Business / Store</th>
                      <th className="py-3.5 px-4">Business ID</th>
                      <th className="py-3.5 px-4">Owner & Contact</th>
                      <th className="py-3.5 px-4 text-center">Products</th>
                      <th className="py-3.5 px-4 text-center">Total Sales</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredBusinesses.map((biz) => {
                      const bProducts = db.getProducts(biz.id);
                      const bSales = db.getSales(biz.id);
                      const bRev = bSales.reduce((acc, s) => acc + s.totalAmount, 0);

                      return (
                        <tr key={biz.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 text-sm block">{biz.name}</span>
                            <span className="text-[11px] text-slate-400">{biz.address || 'Address not set'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{biz.id}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-900 block">{biz.ownerName}</span>
                            <span className="text-[11px] text-slate-400">{biz.email}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800">{bProducts.length} items</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-bold text-emerald-700 block">{formatCurrency(bRev, biz.currencySymbol)}</span>
                            <span className="text-[10px] text-slate-400">{bSales.length} orders</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                biz.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {biz.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSwitchToBusiness(biz)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" /> Enter Dashboard
                              </button>
                              <button
                                onClick={() => handleToggleStatus(biz)}
                                className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                                  biz.status === 'active'
                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {biz.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Multi-Vendor Marketplace Orders (Super Admin Global View) */}
        {activeAdminTab === 'orders' && (
          <div className="space-y-6">
            {/* Global Marketplace Order Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Total Orders</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{orders.length}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">All Stores Combined</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Pending Fulfillment</span>
                  <span className="text-3xl font-black text-amber-600 mt-1 block">
                    {orders.filter((o) => o.orderStatus === 'Pending').length}
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">Awaiting merchant action</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Delivered Orders</span>
                  <span className="text-3xl font-black text-emerald-700 mt-1 block">
                    {orders.filter((o) => o.orderStatus === 'Delivered').length}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium">Completed Deliveries</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Marketplace GMV</span>
                  <span className="text-3xl font-black text-emerald-700 mt-1 block">
                    {formatCurrency(
                      orders
                        .filter((o) => o.orderStatus !== 'Cancelled')
                        .reduce((acc, o) => acc + o.totalAmount, 0)
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Gross Marketplace Value</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="relative sm:col-span-6">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by Order ID, customer name, phone, address..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={orderBusinessFilter}
                    onChange={(e) => setOrderBusinessFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Stores ({businesses.length})</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Packed">Packed</option>
                    <option value="Ready">Ready for Delivery</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">All Marketplace Orders</h2>
                  <p className="text-xs text-slate-500">Live platform customer orders across all vendor shops.</p>
                </div>
                <span className="text-xs text-slate-400 font-bold">{orders.length} total records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Order ID & Date</th>
                      <th className="p-4">Store / Business</th>
                      <th className="p-4">Customer & Phone</th>
                      <th className="p-4">Items & Details</th>
                      <th className="p-4">Total Amount</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4">Order Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {orders
                      .filter((o) => {
                        if (orderBusinessFilter !== 'ALL' && o.businessId !== orderBusinessFilter) return false;
                        if (orderStatusFilter !== 'ALL' && o.orderStatus !== orderStatusFilter) return false;
                        if (orderSearchQuery.trim()) {
                          const q = orderSearchQuery.toLowerCase();
                          const matchId = o.id.toLowerCase().includes(q);
                          const matchCust = o.customerName.toLowerCase().includes(q);
                          const matchPhone = o.customerPhone.toLowerCase().includes(q);
                          const matchStore = (o.businessNameSnapshot || '').toLowerCase().includes(q);
                          const matchAddr = o.deliveryAddress.toLowerCase().includes(q);
                          if (!matchId && !matchCust && !matchPhone && !matchStore && !matchAddr) return false;
                        }
                        return true;
                      })
                      .map((order) => {
                        const statusColors: Record<string, string> = {
                          Pending: 'bg-amber-100 text-amber-800 border-amber-200',
                          Confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
                          Packed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                          Ready: 'bg-purple-100 text-purple-800 border-purple-200',
                          'In Transit': 'bg-cyan-100 text-cyan-800 border-cyan-200',
                          Delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          Cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
                        };

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4">
                              <span className="font-mono font-bold text-slate-900 block">{order.id}</span>
                              <span className="text-[10px] text-slate-400">{formatDate(order.createdAt)}</span>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>{order.businessNameSnapshot || order.businessId}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block">{order.businessId}</span>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-slate-900 block">{order.customerName}</span>
                              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {order.customerPhone}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-800 font-bold block">{order.items.length} items</span>
                              <span className="text-[10px] text-slate-400 truncate max-w-xs block">
                                {order.items.map((i) => `${i.productNameSnapshot} (x${i.quantity})`).join(', ')}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-black text-slate-900 text-sm">
                                {formatCurrency(order.totalAmount)}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold uppercase">
                                {order.paymentMethod}
                              </span>
                              <span className={`block text-[10px] font-semibold mt-0.5 ${order.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {order.paymentStatus}
                              </span>
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  statusColors[order.orderStatus] || 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {order.orderStatus}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setInspectOrder(order)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Super Admin Inspect Order Modal */}
            {inspectOrder && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900">Order #{inspectOrder.id}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                          {inspectOrder.orderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Placed on {formatDate(inspectOrder.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => setInspectOrder(null)}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Merchant & Customer summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Fulfilling Merchant</span>
                      <strong className="text-slate-900 text-sm block">{inspectOrder.businessNameSnapshot}</strong>
                      <span className="text-slate-500">ID: {inspectOrder.businessId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer & Shipping</span>
                      <strong className="text-slate-900 block">{inspectOrder.customerName}</strong>
                      <span className="text-slate-600 block">📞 {inspectOrder.customerPhone}</span>
                      <span className="text-slate-600 block">📍 {inspectOrder.deliveryAddress}</span>
                    </div>
                  </div>

                  {/* Items snapshot table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items (Snapshot)</h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {inspectOrder.items.map((item, idx) => (
                        <div key={idx} className="p-3.5 flex items-center justify-between text-xs bg-white">
                          <div>
                            <span className="font-bold text-slate-900 block">{item.productNameSnapshot}</span>
                            <span className="text-slate-400 text-[11px]">
                              {formatCurrency(item.unitPriceSnapshot)} × {item.quantity} {item.unitSnapshot}
                            </span>
                          </div>
                          <span className="font-extrabold text-slate-900">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Grand Total</span>
                      <span className="text-2xl font-black text-emerald-400">{formatCurrency(inspectOrder.totalAmount)}</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-400 block">Payment Method</span>
                      <span className="font-bold text-white uppercase">{inspectOrder.paymentMethod} • {inspectOrder.paymentStatus}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setInspectOrder(null)}
                      className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Support Contact Settings (Admin Configuration) */}
        {activeAdminTab === 'support_settings' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Admin Support Settings</h2>
                <p className="text-xs text-slate-500">
                  Configure real WhatsApp, Messenger, Gmail, and phone contact info displayed to all users.
                </p>
              </div>
            </div>

            {isSettingsSaved && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center gap-2.5 font-bold animate-in fade-in duration-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Support contact information updated successfully! All users will now see these new links.</span>
              </div>
            )}

            <form onSubmit={handleSaveSupportSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* WhatsApp Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp Contact Number</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supportSettings.whatsappNumber}
                    onChange={(e) =>
                      setSupportSettings({ ...supportSettings, whatsappNumber: e.target.value })
                    }
                    placeholder="e.g. +8801700000000"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Include country code (e.g. +88017...)</p>
                </div>

                {/* Facebook Messenger URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span>Facebook Messenger URL</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={supportSettings.facebookMessengerUrl}
                    onChange={(e) =>
                      setSupportSettings({ ...supportSettings, facebookMessengerUrl: e.target.value })
                    }
                    placeholder="e.g. https://m.me/smartproductmanager"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Messenger direct link (https://m.me/...)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Support Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span>Support Gmail / Email Address</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={supportSettings.supportEmail}
                    onChange={(e) =>
                      setSupportSettings({ ...supportSettings, supportEmail: e.target.value })
                    }
                    placeholder="e.g. support.spm@gmail.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Target email for support mailto buttons</p>
                </div>

                {/* Support Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-700" />
                    <span>Support Phone Hotline</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supportSettings.supportPhone}
                    onChange={(e) =>
                      setSupportSettings({ ...supportSettings, supportPhone: e.target.value })
                    }
                    placeholder="e.g. +880 1700-000000"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Direct call hotline for immediate help</p>
                </div>
              </div>

              {/* WhatsApp Preset Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Default Preset Message
                </label>
                <input
                  type="text"
                  value={supportSettings.whatsappPresetMessage || ''}
                  onChange={(e) =>
                    setSupportSettings({ ...supportSettings, whatsappPresetMessage: e.target.value })
                  }
                  placeholder="e.g. Hello Smart Product Manager Support, I need assistance with "
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Text automatically pre-filled when a user clicks the WhatsApp support button.
                </p>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Support Contact Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: Support Tickets & Problem Reports */}
        {activeAdminTab === 'support_tickets' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Submitted Support Tickets & Reports</h2>
                <p className="text-xs text-slate-500">
                  Problem reports submitted by business owners and platform users.
                </p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-2">
                {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTicketFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                      ticketFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'in_progress' ? 'In Progress' : st}
                  </button>
                ))}
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="p-12 text-center space-y-3 text-slate-400">
                <LifeBuoy className="w-12 h-12 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600">No support tickets found</p>
                <p className="text-xs text-slate-400">No support requests match the selected filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {filteredTickets.map((ticket) => (
                  <div key={ticket.id} className="p-5 hover:bg-slate-50/80 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          #{ticket.id}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{ticket.category}</span>
                        <span className="text-[11px] text-slate-400">• {formatDate(ticket.createdAt)}</span>
                      </div>

                      {/* Status selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">Status:</span>
                        <select
                          value={ticket.status}
                          onChange={(e) =>
                            handleTicketStatusChange(
                              ticket.id,
                              e.target.value as 'open' | 'in_progress' | 'resolved'
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold focus:outline-none border cursor-pointer ${
                            ticket.status === 'open'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : ticket.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          <option value="open">Open (Unresolved)</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Submitted By
                        </span>
                        <span className="font-bold text-slate-900 block mt-0.5">{ticket.userName}</span>
                        <span className="text-slate-500 text-[11px] font-mono">{ticket.email}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Business / Workspace
                        </span>
                        <span className="font-bold text-slate-800 block mt-0.5">{ticket.businessName}</span>
                        {ticket.businessId && (
                          <span className="text-[10px] text-purple-600 font-mono">ID: {ticket.businessId}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://wa.me/${supportSettings.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hello ${ticket.userName}, regarding your support ticket #${ticket.id} (${ticket.category})...`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>

                        <a
                          href={`mailto:${ticket.email}?subject=${encodeURIComponent(
                            `[SPM Support Reply] Ticket #${ticket.id} - ${ticket.category}`
                          )}`}
                          className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" /> Email
                        </a>
                      </div>
                    </div>

                    {/* Problem Description */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                      <span className="font-bold text-slate-900 block mb-1 text-[11px]">Problem Description:</span>
                      {ticket.description}
                    </div>

                    {/* Screenshot attachment preview */}
                    {ticket.screenshotUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-bold text-slate-500">Attachment:</span>
                        <button
                          onClick={() => setSelectedScreenshot(ticket.screenshotUrl!)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" /> View Uploaded Screenshot
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global Security Audit Log */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-extrabold text-slate-900">Platform Security & Audit Log</h3>
            </div>
            <span className="text-xs text-slate-400">{logs.length} logged events</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs">
            {logs.slice(0, 15).map((log, idx) => (
              <div key={`${log.id}-${idx}`} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 uppercase">[{log.action}]</span>{' '}
                  <span className="text-slate-600">{log.details}</span>{' '}
                  <span className="text-purple-700 font-semibold">(Tenant: {log.businessId || 'N/A'})</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(log.timestamp || log.createdAt || '')}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Provision Business Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-extrabold text-slate-900 mb-4">Provision New Business Tenant</h3>

            <form onSubmit={handleCreateBusiness} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supermarket Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Mart Express"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Smith"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Owner Email (Login) *</label>
                <input
                  type="email"
                  required
                  placeholder="robert@metromart.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-2xl p-4 overflow-hidden shadow-2xl">
            <button
              onClick={() => setSelectedScreenshot(null)}
              className="absolute top-3 right-3 p-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <h4 className="font-bold text-sm text-slate-800 mb-3">Support Ticket Screenshot Attachment</h4>
            <div className="max-h-[80vh] overflow-auto rounded-xl border border-slate-200">
              <img src={selectedScreenshot} alt="Support Screenshot" className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
