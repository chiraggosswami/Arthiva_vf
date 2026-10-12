import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Inspect API key from environment variable or provisioned firebase-applet-config.json
const rawFileKey = (firebaseConfig.apiKey || '').trim();
const isPlaceholderKey =
  !rawFileKey ||
  rawFileKey.includes('PLACEHOLDER') ||
  rawFileKey.startsWith('your_') ||
  rawFileKey.length < 10;

const envKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const effectiveApiKey = envKey || (isPlaceholderKey ? '' : rawFileKey);

/**
 * True only when a non-placeholder, non-empty API key is present
 */
export const isFirebaseConfigured = Boolean(
  effectiveApiKey &&
  !effectiveApiKey.includes('PLACEHOLDER') &&
  !effectiveApiKey.startsWith('your_') &&
  effectiveApiKey.length >= 10
);

const resolvedConfig = {
  apiKey: effectiveApiKey || 'AIzaSyPreviewDemoMockKeyForLocalEvaluation0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
};

let appInstance: FirebaseApp;
if (getApps().length === 0) {
  try {
    appInstance = initializeApp(resolvedConfig);
  } catch (err) {
    console.warn('[Firebase] initializeApp fallback:', err);
    appInstance = initializeApp({
      ...resolvedConfig,
      apiKey: 'AIzaSyPreviewDemoMockKeyForLocalEvaluation0',
    });
  }
} else {
  appInstance = getApp();
}

export const app = appInstance;

/* Firestore instance bound to the app and configured database ID */
const effectiveDbId =
  resolvedConfig.firestoreDatabaseId &&
  resolvedConfig.firestoreDatabaseId !== '(default)' &&
  resolvedConfig.firestoreDatabaseId !== 'default'
    ? resolvedConfig.firestoreDatabaseId
    : undefined;

export const db: Firestore = effectiveDbId ? getFirestore(app, effectiveDbId) : getFirestore(app);

let authInstance: Auth;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn('[Firebase] getAuth fallback:', err);
  authInstance = {
    currentUser: null,
    onAuthStateChanged: (_cb: any) => () => {},
  } as unknown as Auth;
}

export const auth: Auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot only when live Firebase is properly configured
async function testConnection() {
  if (!isFirebaseConfigured) {
    // In local demo / placeholder mode, skip network probe to prevent api-key-not-valid errors
    return;
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error?.code?.includes('api-key') || error?.message?.includes('API key')) {
      console.warn('[Firebase] API key validation notice: running in local offline demo mode.');
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Please check your Firebase configuration.');
    }
  }
}

testConnection();

export default app;
