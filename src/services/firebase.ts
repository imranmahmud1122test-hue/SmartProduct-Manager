import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import bundledConfig from '../../firebase-applet-config.json';
import { emitGlobalToast } from '../context/ToastContext';

// Prioritize VITE_FIREBASE_* environment variables (set in Render) with fallback to bundled config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || bundledConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || bundledConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || bundledConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || bundledConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || bundledConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || bundledConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || bundledConfig.firestoreDatabaseId,
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use forced long-polling to ensure reliable connectivity across network firewalls, proxies, and preview sandboxes without initial WebSocket attempts
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

export const firestoreDb = firestoreInstance;
export const db = firestoreDb; // Convenient alias

console.log(`[Firebase Initialized] Project: ${firebaseConfig.projectId} | Database: ${firebaseConfig.firestoreDatabaseId || '(default)'} | Source: ${import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'VITE_FIREBASE_* (Render/Env)' : 'Bundled Config'}`);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isUnavailable = errMsg.includes('unavailable') || errMsg.includes('offline') || errMsg.includes('Failed to get document');
  const isPermissionDenied = errMsg.includes('permission-denied') || 
                             errMsg.includes('Missing or insufficient permissions') || 
                             errMsg.includes('PERMISSION_DENIED') ||
                             errMsg.includes('security rule') ||
                             errMsg.includes('insufficient permissions');
  
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };

  if (isPermissionDenied) {
    console.error('[Firestore Security Restriction]:', JSON.stringify(errInfo));
    emitGlobalToast(
      'security',
      'Firestore Security Rule Restriction',
      `Access to '${path || 'collection'}' was denied by Firestore security rules (${operationType.toUpperCase()}). Please verify user role and tenant permissions.`
    );
  } else if (isUnavailable) {
    console.warn(`[Firestore Offline/Unavailable] Falling back to local storage cache for ${path || 'collection'}:`, errMsg);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
}

// Test connection on boot with a fast timeout to prevent blocking when offline
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testDocRef = doc(firestoreDb, 'test', 'connection');
    
    // Race getDocFromServer against a 2.5-second timeout to check backend reachability
    const networkPromise = getDocFromServer(testDocRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 2500)
    );

    await Promise.race([networkPromise, timeoutPromise]);
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn('[Firestore] Connection probe could not reach backend. Running in offline/cached mode:', errMsg);
    return false;
  }
}

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
};
