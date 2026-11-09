/**
 * FIREBASE CLIENT CONFIGURATION
 * -------------------------------------------------------------
 * You can paste your Firebase project credentials directly here
 * or set them via VITE_ environment variables.
 *
 * How to get your Firebase configuration:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select your Project -> Project Settings (gear icon)
 * 3. Under "Your apps" section, select Web App (</>)
 * 4. Copy the values and paste them below into manualFirebaseConfig.
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// 👉 PASTE YOUR FIREBASE CONFIGURATION HERE:
export const manualFirebaseConfig: FirebaseClientConfig = {
  apiKey: "AIzaSyAXgNUHQQgglDF3WN720-s9D7-YsYZhwO0",
  authDomain: "aesthetx-lifestyle.firebaseapp.com",
  projectId: "aesthetx-lifestyle",
  storageBucket: "aesthetx-lifestyle.firebasestorage.app",
  messagingSenderId: "858750870059",
  appId: "1:858750870059:web:26dad449a1d821ea39c06e"
};

// Automatic fallback to env vars if available, else uses manualFirebaseConfig
export const getActiveFirebaseConfig = (): FirebaseClientConfig => {
  return {
    apiKey: (import.meta.env?.VITE_FIREBASE_API_KEY as string) || manualFirebaseConfig.apiKey,
    authDomain: (import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string) || manualFirebaseConfig.authDomain,
    projectId: (import.meta.env?.VITE_FIREBASE_PROJECT_ID as string) || manualFirebaseConfig.projectId,
    storageBucket: (import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string) || manualFirebaseConfig.storageBucket,
    messagingSenderId: (import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || manualFirebaseConfig.messagingSenderId,
    appId: (import.meta.env?.VITE_FIREBASE_APP_ID as string) || manualFirebaseConfig.appId
  };
};

export default getActiveFirebaseConfig;
