import React, { useState } from 'react';
import { ShieldAlert, Lock, Mail, ArrowLeft, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

interface AdminAuthGateProps {
  children: React.ReactNode;
  onNavigateHome: () => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({ children, onNavigateHome }) => {
  const { currentUser, isAdmin, loading, login, logout } = useAuth();
  const { settings } = useSettings();

  const [email, setEmail] = useState('bad01303228889@gmail.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#162B23] flex items-center justify-center p-4">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-4 border-[#8FA89B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-300">Verifying Administrator Credentials...</p>
        </div>
      </div>
    );
  }

  // Case 1: User is authenticated and matches Admin UID / Email / Claim
  if (currentUser && isAdmin) {
    return <>{children}</>;
  }

  // Case 2: User is authenticated, but is NOT the authorized administrator
  if (currentUser && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#162B23] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center space-y-6 shadow-2xl border border-[#2D5042]">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[#1A1E1C]">Access Denied</h1>
            <p className="text-xs sm:text-sm text-[#626C66] leading-relaxed">
              Your current account ({currentUser.email}) does not have administrative authorization to access the store management portal.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => logout()}
              className="w-full py-3 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Sign Out & Try Admin Credentials
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full py-3 bg-[#FAF8F5] hover:bg-stone-100 text-[#1A1E1C] rounded-xl text-xs font-bold border border-[#E5DFD7] transition-all cursor-pointer"
            >
              Return to Customer Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Not logged in. Show dedicated Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      console.warn('Admin sign-in failure:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrorMsg('Incorrect password. Click "Send Password Reset Email" below to set a new password.');
      } else if (err.code === 'auth/user-not-found') {
        setErrorMsg('User not found in Firebase. Please check your Firebase Authentication console.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const { loginWithGoogle } = useAuth();
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your administrator email first.');
      return;
    }
    setResetting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { resetPassword } = useAuth();
      await resetPassword(email.trim());
      setSuccessMsg(`Password reset link sent to ${email.trim()}! Check your inbox.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send reset email. Ensure the user exists in Firebase Auth.');
    } finally {
      setResetting(false);
    }
  };

  const logoSrc = settings.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

  return (
    <div className="min-h-screen bg-[#162B23] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-[#2D5042] space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-block bg-[#FAF8F5] p-3 rounded-2xl border border-[#E5DFD7] mb-2">
            <img
              src={logoSrc}
              alt={settings.storeName}
              className="h-12 w-auto object-contain mx-auto"
            />
          </div>
          <h1 className="text-xl font-extrabold text-[#1A1E1C]">Admin Portal Login</h1>
          <p className="text-xs text-[#626C66]">
            Authorized Admin: <strong className="text-[#1E3A2F]">bad01303228889@gmail.com</strong>
          </p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              Administrator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#1A1E1C]">
                Password
              </label>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetting}
                className="text-[11px] text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                {resetting ? 'Sending email...' : 'Reset / Forgot Password?'}
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Badhon@2026"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'Verifying...' : 'Sign In as Admin'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-[#EFEBE5] text-center">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs text-[#626C66] hover:text-[#1E3A2F] font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Storefront</span>
          </button>
        </div>
      </div>
    </div>
  );
};
