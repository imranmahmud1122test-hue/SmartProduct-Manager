import {
  User,
  Business,
  Product,
  InventoryMovement,
  StockReceipt,
  Sale,
  Supplier,
  AuditLog,
  SupportSettings,
  SupportTicket,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  AdminAnalytics
} from '../types';
import {
  firestoreDb,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType
} from './firebase';
import { emitGlobalToast } from '../context/ToastContext';
import { compressImageDataUrl } from '../utils/imageCompressor';

const STORAGE_KEYS = {
  USERS: 'ssm_users_v2',
  BUSINESSES: 'ssm_businesses_v2',
  PRODUCTS: 'ssm_products_v2',
  MOVEMENTS: 'ssm_movements_v2',
  RECEIPTS: 'ssm_receipts_v2',
  SALES: 'ssm_sales_v2',
  SUPPLIERS: 'ssm_suppliers_v2',
  AUDIT_LOGS: 'ssm_audit_logs_v2',
  CURRENT_USER: 'ssm_current_user_v2',
  SUPPORT_SETTINGS: 'ssm_support_settings_v2',
  SUPPORT_TICKETS: 'ssm_support_tickets_v2',
  ORDERS: 'ssm_orders_v2',
};

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  whatsappNumber: '+8801859340742',
  facebookMessengerUrl: 'https://www.facebook.com/nazim.hossaim.413123',
  supportEmail: 'imranmahmud1122.test@gmail.com',
  supportPhone: '+880 1859-340742',
  whatsappPresetMessage: 'Hello Smart Product Manager Support, I need assistance with ',
};

const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'TICKET-1001',
    userName: 'David Harris',
    businessName: 'Metro Supermarket & Mart',
    email: 'owner@metro.com',
    category: 'Stock Problem',
    description: 'Need assistance setting up automatic low-stock alerts for high turnover dairy products.',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    businessId: 'SHOP-001',
    userId: 'USR-METRO'
  },
  {
    id: 'TICKET-1002',
    userName: 'Sarah Jenkins',
    businessName: 'Fresh Valley Organic Market',
    email: 'owner@freshvalley.com',
    category: 'Payment / Subscription',
    description: 'Question regarding custom currency format and receipt tax calculation customization.',
    status: 'open',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    businessId: 'SHOP-002',
    userId: 'USR-VALLEY'
  }
];

// Seed Initial Data
const INITIAL_USERS: User[] = [
  {
    id: 'USR-ADMIN-IMRAN',
    email: 'imranmahmud1122.test@gmail.com',
    name: 'Imran Mahmud',
    role: 'super_admin',
    businessId: null,
    phone: '+880 1711-000000',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'active',
  },
  {
    id: 'USR-ADMIN',
    email: 'admin@smartsupermarket.com',
    name: 'Super Administrator',
    role: 'super_admin',
    businessId: null,
    phone: '+880 1711-000000',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'active',
  },
  {
    id: 'USR-METRO',
    email: 'owner@metro.com',
    name: 'David Harris',
    role: 'business_owner',
    businessId: 'SHOP-001',
    businessName: 'Metro Supermarket & Mart',
    phone: '+880 1812-345678',
    createdAt: '2026-02-10T09:00:00Z',
    status: 'active',
  },
  {
    id: 'USR-VALLEY',
    email: 'owner@freshvalley.com',
    name: 'Sarah Jenkins',
    role: 'business_owner',
    businessId: 'SHOP-002',
    businessName: 'Fresh Valley Organic Market',
    phone: '+880 1712-876543',
    createdAt: '2026-03-01T10:30:00Z',
    status: 'active',
  },
];

const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'SHOP-001',
    name: 'Metro Supermarket & Mart',
    ownerName: 'David Harris',
    ownerId: 'USR-METRO',
    email: 'owner@metro.com',
    phone: '+880 1812-345678',
    address: 'Gulshan 2 Commercial Area, Dhaka',
    businessType: 'Supermarket',
    logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80',
    currencySymbol: '৳',
    taxRate: 5.0,
    status: 'active',
    createdAt: '2026-02-10T09:00:00Z',
    description: 'Premier urban supermarket providing daily essentials, fresh dairy, groceries, and consumer goods.',
  },
  {
    id: 'SHOP-002',
    name: 'Fresh Valley Organic Market',
    ownerName: 'Sarah Jenkins',
    ownerId: 'USR-VALLEY',
    email: 'owner@freshvalley.com',
    phone: '+880 1712-876543',
    address: 'Dhanmondi Road 27, Dhaka',
    businessType: 'Organic Market',
    logoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80',
    currencySymbol: '৳',
    taxRate: 4.0,
    status: 'active',
    createdAt: '2026-03-01T10:30:00Z',
    description: 'Certified organic and artisan food market specializing in farm-fresh produce and health foods.',
  },
];

const INITIAL_PRODUCTS: Product[] = [
  // SHOP-001 Products
  {
    id: 'PROD-001',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Fresh Whole Milk 1 Gallon',
    description: 'Fresh pasteurized Grade A whole milk with vitamin D. Sourced daily from local dairy farms.',
    category: 'Dairy & Eggs',
    brand: 'Valley Dairy',
    sku: 'MILK-WHL-1G',
    barcode: '890103001',
    purchasePrice: 2.80,
    sellingPrice: 4.29,
    openingStock: 50,
    totalReceived: 80,
    totalSold: 45,
    stockAdjustments: 0,
    currentStock: 85, // 50 + 80 - 45 = 85
    minStockLevel: 25,
    maxStockLevel: 150,
    supplier: 'Golden Valley Dairy Ltd.',
    batchNumber: 'BCH-2026-M09',
    expiryDate: '2026-10-15',
    unit: 'bottle',
    notes: 'Keep refrigerated between 34°F and 38°F',
    imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-09-10T11:00:00Z',
  },
  {
    id: 'PROD-002',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Basmati Premium Long Grain Rice 5kg',
    description: 'Aged Himalayan long grain aromatic basmati rice. Fluffy and non-sticky when cooked.',
    category: 'Pantry & Grains',
    brand: 'Royal Harvest',
    sku: 'RICE-BAS-5KG',
    barcode: '890103002',
    purchasePrice: 9.50,
    sellingPrice: 15.99,
    openingStock: 30,
    totalReceived: 40,
    totalSold: 28,
    stockAdjustments: 0,
    currentStock: 42, // 30 + 40 - 28 = 42
    minStockLevel: 15,
    maxStockLevel: 100,
    supplier: 'Apex Global Imports',
    batchNumber: 'BCH-2026-R02',
    expiryDate: '2027-08-30',
    unit: 'packet',
    notes: 'Store in cool and dry airtight container',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-09-08T14:00:00Z',
  },
  {
    id: 'PROD-003',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Classic Cola Soda Can (Pack of 6)',
    description: 'Original refreshing carbonated soda cans. Crisp effervescence and balanced sweet cola flavor.',
    category: 'Beverages',
    brand: 'Coca-Cola',
    sku: 'SODA-COLA-6PK',
    barcode: '890103003',
    purchasePrice: 3.20,
    sellingPrice: 5.49,
    openingStock: 80,
    totalReceived: 120,
    totalSold: 192,
    stockAdjustments: 0,
    currentStock: 8, // 80 + 120 - 192 = 8 -> LOW STOCK & Restock Recommended!
    minStockLevel: 20,
    maxStockLevel: 250,
    supplier: 'Metro Beverage Distributors',
    batchNumber: 'BCH-2026-CC1',
    expiryDate: '2027-02-15',
    unit: 'pack',
    notes: 'High velocity seller, auto replenishment needed',
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-09-12T16:00:00Z',
  },
  {
    id: 'PROD-004',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Artisan Sourdough Loaf 500g',
    description: 'Naturally fermented rustic sourdough with a crunchy crust and tender open crumb.',
    category: 'Bakery',
    brand: 'Baker & Mill',
    sku: 'BKR-SRD-500G',
    barcode: '890103004',
    purchasePrice: 2.10,
    sellingPrice: 3.99,
    openingStock: 25,
    totalReceived: 30,
    totalSold: 47,
    stockAdjustments: -1,
    currentStock: 7, // 25 + 30 - 1 - 47 = 7 -> Low Stock
    minStockLevel: 10,
    maxStockLevel: 60,
    supplier: 'Artisan Bakery Co.',
    batchNumber: 'BCH-2026-B12',
    expiryDate: '2026-09-20',
    unit: 'pcs',
    notes: 'Fresh bake received every morning at 7:00 AM',
    imageUrl: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-05T09:00:00Z',
    updatedAt: '2026-09-13T07:00:00Z',
  },
  {
    id: 'PROD-005',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Extra Virgin Olive Oil 750ml',
    description: 'Cold-pressed extra virgin olive oil from Mediterranean olives. Rich aroma and peppery finish.',
    category: 'Pantry & Grains',
    brand: 'Terra Gold',
    sku: 'OIL-EVOO-750M',
    barcode: '890103005',
    purchasePrice: 8.00,
    sellingPrice: 13.50,
    openingStock: 40,
    totalReceived: 20,
    totalSold: 18,
    stockAdjustments: 0,
    currentStock: 42,
    minStockLevel: 12,
    maxStockLevel: 80,
    supplier: 'Apex Global Imports',
    batchNumber: 'BCH-2026-OL4',
    expiryDate: '2027-11-30',
    unit: 'bottle',
    notes: 'Premium dark glass bottle protection',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
    isPublic: false, // Private product example
    isPublished: false,
    status: 'active',
    createdAt: '2026-08-06T10:00:00Z',
    updatedAt: '2026-09-02T15:00:00Z',
  },
  {
    id: 'PROD-006',
    businessId: 'SHOP-001',
    ownerId: 'USR-METRO',
    name: 'Fresh Organic Bananas (Per Kg)',
    description: 'Sweet and creamy high-potassium yellow bananas, ethically harvested from sustainable farms.',
    category: 'Fresh Produce',
    brand: 'Farm Fresh',
    sku: 'PRD-BAN-1KG',
    barcode: '890103006',
    purchasePrice: 0.90,
    sellingPrice: 1.79,
    openingStock: 100,
    totalReceived: 150,
    totalSold: 190,
    stockAdjustments: -2,
    currentStock: 58,
    minStockLevel: 30,
    maxStockLevel: 250,
    supplier: 'Green Valley Produce',
    batchNumber: 'BCH-2026-BN3',
    expiryDate: '2026-09-22',
    unit: 'kg',
    notes: 'Daily turnover item',
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-09-12T10:00:00Z',
  },

  // SHOP-002 Products (Strictly isolated to Fresh Valley Organic Market)
  {
    id: 'PROD-201',
    businessId: 'SHOP-002',
    ownerId: 'USR-VALLEY',
    name: 'Organic Honeycomb Pure Honey 500g',
    description: 'Raw unfiltered clover blossom honey with raw comb section. Rich in natural floral enzymes.',
    category: 'Pantry & Grains',
    brand: 'Valley Bee Co.',
    sku: 'ORG-HNY-500G',
    barcode: '890203001',
    purchasePrice: 6.50,
    sellingPrice: 11.99,
    openingStock: 20,
    totalReceived: 35,
    totalSold: 16,
    stockAdjustments: 0,
    currentStock: 39,
    minStockLevel: 10,
    maxStockLevel: 60,
    supplier: 'Highland Apiaries',
    batchNumber: 'BCH-ORG-H01',
    expiryDate: '2028-06-30',
    unit: 'bottle',
    notes: '100% pure raw unprocessed honey',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-09-05T12:00:00Z',
  },
  {
    id: 'PROD-202',
    businessId: 'SHOP-002',
    ownerId: 'USR-VALLEY',
    name: 'Organic Hass Avocados (Pack of 4)',
    description: 'Ripe and ready-to-eat rich buttery Hass avocados. Certified USDA Organic.',
    category: 'Fresh Produce',
    brand: 'Emerald Groves',
    sku: 'ORG-AVO-4PK',
    barcode: '890203002',
    purchasePrice: 3.50,
    sellingPrice: 5.99,
    openingStock: 40,
    totalReceived: 50,
    totalSold: 84,
    stockAdjustments: 0,
    currentStock: 6, // Low stock
    minStockLevel: 15,
    maxStockLevel: 100,
    supplier: 'Pacific Organic Cooperative',
    batchNumber: 'BCH-ORG-AV2',
    expiryDate: '2026-09-24',
    unit: 'pack',
    notes: 'Customer favorite item',
    imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&auto=format&fit=crop&q=80',
    isPublic: true,
    isPublished: true,
    status: 'active',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-09-12T14:00:00Z',
  },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    businessId: 'SHOP-001',
    name: 'Golden Valley Dairy Ltd.',
    contactPerson: 'Robert Miller',
    email: 'orders@goldenvalleydairy.com',
    phone: '+1 (555) 443-2211',
    address: '12 Farmstead Way, Dairy Valley',
    suppliedCategories: ['Dairy & Eggs'],
    status: 'active',
    createdAt: '2026-02-15T08:00:00Z',
  },
  {
    id: 'SUP-002',
    businessId: 'SHOP-001',
    name: 'Apex Global Imports',
    contactPerson: 'Elena Rostova',
    email: 'supply@apeximports.com',
    phone: '+1 (555) 667-8899',
    address: '88 Harbour Quay, Logistics Terminal 4',
    suppliedCategories: ['Pantry & Grains', 'Snacks & Confectionery'],
    status: 'active',
    createdAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'SUP-003',
    businessId: 'SHOP-001',
    name: 'Metro Beverage Distributors',
    contactPerson: 'Mark Davis',
    email: 'orders@metrobev.com',
    phone: '+1 (555) 991-0022',
    address: '45 Bottler Lane, Industrial Park',
    suppliedCategories: ['Beverages'],
    status: 'active',
    createdAt: '2026-02-20T10:00:00Z',
  },
  {
    id: 'SUP-201',
    businessId: 'SHOP-002',
    name: 'Pacific Organic Cooperative',
    contactPerson: 'Clara Vance',
    email: 'sales@pacificorganic.org',
    phone: '+1 (555) 332-1144',
    address: '500 Coastal Way, Valley Farm',
    suppliedCategories: ['Fresh Produce', 'Pantry & Grains'],
    status: 'active',
    createdAt: '2026-03-05T11:00:00Z',
  },
];

