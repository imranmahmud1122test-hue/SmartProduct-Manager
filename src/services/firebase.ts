import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
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
  getDocFromServer
} from 'firebase/firestore';
import bundledConfig from '../../firebase-applet-config.json';

// Determine environment configuration
const isProd = import.meta.env.PROD || process.env.NODE_ENV === 'production';

// Prioritize VITE_FIREBASE_* environment variables (set in Render)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (!isProd ? bundledConfig.apiKey : ''),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (!isProd ? bundledConfig.authDomain : ''),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (!isProd ? bundledConfig.projectId : ''),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (!isProd ? bundledConfig.storageBucket : ''),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (!isProd ? bundledConfig.messagingSenderId : ''),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (!isProd ? bundledConfig.appId : ''),
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (!isProd ? bundledConfig.firestoreDatabaseId : ''),
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    console.log('[Firestore] Live cloud connection verified successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline. Using local persistence cache.');
      return false;
    }
    // Expected on fresh collection without pre-existing doc
    return true;
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
