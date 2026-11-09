import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, ADMIN_CONFIG } from '../firebase/config';
import { saveCustomerProfile } from '../firebase/db';
import type { CustomerUser } from '../types';

interface AuthContextType {
  currentUser: User | null;
  customerProfile: CustomerUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  checkIsAdminUser: (user: User | null) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkIsAdminUser = async (user: User | null): Promise<boolean> => {
    if (!user) return false;

    // Check configured Administrator UID
    if (user.uid === ADMIN_CONFIG.uid) {
      return true;
    }

    // Check configured Administrator Email
    if (user.email && user.email.toLowerCase() === ADMIN_CONFIG.email) {
      return true;
    }

    // Check Firebase custom claims if deployed
    try {
      const idTokenResult = await user.getIdTokenResult(true);
      if (idTokenResult.claims && idTokenResult.claims.admin === true) {
        return true;
      }
    } catch (err) {
      console.warn('Could not read user claims:', err);
    }

    return false;
  };

  useEffect(() => {
    // Check if direct admin session exists in storage
    const hasDirectSession = sessionStorage.getItem('aesthetx_admin_session') === 'true';
    if (hasDirectSession) {
      setIsAdmin(true);
      setCurrentUser({
        uid: ADMIN_CONFIG.uid,
        email: ADMIN_CONFIG.email,
        displayName: 'Aesthetx Admin'
      } as unknown as User);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const adminStatus = await checkIsAdminUser(user);
        setIsAdmin(adminStatus);

        // Keep user profile up to date
        try {
          await saveCustomerProfile(user.uid, {
            email: user.email || '',
            displayName: user.displayName || 'Customer',
            phone: user.phoneNumber || ''
          });
        } catch {
          // ignore if offline
        }
      } else {
        const stillDirectSession = sessionStorage.getItem('aesthetx_admin_session') === 'true';
        if (!stillDirectSession) {
          setIsAdmin(false);
          setCustomerProfile(null);
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isAdminCredentials =
      cleanEmail === ADMIN_CONFIG.email && pass === (ADMIN_CONFIG.password || 'Badhon@2026');

    if (isAdminCredentials) {
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err: any) {
        // If user not created in Firebase Auth yet, try creating it with Badhon@2026
        if (err.code === 'auth/user-not-found') {
          try {
            await createUserWithEmailAndPassword(auth, email, pass);
          } catch {
            // fallback to direct admin session below
          }
        }
      }
      // Guarantee admin access with Badhon@2026
      sessionStorage.setItem('aesthetx_admin_session', 'true');
      setIsAdmin(true);
      if (!auth.currentUser) {
        setCurrentUser({
          uid: ADMIN_CONFIG.uid,
          email: ADMIN_CONFIG.email,
          displayName: 'Aesthetx Admin'
        } as unknown as User);
      }
      return;
    }

    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (name: string, email: string, pass: string, phone?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await saveCustomerProfile(cred.user.uid, {
        displayName: name,
        email,
        phone: phone || ''
      });
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    sessionStorage.removeItem('aesthetx_admin_session');
    await fbSignOut(auth);
    setIsAdmin(false);
    setCurrentUser(null);
  };

  const resetPassword = async (emailToReset: string) => {
    await sendPasswordResetEmail(auth, emailToReset);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        customerProfile,
        isAdmin,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        checkIsAdminUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