const INITIAL_MOVEMENTS: InventoryMovement[] = [
  {
    id: 'MOV-1001',
    businessId: 'SHOP-001',
    productId: 'PROD-001',
    productName: 'Fresh Whole Milk 1 Gallon',
    sku: 'MILK-WHL-1G',
    type: 'OPENING',
    quantity: 50,
    previousStock: 0,
    newStock: 50,
    referenceId: 'SYS-INIT-001',
    notes: 'Initial opening stock intake',
    createdAt: '2026-08-01T08:00:00Z',
    performedBy: 'David Harris',
  },
  {
    id: 'MOV-1002',
    businessId: 'SHOP-001',
    productId: 'PROD-001',
    productName: 'Fresh Whole Milk 1 Gallon',
    sku: 'MILK-WHL-1G',
    type: 'RECEIVING',
    quantity: 80,
    previousStock: 50,
    newStock: 130,
    referenceId: 'INV-GV-8821',
    unitCost: 2.80,
    notes: 'Stock received from Golden Valley Dairy',
    createdAt: '2026-08-15T10:00:00Z',
    performedBy: 'David Harris',
  },
  {
    id: 'MOV-1003',
    businessId: 'SHOP-001',
    productId: 'PROD-001',
    productName: 'Fresh Whole Milk 1 Gallon',
    sku: 'MILK-WHL-1G',
    type: 'SALE',
    quantity: 45,
    previousStock: 130,
    newStock: 85,
    referenceId: 'POS-REC-1049',
    notes: 'Point of sale customer transactions',
    createdAt: '2026-09-10T18:00:00Z',
    performedBy: 'David Harris',
  },
  {
    id: 'MOV-1004',
    businessId: 'SHOP-001',
    productId: 'PROD-003',
    productName: 'Classic Cola Soda Can (Pack of 6)',
    sku: 'SODA-COLA-6PK',
    type: 'OPENING',
    quantity: 80,
    previousStock: 0,
    newStock: 80,
    referenceId: 'SYS-INIT-002',
    notes: 'Initial opening stock intake',
    createdAt: '2026-08-01T08:00:00Z',
    performedBy: 'David Harris',
  },
  {
    id: 'MOV-1005',
    businessId: 'SHOP-001',
    productId: 'PROD-003',
    productName: 'Classic Cola Soda Can (Pack of 6)',
    sku: 'SODA-COLA-6PK',
    type: 'RECEIVING',
    quantity: 120,
    previousStock: 80,
    newStock: 200,
    referenceId: 'INV-MBD-441',
    unitCost: 3.20,
    notes: 'Stock delivery from Metro Beverage',
    createdAt: '2026-08-20T11:00:00Z',
    performedBy: 'David Harris',
  },
  {
    id: 'MOV-1006',
    businessId: 'SHOP-001',
    productId: 'PROD-003',
    productName: 'Classic Cola Soda Can (Pack of 6)',
    sku: 'SODA-COLA-6PK',
    type: 'SALE',
    quantity: 192,
    previousStock: 200,
    newStock: 8,
    referenceId: 'POS-REC-1080',
    notes: 'High demand weekend beverage sales',
    createdAt: '2026-09-12T16:00:00Z',
    performedBy: 'David Harris',
  },
];

const INITIAL_SALES: Sale[] = [
  {
    id: 'SALE-101',
    businessId: 'SHOP-001',
    invoiceNumber: 'INV-2026-001',
    customerName: 'Alice Walker',
    customerPhone: '+1 555-4321',
    items: [
      {
        productId: 'PROD-001',
        productName: 'Fresh Whole Milk 1 Gallon',
        sku: 'MILK-WHL-1G',
        barcode: '890103001',
        unitPrice: 4.29,
        costPrice: 2.80,
        quantity: 2,
        subtotal: 8.58,
        unit: 'bottle',
      },
      {
        productId: 'PROD-003',
        productName: 'Classic Cola Soda Can (Pack of 6)',
        sku: 'SODA-COLA-6PK',
        barcode: '890103003',
        unitPrice: 5.49,
        costPrice: 3.20,
        quantity: 3,
        subtotal: 16.47,
        unit: 'pack',
      },
    ],
    subtotal: 25.05,
    discount: 0,
    tax: 1.25,
    totalAmount: 26.30,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    receivedAmount: 30.00,
    changeAmount: 3.70,
    notes: 'Customer paid with cash $30 bill',
    createdAt: '2026-09-12T14:30:00Z',
    cashierName: 'David Harris',
  },
  {
    id: 'SALE-102',
    businessId: 'SHOP-001',
    invoiceNumber: 'INV-2026-002',
    customerName: 'Marcus Sterling',
    customerPhone: '+1 555-8890',
    items: [
      {
        productId: 'PROD-002',
        productName: 'Basmati Premium Long Grain Rice 5kg',
        sku: 'RICE-BAS-5KG',
        barcode: '890103002',
        unitPrice: 15.99,
        costPrice: 9.50,
        quantity: 1,
        subtotal: 15.99,
        unit: 'packet',
      },
      {
        productId: 'PROD-004',
        productName: 'Artisan Sourdough Loaf 500g',
        sku: 'BKR-SRD-500G',
        barcode: '890103004',
        unitPrice: 3.99,
        costPrice: 2.10,
        quantity: 2,
        subtotal: 7.98,
        unit: 'pcs',
      },
    ],
    subtotal: 23.97,
    discount: 1.00,
    tax: 1.15,
    totalAmount: 24.12,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    receivedAmount: 24.12,
    changeAmount: 0.00,
    notes: 'Chip card payment accepted',
    createdAt: '2026-09-13T03:15:00Z',
    cashierName: 'David Harris',
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'LOG-001',
    businessId: 'SHOP-001',
    businessName: 'Metro Supermarket & Mart',
    userId: 'USR-METRO',
    userName: 'David Harris',
    userRole: 'business_owner',
    action: 'INIT_STORE',
    details: 'Workspace initialized with 6 core products',
    timestamp: '2026-08-01T08:00:00Z',
  },
  {
    id: 'LOG-002',
    businessId: null,
    userId: 'USR-ADMIN',
    userName: 'Super Administrator',
    userRole: 'super_admin',
    action: 'PLATFORM_CHECK',
    details: 'Routine multi-tenant system integrity check passed',
    timestamp: '2026-09-01T00:00:00Z',
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-2026-1001',
    orderId: 'ORD-2026-1001',
    customerName: 'Tanvir Rahman',
    customerPhone: '+880 1711-223344',
    customerEmail: 'tanvir@gmail.com',
    deliveryAddress: 'House 14, Road 5, Block C, Banani, Dhaka',
    customerNote: 'Please ring bell upon arrival.',
    items: [
      {
        productId: 'PROD-001',
        productNameSnapshot: 'Fresh Whole Milk 1 Gallon',
        sku: 'MILK-WHL-1G',
        barcode: '890103001',
        unitPriceSnapshot: 4.29,
        costPriceSnapshot: 2.80,
        quantity: 2,
        subtotal: 8.58,
        unit: 'bottle',
        ownerId: 'USR-METRO',
        ownerNameSnapshot: 'David Harris',
        storeId: 'SHOP-001',
        storeNameSnapshot: 'Metro Supermarket & Mart',
        imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=80',
      },
      {
        productId: 'PROD-002',
        productNameSnapshot: 'Basmati Premium Long Grain Rice 5kg',
        sku: 'RICE-BAS-5KG',
        barcode: '890103002',
        unitPriceSnapshot: 15.99,
        costPriceSnapshot: 9.50,
        quantity: 1,
        subtotal: 15.99,
        unit: 'packet',
        ownerId: 'USR-METRO',
        ownerNameSnapshot: 'David Harris',
        storeId: 'SHOP-001',
        storeNameSnapshot: 'Metro Supermarket & Mart',
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
      }
    ],
    productId: 'PROD-001',
    productNameSnapshot: 'Fresh Whole Milk 1 Gallon (+1 other)',
    ownerId: 'USR-METRO',
    ownerNameSnapshot: 'David Harris',
    storeId: 'SHOP-001',
    storeNameSnapshot: 'Metro Supermarket & Mart',
    quantity: 3,
    unitPriceSnapshot: 4.29,
    subtotal: 24.57,
    deliveryCharge: 60,
    totalAmount: 84.57,
    orderStatus: 'Processing',
    paymentStatus: 'cash_on_delivery',
    paymentMethod: 'cash_on_delivery',
    statusHistory: [
      {
        changedBy: 'Customer / Online Marketplace',
        changedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        previousStatus: 'Pending',
        newStatus: 'Pending',
        notes: 'Order placed via Public Marketplace',
      },
      {
        changedBy: 'David Harris (Store Owner)',
        changedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        previousStatus: 'Pending',
        newStatus: 'Processing',
        notes: 'Order confirmed and packed in warehouse.',
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'ORD-2026-1002',
    orderId: 'ORD-2026-1002',
    customerName: 'Farhana Akter',
    customerPhone: '+880 1819-998877',
    customerEmail: 'farhana.akter@outlook.com',
    deliveryAddress: 'Apartment 4B, Road 11, Dhanmondi, Dhaka',
    customerNote: 'Leave at front security desk.',
    items: [
      {
        productId: 'PROD-008',
        productNameSnapshot: 'Fresh Farm Spinach Leaves 500g',
        sku: 'VEG-SPN-500G',
        barcode: '890103008',
        unitPriceSnapshot: 1.99,
        costPriceSnapshot: 0.95,
        quantity: 3,
        subtotal: 5.97,
        unit: 'pack',
        ownerId: 'USR-VALLEY',
        ownerNameSnapshot: 'Sarah Jenkins',
        storeId: 'SHOP-002',
        storeNameSnapshot: 'Fresh Valley Organic Market',
        imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&auto=format&fit=crop&q=80',
      }
    ],
    productId: 'PROD-008',
    productNameSnapshot: 'Fresh Farm Spinach Leaves 500g',
    ownerId: 'USR-VALLEY',
    ownerNameSnapshot: 'Sarah Jenkins',
    storeId: 'SHOP-002',
    storeNameSnapshot: 'Fresh Valley Organic Market',
    quantity: 3,
    unitPriceSnapshot: 1.99,
    subtotal: 5.97,
    deliveryCharge: 50,
    totalAmount: 55.97,
    orderStatus: 'Delivered',
    paymentStatus: 'paid',
    paymentMethod: 'mobile_banking',
    statusHistory: [
      {
        changedBy: 'Customer / Online Marketplace',
        changedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        previousStatus: 'Pending',
        newStatus: 'Pending',
      },
      {
        changedBy: 'Sarah Jenkins (Store Owner)',
        changedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        previousStatus: 'Processing',
        newStatus: 'Delivered',
        notes: 'Delivered safely to Dhanmondi customer.',
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  }
];

// Helper to safely read and write to LocalStorage
function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      setToStorage(key, defaultValue);
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (err) {
    console.warn(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

function safeSetItem(key: string, valueStr: string): boolean {
  try {
    localStorage.setItem(key, valueStr);
    return true;
  } catch (err) {
    return false;
  }
}

function setToStorage<T>(key: string, value: T, notify = false): void {
  try {
    const jsonStr = JSON.stringify(value);
    if (safeSetItem(key, jsonStr)) {
      if (notify && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key, timestamp: Date.now() } }));
      }
      return;
    }

    // Quota Exceeded Recovery Strategy
    // 1. If storing array of items (e.g. PRODUCTS, SALES, MOVEMENTS, ORDERS), strip large base64 data URLs from local storage cache
    if (Array.isArray(value)) {
      const sanitized = value.map((item: any) => {
        if (item && typeof item === 'object' && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:image/')) {
          return { ...item, imageUrl: '' };
        }
        return item;
      });

      const sanitizedStr = JSON.stringify(sanitized);
      if (safeSetItem(key, sanitizedStr)) {
        if (notify && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key, timestamp: Date.now() } }));
        }
        return;
      }

      // 2. If still exceeding, keep ALL custom user-created products and trim only static seed demo products
      const customItems = sanitized.filter((item: any) => item && item.id && !String(item.id).startsWith('PROD-INIT'));
      const demoItems = sanitized.filter((item: any) => item && item.id && String(item.id).startsWith('PROD-INIT'));
      const trimmedList = [...customItems, ...demoItems.slice(0, 15)];
      const trimmedStr = JSON.stringify(trimmedList);
      if (safeSetItem(key, trimmedStr)) {
        if (notify && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key, timestamp: Date.now() } }));
        }
        return;
      }
    }

    // 3. Clear non-critical cached keys if still full
    try {
      localStorage.removeItem('ssm_receipts_v2');
      localStorage.removeItem('ssm_audit_logs_v2');
      if (safeSetItem(key, jsonStr)) {
        if (notify && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key, timestamp: Date.now() } }));
        }
        return;
      }
    } catch (_) {}

    console.warn(`[Storage] LocalStorage quota reached for ${key}. Data remains active in memory and synchronized with Cloud Firestore.`);
  } catch (err) {
    console.warn(`[Storage] Unable to save ${key} to localStorage:`, err);
  }
}

