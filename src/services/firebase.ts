import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
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
export const firebaseAuth = auth;

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface GoogleAuthResult {
  firebaseUser: FirebaseUser;
  email: string;
  displayName: string;
  photoURL?: string;
  uid: string;
}

/**
 * Authenticates the user with real Google OAuth via Firebase Authentication.
 * Only genuine Google accounts can pass this authentication.
 */
export async function signInWithGooglePopup(): Promise<GoogleAuthResult> {
  try {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const user = credential.user;
    if (!user.email) {
      throw new Error('No verified email address was returned by Google.');
    }
    return {
      firebaseUser: user,
      email: (user.email || '').toLowerCase(),
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
      photoURL: user.photoURL || undefined,
      uid: user.uid,
    };
  } catch (err: any) {
    if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain') || err.message?.includes('unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      const customErr: any = new Error(`Domain not authorized in Firebase Console (${currentHost}). You can register and log in directly using your Gmail address below.`);
      customErr.code = 'auth/unauthorized-domain';
      throw customErr;
    }
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Google Sign-In was closed by the user.');
    }
    if (err.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in request is already in progress.');
    }
    if (err.code === 'auth/popup-blocked') {
      throw new Error('Google Sign-In popup was blocked by your browser. Please allow popups or open in a new window.');
    }
    if (err.code === 'auth/network-request-failed') {
      throw new Error('Network error during Google authentication. Please check your connection.');
    }
    throw new Error(err.message || 'Failed to authenticate with Google.');
  }
}

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
    console.warn('[Firestore Permission Notice]:', JSON.stringify(errInfo));
    // Only display user-facing security alert if an active Firebase Auth user was denied
    if (auth.currentUser) {
      emitGlobalToast(
        'security',
        'Firestore Security Rule Restriction',
        `Access to '${path || 'collection'}' was denied by Firestore security rules (${operationType.toUpperCase()}). Please verify user role and tenant permissions.`
      );
    }
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
    
    // Race getDocFromServer against a 3.5-second timeout to check backend reachability
    const networkPromise = getDocFromServer(testDocRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 3500)
    );

    await Promise.race([networkPromise, timeoutPromise]);
    return true;
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    // If the server responded with permission-denied or any Firebase code, it reached the server
    if (error?.code === 'permission-denied' || errMsg.includes('insufficient permissions')) {
      return true;
    }
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
