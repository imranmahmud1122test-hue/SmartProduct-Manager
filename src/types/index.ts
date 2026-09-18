export type UserRole = 'super_admin' | 'business_owner' | 'owner' | 'manager' | 'cashier' | 'staff' | 'public_visitor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null; // null for super_admin
  businessName?: string;
  phone?: string;
  createdAt: string;
  status: 'active' | 'suspended' | 'deactivated' | 'pending';
  emailVerified?: boolean;
  verificationCode?: string;
  verificationExpiresAt?: string;
  isGmailVerified?: boolean;
}

export interface Business {
  id: string; // e.g. SHOP-001, SHOP-002
  name: string;
  ownerName: string;
  ownerId: string;
  email: string;
  phone: string;
  address: string;
  businessType: 'Supermarket' | 'Grocery Store' | 'Department Store' | 'Convenience Store' | 'Organic Market' | 'Wholesale Mart' | 'Hypermarket' | 'Electronics' | 'Other';
  logoUrl?: string;
  currencySymbol: string;
  taxRate: number; // percentage, e.g. 5 for 5%
  status: 'active' | 'suspended' | 'deactivated' | 'pending';
  createdAt: string;
  description?: string;
  slug?: string;
  isPublicStoreEnabled?: boolean;
  deliveryCharge?: number;
  emailVerified?: boolean;
}

export interface Product {
  id: string;
  businessId: string; // Tenant isolation key (storeId)
  ownerId?: string; // Explicit owner user ID
  businessName?: string; // Store / Supermarket name
  name: string;
  description: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  qrCodeData?: string;
  purchasePrice: number;
  sellingPrice: number;
  openingStock: number;
  totalReceived: number;
  totalSold: number;
  stockAdjustments: number; // net sum of positive and negative adjustments
  currentStock: number; // openingStock + totalReceived + stockAdjustments - totalSold
  minStockLevel: number; // Low stock threshold
  maxStockLevel: number;
  supplier: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  unit: 'pcs' | 'kg' | 'g' | 'ltr' | 'ml' | 'box' | 'packet' | 'carton' | 'can' | 'bottle' | 'pack';
  notes: string;
  imageUrl: string;
  isPublic: boolean; // Accessible in public stock & marketplace catalog
  isPublished?: boolean; // Synonym for isPublic
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Ready'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'cash_on_delivery' | 'failed' | 'refunded';

export interface OrderStatusHistory {
  changedBy: string;
  changedAt: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  notes?: string;
  userRole?: string;
}

export interface OrderItem {
  productId: string;
  productNameSnapshot: string;
  sku: string;
  barcode?: string;
  unitPriceSnapshot: number;
  costPriceSnapshot?: number;
  quantity: number;
  subtotal: number;
  unit?: string;
  unitSnapshot?: string;
  ownerId: string;
  ownerNameSnapshot?: string;
  storeId: string; // Business ID
  storeNameSnapshot: string;
  imageUrl?: string;
}

export interface Order {
  id: string; // e.g. ORD-2026-XXXXX
  orderId: string; // Unique human-readable code
  parentOrderId?: string; // If this is a split sub-order for an individual vendor
  childOrderIds?: string[]; // If this is a master order encompassing multiple vendor orders
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  zilla?: string;
  thana?: string;
  customerNote?: string;
  items: OrderItem[];
  // Snapshot primary fields for simple querying and historical consistency
  productId?: string;
  productNameSnapshot?: string;
  ownerId: string;
  ownerNameSnapshot: string;
  storeId: string; // Business ID
  storeNameSnapshot: string;
  businessNameSnapshot?: string;
  quantity: number;
  unitPriceSnapshot: number;
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'cash_on_delivery' | 'mobile_banking' | 'card' | 'online';
  businessId?: string; // Optional business ID mirror for multi-tenant querying
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product & { businessName?: string; businessAddress?: string; ownerId?: string };
  quantity: number;
}

export interface AdminAnalytics {
  totalSales: number;
  totalOrders: number;
  totalProductsSold: number;
  totalOwners: number;
  activeOwners: number;
  pendingOwners: number;
  totalCustomers: number;
  totalProducts: number;
  publishedProducts: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  topSellingProducts: {
    id: string;
    name: string;
    salesCount: number;
    totalRevenue: number;
    businessName: string;
    imageUrl?: string;
  }[];
  topSellingOwners: {
    ownerId: string;
    businessId: string;
    storeName: string;
    ownerName: string;
    orderCount: number;
    totalRevenue: number;
  }[];
  dailySales: { date: string; sales: number; orders: number }[];
  weeklySales: { week: string; sales: number; orders: number }[];
  monthlySales: { month: string; sales: number; orders: number }[];
  mostOrderedProduct: { name: string; count: number; revenue: number; storeName: string } | null;
  bestPerformingStore: { name: string; revenue: number; orders: number; ownerName: string } | null;
  mostActiveCustomer: { name: string; phone: string; orderCount: number; totalSpent: number } | null;
}

export type MovementType = 
  | 'OPENING'
  | 'RECEIVING'
  | 'SALE'
  | 'ONLINE_ORDER'
  | 'ORDER_CANCELLED'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUB'
  | 'RETURN';

export interface InventoryMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  sku: string;
  type: MovementType;
  quantity: number; // positive number; direction determined by type
  previousStock: number;
  newStock: number;
  referenceId?: string; // invoice number, PO number, or adjustment ticket
  unitCost?: number;
  notes?: string;
  createdAt: string;
  performedBy: string;
}

export interface StockReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  previousStock: number;
  newStock: number;
}

export interface StockReceipt {
  id: string;
  businessId: string;
  receiptNumber: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  items: StockReceiptItem[];
  totalAmount: number;
  notes: string;
  createdAt: string;
  receivedBy: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  subtotal: number;
  unit: string;
}

export interface Sale {
  id: string;
  businessId: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'mobile_banking' | 'digital_wallet';
  paymentStatus: 'paid' | 'partial' | 'due';
  receivedAmount: number;
  changeAmount: number;
  notes?: string;
  createdAt: string;
  cashierId?: string;
  cashierName: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  suppliedCategories: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  businessId?: string | null;
  businessName?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
  createdAt?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  icon?: string;
}

export interface SupportSettings {
  whatsappNumber: string;
  facebookMessengerUrl: string;
  supportEmail: string;
  supportPhone: string;
  whatsappPresetMessage?: string;
}

export type SupportCategory =
  | 'Login / Registration'
  | 'Account Problem'
  | 'Product Problem'
  | 'Stock Problem'
  | 'Payment / Subscription'
  | 'App Error'
  | 'Other';

export interface SupportTicket {
  id: string;
  userName: string;
  businessName: string;
  email: string;
  category: SupportCategory;
  description: string;
  screenshotUrl?: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  userId?: string;
  businessId?: string;
}
