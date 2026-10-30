import { getApps, initializeApp } from 'firebase/app';

// @ts-ignore
import { Auth, browserLocalPersistence, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
// @ts-ignore
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyPlaceholderForStaticBuildOnly',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'wealthhealth.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'wealthhealth',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'wealthhealth.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

// Initialize Firebase (safely reuse if already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with persistence
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// Initialize Firestore with persistent local cache for offline-first support
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  db = getFirestore(app);
}

export { auth, db };
