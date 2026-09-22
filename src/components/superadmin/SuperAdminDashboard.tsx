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
  MapPin,
  Trash2,
  UserX,
  UserCheck,
  Key,
  Copy,
  Store,
  AlertOctagon,
  UserPlus,
  Shield,
  Briefcase,
  Layers,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import { db } from '../../services/storage';
import { adminApi } from '../../services/adminApi';
import { Business, User, UserRole, SupportSettings, SupportTicket, Order, Product } from '../../types';
import { formatCurrency, formatDate } from '../../utils/codeGenerators';
import { Logo } from '../common/Logo';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import { SmtpDiagnosticPanel } from './SmtpDiagnosticPanel';

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
  // Security validation: verify super_admin role
  if (currentUser.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-rose-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 mb-6">
            Super Administrator permissions are required to access this portal. Your session does not have administrative clearance.
          </p>
          <button
            onClick={onLogout}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'workspaces' | 'products' | 'orders' | 'support_settings' | 'support_tickets' | 'smtp_diagnostics'>('users');
  const [userSubTab, setUserSubTab] = useState<'all_users' | 'business_owners'>('all_users');
  
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Search & Filter states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productStoreFilter, setProductStoreFilter] = useState<string>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderBusinessFilter, setOrderBusinessFilter] = useState<string>('ALL');
  
  // Action Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [alsoDeleteAssociatedStore, setAlsoDeleteAssociatedStore] = useState(true);
  const [businessOwnerToDelete, setBusinessOwnerToDelete] = useState<Business | null>(null);
  const [businessOwnerToDeactivate, setBusinessOwnerToDeactivate] = useState<Business | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  // New User Creation fields
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('staff');
  const [newUserBusinessId, setNewUserBusinessId] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState('');

  const loadData = () => {
    setUsers(db.getUsers());
    setBusinesses(db.getBusinesses());
    setProducts(db.getAllProductsRaw());
    setSupportSettings(db.getSupportSettings());
    setTickets(db.getSupportTickets());
    setOrders(db.getAllOrders());
  };

  useEffect(() => {
    loadData();

    // Verify Super Admin server session in background
    adminApi.getAdminToken(currentUser).catch(err => {
      console.warn('Super Admin server token background check:', err);
    });

    const handleUpdate = () => loadData();
    window.addEventListener('spm_order_update', handleUpdate);
    window.addEventListener('spm_storage_update', handleUpdate);
    window.addEventListener('spm_product_update', handleUpdate);
    return () => {
      window.removeEventListener('spm_order_update', handleUpdate);
      window.removeEventListener('spm_storage_update', handleUpdate);
      window.removeEventListener('spm_product_update', handleUpdate);
    };
  }, [currentUser]);

  const stats = db.getPlatformStats();
  const logs = db.getAuditLogs();

  const copyToClipboard = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------------------
  // USER & BUSINESS OWNER ACTIONS (WITH SERVER ENFORCEMENT & CONFIRMATIONS)
  // -------------------------------------------------------------------------

  // Delete User Account
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsProcessing(true);
    setActionError(null);

    // Strict Super Admin Verification
    if ((currentUser.email || '').toLowerCase() !== 'imranmahmud1122.test@gmail.com') {
      setActionError('Security policy: Only Super Admin (imranmahmud1122.test@gmail.com) is permitted to delete users.');
      setIsProcessing(false);
      return;
    }

    const targetUserId = userToDelete.id;
    const targetBusinessId = userToDelete.businessId;
    const shouldPurgeStore = alsoDeleteAssociatedStore && Boolean(targetBusinessId);

    // Root Super Admin protection check: EXACTLY ONE Super Admin exists: Imran Mahmud (imranmahmud1122.test@gmail.com)
    const targetEmail = (userToDelete.email || '').toLowerCase().trim();
    const targetName = (userToDelete.name || '').toLowerCase().trim();
    const isTargetRootAdmin = targetEmail === 'imranmahmud1122.test@gmail.com' &&
      (targetName === 'imran mahmud' || targetName === 'imran');

    if (
      targetUserId === 'USR-ADMIN-IMRAN' ||
      isTargetRootAdmin
    ) {
      setActionError('Security policy: The single designated Super Admin account (Imran Mahmud) cannot be deleted.');
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Delete user locally and from Firestore
      db.deleteUser(targetUserId, currentUser);

      // 2. Notify backend server-side admin endpoint
      try {
        await adminApi.deleteUser(targetUserId, currentUser);
      } catch (srvErr) {
        console.warn('Notice from server user deletion endpoint:', srvErr);
      }

      // 3. If cascade store purge is requested, delete the associated business workspace
      if (shouldPurgeStore && targetBusinessId) {
        try {
          db.deleteBusiness(targetBusinessId, currentUser);
          await adminApi.deleteBusinessOwner(targetBusinessId, currentUser);
        } catch (bizErr) {
          console.warn('Notice deleting associated store workspace:', bizErr);
        }
      }
      
      setUserToDelete(null);
      setAlsoDeleteAssociatedStore(true);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete user.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Product by Super Admin
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsProcessing(true);
    setActionError(null);

    // Strict Super Admin Verification
    if ((currentUser.email || '').toLowerCase() !== 'imranmahmud1122.test@gmail.com') {
      setActionError('Security policy: Only Super Admin (imranmahmud1122.test@gmail.com) is permitted to delete products.');
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Delete locally and from Firestore
      await db.deleteProduct(productToDelete.businessId, productToDelete.id, currentUser);

      // 2. Notify backend server-side admin endpoint
      try {
        await adminApi.deleteProduct(productToDelete.id, currentUser);
      } catch (srvErr) {
        console.warn('Notice from server product deletion endpoint:', srvErr);
      }

      setProductToDelete(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete product.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Order by Super Admin
  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsProcessing(true);
    setActionError(null);

    // Strict Super Admin Verification
    if ((currentUser.email || '').toLowerCase() !== 'imranmahmud1122.test@gmail.com') {
      setActionError('Security policy: Only Super Admin (imranmahmud1122.test@gmail.com) is permitted to delete orders.');
      setIsProcessing(false);
      return;
    }

    const orderId = orderToDelete.orderId || orderToDelete.id;

    try {
      // 1. Delete locally and from Firestore
      db.deleteOrder(orderId, currentUser);

      // 2. Notify backend server-side admin endpoint
      try {
        await adminApi.deleteOrder(orderId, currentUser);
      } catch (srvErr) {
        console.warn('Notice from server order deletion endpoint:', srvErr);
      }

      setOrderToDelete(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete order.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle User Status
  const handleToggleUserStatus = (targetUser: User) => {
    const nextStatus = targetUser.status === 'active' ? 'deactivated' : 'active';
    try {
      db.updateUserStatus(targetUser.id, nextStatus, currentUser);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  // Delete Business Owner & Store Workspace
  const handleConfirmDeleteBusinessOwner = async () => {
    if (!businessOwnerToDelete) return;
    setIsProcessing(true);
    setActionError(null);

    // Strict Super Admin Verification
    if ((currentUser.email || '').toLowerCase() !== 'imranmahmud1122.test@gmail.com') {
      setActionError('Security policy: Only Super Admin (imranmahmud1122.test@gmail.com) is permitted to delete business owners.');
      setIsProcessing(false);
      return;
    }

    const targetBizId = businessOwnerToDelete.id;

    try {
      // 1. Synchronize local store & firestore
      db.deleteBusiness(targetBizId, currentUser);

      // 2. Enforce backend server-side permission & audit check
      try {
        await adminApi.deleteBusinessOwner(targetBizId, currentUser);
      } catch (srvErr) {
        console.warn('Notice from server business owner deletion endpoint:', srvErr);
      }

      setBusinessOwnerToDelete(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete business owner.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Deactivate / Reactivate Business Owner
  const handleConfirmDeactivateBusinessOwner = async () => {
    if (!businessOwnerToDeactivate) return;
    setIsProcessing(true);
    setActionError(null);

    const nextStatus = businessOwnerToDeactivate.status === 'active' ? 'deactivated' : 'active';

    try {
      // 1. Enforce backend server-side permission
      const serverResult = await adminApi.updateBusinessOwnerStatus(businessOwnerToDeactivate.id, nextStatus, currentUser);
      if (!serverResult.success && serverResult.error) {
        throw new Error(serverResult.error);
      }

      // 2. Synchronize local store & firestore
      db.updateBusinessStatus(businessOwnerToDeactivate.id, nextStatus, currentUser);

      setBusinessOwnerToDeactivate(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update business owner status.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create User by Super Admin
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) return;

    try {
      db.addUser({
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        role: newUserRole,
        businessId: newUserRole === 'super_admin' ? '' : newUserBusinessId || 'SHOP-001',
        phone: newUserPhone.trim(),
      });

      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('staff');
      setNewUserBusinessId('');
      setNewUserPhone('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user.');
    }
  };

  // Create Business
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

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = (userSearchQuery || '').toLowerCase().trim();
    const matchesSearch =
      !q ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q) ||
      (u.phone && (u.phone || '').toLowerCase().includes(q)) ||
      (u.businessId && (u.businessId || '').toLowerCase().includes(q));

    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filtered Business Owners
  const businessOwners = users.filter((u) => u.role === 'business_owner' || u.role === 'owner');
  const filteredBusinessOwners = businessOwners
    .map((u) => {
      const biz = businesses.find((b) => b.ownerId === u.id || (u.businessId && b.id === u.businessId));
      const fallbackBiz: Business = {
        id: u.businessId || 'UNASSIGNED',
        name: u.businessName || 'Store Workspace Pending',
        ownerName: u.name,
        ownerId: u.id,
        email: u.email,
        phone: u.phone || '',
        address: '',
        businessType: 'Other',
        currencySymbol: '৳',
        taxRate: 0,
        status: (u.status as any) || 'active',
        createdAt: u.createdAt || new Date().toISOString(),
      };
      return {
        user: u,
        biz: biz || fallbackBiz,
        hasStore: !!biz,
      };
    })
    .filter(({ user: u, biz: b }) => {
      const q = (userSearchQuery || '').toLowerCase().trim();
      const matchesSearch =
        !q ||
        (b.name || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q) ||
        (u.phone && (u.phone || '').toLowerCase().includes(q));

      const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter || b.status === userStatusFilter;
      return matchesSearch && matchesStatus;
    });

  const filteredBusinesses = businesses.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (b.name || '').toLowerCase().includes(q) || (b.id || '').toLowerCase().includes(q) || (b.email || '').toLowerCase().includes(q);
  });

  const filteredProducts = products.filter((p) => {
    const q = (productSearchQuery || '').toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q);

    const matchesStore =
      productStoreFilter === 'ALL' || p.businessId === productStoreFilter;

    return matchesSearch && matchesStore;
  });

  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === 'all') return true;
    return t.status === ticketFilter;
  });

  const openTicketsCount = tickets.filter((t) => t.status === 'open').length;

  const roleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3 h-3 text-purple-600" /> Super Admin
          </span>
        );
      case 'business_owner':
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
            <Store className="w-3 h-3 text-blue-600" /> Business Owner
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Briefcase className="w-3 h-3 text-amber-600" /> Store Manager
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <DollarSign className="w-3 h-3 text-emerald-600" /> Cashier / POS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Users className="w-3 h-3 text-slate-500" /> {role}
          </span>
        );
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200" title="Account inactive pending Gmail verification">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Pending Gmail
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Suspended
          </span>
        );
      case 'deactivated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Deactivated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Super Admin Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo size="sm" variant="mark" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-tight text-white">Smart Product Manager</h1>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-400" /> Super Admin Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise User Governance, Multi-Tenant Store & Security Management</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageSwitcher variant="header" />
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className="text-[10px] text-purple-300 font-mono">ID: {currentUser.id}</span>
            </div>
            <button
              onClick={onLogout}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> {t('logout', 'Logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full">
        {/* Navigation Tabs for Super Admin */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveAdminTab('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === 'users'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 text-purple-300" />
              <span>User Management</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeAdminTab === 'users' ? 'bg-purple-900 text-purple-200' : 'bg-slate-200 text-slate-700'}`}>
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveAdminTab('workspaces')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === 'workspaces'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Store Workspaces ({businesses.length})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('products')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
                activeAdminTab === 'products'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4 text-emerald-400" />
              <span>Products Catalog ({products.length})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('orders')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
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
              onClick={() => setActiveAdminTab('support_tickets')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
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

            <button
              onClick={() => setActiveAdminTab('support_settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === 'support_settings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Support Contact</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('smtp_diagnostics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeAdminTab === 'smtp_diagnostics'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Mail className="w-4 h-4 text-purple-300" />
              <span>SMTP Diagnostics</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeAdminTab === 'users' && (
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add New User
              </button>
            )}
            {activeAdminTab === 'workspaces' && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Provision New Store
              </button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: SUPER ADMIN USER MANAGEMENT                            */}
        {/* ------------------------------------------------------------- */}
        {activeAdminTab === 'users' && (
          <div className="space-y-6">
            {/* User Management Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Total Registered Users</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{users.length}</span>
                  <span className="text-[11px] text-purple-600 font-medium">All User Roles Combined</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Business Owners</span>
                  <span className="text-3xl font-black text-blue-700 mt-1 block">{businessOwners.length}</span>
                  <span className="text-[11px] text-blue-600 font-medium">Store & Merchant Accounts</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Active Cashiers & Staff</span>
                  <span className="text-3xl font-black text-emerald-700 mt-1 block">
                    {users.filter((u) => u.role === 'cashier' || u.role === 'staff' || u.role === 'manager').length}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium">Store Operations Team</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Deactivated Accounts</span>
                  <span className="text-3xl font-black text-rose-700 mt-1 block">
                    {users.filter((u) => u.status === 'deactivated' || u.status === 'suspended').length}
                  </span>
                  <span className="text-[11px] text-rose-600 font-medium">Restricted / Suspended</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <UserX className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Sub-view Switcher & Filters */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-lg font-black text-slate-900">User Management & Role Governance</h2>
                  <p className="text-xs text-slate-500">
                    Oversee all platform registered users, assign roles, view unique User IDs & Business Owner IDs, and securely manage access.
                  </p>
                </div>

                {/* Sub-Tabs: All Users vs Business Owners */}
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setUserSubTab('all_users')}
                    className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      userSubTab === 'all_users'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    All Registered Users ({users.length})
                  </button>
                  <button
                    onClick={() => setUserSubTab('business_owners')}
                    className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                      userSubTab === 'business_owners'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Business Owners Directory ({businessOwners.length})
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={
                      userSubTab === 'all_users'
                        ? 'Search by name, email, unique User ID, phone, store...'
                        : 'Search by store name, business owner name, owner ID, store ID...'
                    }
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {userSubTab === 'all_users' && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value="ALL">All Roles ({users.length})</option>
                      <option value="super_admin">Super Admins</option>
                      <option value="business_owner">Business Owners</option>
                      <option value="manager">Store Managers</option>
                      <option value="cashier">Cashiers</option>
                      <option value="staff">Staff</option>
                      <option value="public_visitor">Public Visitors</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* SUB-TAB 1: ALL REGISTERED USERS TABLE                       */}
              {/* ----------------------------------------------------------- */}
              {userSubTab === 'all_users' && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse min-w-[880px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-40">Unique User ID</th>
                        <th className="py-3.5 px-4">User Name & Email</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Assigned Store</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4">Created</th>
                        <th className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-slate-900 z-10 min-w-[210px] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.3)]">
                          Actions & Deletion
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold">No registered users matched the filter criteria.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, idx) => {
                          const userBiz = businesses.find((b) => b.id === u.businessId);
                          // EXACTLY ONE Super Administrator on the platform:
                          // Name must match "Imran Mahmud" AND Email must match "imranmahmud1122.test@gmail.com"
                          const cleanUserEmail = (u.email || '').toLowerCase().trim();
                          const cleanUserName = (u.name || '').toLowerCase().trim();
                          const isRootAdmin = cleanUserEmail === 'imranmahmud1122.test@gmail.com' &&
                            (cleanUserName === 'imran mahmud' || cleanUserName === 'imran');
                          const isSelf = isRootAdmin ? (u.id === currentUser.id) : (u.id === currentUser.id && cleanUserName === (currentUser.name || '').toLowerCase().trim());

                          return (
                            <tr key={u.id ? `usr-${u.id}-${idx}` : `usr-idx-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              {/* Unique User ID */}
                              <td className="py-3.5 px-4 font-mono">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-purple-900 font-bold text-[11px]">
                                  <span>{u.id}</span>
                                  <button
                                    onClick={() => copyToClipboard(u.id, `user-${u.id}`)}
                                    title="Copy Unique User ID"
                                    className="p-0.5 hover:text-purple-600 cursor-pointer"
                                  >
                                    {copiedId === `user-${u.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* User Details */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0 border border-purple-200">
                                    {(u.name || u.email || 'User').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                      {u.name || u.email?.split('@')[0] || 'User'}
                                      {isSelf && (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{u.email}</div>
                                    {u.phone && <div className="text-[10px] text-slate-400">{u.phone}</div>}
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-3.5 px-4">{roleBadge(u.role)}</td>

                              {/* Store / Workspace */}
                              <td className="py-3.5 px-4">
                                {u.role === 'super_admin' ? (
                                  <span className="text-[11px] font-semibold text-purple-700">
                                    Global Platform
                                  </span>
                                ) : userBiz ? (
                                  <div>
                                    <span className="font-semibold text-slate-900 text-xs block">{userBiz.name}</span>
                                    <span className="text-[10px] font-mono text-slate-400">ID: {userBiz.id}</span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">No workspace assigned</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 text-center">{statusBadge(u.status || 'active')}</td>

                              {/* Created At */}
                              <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                {formatDate(u.createdAt)}
                              </td>

                              {/* Actions - Sticky Right Column */}
                              <td className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Quick Verify Gmail button for Pending users */}
                                  {!isRootAdmin && (u.status === 'pending' || !u.isGmailVerified) && (
                                    <button
                                      onClick={() => {
                                        db.updateUserStatus(u.id, 'active', currentUser);
                                        loadData();
                                      }}
                                      title="Approve and force-verify Gmail account"
                                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                                      <span className="hidden sm:inline">Verify Gmail</span>
                                    </button>
                                  )}

                                  {/* Toggle status */}
                                  {!isRootAdmin && !isSelf && (
                                    <button
                                      onClick={() => handleToggleUserStatus(u)}
                                      title={u.status === 'active' ? 'Deactivate User Account' : 'Activate User Account'}
                                      className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                                        u.status === 'active'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {u.status === 'active' ? (
                                        <>
                                          <UserX className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Deactivate</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Activate</span>
                                        </>
                                      )}
                                    </button>
                                  )}

                                  {/* Permanent Delete User / Root Protection Badge */}
                                  {isRootAdmin ? (
                                    <span
                                      className="px-2.5 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 inline-flex items-center gap-1.5 shadow-2xs"
                                      title="Designated Super Admin account is protected from deletion."
                                    >
                                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Root Admin (Protected)</span>
                                    </span>
                                  ) : isSelf ? (
                                    <span
                                      className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 inline-flex items-center gap-1.5 shadow-2xs"
                                      title="Currently active session user cannot delete own account."
                                    >
                                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Current Session</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setAlsoDeleteAssociatedStore(Boolean(u.businessId));
                                        setUserToDelete(u);
                                      }}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs hover:border-rose-400"
                                      title="Permanently Delete User Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      <span>Delete User</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* SUB-TAB 2: BUSINESS OWNERS DIRECTORY TABLE                  */}
              {/* ----------------------------------------------------------- */}
              {userSubTab === 'business_owners' && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-44">Business Owner ID</th>
                        <th className="py-3.5 px-4">Business / Store Name & ID</th>
                        <th className="py-3.5 px-4">Owner Contact & Profile</th>
                        <th className="py-3.5 px-4 text-center">Catalog & Sales</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4">Registered Date</th>
                        <th className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-slate-900 z-10 min-w-[280px] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.3)]">Actions & Deletion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredBusinessOwners.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Store className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold">No business owners matched the search criteria.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredBusinessOwners.map(({ user: ownerUser, biz, hasStore }, idx) => {
                          const ownerIdDisplay = ownerUser?.id || biz.ownerId || `BO-${(biz.id || '').replace('SHOP-', '')}`;
                          const bProducts = hasStore && biz.id !== 'UNASSIGNED' ? db.getProducts(biz.id) : [];
                          const bSales = hasStore && biz.id !== 'UNASSIGNED' ? db.getSales(biz.id) : [];
                          const bRev = bSales.reduce((acc, s) => acc + s.totalAmount, 0);

                          return (
                            <tr key={biz.id && biz.id !== 'UNASSIGNED' ? `bo-${biz.id}-${idx}` : `bo-usr-${ownerUser.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              {/* Unique Business Owner ID */}
                              <td className="py-3.5 px-4 font-mono">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-900 font-bold text-[11px]">
                                  <span>{ownerIdDisplay}</span>
                                  <button
                                    onClick={() => copyToClipboard(ownerIdDisplay, `bo-${biz.id}-${ownerUser.id}`)}
                                    title="Copy Business Owner ID"
                                    className="p-0.5 hover:text-blue-600 cursor-pointer"
                                  >
                                    {copiedId === `bo-${biz.id}-${ownerUser.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Store / Business Info */}
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900 text-sm">{biz.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {hasStore && biz.id !== 'UNASSIGNED' ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-purple-700 font-bold">
                                      Store ID: {biz.id}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 font-sans text-[10px] text-amber-700 font-bold border border-amber-200/60">
                                      No Store Assigned
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">{biz.businessType || 'Retail Store'}</span>
                                </div>
                                {biz.address && <div className="text-[10px] text-slate-400 mt-0.5">{biz.address}</div>}
                              </td>

                              {/* Owner Name & Contact */}
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 text-xs">{ownerUser?.name || biz.ownerName || 'Store Owner'}</div>
                                <div className="text-[11px] text-slate-500">{ownerUser?.email || biz.email}</div>
                                {(ownerUser?.phone || biz.phone) && <div className="text-[10px] text-slate-400">{ownerUser?.phone || biz.phone}</div>}
                              </td>

                              {/* Catalog & Sales */}
                              <td className="py-3.5 px-4 text-center">
                                {hasStore && biz.id !== 'UNASSIGNED' ? (
                                  <>
                                    <span className="font-bold text-slate-800 text-xs block">{bProducts.length} products</span>
                                    <span className="text-[10px] text-emerald-700 font-semibold">
                                      {formatCurrency(bRev, biz.currencySymbol)} ({bSales.length} orders)
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">No active store catalog</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 text-center">{statusBadge(biz.status || ownerUser?.status || 'active')}</td>

                              {/* Created Date */}
                              <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                {formatDate(ownerUser?.createdAt || biz.createdAt)}
                              </td>

                              {/* Actions - Sticky Right Column */}
                              <td className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Switch to workspace */}
                                  {hasStore && biz.id !== 'UNASSIGNED' ? (
                                    <button
                                      onClick={() => onSwitchToBusiness(biz)}
                                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Enter Business Store Dashboard"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Workspace</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleUserStatus(ownerUser)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Manage User Account"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Manage</span>
                                    </button>
                                  )}

                                  {/* Deactivate / Reactivate Owner */}
                                  {hasStore && biz.id !== 'UNASSIGNED' ? (
                                    <button
                                      onClick={() => setBusinessOwnerToDeactivate(biz)}
                                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-2xs ${
                                        biz.status === 'active'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                      title={biz.status === 'active' ? 'Deactivate Business Owner' : 'Reactivate Business Owner'}
                                    >
                                      {biz.status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleUserStatus(ownerUser)}
                                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-2xs ${
                                        ownerUser.status === 'active'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                      title={ownerUser.status === 'active' ? 'Deactivate User' : 'Activate User'}
                                    >
                                      {ownerUser.status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                  )}

                                  {/* Permanent Delete Business Owner */}
                                  {hasStore && biz.id !== 'UNASSIGNED' ? (
                                    <button
                                      onClick={() => setBusinessOwnerToDelete(biz)}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs hover:border-rose-300"
                                      title="Permanently Delete Business Owner & Store"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Permanent Delete</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setUserToDelete(ownerUser)}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs hover:border-rose-300"
                                      title="Permanently Delete User"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Permanent Delete</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: STORE WORKSPACES                                        */}
        {/* ------------------------------------------------------------- */}
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
                <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Business / Store</th>
                      <th className="py-3.5 px-4">Store ID & Owner ID</th>
                      <th className="py-3.5 px-4">Owner & Contact</th>
                      <th className="py-3.5 px-4 text-center">Products</th>
                      <th className="py-3.5 px-4 text-center">Total Sales</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-slate-900 z-10 min-w-[280px] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.3)]">Actions & Deletion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredBusinesses.map((biz, idx) => {
                      const bProducts = db.getProducts(biz.id);
                      const bSales = db.getSales(biz.id);
                      const bRev = bSales.reduce((acc, s) => acc + s.totalAmount, 0);

                      return (
                        <tr key={biz.id ? `biz-${biz.id}-${idx}` : `biz-idx-${idx}`} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 text-sm block">{biz.name}</span>
                            <span className="text-[11px] text-slate-400">{biz.address || 'Address not set'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                            <div>{biz.id}</div>
                            {biz.ownerId && <div className="text-[10px] text-blue-600 font-normal">Owner: {biz.ownerId}</div>}
                          </td>
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
                            {statusBadge(biz.status || 'active')}
                          </td>
                          <td className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSwitchToBusiness(biz)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Enter Business Dashboard"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Dashboard</span>
                              </button>
                              <button
                                onClick={() => setBusinessOwnerToDeactivate(biz)}
                                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-2xs ${
                                  biz.status === 'active'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title={biz.status === 'active' ? 'Suspend Store Operations' : 'Activate Store'}
                              >
                                {biz.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                onClick={() => setBusinessOwnerToDelete(biz)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs hover:border-rose-300"
                                title="Permanently Delete Store Workspace & All Data"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Permanent Delete</span>
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

        {/* ------------------------------------------------------------- */}
        {/* TAB: PRODUCTS CATALOG MANAGEMENT                             */}
        {/* ------------------------------------------------------------- */}
        {activeAdminTab === 'products' && (
          <div className="space-y-6">
            {/* Products Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Total Catalog Items</span>
                  <span className="text-3xl font-black text-slate-900 mt-1 block">{products.length}</span>
                  <span className="text-[11px] text-purple-600 font-medium">All Stores Combined</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">In-Stock Items</span>
                  <span className="text-3xl font-black text-emerald-600 mt-1 block">
                    {products.filter((p) => p.currentStock > (p.minStockLevel || 5)).length}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">Healthy inventory</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Low Stock Alerts</span>
                  <span className="text-3xl font-black text-amber-600 mt-1 block">
                    {products.filter((p) => p.currentStock > 0 && p.currentStock <= (p.minStockLevel || 5)).length}
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">Needs replenishment</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Out of Stock</span>
                  <span className="text-3xl font-black text-rose-600 mt-1 block">
                    {products.filter((p) => p.currentStock <= 0).length}
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">Unavailable for sale</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Multi-Store Product Inventory</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Super Admin level oversight and management across all vendor and store catalogs
                    </p>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by product name, SKU, barcode, category..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    />
                    {productSearchQuery && (
                      <button
                        onClick={() => setProductSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                    <select
                      value={productStoreFilter}
                      onChange={(e) => setProductStoreFilter(e.target.value)}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value="ALL">All Store Catalogs ({products.length})</option>
                      {businesses.map((b, idx) => (
                        <option key={b.id ? `b-filter-${b.id}-${idx}` : `b-filter-idx-${idx}`} value={b.id}>
                          {b.name} ({products.filter((p) => p.businessId === b.id).length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-4">SKU / Code</th>
                      <th className="py-3.5 px-4">Store Workspace</th>
                      <th className="py-3.5 px-4 text-right">Price</th>
                      <th className="py-3.5 px-4 text-center">Stock Level</th>
                      <th className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-slate-900 z-10 min-w-[130px] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.3)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="text-sm font-semibold">No products found</p>
                          <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or store filter</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p, idx) => {
                        const biz = businesses.find((b) => b.id === p.businessId);
                        const isLowStock = p.currentStock > 0 && p.currentStock <= (p.minStockLevel || 5);
                        const isOutOfStock = p.currentStock <= 0;

                        return (
                          <tr key={p.id ? `prod-${p.id}-${idx}` : `prod-idx-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-slate-900 block text-xs">{p.name || 'Unnamed Product'}</span>
                                  <span className="text-[10px] text-slate-400">{p.category || 'General'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                                {p.sku || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div>
                                <span className="font-semibold text-slate-800 text-xs block">{biz?.name || p.businessName || 'Store'}</span>
                                <span className="text-[10px] font-mono text-slate-400">ID: {p.businessId}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(p.sellingPrice, biz?.currencySymbol || '৳')}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                  isOutOfStock
                                    ? 'bg-rose-100 text-rose-800'
                                    : isLowStock
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {p.currentStock} in stock
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right pr-6 sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
                              <button
                                onClick={() => setProductToDelete(p)}
                                title="Permanently Delete Product"
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-rose-200 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: MARKETPLACE ORDERS                                     */}
        {/* ------------------------------------------------------------- */}
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
                      orders.filter((o) => o.orderStatus !== 'Cancelled').reduce((acc, o) => acc + o.totalAmount, 0)
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Gross Merchandise Value</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Orders List Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">All Marketplace Orders</h2>
                  <p className="text-xs text-slate-500">Live feed of all customer orders placed across all independent supermarket storefronts.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search order #, customer, phone..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 w-52"
                    />
                  </div>

                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processing">Processing</option>
                    <option value="Ready">Ready</option>
                    <option value="Out for Delivery">Out for Delivery</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  <select
                    value={orderBusinessFilter}
                    onChange={(e) => setOrderBusinessFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">All Stores</option>
                    {businesses.map((b, idx) => (
                      <option key={b.id ? `b-ord-${b.id}-${idx}` : `b-ord-idx-${idx}`} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Order Ref #</th>
                      <th className="py-3.5 px-4">Supermarket Store</th>
                      <th className="py-3.5 px-4">Customer Details</th>
                      <th className="py-3.5 px-4">Items / Total</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right sticky right-0 bg-slate-900 z-10 min-w-[130px] shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.3)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {orders
                      .filter((o) => {
                        const q = (orderSearchQuery || '').toLowerCase().trim();
                        const orderNum = o.orderId || o.id || '';
                        const storeName = o.storeNameSnapshot || o.businessNameSnapshot || '';
                        const matchesSearch =
                          !q ||
                          orderNum.toLowerCase().includes(q) ||
                          (o.customerName || '').toLowerCase().includes(q) ||
                          (o.customerPhone || '').toLowerCase().includes(q) ||
                          storeName.toLowerCase().includes(q);
                        const matchesStatus = orderStatusFilter === 'ALL' || o.orderStatus === orderStatusFilter;
                        const matchesBiz = orderBusinessFilter === 'ALL' || (o.storeId === orderBusinessFilter || o.businessId === orderBusinessFilter);
                        return matchesSearch && matchesStatus && matchesBiz;
                      })
                      .map((o, idx) => (
                        <tr key={o.id ? `ord-${o.id}-${idx}` : `ord-idx-${idx}`} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                            {o.orderId || o.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{o.storeNameSnapshot || o.businessNameSnapshot || 'Supermarket'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {o.storeId || o.businessId}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{o.customerName}</span>
                            <span className="text-[11px] text-slate-500">{o.customerPhone}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-emerald-700 block text-sm">{formatCurrency(o.totalAmount)}</span>
                            <span className="text-[10px] text-slate-500">{o.items?.length || 0} line items</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800">
                              {o.orderStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{formatDate(o.createdAt)}</td>
                          <td className="py-3.5 px-4 text-right sticky right-0 bg-white/95 backdrop-blur-xs z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectOrder(o)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Inspect
                              </button>
                              <button
                                onClick={() => setOrderToDelete(o)}
                                title="Delete Order"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: SUPPORT TICKETS                                        */}
        {/* ------------------------------------------------------------- */}
        {activeAdminTab === 'support_tickets' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Merchant & Store Support Inquiries</h2>
                  <p className="text-xs text-slate-500">Live tickets submitted by supermarket owners and staff seeking technical help.</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Filter:</span>
                  <select
                    value={ticketFilter}
                    onChange={(e: any) => setTicketFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Tickets ({tickets.length})</option>
                    <option value="open">Open ({tickets.filter((t) => t.status === 'open').length})</option>
                    <option value="in_progress">In Progress ({tickets.filter((t) => t.status === 'in_progress').length})</option>
                    <option value="resolved">Resolved ({tickets.filter((t) => t.status === 'resolved').length})</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Headphones className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold">No support tickets match the current filter.</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket, idx) => (
                    <div
                      key={ticket.id ? `ticket-${ticket.id}-${idx}` : `ticket-idx-${idx}`}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md">
                            {ticket.id}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{ticket.category}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              ticket.status === 'open'
                                ? 'bg-amber-100 text-amber-800'
                                : ticket.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">{ticket.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                          <span className="font-semibold text-slate-600">{ticket.userName}</span>
                          <span>•</span>
                          <span>{ticket.businessName}</span>
                          <span>•</span>
                          <a href={`mailto:${ticket.email}`} className="text-purple-600 hover:underline">
                            {ticket.email}
                          </a>
                          <span>•</span>
                          <span>{formatDate(ticket.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ticket.screenshotUrl && (
                          <button
                            onClick={() => setSelectedScreenshot(ticket.screenshotUrl || null)}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-600" /> Screenshot
                          </button>
                        )}

                        <select
                          value={ticket.status}
                          onChange={(e: any) => handleTicketStatusChange(ticket.id, e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: SUPPORT SETTINGS                                       */}
        {/* ------------------------------------------------------------- */}
        {activeAdminTab === 'support_settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-black text-slate-900">Platform Support Channel Settings</h2>
                <p className="text-xs text-slate-500">Configure real contact points presented to merchants across the platform.</p>
              </div>

              <form onSubmit={handleSaveSupportSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Business Number</label>
                  <input
                    type="text"
                    required
                    value={supportSettings.whatsappNumber}
                    onChange={(e) => setSupportSettings({ ...supportSettings, whatsappNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Support Email</label>
                  <input
                    type="email"
                    required
                    value={supportSettings.supportEmail}
                    onChange={(e) => setSupportSettings({ ...supportSettings, supportEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Direct Support Hotline Phone</label>
                  <input
                    type="text"
                    required
                    value={supportSettings.supportPhone}
                    onChange={(e) => setSupportSettings({ ...supportSettings, supportPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Facebook Messenger URL</label>
                  <input
                    type="url"
                    required
                    value={supportSettings.facebookMessengerUrl}
                    onChange={(e) => setSupportSettings({ ...supportSettings, facebookMessengerUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Save Support Configuration
                  </button>
                  {isSettingsSaved && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Settings updated successfully!
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: SMTP DIAGNOSTICS                                       */}
        {/* ------------------------------------------------------------- */}
        {activeAdminTab === 'smtp_diagnostics' && (
          <SmtpDiagnosticPanel currentUser={currentUser} />
        )}

        {/* Global Security Audit Log */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-extrabold text-slate-900">Platform Security & Governance Audit Log</h3>
            </div>
            <span className="text-xs text-slate-400">{logs.length} logged events</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs">
            {logs.slice(0, 15).map((log, idx) => (
              <div key={`${log.id}-${idx}`} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 uppercase">[{log.action}]</span>{' '}
                  <span className="text-slate-600">{log.details}</span>{' '}
                  {log.businessId && <span className="text-purple-700 font-semibold">(Tenant: {log.businessId})</span>}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(log.timestamp || log.createdAt || '')}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: CONFIRM PERMANENT DELETE USER ACCOUNT                      */}
      {/* ------------------------------------------------------------------- */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] tracking-wider uppercase mb-1">
                  Permanent Delete Option
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Permanently Delete User?</h3>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-semibold mb-4 leading-relaxed">
              Warning: This action will permanently remove the user record from both the cloud database and system cache. The user will immediately lose all access.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">User Name:</span>
                <span className="font-bold text-slate-900">{userToDelete.name || userToDelete.email || 'User'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-mono text-slate-800">{userToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unique User ID:</span>
                <span className="font-mono font-bold text-purple-700">{userToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="font-bold text-slate-800 uppercase">{userToDelete.role}</span>
              </div>
              {userToDelete.businessId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Workspace:</span>
                  <span className="font-mono font-bold text-blue-700">{userToDelete.businessId}</span>
                </div>
              )}
            </div>

            {/* Optional Cascade Store Deletion if User is associated with a business */}
            {userToDelete.businessId && (
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-semibold cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={alsoDeleteAssociatedStore}
                  onChange={(e) => setAlsoDeleteAssociatedStore(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <span>
                  Also permanently purge associated store workspace ({userToDelete.businessId}) and wipe all inventory, orders, and sales data.
                </span>
              </label>
            )}

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeleteUser}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: CONFIRM PERMANENT DELETE BUSINESS OWNER & WORKSPACE        */}
      {/* ------------------------------------------------------------------- */}
      {businessOwnerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] tracking-wider uppercase mb-1">
                  Permanent Delete Option
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Delete Business Owner & Store?</h3>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-semibold mb-4 leading-relaxed">
              Caution: Permanently deleting this Business Owner will erase the entire supermarket workspace, including product catalog, sales ledgers, inventory records, and customer orders.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Business / Store:</span>
                <span className="font-bold text-slate-900">{businessOwnerToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store ID:</span>
                <span className="font-mono font-bold text-purple-700">{businessOwnerToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner Name:</span>
                <span className="font-bold text-slate-800">{businessOwnerToDelete.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner ID:</span>
                <span className="font-mono text-blue-700 font-bold">{businessOwnerToDelete.ownerId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{businessOwnerToDelete.email}</span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setBusinessOwnerToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeleteBusinessOwner}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, Permanently Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: CONFIRM DEACTIVATE / REACTIVATE BUSINESS OWNER            */}
      {/* ------------------------------------------------------------------- */}
      {businessOwnerToDeactivate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              businessOwnerToDeactivate.status === 'active' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {businessOwnerToDeactivate.status === 'active' ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              {businessOwnerToDeactivate.status === 'active' ? 'Deactivate Business Owner?' : 'Reactivate Business Owner?'}
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {businessOwnerToDeactivate.status === 'active'
                ? 'Deactivating this Business Owner will suspend login capabilities and temporarily disable store operations.'
                : 'Reactivating this Business Owner will restore full access and store operations immediately.'}
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Store Name:</span>
                <span className="font-bold text-slate-900">{businessOwnerToDeactivate.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner Name:</span>
                <span className="font-bold text-slate-800">{businessOwnerToDeactivate.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-bold uppercase">{businessOwnerToDeactivate.status}</span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setBusinessOwnerToDeactivate(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeactivateBusinessOwner}
                className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  businessOwnerToDeactivate.status === 'active'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Yes, {businessOwnerToDeactivate.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 4: ADD NEW USER BY SUPER ADMIN                               */}
      {/* ------------------------------------------------------------------- */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900 mb-1">Create Platform User</h3>
            <p className="text-xs text-slate-500 mb-4">Register a user and configure role and store permissions.</p>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="staff">Staff Member</option>
                  <option value="cashier">Cashier / POS Operator</option>
                  <option value="manager">Store Manager</option>
                  <option value="business_owner">Business Owner</option>
                </select>
              </div>

              {newUserRole !== 'super_admin' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assign to Store Workspace</label>
                  <select
                    value={newUserBusinessId}
                    onChange={(e) => setNewUserBusinessId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="">Select a store...</option>
                    {businesses.map((b, idx) => (
                      <option key={b.id ? `b-assign-${b.id}-${idx}` : `b-assign-idx-${idx}`} value={b.id}>
                        {b.name} ({b.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+880 1700-000000"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 5: PROVISION NEW BUSINESS                                    */}
      {/* ------------------------------------------------------------------- */}
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
                    placeholder="+880 1711-000000"
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

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: CONFIRM PERMANENT DELETE PRODUCT                             */}
      {/* ------------------------------------------------------------------- */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] tracking-wider uppercase mb-1">
                  Super Admin Deletion
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Delete Product?</h3>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-semibold mb-4 leading-relaxed">
              Caution: Permanently deleting this product will remove it from the store catalog, public marketplace, and inventory tracking.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Product Name:</span>
                <span className="font-bold text-slate-900">{productToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SKU:</span>
                <span className="font-mono font-bold text-purple-700">{productToDelete.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store Workspace:</span>
                <span className="font-mono text-slate-800">{productToDelete.businessId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Stock:</span>
                <span className="font-bold text-slate-900">{productToDelete.currentStock} units</span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: CONFIRM PERMANENT DELETE ORDER                               */}
      {/* ------------------------------------------------------------------- */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] tracking-wider uppercase mb-1">
                  Super Admin Deletion
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Delete Order?</h3>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-semibold mb-4 leading-relaxed">
              Caution: Permanently deleting this order will remove it from all merchant order queues and customer tracking.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono font-bold text-purple-700">{orderToDelete.orderId || orderToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{orderToDelete.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-slate-900">৳{orderToDelete.totalAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold uppercase text-slate-800">{orderToDelete.orderStatus}</span>
              </div>
            </div>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeleteOrder}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-2xl p-4 overflow-hidden shadow-2xl">
            <button
              onClick={() => setSelectedScreenshot(null)}
              className="absolute top-3 right-3 p-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
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
