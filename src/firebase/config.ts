import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getActiveFirebaseConfig } from '../lib/firebaseConfig';

export const firebaseConfig = getActiveFirebaseConfig();

// Target Administrator Identity configured by user
export const ADMIN_CONFIG = {
  uid: import.meta.env.VITE_ADMIN_UID || "7dFGhk3ntrNxH4fA3bZerczN92B3",
  email: (import.meta.env.VITE_ADMIN_EMAIL || "bad01303228889@gmail.com").toLowerCase(),
  password: "Badhon@2026"
};

// Official Store branding defaults
export const OFFICIAL_STORE_INFO = {
  name: "AESTHETX LIFESTYLE",
  tagline: "BUYING CLOTHES IS CHEAPER THEN THERAPY",
  logoUrl: "/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg",
  phone: "01708943242",
  whatsapp: "01708943242",
  email: "badhonrefaz@gmail.com",
  facebook: "https://www.facebook.com/share/1MBQboEuDz/",
  currency: "৳",
  deliveryArea: "All Bangladesh",
  timezone: "Asia/Dhaka"
};

// Initialize Firebase once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
