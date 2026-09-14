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
  status: 'active' | 'suspended';
}

export interface Business {
  id: string; // e.g. SHOP-001, SHOP-002
  name: string;
  ownerName: string;
  ownerId: string;
  email: string;
  phone: string;
  address: string;
  businessType: 'Supermarket' | 'Grocery Store' | 'Department Store' | 'Convenience Store' | 'Organic Market' | 'Wholesale Mart' | 'Hypermarket';
  logoUrl?: string;
  currencySymbol: string;
  taxRate: number; // percentage, e.g. 5 for 5%
  status: 'active' | 'suspended';
  createdAt: string;
  description?: string;
  slug?: string;
  isPublicStoreEnabled?: boolean;
}

export interface Product {
  id: string;
  businessId: string; // Tenant isolation key
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
  isPublic: boolean; // Accessible in public stock directory
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 
  | 'OPENING'
  | 'RECEIVING'
  | 'SALE'
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
