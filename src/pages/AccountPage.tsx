import React, { useState, useEffect } from 'react';
import {
  User,
  Package,
  LogOut,
  Mail,
  Lock,
  Phone,
  ShieldCheck,
  ChevronRight,
  Clock,
  AlertCircle,
  Truck,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCustomerOrders } from '../firebase/db';
import type { Order } from '../types';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { calculateEstimatedDelivery } from '../utils/deliveryEstimation';

interface AccountPageProps {
  onNavigate: (path: string) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { currentUser, login, register, logout, isAdmin } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Customer orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');

  useEffect(() => {
    if (currentUser) {
      setLoadingOrders(true);
      getCustomerOrders(currentUser.uid)
        .then(setOrders)
        .catch(console.warn)
        .finally(() => setLoadingOrders(false));
    }
  }, [currentUser]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          setAuthError('Please enter your full name');
          setAuthLoading(false);
          return;
        }
        await register(name.trim(), email.trim(), password, phone.trim());
      }
    } catch (err: any) {
      console.warn('Auth failure:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else {
        setAuthError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // If customer is not authenticated, show sleek Login/Register UI
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#1E3A2F]/10 text-[#1E3A2F] flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-[#1A1E1C]">
              {authMode === 'login' ? 'Customer Sign In' : 'Create Customer Account'}
            </h1>
            <p className="text-xs text-[#626C66] mt-1">
              {authMode === 'login'
                ? 'Sign in to track orders, manage addresses, and check order history.'
                : 'Join Aesthetx Lifestyle for speedy checkouts and order tracking.'}
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD7] text-xs font-bold mb-6">
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-white text-[#1E3A2F] shadow-xs'
                  : 'text-[#626C66] hover:text-[#1A1E1C]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all ${
                authMode === 'register'
                  ? 'bg-white text-[#1E3A2F] shadow-xs'
                  : 'text-[#626C66] hover:text-[#1A1E1C]'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="01708943242"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {authLoading
                ? 'Processing...'
                : authMode === 'login'
                ? 'Sign In to Account'
                : 'Create Account'}
            </button>
          </form>

          {/* Quick guest track link */}
          <div className="pt-6 mt-6 border-t border-[#EFEBE5] text-center">
            <button
              onClick={() => onNavigate('/track-order')}
              className="text-xs text-[#626C66] hover:text-[#1E3A2F] font-semibold"
            >
              Don't have an account? <u>Track order with phone number →</u>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Customer logged in view
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[#E5DFD7] gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1E3A2F] text-white flex items-center justify-center font-bold text-xl shadow-xs">
            {currentUser.displayName ? currentUser.displayName.slice(0, 1).toUpperCase() : 'C'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1E1C]">
              {currentUser.displayName || 'Customer'}
            </h1>
            <p className="text-xs text-[#626C66]">{currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => onNavigate('/admin')}
              className="px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-[#8FA89B]" />
              <span>Admin Portal</span>
            </button>
          )}

          <button
            onClick={() => logout()}
            className="px-4 py-2 bg-white border border-[#E5DFD7] text-stone-700 hover:text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E5DFD7] mb-8 text-sm">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-3 font-bold transition-all relative ${
            activeTab === 'orders' ? 'text-[#1E3A2F]' : 'text-[#626C66] hover:text-[#1A1E1C]'
          }`}
        >
          <span>Order History ({orders.length})</span>
          {activeTab === 'orders' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A2F]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 px-3 font-bold transition-all relative ${
            activeTab === 'profile' ? 'text-[#1E3A2F]' : 'text-[#626C66] hover:text-[#1A1E1C]'
          }`}
        >
          <span>Profile Details</span>
          {activeTab === 'profile' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A2F]" />
          )}
        </button>

        <button
          onClick={() => onNavigate('/my-orders')}
          className="ml-auto pb-3 px-3 font-bold text-xs text-[#C85A32] hover:text-[#1E3A2F] flex items-center gap-1 cursor-pointer transition-colors"
          title="View All Orders & Invoices"
        >
          <span>View All Orders & Invoices</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'orders' ? (
        <div>
          {loadingOrders ? (
            <TableSkeleton rows={4} />
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((ord) => {
                const est = calculateEstimatedDelivery(ord);
                return (
                  <div
                    key={ord.id}
                    className="bg-white border border-[#E5DFD7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#EFEBE5] gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#1E3A2F]">
                          #{ord.orderNumber || ord.id}
                        </span>
                        <p className="text-[11px] text-[#626C66]">
                          Placed on {est.orderDateFormatted}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#1E3A2F] text-white">
                          {ord.orderStatus}
                        </span>
                        <button
                          onClick={() =>
                            onNavigate(
                              `/track-order?id=${encodeURIComponent(
                                ord.orderNumber || ord.id
                              )}&phone=${encodeURIComponent(ord.customerPhone)}`
                            )
                          }
                          className="px-3 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-xs font-bold text-[#1E3A2F] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Truck className="w-3.5 h-3.5 text-[#C85A32]" />
                          <span>Live Track</span>
                        </button>
                      </div>
                    </div>

                    {/* Estimated Delivery Highlight */}
                    <div className="p-3 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-1.5">
                      <div className="flex items-center gap-2 text-[#1E3A2F] font-bold">
                        <Clock className="w-4 h-4 text-[#C85A32] shrink-0" />
                        <span>Estimated Delivery: {est.isCompleted ? 'Delivered' : est.windowFormatted}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#C85A32] bg-white px-2 py-0.5 rounded-md border border-[#E5DFD7]">
                        {est.relativeTimeText}
                      </span>
                    </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {item.image && (
                            <img
                              src={item.image}
                              alt=""
                              className="w-9 h-11 object-cover rounded border border-[#E5DFD7]"
                            />
                          )}
                          <div>
                            <span className="font-semibold text-[#1A1E1C]">{item.name}</span>
                            <span className="text-[#626C66] text-[11px] block">
                              {item.selectedSize} / {item.selectedColor} × {item.quantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-[#1A1E1C]">
                          ৳{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-[#EFEBE5] flex justify-between items-center text-xs">
                    <span className="text-[#626C66]">
                      Delivery to: {ord.shippingAddress?.district || 'Bangladesh'} ({ord.paymentMethod})
                    </span>
                    <span className="font-black text-sm text-[#1E3A2F]">
                      Total: ৳{ord.total?.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <EmptyState
              icon={<Package className="w-8 h-8 text-[#1E3A2F]" />}
              title="No Orders Found Yet"
              description="You haven't placed any orders with this account yet. Check out our store and enjoy Cash on Delivery!"
              actionText="Start Shopping"
              onAction={() => onNavigate('/shop')}
            />
          )}
        </div>
      ) : (
        /* Profile Info */
        <div className="max-w-xl bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
            Account Credentials
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#626C66] block">Full Name:</span>
              <p className="font-bold text-[#1A1E1C] text-sm mt-0.5">
                {currentUser.displayName || 'Not specified'}
              </p>
            </div>
            <div>
              <span className="text-[#626C66] block">Email:</span>
              <p className="font-bold text-[#1A1E1C] text-sm mt-0.5">{currentUser.email}</p>
            </div>
            <div>
              <span className="text-[#626C66] block">Account UID:</span>
              <p className="font-mono text-stone-500 text-[11px] mt-0.5">{currentUser.uid}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