export function notifyStorageUpdate(key?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key, timestamp: Date.now() } }));
  }
}

let isFirestoreSyncActive = false;

export async function syncWithFirestore(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isFirestoreSyncActive) return;
  isFirestoreSyncActive = true;

  try {
    await testFirestoreConnection();

    // 1. Initial Products & Tenant Hydration from Firestore
    try {
      const prodSnap = await getDocs(collection(firestoreDb, 'products'));
      if (prodSnap.empty) {
        console.log('[Firestore] Cloud database empty. Bootstrapping initial catalog...');
        for (const p of INITIAL_PRODUCTS) {
          await setDoc(doc(firestoreDb, 'products', p.id), p);
        }
        for (const b of INITIAL_BUSINESSES) {
          await setDoc(doc(firestoreDb, 'businesses', b.id), b);
        }
        for (const u of INITIAL_USERS) {
          await setDoc(doc(firestoreDb, 'users', u.id), u);
        }
        for (const o of INITIAL_ORDERS) {
          await setDoc(doc(firestoreDb, 'orders', o.id), o);
        }
      } else {
        const cloudProducts: Product[] = [];
        prodSnap.forEach((docSnap) => {
          cloudProducts.push(docSnap.data() as Product);
        });
        if (cloudProducts.length > 0) {
          setToStorage(STORAGE_KEYS.PRODUCTS, cloudProducts, false);
          console.log(`[Firestore] Hydrated ${cloudProducts.length} live products from Cloud Firestore.`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
    }

    // 2. Hydrate Businesses from Firestore
    try {
      const bizSnap = await getDocs(collection(firestoreDb, 'businesses'));
      if (!bizSnap.empty) {
        const cloudBiz: Business[] = [];
        bizSnap.forEach((docSnap) => cloudBiz.push(docSnap.data() as Business));
        setToStorage(STORAGE_KEYS.BUSINESSES, cloudBiz, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'businesses');
    }

    // 3. Hydrate Orders from Firestore
    try {
      const ordSnap = await getDocs(collection(firestoreDb, 'orders'));
      if (!ordSnap.empty) {
        const cloudOrders: Order[] = [];
        ordSnap.forEach((docSnap) => cloudOrders.push(docSnap.data() as Order));
        setToStorage(STORAGE_KEYS.ORDERS, cloudOrders, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    }

    // 4. Hydrate Users from Firestore
    try {
      const usrSnap = await getDocs(collection(firestoreDb, 'users'));
      if (!usrSnap.empty) {
        const cloudUsers: User[] = [];
        usrSnap.forEach((docSnap) => cloudUsers.push(docSnap.data() as User));
        setToStorage(STORAGE_KEYS.USERS, cloudUsers, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }

    // 5. Hydrate Movements from Firestore
    try {
      const movSnap = await getDocs(collection(firestoreDb, 'movements'));
      if (!movSnap.empty) {
        const cloudMovs: InventoryMovement[] = [];
        movSnap.forEach((docSnap) => cloudMovs.push(docSnap.data() as InventoryMovement));
        setToStorage(STORAGE_KEYS.MOVEMENTS, cloudMovs, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'movements');
    }

    // 6. Real-time Listeners for instant multi-device / multi-environment sync
    onSnapshot(
      collection(firestoreDb, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveProducts: Product[] = [];
          snapshot.forEach((docSnap) => liveProducts.push(docSnap.data() as Product));
          setToStorage(STORAGE_KEYS.PRODUCTS, liveProducts, false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'products')
    );

    onSnapshot(
      collection(firestoreDb, 'businesses'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveBusinesses: Business[] = [];
          snapshot.forEach((docSnap) => liveBusinesses.push(docSnap.data() as Business));
          setToStorage(STORAGE_KEYS.BUSINESSES, liveBusinesses, false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'businesses')
    );

    onSnapshot(
      collection(firestoreDb, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveOrders: Order[] = [];
          snapshot.forEach((docSnap) => liveOrders.push(docSnap.data() as Order));
          setToStorage(STORAGE_KEYS.ORDERS, liveOrders, false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'orders')
    );

    onSnapshot(
      collection(firestoreDb, 'users'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveUsers: User[] = [];
          snapshot.forEach((docSnap) => liveUsers.push(docSnap.data() as User));
          setToStorage(STORAGE_KEYS.USERS, liveUsers, false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'users')
    );

    onSnapshot(
      collection(firestoreDb, 'movements'),
      (snapshot) => {
        const liveMovements: InventoryMovement[] = [];
        snapshot.forEach((docSnap) => liveMovements.push(docSnap.data() as InventoryMovement));
        setToStorage(STORAGE_KEYS.MOVEMENTS, liveMovements, true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'movements')
    );
  } catch (globalErr) {
    console.warn('[Firestore] Sync notice:', globalErr);
  }
}

// Ensure database initialization
export function initializeStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setToStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
  } else {
    // Ensure all demo users exist
    try {
      const existingUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      let updated = false;
      INITIAL_USERS.forEach((initUser) => {
        if (!existingUsers.some((u) => u.email.toLowerCase() === initUser.email.toLowerCase())) {
          existingUsers.push(initUser);
          updated = true;
        }
      });
      if (updated) {
        setToStorage(STORAGE_KEYS.USERS, existingUsers);
      }
    } catch (e) {
      console.warn('User migration error:', e);
    }
  }

  if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
    setToStorage(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
  } else {
    // Migrate any stored business currencySymbol from '$' to '৳' (BDT)
    try {
      const storedBiz: Business[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESSES) || '[]');
      let changed = false;
      const updatedBiz = storedBiz.map((b) => {
        if (!b.currencySymbol || b.currencySymbol === '$') {
          changed = true;
          return { ...b, currencySymbol: '৳' };
        }
        return b;
      });
      if (changed) {
        setToStorage(STORAGE_KEYS.BUSINESSES, updatedBiz);
      }
    } catch (e) {
      console.warn('Currency migration error:', e);
    }
  }

  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    setToStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
  } else {
    // Migrate cached products to ensure store businessName is populated
    try {
      const storedProds: Product[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      const storedBiz: Business[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESSES) || '[]');
      const storedUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const bizMap = new Map<string, Business>(storedBiz.map((b) => [b.id, b]));
      const usrMap = new Map<string, User>(storedUsers.map((u) => [u.id, u]));

      let prodChanged = false;
      const updatedProds = storedProds.map((p) => {
        const b = bizMap.get(p.businessId);
        const u = p.ownerId ? usrMap.get(p.ownerId) : storedUsers.find((user) => user.businessId === p.businessId);
        const resolvedName = p.businessName || b?.name || u?.businessName;
        if (resolvedName && p.businessName !== resolvedName) {
          prodChanged = true;
          return { ...p, businessName: resolvedName };
        }
        return p;
      });
      if (prodChanged) {
        setToStorage(STORAGE_KEYS.PRODUCTS, updatedProds);
      }
    } catch (e) {
      console.warn('Product migration error:', e);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLIERS)) {
    setToStorage(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
    setToStorage(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SALES)) {
    setToStorage(STORAGE_KEYS.SALES, INITIAL_SALES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    setToStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    setToStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  }

  // Auto-connect and sync live Cloud Firestore
  syncWithFirestore().catch((e) => console.error('[Firestore] Initialization error:', e));
}

let cachedProductsInMemory: Product[] | null = null;

// Data Access Layer (Repository)
export const db = {
  // Authentication & Session
  getCurrentUser(): User | null {
    return getFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
  },

  setCurrentUser(user: User | null): void {
    setToStorage(STORAGE_KEYS.CURRENT_USER, user);
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  getUsers(): User[] {
    const list = getFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const filtered = list.filter((u) => u.email.toLowerCase() !== 'cashier@metro.com' && u.id !== 'USR-METRO-CASHIER');
    if (filtered.length !== list.length) {
      setToStorage(STORAGE_KEYS.USERS, filtered);
    }
    return filtered;
  },

  addUser(userData: {
    email: string;
    password?: string;
    name: string;
    role: User['role'];
    businessId: string;
    phone?: string;
  }): User {
    const users = this.getUsers();
    const newUser: User = {
      id: `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      businessId: userData.businessId,
      phone: userData.phone || '',
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    users.push(newUser);
    setToStorage(STORAGE_KEYS.USERS, users);
    return newUser;
  },

  findUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    const users = this.getUsers();
    const found = users.find((u) => u.email.toLowerCase() === clean);

    if (found) {
      if (clean === 'imranmahmud1122.test@gmail.com' && found.role !== 'super_admin') {
        found.role = 'super_admin';
        setToStorage(STORAGE_KEYS.USERS, users);
      }
      return found;
    }

    // Auto-create Super Admin if imranmahmud1122.test@gmail.com
    if (clean === 'imranmahmud1122.test@gmail.com') {
      const superAdminUser: User = {
        id: 'USR-ADMIN-IMRAN',
        email: 'imranmahmud1122.test@gmail.com',
        name: 'Imran Mahmud',
        role: 'super_admin',
        businessId: null,
        phone: '+880 1711-000000',
        createdAt: new Date().toISOString(),
        status: 'active',
      };
      users.push(superAdminUser);
      setToStorage(STORAGE_KEYS.USERS, users);
      return superAdminUser;
    }

    return undefined;
  },

  // Business / Tenant Management
  getBusinesses(): Business[] {
    const list = getFromStorage<Business[]>(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    let updated = false;
    const sanitized = list.map((b) => {
      if (!b.currencySymbol || b.currencySymbol === '$') {
        updated = true;
        return { ...b, currencySymbol: '৳' };
      }
      return b;
    });
    if (updated) {
      setToStorage(STORAGE_KEYS.BUSINESSES, sanitized);
    }
    return sanitized;
  },

  getBusinessById(businessId: string): Business | undefined {
    const businesses = this.getBusinesses();
    return businesses.find((b) => b.id === businessId);
  },

  registerBusiness(data: {
    ownerName: string;
    businessName?: string;
    name?: string;
    email: string;
    password?: string;
    phone?: string;
    address?: string;
    businessType?: Business['businessType'];
    logoUrl?: string;
    currencySymbol?: string;
  }): { user: User; business: Business } {
    const businesses = this.getBusinesses();
    const users = this.getUsers();

    const newShopIndex = businesses.length + 1;
    const businessId = `SHOP-${String(newShopIndex).padStart(3, '0')}`;
    const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const finalBusinessName = data.businessName || data.name || 'My Supermarket';

    const newBusiness: Business = {
      id: businessId,
      name: finalBusinessName,
      ownerName: data.ownerName,
      ownerId: userId,
      email: data.email,
      phone: data.phone || '',
      address: data.address || '',
      businessType: data.businessType || 'Supermarket',
      logoUrl: data.logoUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80',
      currencySymbol: data.currencySymbol || '৳',
      taxRate: 5.0,
      status: 'active',
      createdAt: new Date().toISOString(),
      isPublicStoreEnabled: true,
    };

    const newUser: User = {
      id: userId,
      email: data.email,
      name: data.ownerName,
      role: 'business_owner',
      businessId: businessId,
      businessName: finalBusinessName,
      phone: data.phone || '',
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    businesses.push(newBusiness);
    users.push(newUser);

    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);
    setToStorage(STORAGE_KEYS.USERS, users);

    // Save to Firestore
    setDoc(doc(firestoreDb, 'businesses', newBusiness.id), newBusiness).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `businesses/${newBusiness.id}`)
    );
    setDoc(doc(firestoreDb, 'users', newUser.id), newUser).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `users/${newUser.id}`)
    );

    this.logAudit({
      businessId,
      businessName: finalBusinessName,
      userId,
      userName: data.ownerName,
      userRole: 'business_owner',
      action: 'REGISTER_BUSINESS',
      details: `New business workspace registered: ${finalBusinessName} (${businessId})`,
    });

    return { user: newUser, business: newBusiness };
  },

  updateBusiness(businessId: string, updates: Partial<Business>, user?: User): Business {
    const businesses = this.getBusinesses();
    const index = businesses.findIndex((b) => b.id === businessId);
    if (index === -1) throw new Error('Business not found');

    businesses[index] = { ...businesses[index], ...updates };
    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);

    // Update in Firestore
    setDoc(doc(firestoreDb, 'businesses', businessId), businesses[index], { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`)
    );

    if (user) {
      this.logAudit({
        businessId,
        businessName: businesses[index].name,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'UPDATE_BUSINESS',
        details: `Business details updated for ${businesses[index].name}`,
      });
    }

    return businesses[index];
  },

  updateBusinessStatus(businessId: string, status: 'active' | 'suspended', adminUser?: User): Business {
    const businesses = this.getBusinesses();
    const index = businesses.findIndex((b) => b.id === businessId);
    if (index === -1) throw new Error('Business not found');

    businesses[index].status = status;
    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);

    setDoc(doc(firestoreDb, 'businesses', businessId), { status }, { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`)
    );

    // Also update owner user status
    const users = this.getUsers();
    const ownerIndex = users.findIndex((u) => u.businessId === businessId);
    if (ownerIndex !== -1) {
      users[ownerIndex].status = status;
      setToStorage(STORAGE_KEYS.USERS, users);
      setDoc(doc(firestoreDb, 'users', users[ownerIndex].id), { status }, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${users[ownerIndex].id}`)
      );
    }

    if (adminUser) {
      this.logAudit({
        businessId,
        businessName: businesses[index].name,
        userId: adminUser.id,
        userName: adminUser.name,
        userRole: adminUser.role,
        action: status === 'active' ? 'ACTIVATE_BUSINESS' : 'SUSPEND_BUSINESS',
        details: `Business ${businesses[index].name} status set to ${status}`,
      });
    }

    return businesses[index];
  },

  deleteBusiness(businessId: string, adminUser: User): void {
    let businesses = this.getBusinesses();
    const target = businesses.find((b) => b.id === businessId);
    businesses = businesses.filter((b) => b.id !== businessId);
    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);

    // Filter out users, products, sales, movements for this business
    let users = this.getUsers().filter((u) => u.businessId !== businessId);
    setToStorage(STORAGE_KEYS.USERS, users);

    let products = this.getAllProductsRaw().filter((p) => p.businessId !== businessId);
    setToStorage(STORAGE_KEYS.PRODUCTS, products);

    this.logAudit({
      businessId,
      businessName: target?.name,
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      action: 'DELETE_BUSINESS',
      details: `Business workspace permanently deleted: ${target?.name} (${businessId})`,
    });
  },

  // Products (Tenant-isolated)
  getAllProductsRaw(): Product[] {
    if (!cachedProductsInMemory) {
      cachedProductsInMemory = getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    }
    return cachedProductsInMemory;
  },

  setProductsInMemory(products: Product[], notify = true): void {
    cachedProductsInMemory = [...products];
    setToStorage(STORAGE_KEYS.PRODUCTS, products, notify);
  },

  getProducts(businessId: string): Product[] {
    const all = this.getAllProductsRaw();
    const businesses = this.getBusinesses();
    const users = this.getUsers();
    const businessMap = new Map<string, Business>(businesses.map((b) => [b.id, b]));
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    return all
      .filter((p) => p.businessId === businessId)
      .map((p) => {
        const business = businessMap.get(p.businessId);
        const ownerUser = p.ownerId ? userMap.get(p.ownerId) : users.find((u) => u.businessId === p.businessId);
        const resolvedName =
          p.businessName ||
          business?.name ||
          ownerUser?.businessName ||
          'Supermarket Store';
        return {
          ...p,
          businessName: resolvedName,
        };
      });
  },

  /**
   * Directly queries the live 'products' Firestore collection for a specific businessId.
   * Updates local state cache and emits a security toast notification if restricted by security rules.
   */
  async fetchProductsFromFirestore(businessId: string): Promise<Product[]> {
    if (!businessId) return [];
    try {
      const q = query(
        collection(firestoreDb, 'products'),
        where('businessId', '==', businessId)
      );
      const snapshot = await getDocs(q);
      const liveProducts: Product[] = [];
      snapshot.forEach((docSnap) => {
        liveProducts.push(docSnap.data() as Product);
      });

      // Update local storage cache for this business
      const businesses = this.getBusinesses();
      const users = this.getUsers();
      const businessMap = new Map<string, Business>(businesses.map((b) => [b.id, b]));
      const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

      const enrichedProducts = liveProducts.map((p) => {
        const business = businessMap.get(p.businessId);
        const ownerUser = p.ownerId ? userMap.get(p.ownerId) : users.find((u) => u.businessId === p.businessId);
        const resolvedName =
          p.businessName ||
          business?.name ||
          ownerUser?.businessName ||
          'Supermarket Store';
        return {
          ...p,
          businessName: resolvedName,
        };
      });

      // Merge enriched live products with existing local memory products so offline/new products aren't lost
      const existingAll = this.getAllProductsRaw();
      const productMap = new Map<string, Product>(existingAll.map((p) => [p.id, p]));
      enrichedProducts.forEach((p) => {
        productMap.set(p.id, p);
      });

      const updatedList = Array.from(productMap.values());
      this.setProductsInMemory(updatedList, true);

      return this.getProducts(businessId);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, `products (businessId: ${businessId})`);
      const isPermission =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission-denied') ||
        error?.message?.includes('Missing or insufficient permissions') ||
        error?.message?.includes('insufficient permissions');

      if (isPermission) {
        emitGlobalToast(
          'security',
          'Owner Dashboard: Security Restriction',
          `Access to store inventory for "${businessId}" was denied by Firestore security rules. Verify your store credentials.`
        );
      }
      return this.getProducts(businessId);
    }
  },

  getPublicProducts(businessId?: string): (Product & { businessName?: string })[] {
    const all = this.getAllProductsRaw();
    const businesses = this.getBusinesses();
    const users = this.getUsers();
    const businessMap = new Map<string, Business>(businesses.map((b) => [b.id, b]));
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    return all
      .filter((p) => {
        const business = businessMap.get(p.businessId);
        if (business && business.status === 'suspended') return false;
        if (p.status === 'archived') return false;

        const isPublic =
          p.isPublic !== undefined
            ? Boolean(p.isPublic)
            : p.isPublished !== undefined
            ? Boolean(p.isPublished)
            : true;
        if (!isPublic) return false;

        if (businessId && businessId !== 'ALL' && p.businessId !== businessId) return false;
        return true;
      })
      .map((p) => {
        const business = businessMap.get(p.businessId);
        const ownerUser = p.ownerId ? userMap.get(p.ownerId) : users.find((u) => u.businessId === p.businessId);
        const resolvedName =
          p.businessName ||
          business?.name ||
          ownerUser?.businessName ||
          (p.businessId && p.businessId !== 'MULTI' ? `Store ${p.businessId}` : 'Supermarket Store');
        return {
          ...p,
          businessName: resolvedName,
        };
      });
  },

  /**
   * Directly queries the live 'products' Firestore collection for the Public Catalog.
   * If a businessId is specified, filters by that businessId.
   * Handles security rule restrictions with a toast notification.
   */
  async fetchPublicProductsFromFirestore(businessId?: string): Promise<(Product & { businessName?: string })[]> {
    try {
      let q;
      if (businessId && businessId !== 'ALL') {
        q = query(
          collection(firestoreDb, 'products'),
          where('businessId', '==', businessId)
        );
      } else {
        q = query(collection(firestoreDb, 'products'));
      }

      const snapshot = await getDocs(q);
      const liveProducts: Product[] = [];
      snapshot.forEach((docSnap) => {
        liveProducts.push(docSnap.data() as Product);
      });

      if (liveProducts.length > 0) {
        const existingAll = this.getAllProductsRaw();
        const productMap = new Map<string, Product>(existingAll.map((p) => [p.id, p]));
        liveProducts.forEach((lp) => {
          productMap.set(lp.id, lp);
        });
        const mergedList = Array.from(productMap.values());
        this.setProductsInMemory(mergedList, true);
      }

      return this.getPublicProducts(businessId && businessId !== 'ALL' ? businessId : undefined);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, `products (public catalog, businessId: ${businessId || 'ALL'})`);
      const isPermission =
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission-denied') ||
        error?.message?.includes('Missing or insufficient permissions') ||
        error?.message?.includes('insufficient permissions');

      if (isPermission) {
        emitGlobalToast(
          'security',
          'Public Catalog: Security Restriction',
          `Public product query${businessId && businessId !== 'ALL' ? ` for store "${businessId}"` : ''} was denied by Firestore security rules.`
        );
      }
      return this.getPublicProducts(businessId && businessId !== 'ALL' ? businessId : undefined);
    }
  },

  getProductById(businessId: string, productId: string): Product | undefined {
    const products = this.getProducts(businessId);
    return products.find((p) => p.id === productId);
  },

  async addProduct(
    businessId: string,
    productData: Omit<Product, 'id' | 'businessId' | 'currentStock' | 'createdAt' | 'updatedAt' | 'totalSold'>,
    user: User
  ): Promise<Product> {
    const allProducts = this.getAllProductsRaw();
    const productId = `PROD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const openingStock = Number(productData.openingStock) || 0;
    const totalReceived = Number(productData.totalReceived) || 0;
    const stockAdjustments = Number(productData.stockAdjustments) || 0;
    const totalSold = 0;
    const currentStock = openingStock + totalReceived + stockAdjustments - totalSold;

    const business = this.getBusinessById(businessId);
    const users = this.getUsers();
    const authenticatedUid = user?.id || (user as any)?.uid || '';
    const ownerUser = users.find((u) => u.id === (authenticatedUid || productData.ownerId) || u.businessId === businessId);
    const resolvedOwnerId = authenticatedUid || productData.ownerId || business?.ownerId || '';
    const resolvedBusinessName =
      productData.businessName ||
      business?.name ||
      user?.businessName ||
      ownerUser?.businessName ||
      'Supermarket Store';

    const isPublished =
      productData.isPublished !== undefined
        ? Boolean(productData.isPublished)
        : productData.isPublic !== undefined
        ? Boolean(productData.isPublic)
        : true;
    const isPublic = isPublished;

    let safeImageUrl = productData.imageUrl || '';
    if (safeImageUrl && safeImageUrl.startsWith('data:image/')) {
      safeImageUrl = await compressImageDataUrl(safeImageUrl, 800, 800, 0.75);
    }

    const newProduct: Product = {
      ...productData,
      id: productId,
      businessId,
      ownerId: resolvedOwnerId,
      businessName: resolvedBusinessName,
      imageUrl: safeImageUrl,
      isPublished,
      isPublic,
      openingStock,
      totalReceived,
      totalSold,
      stockAdjustments,
      currentStock,
      purchasePrice: Number(productData.purchasePrice) || 0,
      sellingPrice: Number(productData.sellingPrice) || 0,
      minStockLevel: Number(productData.minStockLevel) || 0,
      maxStockLevel: Number(productData.maxStockLevel) || 100,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allProducts.push(newProduct);
    this.setProductsInMemory(allProducts, true);

    // Save directly to Cloud Firestore immediately
    try {
      await setDoc(doc(firestoreDb, 'products', newProduct.id), newProduct);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `products/${newProduct.id}`);
    }

    // If opening stock > 0, log initial movement
    if (openingStock > 0) {
      this.logMovement({
        businessId,
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'OPENING',
        quantity: openingStock,
        previousStock: 0,
        newStock: openingStock,
        unitCost: newProduct.purchasePrice,
        referenceId: `OPEN-${productId}`,
        notes: 'Initial opening stock upon product creation',
        performedBy: user.name,
      });
    }

    this.logAudit({
      businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'ADD_PRODUCT',
      details: `Added new product: ${newProduct.name} (SKU: ${newProduct.sku})`,
    });

    // Notify listeners across app for instantaneous state updates
    window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key: STORAGE_KEYS.PRODUCTS } }));
    window.dispatchEvent(new CustomEvent('spm_product_update', { detail: { product: newProduct } }));

    return newProduct;
  },

  async updateProduct(businessId: string, productId: string, updates: Partial<Product>, user: User): Promise<Product> {
    const allProducts = this.getAllProductsRaw();
    const index = allProducts.findIndex((p) => p.id === productId && (p.businessId === businessId || user.role === 'super_admin'));
    if (index === -1) throw new Error('Product not found or access denied');

    const prev = allProducts[index];
    const openingStock = updates.openingStock !== undefined ? Number(updates.openingStock) : prev.openingStock;
    const totalReceived = updates.totalReceived !== undefined ? Number(updates.totalReceived) : prev.totalReceived;
    const totalSold = updates.totalSold !== undefined ? Number(updates.totalSold) : prev.totalSold;
    const stockAdjustments = updates.stockAdjustments !== undefined ? Number(updates.stockAdjustments) : prev.stockAdjustments;

    // Strict formula: Current Stock = Opening Stock + Total Received + Stock Adjustments - Total Sold
    const currentStock = openingStock + totalReceived + stockAdjustments - totalSold;

    const business = this.getBusinessById(businessId);
    const users = this.getUsers();
    const isPublished =
      updates.isPublished !== undefined
        ? Boolean(updates.isPublished)
        : updates.isPublic !== undefined
        ? Boolean(updates.isPublic)
        : prev.isPublished ?? prev.isPublic ?? true;
    const isPublic = isPublished;
    const authenticatedUid = user?.id || (user as any)?.uid || '';
    const ownerId = authenticatedUid || updates.ownerId || prev.ownerId || business?.ownerId || '';
    const ownerUser = users.find((u) => u.id === (authenticatedUid || updates.ownerId || prev.ownerId) || u.businessId === businessId);
    const resolvedBusinessName =
      updates.businessName ||
      prev.businessName ||
      business?.name ||
      user?.businessName ||
      ownerUser?.businessName ||
      'Supermarket Store';

    let safeImageUrl = updates.imageUrl !== undefined ? updates.imageUrl : prev.imageUrl;
    if (safeImageUrl && safeImageUrl.startsWith('data:image/')) {
      safeImageUrl = await compressImageDataUrl(safeImageUrl, 800, 800, 0.75);
    }

    allProducts[index] = {
      ...prev,
      ...updates,
      ownerId,
      businessName: resolvedBusinessName,
      imageUrl: safeImageUrl,
      isPublished,
      isPublic,
      openingStock,
      totalReceived,
      totalSold,
      stockAdjustments,
      currentStock,
      updatedAt: new Date().toISOString(),
    };

    this.setProductsInMemory(allProducts, true);

    // Update in Cloud Firestore immediately
    try {
      await setDoc(doc(firestoreDb, 'products', productId), allProducts[index], { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }

    this.logAudit({
      businessId: prev.businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE_PRODUCT',
      details: `Updated product details for ${prev.name} (ID: ${productId})`,
    });

    window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key: STORAGE_KEYS.PRODUCTS } }));
    window.dispatchEvent(new CustomEvent('spm_product_update', { detail: { product: allProducts[index] } }));

    return allProducts[index];
  },

  async deleteProduct(businessId: string, productId: string, user: User): Promise<boolean> {
    let allProducts = this.getAllProductsRaw();
    const target = allProducts.find((p) => p.id === productId && (p.businessId === businessId || user.role === 'super_admin'));
    if (!target) throw new Error('Product not found');

    allProducts = allProducts.filter((p) => p.id !== productId);
    this.setProductsInMemory(allProducts, true);

    // Permanently delete from Cloud Firestore
    try {
      await deleteDoc(doc(firestoreDb, 'products', productId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }

    this.logAudit({
      businessId: target.businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'DELETE_PRODUCT',
      details: `Permanently deleted product ${target.name} (SKU: ${target.sku})`,
    });

    window.dispatchEvent(new CustomEvent('spm_storage_update', { detail: { key: STORAGE_KEYS.PRODUCTS } }));
    window.dispatchEvent(new CustomEvent('spm_product_update', { detail: { productId } }));

    return true;
  },

  archiveProduct(businessId: string, productId: string, user: User): Product {
    return this.updateProduct(businessId, productId, { status: 'archived' }, user);
  },

  restoreProduct(businessId: string, productId: string, user: User): Product {
    return this.updateProduct(businessId, productId, { status: 'active' }, user);
  },

  // Stock Operations: Receiving / Inward Load
  receiveStock(
    businessId: string,
    data: {
      productId: string;
      quantity: number;
      supplierName: string;
      invoiceNumber: string;
      unitCost?: number;
      notes?: string;
    },
    user: User
  ): { product: Product; movement: InventoryMovement } {
    const product = this.getProductById(businessId, data.productId);
    if (!product) throw new Error('Product not found');

    const quantity = Number(data.quantity);
    if (quantity <= 0) throw new Error('Stock receiving quantity must be greater than 0');

    const previousStock = product.currentStock;
    const newTotalReceived = product.totalReceived + quantity;
    const newStock = product.openingStock + newTotalReceived + product.stockAdjustments - product.totalSold;

    const updatedProduct = this.updateProduct(
      businessId,
      product.id,
      {
        totalReceived: newTotalReceived,
        supplier: data.supplierName || product.supplier,
        purchasePrice: data.unitCost !== undefined && data.unitCost > 0 ? data.unitCost : product.purchasePrice,
      },
      user
    );

    const movement = this.logMovement({
      businessId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: 'RECEIVING',
      quantity,
      previousStock,
      newStock,
      unitCost: data.unitCost || product.purchasePrice,
      referenceId: data.invoiceNumber || `REC-${Date.now().toString(36).toUpperCase()}`,
      notes: data.notes || `Stock received from ${data.supplierName || 'supplier'}`,
      performedBy: user.name,
    });

    this.logAudit({
      businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'RECEIVE_STOCK',
      details: `Received +${quantity} units for ${product.name}. Stock changed from ${previousStock} to ${newStock}`,
    });

    return { product: updatedProduct, movement };
  },

  // Stock Adjustment (Manual loss, damage, count correction)
  adjustStock(
    businessId: string,
    data: {
      productId: string;
      deltaQuantity: number; // positive or negative
      reason: string;
    },
    user: User
  ): { product: Product; movement: InventoryMovement } {
    const product = this.getProductById(businessId, data.productId);
    if (!product) throw new Error('Product not found');

    const delta = Number(data.deltaQuantity);
    if (delta === 0) throw new Error('Adjustment quantity cannot be 0');

    const previousStock = product.currentStock;
    const targetStock = previousStock + delta;
    if (targetStock < 0) throw new Error('Stock adjustment would result in negative inventory');

    const newAdjustments = product.stockAdjustments + delta;
    const updatedProduct = this.updateProduct(
      businessId,
      product.id,
      {
        stockAdjustments: newAdjustments,
      },
      user
    );

    const movement = this.logMovement({
      businessId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type: delta > 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB',
      quantity: Math.abs(delta),
      previousStock,
      newStock: targetStock,
      referenceId: `ADJ-${Date.now().toString(36).toUpperCase()}`,
      notes: data.reason || 'Inventory count adjustment',
      performedBy: user.name,
    });

    this.logAudit({
      businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'ADJUST_STOCK',
      details: `Adjusted stock by ${delta > 0 ? '+' : ''}${delta} for ${product.name} (Reason: ${data.reason})`,
    });

    return { product: updatedProduct, movement };
  },

  // Sales & POS Execution
  processSale(
    businessId: string,
    saleData: {
      items: { productId: string; quantity: number }[];
      customerName?: string;
      customerPhone?: string;
      discount?: number;
      paymentMethod: Sale['paymentMethod'];
      receivedAmount?: number;
      notes?: string;
    },
    user: User
  ): Sale {
    const business = this.getBusinessById(businessId);
    if (!business) throw new Error('Business not found');

    const allProducts = this.getProducts(businessId);
    const saleItems: Sale['items'] = [];
    let subtotal = 0;

    // Validate availability for all items first (Never allow selling more than available stock)
    for (const item of saleData.items) {
      const prod = allProducts.find((p) => p.id === item.productId);
      if (!prod) throw new Error(`Product ID ${item.productId} not found`);
      if (prod.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}`);
      }
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const saleId = `SALE-${Date.now().toString(36).toUpperCase()}`;

    // Execute decrements & assemble sale items
    for (const item of saleData.items) {
      const prod = allProducts.find((p) => p.id === item.productId)!;
      const lineSubtotal = prod.sellingPrice * item.quantity;
      subtotal += lineSubtotal;

      saleItems.push({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        unitPrice: prod.sellingPrice,
        costPrice: prod.purchasePrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        unit: prod.unit,
      });

      const previousStock = prod.currentStock;
      const newTotalSold = prod.totalSold + item.quantity;
      const newStock = prod.openingStock + prod.totalReceived + prod.stockAdjustments - newTotalSold;

      // Update product totalSold
      this.updateProduct(
        businessId,
        prod.id,
        {
          totalSold: newTotalSold,
        },
        user
      );

      // Log movement for this product
      this.logMovement({
        businessId,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        type: 'SALE',
        quantity: item.quantity,
        previousStock,
        newStock,
        referenceId: invoiceNumber,
        unitCost: prod.purchasePrice,
        notes: `Sold via POS (Invoice #${invoiceNumber})`,
        performedBy: user.name,
      });
    }

    const discount = Number(saleData.discount) || 0;
    const taxRate = business.taxRate || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
    const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

    const receivedAmount = saleData.receivedAmount !== undefined ? Number(saleData.receivedAmount) : totalAmount;
    const changeAmount = Math.max(0, Math.round((receivedAmount - totalAmount) * 100) / 100);

    const newSale: Sale = {
      id: saleId,
      businessId,
      invoiceNumber,
      customerName: saleData.customerName || 'Walk-in Customer',
      customerPhone: saleData.customerPhone || '',
      items: saleItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount,
      tax,
      totalAmount,
      paymentMethod: saleData.paymentMethod,
      paymentStatus: 'paid',
      receivedAmount,
      changeAmount,
      notes: saleData.notes,
      createdAt: new Date().toISOString(),
      cashierName: user.name,
    };

    const allSales = getFromStorage<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    allSales.unshift(newSale);
    setToStorage(STORAGE_KEYS.SALES, allSales);

    this.logAudit({
      businessId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'PROCESS_SALE',
      details: `Completed sale #${invoiceNumber} for ${saleItems.length} items. Total: $${totalAmount.toFixed(2)}`,
    });

    return newSale;
  },

  getSales(businessId: string): Sale[] {
    const allSales = getFromStorage<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    return allSales.filter((s) => s.businessId === businessId);
  },

  getAllPlatformSales(): Sale[] {
    return getFromStorage<Sale[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
  },

  // Movements & History
  getMovements(businessId: string, productId?: string): InventoryMovement[] {
    const all = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    return all
      .filter((m) => m.businessId === businessId && (!productId || m.productId === productId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  logMovement(data: Omit<InventoryMovement, 'id' | 'createdAt'>): InventoryMovement {
    const all = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const newMovement: InventoryMovement = {
      ...data,
      id: `MOV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(newMovement);
    setToStorage(STORAGE_KEYS.MOVEMENTS, all);

    setDoc(doc(firestoreDb, 'movements', newMovement.id), newMovement).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `movements/${newMovement.id}`)
    );

    return newMovement;
  },

  deleteMovement(id: string): boolean {
    const all = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const updated = all.filter((m) => m.id !== id);
    setToStorage(STORAGE_KEYS.MOVEMENTS, updated, true);

    deleteDoc(doc(firestoreDb, 'movements', id)).catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `movements/${id}`)
    );
    return true;
  },

  // Suppliers (Tenant-isolated)
  getSuppliers(businessId: string): Supplier[] {
    const all = getFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    return all.filter((s) => s.businessId === businessId);
  },

  addSupplier(
    businessId: string,
    data: {
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      suppliedCategories?: string[];
      notes?: string;
    },
    user?: User
  ): Supplier {
    const all = getFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    const newSupplier: Supplier = {
      id: `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      businessId,
      name: data.name,
      contactPerson: data.contactPerson || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      suppliedCategories: data.suppliedCategories || [],
      notes: data.notes || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    all.push(newSupplier);
    setToStorage(STORAGE_KEYS.SUPPLIERS, all);

    if (user) {
      this.logAudit({
        businessId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'ADD_SUPPLIER',
        details: `Added new supplier: ${newSupplier.name}`,
      });
    }

    return newSupplier;
  },

  updateSupplier(
    businessId: string,
    supplierId: string,
    updates: Partial<Supplier>,
    user?: User
  ): Supplier {
    const all = getFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    const index = all.findIndex((s) => s.id === supplierId && s.businessId === businessId);
    if (index === -1) throw new Error('Supplier not found');

    all[index] = { ...all[index], ...updates };
    setToStorage(STORAGE_KEYS.SUPPLIERS, all);

    if (user) {
      this.logAudit({
        businessId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'UPDATE_SUPPLIER',
        details: `Updated supplier: ${all[index].name}`,
      });
    }

    return all[index];
  },

  deleteSupplier(businessId: string, supplierId: string, user?: User): void {
    let all = getFromStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    all = all.filter((s) => s.id !== supplierId || s.businessId !== businessId);
    setToStorage(STORAGE_KEYS.SUPPLIERS, all);
  },

  // Audit Logs
  getAuditLogs(businessId?: string | null): AuditLog[] {
    const all = getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    const seenIds = new Set<string>();
    const uniqueLogs: AuditLog[] = [];

    for (let i = 0; i < all.length; i++) {
      const log = all[i];
      if (!log) continue;
      const rawId = log.id || `LOG-${i}`;
      if (seenIds.has(rawId)) {
        const uniqueId = `${rawId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${i}`;
        uniqueLogs.push({ ...log, id: uniqueId });
        seenIds.add(uniqueId);
      } else {
        seenIds.add(rawId);
        uniqueLogs.push(log);
      }
    }

    if (!businessId) {
      return uniqueLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return uniqueLogs
      .filter((l) => l.businessId === businessId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  logAudit(data: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const all = getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    const newLog: AuditLog = {
      ...data,
      id: `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
    all.unshift(newLog);
    if (all.length > 500) all.pop(); // Keep manageable size
    setToStorage(STORAGE_KEYS.AUDIT_LOGS, all);
  },

  getPlatformStats() {
    const stats = this.getSuperAdminStats();
    return {
      totalBusinesses: stats.totalBusinesses,
      totalProducts: stats.totalProducts,
      totalSalesCount: stats.totalTransactions,
      totalRevenue: stats.totalSalesRevenue,
      activeBusinesses: stats.activeBusinesses,
      suspendedBusinesses: stats.suspendedBusinesses,
    };
  },

  // Super Admin Platform Metrics
  getSuperAdminStats() {
    const businesses = this.getBusinesses();
    const users = this.getUsers().filter((u) => u.role === 'business_owner');
    const products = this.getAllProductsRaw();
    const sales = this.getAllPlatformSales();

    const totalStockUnits = products.reduce((acc, p) => acc + (p.currentStock > 0 ? p.currentStock : 0), 0);
    const totalPlatformSalesRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const activeBusinesses = businesses.filter((b) => b.status === 'active').length;
    const suspendedBusinesses = businesses.filter((b) => b.status === 'suspended').length;

    return {
      totalBusinesses: businesses.length,
      totalBusinessOwners: users.length,
      totalProducts: products.length,
      totalStockUnits,
      totalSalesRevenue: totalPlatformSalesRevenue,
      totalTransactions: sales.length,
      activeBusinesses,
      suspendedBusinesses,
      newRegistrationsCount: businesses.filter((b) => {
        const d = new Date(b.createdAt);
        const now = new Date();
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 30;
      }).length,
    };
  },

  // Helper categories
  getCategories(): string[] {
    const baseCategories = [
      'Electronics & Gadgets',
      'Computers & Accessories',
      'Mobile & Audio',
      'Home & Kitchen Appliances',
      'Dairy & Eggs',
      'Fresh Produce',
      'Bakery',
      'Beverages',
      'Pantry & Grains',
      'Snacks & Confectionery',
      'Meat & Poultry',
      'Frozen Foods',
      'Household Essentials',
      'Personal Care & Health',
      'Baby & Child Care',
      'Pet Supplies',
      'Clothing & Apparel',
      'General / Other',
    ];
    try {
      const allProducts = this.getAllProductsRaw();
      const existingProductCats = allProducts.map((p) => p.category).filter(Boolean);
      return Array.from(new Set([...baseCategories, ...existingProductCats]));
    } catch {
      return baseCategories;
    }
  },

  // Support Settings & Tickets
  getSupportSettings(): SupportSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPORT_SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SUPPORT_SETTINGS, JSON.stringify(DEFAULT_SUPPORT_SETTINGS));
      return DEFAULT_SUPPORT_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      // If parsed contains legacy default placeholder values, update to new defaults
      if (parsed.whatsappNumber === '+8801700000000' || parsed.supportEmail === 'support.spm@gmail.com') {
        const migrated = { ...DEFAULT_SUPPORT_SETTINGS, ...parsed, whatsappNumber: '+8801859340742', supportPhone: '+880 1859-340742', facebookMessengerUrl: 'https://www.facebook.com/nazim.hossaim.413123', supportEmail: 'imranmahmud1122.test@gmail.com' };
        localStorage.setItem(STORAGE_KEYS.SUPPORT_SETTINGS, JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch {
      return DEFAULT_SUPPORT_SETTINGS;
    }
  },

  updateSupportSettings(settings: Partial<SupportSettings>): SupportSettings {
    const current = this.getSupportSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SUPPORT_SETTINGS, JSON.stringify(updated));
    this.addAuditLog('SUPPORT_SETTINGS_UPDATED', 'Updated support contact configuration');
    return updated;
  },

  getSupportTickets(): SupportTicket[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPORT_TICKETS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify(INITIAL_SUPPORT_TICKETS));
      return INITIAL_SUPPORT_TICKETS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SUPPORT_TICKETS;
    }
  },

  createSupportTicket(ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): SupportTicket {
    const tickets = this.getSupportTickets();
    const newId = `TICKET-${1000 + tickets.length + 1}`;
    const newTicket: SupportTicket = {
      ...ticketData,
      id: newId,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    const updated = [newTicket, ...tickets];
    localStorage.setItem(STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify(updated));
    this.addAuditLog('SUPPORT_TICKET_SUBMITTED', `New support ticket ${newId} submitted by ${newTicket.email} (${newTicket.category})`);
    return newTicket;
  },

  updateSupportTicketStatus(id: string, status: 'open' | 'in_progress' | 'resolved'): SupportTicket | null {
    const tickets = this.getSupportTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tickets[idx].status = status;
    localStorage.setItem(STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify(tickets));
    this.addAuditLog('SUPPORT_TICKET_STATUS_CHANGED', `Ticket ${id} status changed to ${status}`);
    return tickets[idx];
  },

  // ==========================================
  // MULTI-VENDOR MARKETPLACE ORDER MANAGEMENT
  // ==========================================

  getOrders(): Order[] {
    const list = getFromStorage<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getOrdersByOwner(ownerId: string, businessId?: string): Order[] {
    const all = this.getOrders();
    return all.filter((o) => {
      // Direct owner or store match
      if (o.ownerId === ownerId) return true;
      if (businessId && o.storeId === businessId) return true;
      // Item level match
      if (o.items && o.items.some((it) => it.ownerId === ownerId || (businessId && it.storeId === businessId))) return true;
      return false;
    });
  },

  getOrderById(orderId: string): Order | undefined {
    const all = this.getOrders();
    return all.find((o) => o.id === orderId || o.orderId === orderId);
  },

  trackOrder(orderId: string, phone: string): Order | null {
    const cleanId = orderId.trim().toUpperCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const all = this.getOrders();
    const matched = all.find((o) => {
      const matchId = o.id.toUpperCase() === cleanId || o.orderId.toUpperCase() === cleanId;
      if (!matchId) return false;
      const orderPhoneClean = o.customerPhone.replace(/[^0-9]/g, '');
      // Match last 8 digits or full phone to handle country code variations
      return (
        orderPhoneClean === cleanPhone ||
        (cleanPhone.length >= 7 && orderPhoneClean.endsWith(cleanPhone.slice(-7))) ||
        (orderPhoneClean.length >= 7 && cleanPhone.endsWith(orderPhoneClean.slice(-7)))
      );
    });
    return matched || null;
  },

  createOrder(payload: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    zilla?: string;
    thana?: string;
    customerNote?: string;
    paymentMethod?: 'cash_on_delivery' | 'mobile_banking' | 'card' | 'online';
    items: { productId: string; quantity: number }[];
  }): { masterOrder: Order; vendorOrders: Order[] } {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const allProducts = this.getAllProductsRaw();
    const allBusinesses = this.getBusinesses();
    const allUsers = this.getUsers();
    const bizMap = new Map<string, Business>(allBusinesses.map((b) => [b.id, b]));
    const userMap = new Map<string, User>(allUsers.map((u) => [u.id, u]));

    // Validate stock and build snapshots
    const validatedItems: OrderItem[] = [];
    for (const reqItem of payload.items) {
      const p = allProducts.find((prod) => prod.id === reqItem.productId);
      if (!p) {
        throw new Error(`Product not found (ID: ${reqItem.productId})`);
      }
      if (p.currentStock < reqItem.quantity) {
        throw new Error(`Insufficient stock for "${p.name}". Available: ${p.currentStock}, Requested: ${reqItem.quantity}`);
      }

      const biz = bizMap.get(p.businessId);
      const ownerUser = biz ? userMap.get(biz.ownerId) || allUsers.find((u) => u.businessId === biz.id) : null;
      const ownerId = p.ownerId || biz?.ownerId || ownerUser?.id || 'USR-METRO';
      const ownerName = ownerUser?.name || biz?.ownerName || 'Store Owner';
      const storeName = biz?.name || 'Supermarket';

      validatedItems.push({
        productId: p.id,
        productNameSnapshot: p.name,
        sku: p.sku,
        barcode: p.barcode,
        unitPriceSnapshot: p.sellingPrice,
        costPriceSnapshot: p.purchasePrice,
        quantity: reqItem.quantity,
        subtotal: p.sellingPrice * reqItem.quantity,
        unit: p.unit,
        ownerId,
        ownerNameSnapshot: ownerName,
        storeId: p.businessId,
        storeNameSnapshot: storeName,
        imageUrl: p.imageUrl,
      });
    }

    // Atomically decrement stock and log inventory movements
    for (const reqItem of payload.items) {
      const pIndex = allProducts.findIndex((prod) => prod.id === reqItem.productId);
      if (pIndex !== -1) {
        const prod = allProducts[pIndex];
        const prevStock = prod.currentStock;
        prod.totalSold = (prod.totalSold || 0) + reqItem.quantity;
        prod.currentStock = prod.openingStock + prod.totalReceived + prod.stockAdjustments - prod.totalSold;
        prod.updatedAt = new Date().toISOString();

        // Log movement
        this.logMovement({
          businessId: prod.businessId,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'ONLINE_ORDER',
          quantity: reqItem.quantity,
          previousStock: prevStock,
          newStock: prod.currentStock,
          unitCost: prod.purchasePrice,
          referenceId: `ORD-${Date.now().toString().slice(-6)}`,
          notes: `Public marketplace customer order placed by ${payload.customerName}`,
          performedBy: payload.customerName,
        });
      }
    }
    setToStorage(STORAGE_KEYS.PRODUCTS, allProducts);

    // Group items by vendor/store
    const itemsByStore = new Map<string, OrderItem[]>();
    for (const it of validatedItems) {
      const groupKey = it.storeId;
      if (!itemsByStore.has(groupKey)) {
        itemsByStore.set(groupKey, []);
      }
      itemsByStore.get(groupKey)!.push(it);
    }

    const timestamp = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const masterOrderId = `ORD-${new Date().getFullYear()}-${randomSuffix}`;
    const allStoredOrders = this.getOrders();
    const vendorOrders: Order[] = [];

    // Create sub-orders for each store vendor
    let subOrderIndex = 1;
    for (const [storeId, itemsList] of itemsByStore.entries()) {
      const firstItem = itemsList[0];
      const subtotal = itemsList.reduce((acc, it) => acc + it.subtotal, 0);
      const totalQty = itemsList.reduce((acc, it) => acc + it.quantity, 0);
      const biz = bizMap.get(storeId);
      const deliveryCharge = biz?.deliveryCharge !== undefined ? biz.deliveryCharge : 60;
      const totalAmount = subtotal + deliveryCharge;
      const subOrderId = itemsByStore.size > 1 ? `${masterOrderId}-V${subOrderIndex}` : masterOrderId;

      const vendorOrder: Order = {
        id: subOrderId,
        orderId: subOrderId,
        parentOrderId: itemsByStore.size > 1 ? masterOrderId : undefined,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerEmail: payload.customerEmail || '',
        deliveryAddress: payload.deliveryAddress,
        zilla: payload.zilla || '',
        thana: payload.thana || '',
        customerNote: payload.customerNote || '',
        items: itemsList,
        productId: firstItem.productId,
        productNameSnapshot: itemsList.length === 1 ? firstItem.productNameSnapshot : `${firstItem.productNameSnapshot} (+${itemsList.length - 1} more)`,
        ownerId: firstItem.ownerId,
        ownerNameSnapshot: firstItem.ownerNameSnapshot || 'Store Owner',
        storeId: storeId,
        storeNameSnapshot: firstItem.storeNameSnapshot,
        quantity: totalQty,
        unitPriceSnapshot: firstItem.unitPriceSnapshot,
        subtotal,
        deliveryCharge,
        totalAmount,
        orderStatus: 'Pending',
        paymentStatus: payload.paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'pending',
        paymentMethod: payload.paymentMethod || 'cash_on_delivery',
        statusHistory: [
          {
            changedBy: `${payload.customerName} (Customer)`,
            changedAt: timestamp,
            previousStatus: 'Pending',
            newStatus: 'Pending',
            notes: 'Order placed via Public Marketplace',
          },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      vendorOrders.push(vendorOrder);
      allStoredOrders.unshift(vendorOrder);
      subOrderIndex++;
    }

    // Master order representation
    const masterOrder: Order = vendorOrders.length === 1
      ? vendorOrders[0]
      : {
          id: masterOrderId,
          orderId: masterOrderId,
          childOrderIds: vendorOrders.map((vo) => vo.orderId),
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          customerEmail: payload.customerEmail || '',
          deliveryAddress: payload.deliveryAddress,
          zilla: payload.zilla || '',
          thana: payload.thana || '',
          customerNote: payload.customerNote || '',
          items: validatedItems,
          productId: validatedItems[0].productId,
          productNameSnapshot: `${validatedItems[0].productNameSnapshot} and ${validatedItems.length - 1} items from ${itemsByStore.size} stores`,
          ownerId: 'MULTI',
          ownerNameSnapshot: 'Multi-Store Marketplace Order',
          storeId: 'MULTI',
          storeNameSnapshot: 'Multi-Store Order',
          quantity: validatedItems.reduce((acc, it) => acc + it.quantity, 0),
          unitPriceSnapshot: validatedItems[0].unitPriceSnapshot,
          subtotal: validatedItems.reduce((acc, it) => acc + it.subtotal, 0),
          deliveryCharge: vendorOrders.reduce((acc, vo) => acc + vo.deliveryCharge, 0),
          totalAmount: vendorOrders.reduce((acc, vo) => acc + vo.totalAmount, 0),
          orderStatus: 'Pending',
          paymentStatus: payload.paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'pending',
          paymentMethod: payload.paymentMethod || 'cash_on_delivery',
          statusHistory: [
            {
              changedBy: `${payload.customerName} (Customer)`,
              changedAt: timestamp,
              previousStatus: 'Pending',
              newStatus: 'Pending',
              notes: 'Master order created across multiple vendor stores',
            },
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    setToStorage(STORAGE_KEYS.ORDERS, allStoredOrders);

    // Save orders to Cloud Firestore
    setDoc(doc(firestoreDb, 'orders', masterOrder.id), masterOrder).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `orders/${masterOrder.id}`)
    );
    for (const vo of vendorOrders) {
      setDoc(doc(firestoreDb, 'orders', vo.id), vo).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `orders/${vo.id}`)
      );
    }

    this.logAudit({
      businessId: vendorOrders.length === 1 ? vendorOrders[0].storeId : null,
      userId: 'PUBLIC_CUSTOMER',
      userName: payload.customerName,
      userRole: 'public_visitor',
      action: 'PLACE_ORDER',
      details: `New order placed: ${masterOrderId} for $${masterOrder.totalAmount.toFixed(2)} by ${payload.customerName}`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spm_order_update', { detail: { orderId: masterOrderId } }));
    }

    return { masterOrder, vendorOrders };
  },

  updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    userRole?: string,
    notes?: string
  ): Order | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId || o.orderId === orderId);
    if (idx === -1) return null;

    const currentOrder = orders[idx];
    const prevStatus = currentOrder.orderStatus;
    if (prevStatus === newStatus) return currentOrder;

    // Handle stock restoration on cancellation
    if (newStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
      const allProducts = this.getAllProductsRaw();
      for (const item of currentOrder.items) {
        const pIdx = allProducts.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          const prod = allProducts[pIdx];
          const prevStock = prod.currentStock;
          prod.totalSold = Math.max(0, (prod.totalSold || 0) - item.quantity);
          prod.currentStock = prod.openingStock + prod.totalReceived + prod.stockAdjustments - prod.totalSold;
          prod.updatedAt = new Date().toISOString();

          this.logMovement({
            businessId: prod.businessId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'ORDER_CANCELLED',
            quantity: item.quantity,
            previousStock: prevStock,
            newStock: prod.currentStock,
            unitCost: prod.purchasePrice,
            referenceId: currentOrder.orderId,
            notes: `Stock replenished due to order cancellation (${currentOrder.orderId})`,
            performedBy: changedBy,
          });
        }
      }
      setToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    } else if (prevStatus === 'Cancelled' && newStatus !== 'Cancelled') {
      // Re-decrement stock if uncancelled
      const allProducts = this.getAllProductsRaw();
      for (const item of currentOrder.items) {
        const pIdx = allProducts.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          const prod = allProducts[pIdx];
          const prevStock = prod.currentStock;
          prod.totalSold = (prod.totalSold || 0) + item.quantity;
          prod.currentStock = prod.openingStock + prod.totalReceived + prod.stockAdjustments - prod.totalSold;
          prod.updatedAt = new Date().toISOString();

          this.logMovement({
            businessId: prod.businessId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'ONLINE_ORDER',
            quantity: item.quantity,
            previousStock: prevStock,
            newStock: prod.currentStock,
            unitCost: prod.purchasePrice,
            referenceId: currentOrder.orderId,
            notes: `Stock re-deducted after reactivation of order (${currentOrder.orderId})`,
            performedBy: changedBy,
          });
        }
      }
      setToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    }

    const timestamp = new Date().toISOString();
    const newHistoryEntry: OrderStatusHistory = {
      changedBy,
      changedAt: timestamp,
      previousStatus: prevStatus,
      newStatus,
      notes: notes || `Status updated to ${newStatus}`,
      userRole,
    };

    currentOrder.orderStatus = newStatus;
    currentOrder.updatedAt = timestamp;
    currentOrder.statusHistory = [...(currentOrder.statusHistory || []), newHistoryEntry];

    // If delivered, mark payment as paid if cash on delivery
    if (newStatus === 'Delivered' && currentOrder.paymentStatus === 'cash_on_delivery') {
      currentOrder.paymentStatus = 'paid';
    }

    orders[idx] = currentOrder;
    setToStorage(STORAGE_KEYS.ORDERS, orders);

    setDoc(doc(firestoreDb, 'orders', currentOrder.id), currentOrder, { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `orders/${currentOrder.id}`)
    );

    this.logAudit({
      businessId: currentOrder.storeId !== 'MULTI' ? currentOrder.storeId : null,
      userId: changedBy,
      userName: changedBy,
      userRole: (userRole as any) || 'business_owner',
      action: 'UPDATE_ORDER_STATUS',
      details: `Order ${currentOrder.orderId} status changed from ${prevStatus} to ${newStatus}`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spm_order_update', { detail: { orderId: currentOrder.orderId, status: newStatus } }));
    }

    return currentOrder;
  },

  // Rich Admin Platform & Marketplace Analytics
  getAdminAnalytics(): AdminAnalytics {
    const orders = this.getOrders();
    const businesses = this.getBusinesses();
    const users = this.getUsers().filter((u) => u.role === 'business_owner');
    const products = this.getAllProductsRaw();

    const totalSales = orders
      .filter((o) => o.orderStatus !== 'Cancelled')
      .reduce((acc, o) => acc + o.totalAmount, 0);

    const totalProductsSold = orders
      .filter((o) => o.orderStatus !== 'Cancelled')
      .reduce((acc, o) => acc + o.quantity, 0);

    const activeOwners = businesses.filter((b) => b.status === 'active').length;
    const pendingOwners = businesses.filter((b) => b.status === 'pending').length;
    const publishedProducts = products.filter((p) => p.isPublic && p.status === 'active').length;

    const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending').length;
    const completedOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === 'Cancelled').length;

    // Unique customers count by phone
    const uniquePhones = new Set(orders.map((o) => o.customerPhone.trim()));
    const totalCustomers = uniquePhones.size;

    // Top selling products computation
    const productStats = new Map<string, { name: string; salesCount: number; totalRevenue: number; businessName: string; imageUrl?: string }>();
    for (const ord of orders) {
      if (ord.orderStatus === 'Cancelled') continue;
      for (const it of ord.items || []) {
        const existing = productStats.get(it.productId) || {
          name: it.productNameSnapshot,
          salesCount: 0,
          totalRevenue: 0,
          businessName: it.storeNameSnapshot,
          imageUrl: it.imageUrl,
        };
        existing.salesCount += it.quantity;
        existing.totalRevenue += it.subtotal;
        productStats.set(it.productId, existing);
      }
    }

    const topSellingProducts = Array.from(productStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    // Top selling owners / stores computation
    const storeStats = new Map<string, { ownerId: string; storeName: string; ownerName: string; orderCount: number; totalRevenue: number }>();
    for (const ord of orders) {
      if (ord.orderStatus === 'Cancelled' || ord.storeId === 'MULTI') continue;
      const existing = storeStats.get(ord.storeId) || {
        ownerId: ord.ownerId,
        storeName: ord.storeNameSnapshot,
        ownerName: ord.ownerNameSnapshot,
        orderCount: 0,
        totalRevenue: 0,
      };
      existing.orderCount += 1;
      existing.totalRevenue += ord.totalAmount;
      storeStats.set(ord.storeId, existing);
    }

    const topSellingOwners = Array.from(storeStats.entries())
      .map(([businessId, stats]) => ({ businessId, ...stats }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Daily Sales trends (last 7 days)
    const dailyMap = new Map<string, { sales: number; orders: number }>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(key, { sales: 0, orders: 0 });
    }

    for (const ord of orders) {
      if (ord.orderStatus === 'Cancelled') continue;
      const d = new Date(ord.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap.has(key)) {
        const curr = dailyMap.get(key)!;
        curr.sales += ord.totalAmount;
        curr.orders += 1;
      }
    }

    const dailySales = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      sales: Math.round(data.sales),
      orders: data.orders,
    }));

    // Weekly Sales
    const weeklySales = [
      { week: 'Week 1', sales: Math.round(totalSales * 0.18), orders: Math.max(1, Math.round(orders.length * 0.2)) },
      { week: 'Week 2', sales: Math.round(totalSales * 0.24), orders: Math.max(1, Math.round(orders.length * 0.25)) },
      { week: 'Week 3', sales: Math.round(totalSales * 0.28), orders: Math.max(1, Math.round(orders.length * 0.27)) },
      { week: 'Week 4 (Current)', sales: Math.round(totalSales * 0.30), orders: Math.max(1, Math.round(orders.length * 0.28)) },
    ];

    // Monthly Sales
    const monthlySales = [
      { month: 'Jul 2026', sales: Math.round(totalSales * 0.15), orders: Math.round(orders.length * 0.15) },
      { month: 'Aug 2026', sales: Math.round(totalSales * 0.35), orders: Math.round(orders.length * 0.35) },
      { month: 'Sep 2026', sales: Math.round(totalSales * 0.50), orders: Math.round(orders.length * 0.50) },
    ];

    // Highlights
    const mostOrderedProduct = topSellingProducts.length > 0
      ? { name: topSellingProducts[0].name, count: topSellingProducts[0].salesCount, revenue: topSellingProducts[0].totalRevenue, storeName: topSellingProducts[0].businessName }
      : null;

    const bestPerformingStore = topSellingOwners.length > 0
      ? { name: topSellingOwners[0].storeName, revenue: topSellingOwners[0].totalRevenue, orders: topSellingOwners[0].orderCount, ownerName: topSellingOwners[0].ownerName }
      : null;

    // Customer spend tracking
    const custMap = new Map<string, { name: string; phone: string; orderCount: number; totalSpent: number }>();
    for (const ord of orders) {
      if (ord.orderStatus === 'Cancelled') continue;
      const key = ord.customerPhone;
      const existing = custMap.get(key) || { name: ord.customerName, phone: ord.customerPhone, orderCount: 0, totalSpent: 0 };
      existing.orderCount += 1;
      existing.totalSpent += ord.totalAmount;
      custMap.set(key, existing);
    }

    const topCustomer = Array.from(custMap.values()).sort((a, b) => b.totalSpent - a.totalSpent)[0] || null;

    return {
      totalSales,
      totalOrders: orders.length,
      totalProductsSold,
      totalOwners: users.length,
      activeOwners,
      pendingOwners,
      totalCustomers,
      totalProducts: products.length,
      publishedProducts,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      topSellingProducts,
      topSellingOwners,
      dailySales,
      weeklySales,
      monthlySales,
      mostOrderedProduct,
      bestPerformingStore,
      mostActiveCustomer: topCustomer,
    };
  },

  getOwnerAnalytics(businessId: string, ownerId: string) {
    const orders = this.getOrdersByOwner(ownerId, businessId);
    const nonCancelled = orders.filter((o) => o.orderStatus !== 'Cancelled');
    const totalRevenue = nonCancelled.reduce((acc, o) => acc + o.totalAmount, 0);
    const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending').length;
    const processingOrders = orders.filter((o) => o.orderStatus === 'Processing' || o.orderStatus === 'Confirmed' || o.orderStatus === 'Ready' || o.orderStatus === 'Out for Delivery').length;
    const deliveredOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === 'Cancelled').length;

    // Today's orders
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = nonCancelled.filter((o) => o.createdAt.startsWith(todayStr));
    const todaySales = todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);

    return {
      totalOrders: orders.length,
      totalRevenue,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrdersCount: todayOrders.length,
      todaySales,
      recentOrders: orders.slice(0, 5),
    };
  },

  getAllOrders(): Order[] {
    return this.getOrders();
  },
};
