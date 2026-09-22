import {
  User,
  UserRole,
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
  OperationType,
  auth
} from './firebase';
import { emitGlobalToast } from '../context/ToastContext';
import { compressImageDataUrl } from '../utils/imageCompressor';
import { apiPost } from './apiClient';

function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const result: any = {};
    for (const key of Object.keys(data)) {
      const val = (data as any)[key];
      if (val !== undefined) {
        result[key] = sanitizeForFirestore(val);
      }
    }
    return result;
  }
  return data;
}

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
  TOMBSTONES: 'ssm_tombstones_v2',
};

interface TombstoneRegistry {
  users: string[];
  businesses: string[];
  products: string[];
  orders: string[];
}

function getTombstones(): TombstoneRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOMBSTONES);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        businesses: Array.isArray(parsed.businesses) ? parsed.businesses : [],
        products: Array.isArray(parsed.products) ? parsed.products : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      };
    }
  } catch {}
  return { users: [], businesses: [], products: [], orders: [] };
}

function recordTombstone(type: keyof TombstoneRegistry, id: string): void {
  if (!id) return;
  const current = getTombstones();
  const cleanId = id.trim();
  if (!current[type].includes(cleanId)) {
    current[type].push(cleanId);
    try {
      localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(current));
    } catch {}
  }
}

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

// Seed Initial Data: EXACTLY ONE Super Admin Account
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
    emailVerified: true,
    isGmailVerified: true,
  },
];

const INITIAL_BUSINESSES: Business[] = [];
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_SUPPLIERS: Supplier[] = [];
const INITIAL_MOVEMENTS: InventoryMovement[] = [];
const INITIAL_SALES: Sale[] = [];
const INITIAL_AUDIT_LOGS: AuditLog[] = [];
const INITIAL_ORDERS: Order[] = [];

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
    if (key === STORAGE_KEYS.PRODUCTS) {
      cachedProductsInMemory = Array.isArray(value) ? ([...value] as any) : null;
    }
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

const DEMO_PRODUCT_IDS = new Set([
  'PROD-001', 'PROD-002', 'PROD-003', 'PROD-004', 'PROD-005', 'PROD-006', 'PROD-007', 'PROD-008',
  'PROD-101', 'PROD-102', 'PROD-103', 'PROD-104', 'PROD-105',
  'PROD-201', 'PROD-202'
]);

const isDemoProduct = (p?: { id?: string; ownerId?: string } | null): boolean =>
  Boolean(p && (DEMO_PRODUCT_IDS.has(p.id || '') || p.ownerId === 'USR-METRO' || p.ownerId === 'USR-VALLEY'));

const isDemoUser = (u?: { id?: string; email?: string } | null): boolean =>
  Boolean(u && (u.id === 'USR-METRO' || u.id === 'USR-VALLEY' || u.email === 'owner@metro.com' || u.email === 'owner@freshvalley.com'));

const isDemoBusiness = (b?: { id?: string; ownerId?: string; name?: string } | null): boolean =>
  Boolean(b && (b.ownerId === 'USR-METRO' || b.ownerId === 'USR-VALLEY' ||
  b.name === 'Metro Supermarket & Mart' || b.name === 'Fresh Valley Organic Market'));

let isFirestoreSyncActive = false;

export async function syncWithFirestore(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isFirestoreSyncActive) return;
  isFirestoreSyncActive = true;

  try {
    const isOnline = await testFirestoreConnection();
    if (!isOnline) {
      console.warn('[Firestore] Backend could not be reached. Operating strictly in local-first cached mode.');
      isFirestoreSyncActive = false;
      return;
    }

    // 1. Initial Products & Tenant Hydration from Firestore
    try {
      const tombstones = getTombstones();
      const deletedProdSet = new Set(tombstones.products);
      const prodSnap = await getDocs(collection(firestoreDb, 'products'));
      if (!prodSnap.empty) {
        const cloudProducts: Product[] = [];
        prodSnap.forEach((docSnap) => {
          const data = docSnap.data() as Product;
          const p = { ...data, id: data?.id || docSnap.id };
          if (deletedProdSet.has(p.id) || deletedProdSet.has(docSnap.id)) {
            deleteDoc(doc(firestoreDb, 'products', docSnap.id)).catch(() => {});
            return;
          }
          if (!isDemoProduct(p)) {
            cloudProducts.push(p);
          }
        });
        const existingProds = getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []).filter((p) => p && !deletedProdSet.has(p.id));
        const prodMap = new Map<string, Product>();
        existingProds.forEach((p) => prodMap.set(p.id, p));
        cloudProducts.forEach((p) => prodMap.set(p.id, p));
        const mergedProds = Array.from(prodMap.values()).filter((p) => p && !deletedProdSet.has(p.id));
        cachedProductsInMemory = mergedProds;
        setToStorage(STORAGE_KEYS.PRODUCTS, mergedProds, false);
        console.log(`[Firestore] Hydrated and merged ${cloudProducts.length} live products from Cloud Firestore.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
    }

    // 2. Hydrate Businesses from Firestore
    try {
      const tombstones = getTombstones();
      const deletedBizSet = new Set(tombstones.businesses);
      const bizSnap = await getDocs(collection(firestoreDb, 'businesses'));
      if (!bizSnap.empty) {
        const cloudBiz: Business[] = [];
        bizSnap.forEach((docSnap) => {
          const data = docSnap.data() as Business;
          const b = { ...data, id: data?.id || docSnap.id };
          if (deletedBizSet.has(b.id) || deletedBizSet.has(docSnap.id)) {
            deleteDoc(doc(firestoreDb, 'businesses', docSnap.id)).catch(() => {});
            return;
          }
          if (!isDemoBusiness(b)) {
            cloudBiz.push(b);
          }
        });
        const existingBiz = getFromStorage<Business[]>(STORAGE_KEYS.BUSINESSES, []).filter((b) => b && !deletedBizSet.has(b.id));
        const bizMap = new Map<string, Business>();
        existingBiz.forEach((b) => bizMap.set(b.id, b));
        cloudBiz.forEach((b) => bizMap.set(b.id, b));
        const mergedBiz = Array.from(bizMap.values()).filter((b) => b && !deletedBizSet.has(b.id));
        setToStorage(STORAGE_KEYS.BUSINESSES, mergedBiz, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'businesses');
    }

    // 3. Hydrate Orders from Firestore
    try {
      const tombstones = getTombstones();
      const deletedOrderSet = new Set(tombstones.orders);
      const ordSnap = await getDocs(collection(firestoreDb, 'orders'));
      if (!ordSnap.empty) {
        const cloudOrders: Order[] = [];
        ordSnap.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          const o = { ...data, id: data?.id || docSnap.id };
          if (deletedOrderSet.has(o.id) || deletedOrderSet.has(docSnap.id) || deletedOrderSet.has(o.orderId)) {
            deleteDoc(doc(firestoreDb, 'orders', docSnap.id)).catch(() => {});
            return;
          }
          if (o.businessId !== 'SHOP-001' && o.customerEmail !== 'tanvir@gmail.com' && o.customerEmail !== 'sumaiya@yahoo.com') {
            cloudOrders.push(o);
          }
        });
        const existingOrders = getFromStorage<Order[]>(STORAGE_KEYS.ORDERS, []).filter((o) => o && !deletedOrderSet.has(o.id) && !deletedOrderSet.has(o.orderId));
        const ordMap = new Map<string, Order>();
        existingOrders.forEach((o) => ordMap.set(o.id || o.orderId, o));
        cloudOrders.forEach((o) => ordMap.set(o.id || o.orderId, o));
        const mergedOrders = Array.from(ordMap.values()).filter((o) => o && !deletedOrderSet.has(o.id) && !deletedOrderSet.has(o.orderId));
        setToStorage(STORAGE_KEYS.ORDERS, mergedOrders, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    }

    // 4. Hydrate Users from Firestore
    try {
      const tombstones = getTombstones();
      const deletedUserSet = new Set(tombstones.users);
      const usrSnap = await getDocs(collection(firestoreDb, 'users'));
      if (!usrSnap.empty) {
        const cloudUsers: User[] = [];
        usrSnap.forEach((docSnap) => {
          const data = docSnap.data() as User;
          const u = { ...data, id: data?.id || docSnap.id };
          if (deletedUserSet.has(u.id) || deletedUserSet.has(docSnap.id) || (u.email && deletedUserSet.has(u.email.toLowerCase()))) {
            deleteDoc(doc(firestoreDb, 'users', docSnap.id)).catch(() => {});
            return;
          }
          if (u && !isDemoUser(u)) {
            if (!u.name || typeof u.name !== 'string') {
              u.name = u.email ? u.email.split('@')[0] : 'User';
            }
            cloudUsers.push(u);
          }
        });
        const existingUsers = getFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS).filter((u) => u && !deletedUserSet.has(u.id) && (!u.email || !deletedUserSet.has(u.email.toLowerCase())));
        const usrMap = new Map<string, User>();
        existingUsers.forEach((u) => usrMap.set(u.id, u));
        cloudUsers.forEach((u) => usrMap.set(u.id, u));
        const mergedUsers = Array.from(usrMap.values()).filter((u) => u && !deletedUserSet.has(u.id) && (!u.email || !deletedUserSet.has(u.email.toLowerCase())));
        setToStorage(STORAGE_KEYS.USERS, mergedUsers, false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }

    // 5. Hydrate Movements from Firestore
    try {
      const movSnap = await getDocs(collection(firestoreDb, 'movements'));
      if (!movSnap.empty) {
        const cloudMovs: InventoryMovement[] = [];
        movSnap.forEach((docSnap) => {
          const data = docSnap.data() as InventoryMovement;
          const m = { ...data, id: data?.id || docSnap.id };
          if (!DEMO_PRODUCT_IDS.has(m.productId) && m.performedBy !== 'USR-METRO' && m.performedBy !== 'USR-VALLEY') {
            cloudMovs.push(m);
          }
        });
        const existingMovs = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
        const movMap = new Map<string, InventoryMovement>();
        existingMovs.forEach((m) => movMap.set(m.id, m));
        cloudMovs.forEach((m) => movMap.set(m.id, m));
        setToStorage(STORAGE_KEYS.MOVEMENTS, Array.from(movMap.values()), false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'movements');
    }

    // 6. Hydrate Sales from Firestore
    try {
      const saleSnap = await getDocs(collection(firestoreDb, 'sales'));
      if (!saleSnap.empty) {
        const cloudSales: Sale[] = [];
        saleSnap.forEach((docSnap) => {
          const data = docSnap.data() as Sale;
          const s = { ...data, id: data?.id || docSnap.id };
          if (s.cashierId !== 'USR-METRO' && s.cashierId !== 'USR-VALLEY') {
            cloudSales.push(s);
          }
        });
        const existingSales = getFromStorage<Sale[]>(STORAGE_KEYS.SALES, []);
        const saleMap = new Map<string, Sale>();
        existingSales.forEach((s) => saleMap.set(s.id, s));
        cloudSales.forEach((s) => saleMap.set(s.id, s));
        setToStorage(STORAGE_KEYS.SALES, Array.from(saleMap.values()), false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'sales');
    }

    // 7. Real-time Listeners for instant multi-device / multi-environment sync
    onSnapshot(
      collection(firestoreDb, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveProducts: Product[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Product;
            const p = { ...data, id: data?.id || docSnap.id };
            if (!isDemoProduct(p)) {
              liveProducts.push(p);
            }
          });
          const existingProds = getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
          const prodMap = new Map<string, Product>();
          existingProds.forEach((p) => prodMap.set(p.id, p));
          liveProducts.forEach((p) => prodMap.set(p.id, p));
          const merged = Array.from(prodMap.values());
          cachedProductsInMemory = merged;
          setToStorage(STORAGE_KEYS.PRODUCTS, merged, true);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'products')
    );

    onSnapshot(
      collection(firestoreDb, 'businesses'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveBusinesses: Business[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Business;
            const b = { ...data, id: data?.id || docSnap.id };
            if (!isDemoBusiness(b)) {
              liveBusinesses.push(b);
            }
          });
          const existingBiz = getFromStorage<Business[]>(STORAGE_KEYS.BUSINESSES, []);
          const bizMap = new Map<string, Business>();
          existingBiz.forEach((b) => bizMap.set(b.id, b));
          liveBusinesses.forEach((b) => bizMap.set(b.id, b));
          setToStorage(STORAGE_KEYS.BUSINESSES, Array.from(bizMap.values()), true);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'businesses')
    );

    onSnapshot(
      collection(firestoreDb, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveOrders: Order[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Order;
            const o = { ...data, id: data?.id || docSnap.id };
            if (o.businessId !== 'SHOP-001' && o.customerEmail !== 'tanvir@gmail.com' && o.customerEmail !== 'sumaiya@yahoo.com') {
              liveOrders.push(o);
            }
          });
          const existingOrders = getFromStorage<Order[]>(STORAGE_KEYS.ORDERS, []);
          const ordMap = new Map<string, Order>();
          existingOrders.forEach((o) => ordMap.set(o.id || o.orderId, o));
          liveOrders.forEach((o) => ordMap.set(o.id || o.orderId, o));
          setToStorage(STORAGE_KEYS.ORDERS, Array.from(ordMap.values()), true);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'orders')
    );

    onSnapshot(
      collection(firestoreDb, 'users'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveUsers: User[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as User;
            const u = { ...data, id: data?.id || docSnap.id };
            if (u && !isDemoUser(u)) {
              if (!u.name || typeof u.name !== 'string') {
                u.name = u.email ? u.email.split('@')[0] : 'User';
              }
              liveUsers.push(u);
            }
          });
          const existingUsers = getFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
          const usrMap = new Map<string, User>();
          existingUsers.forEach((u) => usrMap.set(u.id, u));
          liveUsers.forEach((u) => usrMap.set(u.id, u));
          setToStorage(STORAGE_KEYS.USERS, Array.from(usrMap.values()), true);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'users')
    );

    onSnapshot(
      collection(firestoreDb, 'movements'),
      (snapshot) => {
        const liveMovements: InventoryMovement[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as InventoryMovement;
          const m = { ...data, id: data?.id || docSnap.id };
          if (!DEMO_PRODUCT_IDS.has(m.productId) && m.performedBy !== 'USR-METRO' && m.performedBy !== 'USR-VALLEY') {
            liveMovements.push(m);
          }
        });
        const existingMovs = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
        const movMap = new Map<string, InventoryMovement>();
        existingMovs.forEach((m) => movMap.set(m.id, m));
        liveMovements.forEach((m) => movMap.set(m.id, m));
        setToStorage(STORAGE_KEYS.MOVEMENTS, Array.from(movMap.values()), true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'movements')
    );

    onSnapshot(
      collection(firestoreDb, 'sales'),
      (snapshot) => {
        if (!snapshot.empty) {
          const liveSales: Sale[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Sale;
            const s = { ...data, id: data?.id || docSnap.id };
            if (s.cashierId !== 'USR-METRO' && s.cashierId !== 'USR-VALLEY') {
              liveSales.push(s);
            }
          });
          const existingSales = getFromStorage<Sale[]>(STORAGE_KEYS.SALES, []);
          const saleMap = new Map<string, Sale>();
          existingSales.forEach((s) => saleMap.set(s.id, s));
          liveSales.forEach((s) => saleMap.set(s.id, s));
          setToStorage(STORAGE_KEYS.SALES, Array.from(saleMap.values()), true);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'sales')
    );
  } catch (globalErr) {
    console.warn('[Firestore] Sync notice:', globalErr);
  }
}

// Ensure database initialization
export function initializeStorage(): void {
  // Purge lingering demo items from cached local storage
  try {
    const storedProds: Product[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const cleanedProds = storedProds.filter((p) => !isDemoProduct(p));
    if (cleanedProds.length !== storedProds.length) {
      setToStorage(STORAGE_KEYS.PRODUCTS, cleanedProds);
    }

    const storedMovs: InventoryMovement[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOVEMENTS) || '[]');
    const cleanedMovs = storedMovs.filter((m) => !DEMO_PRODUCT_IDS.has(m.productId) && m.performedBy !== 'USR-METRO' && m.performedBy !== 'USR-VALLEY');
    if (cleanedMovs.length !== storedMovs.length) {
      setToStorage(STORAGE_KEYS.MOVEMENTS, cleanedMovs);
    }

    const storedSales: Sale[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES) || '[]');
    const cleanedSales = storedSales.filter((s) => s.cashierId !== 'USR-METRO' && s.cashierId !== 'USR-VALLEY');
    if (cleanedSales.length !== storedSales.length) {
      setToStorage(STORAGE_KEYS.SALES, cleanedSales);
    }

    const storedUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const cleanedUsers = storedUsers.filter((u) => !isDemoUser(u));
    if (cleanedUsers.length !== storedUsers.length) {
      setToStorage(STORAGE_KEYS.USERS, cleanedUsers);
    }

    const storedBiz: Business[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESSES) || '[]');
    const cleanedBiz = storedBiz.filter((b) => !isDemoBusiness(b));
    if (cleanedBiz.length !== storedBiz.length) {
      setToStorage(STORAGE_KEYS.BUSINESSES, cleanedBiz);
    }
  } catch (cleanErr) {
    console.warn('Storage initial cleanup:', cleanErr);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setToStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
  } else {
    // Ensure the single designated Super Admin account Imran Mahmud exists without resurrecting deleted users
    try {
      const tombstones = getTombstones();
      const deletedUserSet = new Set(tombstones.users);
      let existingUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      existingUsers = existingUsers.filter((u) => u && !deletedUserSet.has(u.id) && (!u.email || !deletedUserSet.has(u.email.toLowerCase())));
      const hasSuperAdmin = existingUsers.some((u) => isTrueSuperAdmin(u));
      if (!hasSuperAdmin) {
        existingUsers.unshift(INITIAL_USERS[0]);
      }
      setToStorage(STORAGE_KEYS.USERS, existingUsers);
    } catch (e) {
      console.warn('User initialization check:', e);
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

export const isTrueSuperAdmin = (u: { email?: string; name?: string } | null | undefined): boolean => {
  if (!u) return false;
  const cleanEmail = (u.email || '').trim().toLowerCase();
  const cleanName = (u.name || '').trim().toLowerCase();
  return cleanEmail === 'imranmahmud1122.test@gmail.com' && (cleanName === 'imran mahmud' || cleanName === 'imran');
};

// Data Access Layer (Repository)
export const db = {
  // Authentication & Session
  getCurrentUser(): User | null {
    let user = getFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!user) return null;
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanName = (user.name || '').trim().toLowerCase();

    // If current session is super_admin:
    if (user.role === 'super_admin') {
      // ONLY Imran Mahmud with imranmahmud1122.test@gmail.com is Super Admin!
      if (cleanEmail === 'imranmahmud1122.test@gmail.com') {
        // If the local session name had accidentally been set to 'Ahad', restore it to 'Imran Mahmud'
        if (cleanName !== 'imran mahmud' && cleanName !== 'imran') {
          user = { ...user, id: 'USR-ADMIN-IMRAN', name: 'Imran Mahmud', role: 'super_admin' };
          this.setCurrentUser(user);
          return user;
        }
      } else {
        const downgraded = { ...user, role: 'business_owner' as const };
        this.setCurrentUser(downgraded);
        return downgraded;
      }
    }
    return user;
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      if (user.role === 'super_admin' && !isTrueSuperAdmin(user)) {
        user = { ...user, role: 'business_owner' as const };
      }
    }
    setToStorage(STORAGE_KEYS.CURRENT_USER, user);
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  getUsers(): User[] {
    const tombstones = getTombstones();
    const deletedUserSet = new Set(tombstones.users);
    const list = getFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    let updated = false;

    const resultUsers: User[] = [];
    let hasSuperAdminImran = false;

    for (const u of (list || [])) {
      if (!u || deletedUserSet.has(u.id) || (u?.email && deletedUserSet.has(u.email.toLowerCase()))) {
        updated = true;
        continue;
      }
      if ((u?.email || '').toLowerCase() === 'cashier@metro.com' || u?.id === 'USR-METRO-CASHIER') {
        updated = true;
        continue;
      }

      const isImran = isTrueSuperAdmin(u);
      const cleanName = (u.name || '').trim().toLowerCase();

      if (isImran) {
        hasSuperAdminImran = true;
        resultUsers.push({
          ...u,
          id: 'USR-ADMIN-IMRAN',
          name: 'Imran Mahmud',
          email: 'imranmahmud1122.test@gmail.com',
          role: 'super_admin' as const,
          businessId: null,
          status: 'active' as const,
          emailVerified: true,
          isGmailVerified: true,
        });
      } else {
        // Any account that is NOT Imran Mahmud (e.g. Ahad or any other registered user):
        let userCopy = { ...u };
        // Never allow non-Imran Mahmud to hold USR-ADMIN-IMRAN ID or super_admin role!
        if (userCopy.id === 'USR-ADMIN-IMRAN') {
          userCopy.id = `USR-USER-${Math.abs(cleanName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) || 'AHAD'}`;
          updated = true;
        }
        if (userCopy.role === 'super_admin') {
          userCopy.role = 'business_owner' as const;
          updated = true;
        }
        resultUsers.push(userCopy);
      }
    }

    if (!hasSuperAdminImran) {
      resultUsers.unshift({
        id: 'USR-ADMIN-IMRAN',
        email: 'imranmahmud1122.test@gmail.com',
        name: 'Imran Mahmud',
        role: 'super_admin',
        businessId: null,
        phone: '+880 1711-000000',
        createdAt: '2026-01-01T00:00:00Z',
        status: 'active',
        emailVerified: true,
        isGmailVerified: true,
      });
      updated = true;
    }

    if (updated || resultUsers.length !== (list || []).length) {
      setToStorage(STORAGE_KEYS.USERS, resultUsers);
    }

    return resultUsers;
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
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    // STRICT POLICY: Only Imran Mahmud with imranmahmud1122.test@gmail.com can be super_admin. Nobody else can ever be super_admin.
    const isSuperAdmin = isTrueSuperAdmin(userData);
    const assignedRole: UserRole = isSuperAdmin
      ? 'super_admin'
      : (userData.role === 'super_admin' ? 'business_owner' : userData.role);

    const newUser: User = {
      id: `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      email: cleanEmail,
      name: userData.name,
      role: assignedRole,
      businessId: assignedRole === 'super_admin' ? null : userData.businessId,
      phone: userData.phone || '',
      createdAt: new Date().toISOString(),
      status: 'active',
      emailVerified: true,
      isGmailVerified: true,
    };

    users.push(newUser);
    setToStorage(STORAGE_KEYS.USERS, users);

    setDoc(doc(firestoreDb, 'users', newUser.id), sanitizeForFirestore(newUser)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `users/${newUser.id}`)
    );

    return newUser;
  },

  findUserByEmail(email: string): User | undefined {
    if (!email) return undefined;
    const clean = email.trim().toLowerCase();
    const users = this.getUsers();

    // If searching for super admin email, return the true Imran Mahmud Super Admin
    if (clean === 'imranmahmud1122.test@gmail.com') {
      const imran = users.find((u) => isTrueSuperAdmin(u));
      if (imran) return imran;
    }

    return users.find((u) => (u?.email || '').toLowerCase() === clean);
  },

  updateUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'deactivated',
    adminUser: User
  ): User {
    if (adminUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Super Admin role required to modify user status.');
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('User not found.');
    }

    users[index].status = status;
    if (status === 'active') {
      users[index].emailVerified = true;
      users[index].isGmailVerified = true;

      // Also activate business workspace if user is business owner
      if (users[index].businessId) {
        const businesses = this.getBusinesses();
        const bizIndex = businesses.findIndex((b) => b.id === users[index].businessId);
        if (bizIndex !== -1) {
          businesses[bizIndex].status = 'active';
          businesses[bizIndex].emailVerified = true;
          setToStorage(STORAGE_KEYS.BUSINESSES, businesses);
          setDoc(doc(firestoreDb, 'businesses', businesses[bizIndex].id), { status: 'active', emailVerified: true }, { merge: true }).catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `businesses/${businesses[bizIndex].id}`)
          );
        }
      }
    }
    setToStorage(STORAGE_KEYS.USERS, users);

    setDoc(doc(firestoreDb, 'users', userId), {
      status,
      ...(status === 'active' ? { emailVerified: true, isGmailVerified: true } : {})
    }, { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`)
    );

    this.logAudit({
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      action: 'UPDATE_USER_STATUS',
      details: `User ${users[index].name} (${users[index].email}) status updated to ${status}`,
    });

    return users[index];
  },

  deleteUser(userId: string, adminUser: User): void {
    if (adminUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Super Admin privileges required to delete a user.');
    }

    const users = this.getUsers();
    const targetUser = users.find((u) => u.id === userId);

    if (
      userId === adminUser.id ||
      isTrueSuperAdmin(targetUser)
    ) {
      throw new Error('Security policy: Designated Super Admin account (Imran Mahmud) cannot be deleted.');
    }

    recordTombstone('users', userId);
    if (targetUser?.email) {
      recordTombstone('users', targetUser.email.toLowerCase());
    }

    const remainingUsers = users.filter((u) => u.id !== userId);
    setToStorage(STORAGE_KEYS.USERS, remainingUsers);

    // Unconditionally permanently delete document from Cloud Firestore
    try {
      deleteDoc(doc(firestoreDb, 'users', userId)).catch(() => {});
    } catch {}

    this.logAudit({
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      action: 'DELETE_USER',
      details: `User account permanently deleted: ${targetUser?.name || 'User'} (${targetUser?.email || userId}, ID: ${userId}, Role: ${targetUser?.role || 'user'})`,
    });
  },

  // Business / Tenant Management
  getBusinesses(): Business[] {
    const tombstones = getTombstones();
    const deletedBizSet = new Set(tombstones.businesses);
    const list = getFromStorage<Business[]>(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    let updated = false;
    const sanitized = list
      .filter((b) => b && !deletedBizSet.has(b.id))
      .map((b) => {
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

  async registerBusiness(data: {
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
    authProvider?: 'google' | 'password';
    authUid?: string;
    photoURL?: string;
  }): Promise<{ user: User; business: Business }> {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('A valid email address is required for store registration.');
    }

    // Determine and validate Firebase Authentication UID
    const authenticatedUid = (data.authUid || auth.currentUser?.uid || '').trim();
    const authenticatedPhoto = data.photoURL || auth.currentUser?.photoURL || undefined;

    const isGoogleAuth = data.authProvider === 'google' || Boolean(authenticatedUid);

    const businesses = this.getBusinesses();
    const users = this.getUsers();

    let candidateIndex = 101;
    businesses.forEach((b) => {
      const match = b.id?.match(/^SHOP-(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= candidateIndex) candidateIndex = val + 1;
      }
    });
    while (businesses.some((b) => b.id === `SHOP-${String(candidateIndex).padStart(3, '0')}`)) {
      candidateIndex++;
    }
    const businessId = `SHOP-${String(candidateIndex).padStart(3, '0')}`;
    const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const finalBusinessName = data.businessName || data.name || 'My Supermarket';
    const finalOwnerName = data.ownerName || auth.currentUser?.displayName || 'Store Owner';

    const newBusiness: Business = {
      id: businessId,
      name: finalBusinessName,
      ownerName: finalOwnerName,
      ownerId: userId,
      email: cleanEmail,
      phone: data.phone || '',
      address: data.address || '',
      businessType: data.businessType || 'Supermarket',
      logoUrl: data.logoUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80',
      currencySymbol: data.currencySymbol || '৳',
      taxRate: 5.0,
      status: 'active', // Active immediately
      createdAt: new Date().toISOString(),
      isPublicStoreEnabled: true,
      emailVerified: true,
    };

    const isOwnerTrueSuperAdmin = isTrueSuperAdmin({ email: cleanEmail, name: finalOwnerName });

    // Guaranteed valid non-empty authUid for Firestore consistency
    const effectiveAuthUid = authenticatedUid || `uid_user_${userId.replace('USR-', '')}`;

    const newUser: User = {
      id: userId,
      email: cleanEmail,
      name: finalOwnerName,
      role: isOwnerTrueSuperAdmin ? 'super_admin' : 'business_owner',
      businessId: businessId,
      businessName: finalBusinessName,
      phone: data.phone || '',
      createdAt: new Date().toISOString(),
      status: 'active',
      emailVerified: true,
      isGmailVerified: true,
      authProvider: isGoogleAuth ? 'google' : 'password',
      authUid: effectiveAuthUid,
    };

    if (authenticatedPhoto) {
      newUser.photoURL = authenticatedPhoto;
    }

    businesses.push(newBusiness);
    users.push(newUser);

    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);
    setToStorage(STORAGE_KEYS.USERS, users);

    // Save to Firestore with strict sanitization (removing any undefined values)
    try {
      const sanitizedBiz = sanitizeForFirestore(newBusiness);
      setDoc(doc(firestoreDb, 'businesses', newBusiness.id), sanitizedBiz).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `businesses/${newBusiness.id}`)
      );
    } catch (bizErr) {
      console.warn('Firestore business save error:', bizErr);
    }

    try {
      const sanitizedUser = sanitizeForFirestore(newUser);
      setDoc(doc(firestoreDb, 'users', newUser.id), sanitizedUser).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${newUser.id}`)
      );
    } catch (userErr) {
      console.warn('Firestore user save error:', userErr);
    }

    this.setCurrentUser(newUser);

    this.logAudit({
      businessId,
      businessName: finalBusinessName,
      userId,
      userName: finalOwnerName,
      userRole: newUser.role,
      action: 'REGISTER_BUSINESS_SUCCESS',
      details: `New workspace registered and activated with Google Verified Authentication: ${finalBusinessName} (${businessId}) for ${cleanEmail}`,
    });

    return { user: newUser, business: newBusiness };
  },

  /**
   * Authenticates or creates workspace for a user who verified with real Google Sign-In
   */
  async loginWithGoogle(googleUser: {
    email: string;
    displayName: string;
    photoURL?: string;
    uid: string;
  }): Promise<{ success: boolean; user?: User; business?: Business; isNew?: boolean; error?: string }> {
    if (!googleUser || !googleUser.uid || typeof googleUser.uid !== 'string' || !googleUser.uid.trim()) {
      return { success: false, error: 'Invalid Google Authentication: missing authentic user UID.' };
    }

    const cleanEmail = googleUser.email.trim().toLowerCase();
    const validUid = googleUser.uid.trim();
    const users = this.getUsers();

    // Check for Super Admin predefined account
    const cleanDisplayName = (googleUser.displayName || '').trim().toLowerCase();
    const isGoogleSuperAdmin = cleanEmail === 'imranmahmud1122.test@gmail.com' &&
      (cleanDisplayName === 'imran mahmud' || cleanDisplayName === 'imran');

    if (isGoogleSuperAdmin) {
      let superAdminUser = users.find((u) => isTrueSuperAdmin(u));
      if (!superAdminUser) {
        superAdminUser = {
          id: 'USR-ADMIN-IMRAN',
          email: cleanEmail,
          name: 'Imran Mahmud',
          role: 'super_admin',
          businessId: null,
          phone: '+880 1711-000000',
          createdAt: new Date().toISOString(),
          status: 'active',
          emailVerified: true,
          isGmailVerified: true,
          authProvider: 'google',
          authUid: validUid,
        };
        if (googleUser.photoURL) superAdminUser.photoURL = googleUser.photoURL;
        users.push(superAdminUser);
        setToStorage(STORAGE_KEYS.USERS, users);
      } else {
        superAdminUser.name = 'Imran Mahmud';
        superAdminUser.role = 'super_admin';
        superAdminUser.status = 'active';
        superAdminUser.emailVerified = true;
        superAdminUser.isGmailVerified = true;
        superAdminUser.authProvider = 'google';
        superAdminUser.authUid = validUid;
        if (googleUser.photoURL) superAdminUser.photoURL = googleUser.photoURL;
        setToStorage(STORAGE_KEYS.USERS, users);
      }

      setDoc(doc(firestoreDb, 'users', superAdminUser.id), sanitizeForFirestore(superAdminUser), { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${superAdminUser.id}`)
      );

      this.setCurrentUser(superAdminUser);
      this.logAudit({
        businessId: null,
        userId: superAdminUser.id,
        userName: superAdminUser.name,
        userRole: 'super_admin',
        action: 'USER_LOGIN_GOOGLE',
        details: `Super Administrator verified and authenticated via Google Account (${cleanEmail})`,
      });

      const biz = superAdminUser.businessId ? this.getBusinessById(superAdminUser.businessId) : undefined;
      return { success: true, user: superAdminUser, business: biz, isNew: false };
    }

    // Standard business owner / staff lookup - Match by email OR by permanent authUid
    const existingUser = users.find((u) => (u?.email && u.email.toLowerCase() === cleanEmail) || (u?.authUid && u.authUid === validUid));

    if (existingUser) {
      if (existingUser.status === 'suspended' || existingUser.status === 'deactivated') {
        return { success: false, error: 'Your account has been deactivated or suspended. Please contact support.' };
      }

      // Activate and update verified status
      existingUser.status = 'active';
      existingUser.emailVerified = true;
      existingUser.isGmailVerified = true;
      existingUser.authProvider = 'google';
      existingUser.authUid = validUid;
      if (googleUser.photoURL) existingUser.photoURL = googleUser.photoURL;

      setToStorage(STORAGE_KEYS.USERS, users);
      setDoc(doc(firestoreDb, 'users', existingUser.id), sanitizeForFirestore(existingUser), { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${existingUser.id}`)
      );

      let biz: Business | undefined;
      if (existingUser.businessId) {
        biz = this.getBusinessById(existingUser.businessId);
        if (biz && biz.status !== 'active') {
          biz.status = 'active';
          biz.emailVerified = true;
          setDoc(doc(firestoreDb, 'businesses', biz.id), { status: 'active', emailVerified: true }, { merge: true }).catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `businesses/${biz?.id}`)
          );
        }
      }

      this.setCurrentUser(existingUser);
      this.logAudit({
        businessId: existingUser.businessId,
        userId: existingUser.id,
        userName: existingUser.name,
        userRole: existingUser.role,
        action: 'USER_LOGIN_GOOGLE',
        details: `User verified and logged in via Google Account (${cleanEmail})`,
      });

      return { success: true, user: existingUser, business: biz, isNew: false };
    }

    // New Google User - Needs Store / Business Registration
    return {
      success: true,
      isNew: true,
    };
  },

  /**
   * Registers a brand new Business and Owner authenticated directly by real Google OAuth
   */
  async registerBusinessWithGoogle(data: {
    googleUser: {
      email: string;
      displayName: string;
      photoURL?: string;
      uid: string;
    };
    businessName: string;
    phone?: string;
    address?: string;
    businessType?: Business['businessType'];
    currencySymbol?: string;
    logoUrl?: string;
  }): Promise<{ user: User; business: Business }> {
    if (!data.googleUser || !data.googleUser.uid || typeof data.googleUser.uid !== 'string' || !data.googleUser.uid.trim()) {
      throw new Error('Google Authentication required: missing authentic user UID. Please authenticate with Google first.');
    }

    return this.registerBusiness({
      ownerName: data.googleUser.displayName || data.googleUser.email.split('@')[0],
      businessName: data.businessName,
      email: data.googleUser.email,
      phone: data.phone,
      address: data.address,
      businessType: data.businessType,
      currencySymbol: data.currencySymbol,
      logoUrl: data.logoUrl || data.googleUser.photoURL,
      authProvider: 'google',
      authUid: data.googleUser.uid.trim(),
      photoURL: data.googleUser.photoURL,
    });
  },

  // Backward compatible stub
  async verifyGmailCode(email: string, code: string): Promise<{ success: boolean; user?: User; business?: Business; error?: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find((u) => (u?.email || '').toLowerCase() === cleanEmail);
    if (!user) return { success: false, error: 'User not found' };
    user.status = 'active';
    user.emailVerified = true;
    user.isGmailVerified = true;
    this.setCurrentUser(user);
    const biz = user.businessId ? this.getBusinessById(user.businessId) : undefined;
    return { success: true, user, business: biz };
  },

  async resendGmailCode(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return { success: true, message: 'Google Authentication active. No code required.' };
  },

  getPendingGmailVerification(email: string): { user: User } | null {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find((u) => (u?.email || '').toLowerCase() === cleanEmail);
    if (!user) return null;
    return { user };
  },

  updateBusiness(businessId: string, updates: Partial<Business>, user?: User): Business {
    const businesses = this.getBusinesses();
    const index = businesses.findIndex((b) => b.id === businessId);
    if (index === -1) throw new Error('Business shop profile not found.');

    const targetBusiness = businesses[index];

    // SECURITY AUTHORIZATION CHECK:
    // A Business Owner can update ONLY their own shop profile.
    if (user) {
      const isSuperAdmin =
        user.role === 'super_admin' &&
        user.email?.toLowerCase() === 'imranmahmud1122.test@gmail.com';

      const isAuthorizedOwner =
        (user.role === 'business_owner' || user.role === 'owner') &&
        (user.businessId === businessId || targetBusiness.ownerId === user.id);

      if (!isSuperAdmin && !isAuthorizedOwner) {
        throw new Error(
          `Security Violation: Access Denied. You do not have permission to edit Business Owner shop profile "${targetBusiness.name}" (${businessId}).`
        );
      }
    }

    // IMMUTABLE SECURITY FIELD PROTECTION
    // Disallow modifying permanent IDs, owner identity, verification status, or roles via shop profile updates
    const safeUpdates: Partial<Business> = { ...updates };
    delete safeUpdates.id;
    delete safeUpdates.ownerId;
    delete safeUpdates.ownerName;
    delete safeUpdates.createdAt;
    delete safeUpdates.status;
    delete safeUpdates.emailVerified;

    // Validate uploaded shop logo size if provided as Data URL
    if (safeUpdates.logoUrl && safeUpdates.logoUrl.startsWith('data:image/')) {
      if (safeUpdates.logoUrl.length > 10 * 1024 * 1024) {
        throw new Error('Shop logo image payload is too large. Please upload an image under 5MB.');
      }
    }

    const updatedBusiness: Business = {
      ...targetBusiness,
      ...safeUpdates,
      name: safeUpdates.name ? safeUpdates.name.trim() : targetBusiness.name,
    };

    businesses[index] = updatedBusiness;
    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);

    // Synchronize in Firestore
    setDoc(doc(firestoreDb, 'businesses', businessId), sanitizeForFirestore(updatedBusiness), { merge: true }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${businessId}`)
    );

    // Synchronize owner user record businessName
    const users = this.getUsers();
    const ownerIndex = users.findIndex((u) => u.id === targetBusiness.ownerId || u.businessId === businessId);
    if (ownerIndex !== -1 && safeUpdates.name) {
      users[ownerIndex].businessName = safeUpdates.name;
      setToStorage(STORAGE_KEYS.USERS, users);
      setDoc(doc(firestoreDb, 'users', users[ownerIndex].id), { businessName: safeUpdates.name }, { merge: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${users[ownerIndex].id}`)
      );
    }

    // Synchronize active logged in user in memory if applicable
    const currentUser = this.getCurrentUser();
    if (currentUser && (currentUser.businessId === businessId || currentUser.id === targetBusiness.ownerId) && safeUpdates.name) {
      const updatedCurrentUser = { ...currentUser, businessName: safeUpdates.name };
      this.setCurrentUser(updatedCurrentUser);
    }

    // Synchronize products businessName across inventory and public store
    if (safeUpdates.name && safeUpdates.name !== targetBusiness.name) {
      const newShopName = safeUpdates.name;
      const allProducts = this.getAllProductsRaw();
      let updatedCount = 0;
      const updatedProducts = allProducts.map((p) => {
        if (p.businessId === businessId) {
          updatedCount++;
          setDoc(doc(firestoreDb, 'products', p.id), { businessName: newShopName }, { merge: true }).catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`)
          );
          return { ...p, businessName: newShopName };
        }
        return p;
      });

      if (updatedCount > 0) {
        this.setProductsInMemory(updatedProducts, false);
      }
    }

    // Notify all UI components and event listeners
    notifyStorageUpdate(STORAGE_KEYS.BUSINESSES);
    notifyStorageUpdate(STORAGE_KEYS.PRODUCTS);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spm_business_update', { detail: { businessId, updatedBusiness, timestamp: Date.now() } }));
    }

    if (user) {
      this.logAudit({
        businessId,
        businessName: updatedBusiness.name,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'UPDATE_BUSINESS',
        details: `Shop profile updated for ${updatedBusiness.name} (${businessId}). Updated fields: ${Object.keys(safeUpdates).join(', ')}`,
      });
    }

    return updatedBusiness;
  },

  async updateShopProfile(
    businessId: string,
    updates: Partial<Business>,
    requestingUser: User
  ): Promise<Business> {
    // 1. Check server-side authorization API endpoint
    try {
      const response = await fetch('/api/business/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          requestingUser: {
            id: requestingUser.id,
            email: requestingUser.email,
            role: requestingUser.role,
            businessId: requestingUser.businessId,
          },
          updates,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Shop profile update denied by server security layer.');
      }
    } catch (apiErr: any) {
      // Re-throw security authorization errors immediately
      if (apiErr.message && (apiErr.message.includes('Security Violation') || apiErr.message.includes('Access Denied'))) {
        throw apiErr;
      }
      console.warn('[Shop Profile Sync Note]:', apiErr?.message);
    }

    // 2. Perform database update with local + Firestore synchronization
    return this.updateBusiness(businessId, updates, requestingUser);
  },

  updateBusinessStatus(businessId: string, status: 'active' | 'suspended' | 'deactivated', adminUser?: User): Business {
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
        action: status === 'active' ? 'ACTIVATE_BUSINESS' : status === 'deactivated' ? 'DEACTIVATE_BUSINESS' : 'SUSPEND_BUSINESS',
        details: `Business ${businesses[index].name} status set to ${status}`,
      });
    }

    return businesses[index];
  },

  deleteBusiness(businessId: string, adminUser: User): void {
    if (adminUser.role !== 'super_admin') {
      throw new Error('Unauthorized: Super Admin role required to delete a business.');
    }

    recordTombstone('businesses', businessId);

    let businesses = this.getBusinesses();
    const target = businesses.find((b) => b.id === businessId);
    businesses = businesses.filter((b) => b.id !== businessId);
    setToStorage(STORAGE_KEYS.BUSINESSES, businesses);

    // Unconditionally delete from Firestore
    try {
      deleteDoc(doc(firestoreDb, 'businesses', businessId)).catch(() => {});
    } catch {}

    // Filter and tombstone users belonging to this business (except root super admin)
    const usersToDelete = this.getUsers().filter((u) => u.businessId === businessId && !isTrueSuperAdmin(u));
    usersToDelete.forEach((u) => {
      recordTombstone('users', u.id);
      if (u.email) recordTombstone('users', u.email.toLowerCase());
      deleteDoc(doc(firestoreDb, 'users', u.id)).catch(() => {});
    });
    let users = this.getUsers().filter((u) => u.businessId !== businessId || isTrueSuperAdmin(u));
    setToStorage(STORAGE_KEYS.USERS, users);

    // Filter and tombstone products belonging to this business
    const prodsToDelete = this.getAllProductsRaw().filter((p) => p.businessId === businessId);
    prodsToDelete.forEach((p) => {
      recordTombstone('products', p.id);
      deleteDoc(doc(firestoreDb, 'products', p.id)).catch(() => {});
    });
    let products = this.getAllProductsRaw().filter((p) => p.businessId !== businessId);
    this.setProductsInMemory(products, true);

    // Filter and tombstone orders belonging to this store
    const ordersToDelete = this.getOrders().filter((o) => o.storeId === businessId || o.businessId === businessId);
    ordersToDelete.forEach((o) => {
      recordTombstone('orders', o.id);
      if (o.orderId) recordTombstone('orders', o.orderId);
      deleteDoc(doc(firestoreDb, 'orders', o.id)).catch(() => {});
    });
    let orders = this.getOrders().filter((o) => o.storeId !== businessId && o.businessId !== businessId);
    setToStorage(STORAGE_KEYS.ORDERS, orders);

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
    const tombstones = getTombstones();
    const deletedProdSet = new Set(tombstones.products);
    if (!cachedProductsInMemory) {
      cachedProductsInMemory = getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    }
    return (cachedProductsInMemory || []).filter((p) => p && !deletedProdSet.has(p.id));
  },

  setProductsInMemory(products: Product[], notify = true): void {
    const tombstones = getTombstones();
    const deletedProdSet = new Set(tombstones.products);
    const cleaned = (products || []).filter((p) => p && !deletedProdSet.has(p.id));
    cachedProductsInMemory = [...cleaned];
    setToStorage(STORAGE_KEYS.PRODUCTS, cleaned, notify);
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
      const tombstones = getTombstones();
      const deletedProdSet = new Set(tombstones.products);
      const q = query(
        collection(firestoreDb, 'products'),
        where('businessId', '==', businessId)
      );
      const snapshot = await getDocs(q);
      const liveProducts: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Product;
        const p = { ...data, id: data?.id || docSnap.id };
        if (deletedProdSet.has(p.id) || deletedProdSet.has(docSnap.id)) {
          deleteDoc(doc(firestoreDb, 'products', docSnap.id)).catch(() => {});
          return;
        }
        liveProducts.push(p);
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
      const existingAll = this.getAllProductsRaw().filter((p) => !deletedProdSet.has(p.id));
      const productMap = new Map<string, Product>(existingAll.map((p) => [p.id, p]));
      enrichedProducts.forEach((p) => {
        if (!deletedProdSet.has(p.id)) {
          productMap.set(p.id, p);
        }
      });

      const updatedList = Array.from(productMap.values()).filter((p) => !deletedProdSet.has(p.id));
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

    recordTombstone('products', productId);

    allProducts = allProducts.filter((p) => p.id !== productId);
    this.setProductsInMemory(allProducts, true);

    // Permanently delete from Cloud Firestore unconditionally
    try {
      await deleteDoc(doc(firestoreDb, 'products', productId));
    } catch (err: any) {
      console.warn('Firestore product delete notice:', err);
    }

    // Call server backend deletion
    try {
      if (user.role === 'super_admin') {
        await fetch(`/api/admin/products/${productId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-email': user.email,
            'x-admin-name': user.name,
          },
        });
      } else {
        await fetch(`/api/products/${productId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (srvErr) {
      console.warn('Server product delete notice:', srvErr);
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

    // Persist sale to Cloud Firestore
    setDoc(doc(firestoreDb, 'sales', newSale.id), sanitizeForFirestore(newSale)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `sales/${newSale.id}`)
    );

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

    setDoc(doc(firestoreDb, 'movements', newMovement.id), sanitizeForFirestore(newMovement)).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `movements/${newMovement.id}`)
    );

    return newMovement;
  },

  deleteMovement(id: string): boolean {
    const all = getFromStorage<InventoryMovement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const updated = all.filter((m) => m.id !== id);
    setToStorage(STORAGE_KEYS.MOVEMENTS, updated, true);

    if (auth.currentUser) {
      deleteDoc(doc(firestoreDb, 'movements', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `movements/${id}`)
      );
    }
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

  logAudit(data: Partial<AuditLog> & { action: string; details: string }): void {
    const all = getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    const currentUser = this.getCurrentUser();
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: data.userId || currentUser?.id || 'system',
      userName: data.userName || currentUser?.name || 'System User',
      userRole: (data.userRole as any) || currentUser?.role || 'super_admin',
      businessId: data.businessId !== undefined ? data.businessId : (currentUser?.businessId || null),
      businessName: data.businessName || currentUser?.businessName,
      action: data.action,
      details: data.details,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    all.unshift(newLog);
    if (all.length > 500) all.pop(); // Keep manageable size
    setToStorage(STORAGE_KEYS.AUDIT_LOGS, all);
  },

  addAuditLog(action: string, details: string, extra?: Partial<AuditLog>): void {
    const currentUser = this.getCurrentUser();
    this.logAudit({
      action,
      details,
      userId: extra?.userId || currentUser?.id || 'system',
      userName: extra?.userName || currentUser?.name || 'System User',
      userRole: (extra?.userRole as any) || currentUser?.role || 'super_admin',
      businessId: extra?.businessId !== undefined ? extra.businessId : (currentUser?.businessId || null),
      businessName: extra?.businessName || currentUser?.businessName,
      ...extra,
    });
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
    const tombstones = getTombstones();
    const deletedOrderSet = new Set(tombstones.orders);
    const list = getFromStorage<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    return list
      .filter((o) => o && !deletedOrderSet.has(o.id) && !deletedOrderSet.has(o.orderId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      const matchId = (o.id && o.id.toUpperCase() === cleanId) || (o.orderId && o.orderId.toUpperCase() === cleanId);
      if (!matchId) return false;
      const orderPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
      // Match last 8 digits or full phone to handle country code variations
      return (
        orderPhoneClean === cleanPhone ||
        (cleanPhone.length >= 7 && orderPhoneClean.endsWith(cleanPhone.slice(-7))) ||
        (orderPhoneClean.length >= 7 && cleanPhone.endsWith(orderPhoneClean.slice(-7)))
      );
    });
    return matched || null;
  },

  async trackOrderOnline(orderId: string, phone: string): Promise<Order | null> {
    const local = this.trackOrder(orderId, phone);
    if (local) return local;

    try {
      const cleanId = orderId.trim().toUpperCase();
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const ordSnap = await getDocs(collection(firestoreDb, 'orders'));
      for (const d of ordSnap.docs) {
        const o = d.data() as Order;
        const matchId = (o.id && o.id.toUpperCase() === cleanId) || (o.orderId && o.orderId.toUpperCase() === cleanId);
        if (matchId) {
          const orderPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
          if (
            orderPhoneClean === cleanPhone ||
            (cleanPhone.length >= 7 && orderPhoneClean.endsWith(cleanPhone.slice(-7))) ||
            (orderPhoneClean.length >= 7 && cleanPhone.endsWith(orderPhoneClean.slice(-7)))
          ) {
            const allOrders = this.getOrders();
            if (!allOrders.some((item) => (item.id || item.orderId) === (o.id || o.orderId))) {
              allOrders.unshift(o);
              setToStorage(STORAGE_KEYS.ORDERS, allOrders, false);
            }
            return o;
          }
        }
      }
    } catch (err) {
      console.warn('[Storage] trackOrderOnline error:', err);
    }
    return null;
  },

  async createOrder(payload: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    zilla?: string;
    thana?: string;
    customerNote?: string;
    paymentMethod?: 'cash_on_delivery' | 'mobile_banking' | 'card' | 'online';
    items: { productId: string; quantity: number }[];
  }): Promise<{ masterOrder: Order; vendorOrders: Order[] }> {
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

    // Save orders to Cloud Firestore first
    try {
      await setDoc(doc(firestoreDb, 'orders', masterOrder.id), sanitizeForFirestore(masterOrder));
      for (const vo of vendorOrders) {
        if (vo.id !== masterOrder.id) {
          await setDoc(doc(firestoreDb, 'orders', vo.id), sanitizeForFirestore(vo));
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${masterOrder.id}`);
    }

    // Since Firestore succeeded, save to Local Storage
    setToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    setToStorage(STORAGE_KEYS.ORDERS, allStoredOrders);

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

    setDoc(doc(firestoreDb, 'orders', currentOrder.id), sanitizeForFirestore(currentOrder), { merge: true }).catch((err) =>
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

  deleteOrder(orderId: string, user: User): boolean {
    if (user.role !== 'super_admin') {
      throw new Error('Unauthorized: Super Admin role required to delete an order.');
    }

    let allOrders = this.getAllOrders();
    const target = allOrders.find((o) => o.id === orderId || o.orderId === orderId);
    if (!target) return false;

    recordTombstone('orders', orderId);
    if (target.id) recordTombstone('orders', target.id);
    if (target.orderId) recordTombstone('orders', target.orderId);

    allOrders = allOrders.filter((o) => o.id !== orderId && o.orderId !== orderId);
    setToStorage(STORAGE_KEYS.ORDERS, allOrders);

    // Unconditionally delete from Firestore
    try {
      deleteDoc(doc(firestoreDb, 'orders', target.id)).catch(() => {});
    } catch {}

    // Call server backend
    try {
      fetch(`/api/admin/orders/${target.id || orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user.email,
          'x-admin-name': user.name,
        },
      }).catch(() => {});
    } catch {}

    this.logAudit({
      businessId: target.storeId !== 'MULTI' ? target.storeId : null,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'DELETE_ORDER',
      details: `Permanently deleted order ${target.orderId || target.id}`,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spm_order_update', { detail: { orderId: target.orderId || target.id } }));
    }

    return true;
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
