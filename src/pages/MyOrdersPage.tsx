import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Eye,
  Printer,
  Phone,
  MapPin,
  CreditCard,
  Copy,
  Check,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  X,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  ExternalLink,
  PackageCheck,
  ChevronRight,
  Boxes
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getAccountOrders, getOrdersByPhone } from '../firebase/db';
import { calculateEstimatedDelivery } from '../utils/deliveryEstimation';
import type { Order, OrderStatus } from '../types';
import { EmptyState } from '../components/common/EmptyState';

interface MyOrdersPageProps {
  onNavigate: (path: string) => void;
}

// 4-stage tracking timeline for active orders
const ORDER_TIMELINE_STAGES = [
  { key: 'Pending', label: 'Order Placed', step: 1 },
  { key: 'Confirmed', label: 'Confirmed', step: 2 },
  { key: 'Processing', label: 'Packed & Ready', step: 3 },
  { key: 'Shipped', label: 'In Transit', step: 4 },
  { key: 'Delivered', label: 'Delivered', step: 5 }
];

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Exclusively two tabs as requested: 'ACTIVE' (In-Progress/Pending) and 'DELIVERED' (Received)
  const [selectedTab, setSelectedTab] = useState<'ACTIVE' | 'DELIVERED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');

  // Phone lookup if guest or unauthenticated
  const [phoneLookup, setPhoneLookup] = useState('');
  const [phoneSearchError, setPhoneSearchError] = useState('');
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // Selected Order for Full Customer Invoice / Memo Modal
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // Load orders for current account or phone
  const loadAccountOrders = async () => {
    setLoading(true);
    try {
      if (currentUser) {
        const userOrders = await getAccountOrders({
          customerId: currentUser.uid,
          email: currentUser.email || undefined,
          phone: currentUser.phoneNumber || undefined
        });
        setOrders(userOrders);
      } else {
        const savedPhone = localStorage.getItem('aesthetx_user_phone');
        if (savedPhone) {
          setPhoneLookup(savedPhone);
          const phoneOrders = await getOrdersByPhone(savedPhone);
          setOrders(phoneOrders);
        } else {
          setOrders([]);
        }
      }
    } catch (err) {
      console.error('Error loading account orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountOrders();

    const handleUpdate = () => {
      loadAccountOrders();
    };

    window.addEventListener('aesthetx-orders-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetx-orders-updated', handleUpdate);
    };
  }, [currentUser]);

  // Handle phone search for quick guest lookup
  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneLookup.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 11) {
      setPhoneSearchError('Please enter a valid 11-digit phone number (e.g. 01708943242).');
      return;
    }
    setPhoneSearchError('');
    setIsSearchingPhone(true);
    try {
      localStorage.setItem('aesthetx_user_phone', cleanPhone);
      const res = await getOrdersByPhone(cleanPhone);
      setOrders(res);
      if (res.length === 0) {
        setPhoneSearchError('No orders were found for this phone number.');
      }
    } catch (err: any) {
      setPhoneSearchError('Unable to load orders. Please try again.');
    } finally {
      setIsSearchingPhone(false);
    }
  };

  // Copy Order ID helper
  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Compute Active (Pending/In-Transit) vs Delivered
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled');
  }, [orders]);

  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => o.orderStatus === 'Delivered');
  }, [orders]);

  // Filtered orders list based on the chosen tab ('ACTIVE' vs 'DELIVERED') and search term
  const displayedOrders = useMemo(() => {
    const list = selectedTab === 'DELIVERED' ? deliveredOrders : activeOrders;

    if (!searchTerm.trim()) return list;

    const query = searchTerm.trim().toLowerCase();
    return list.filter((ord) => {
      const matchesId =
        (ord.orderNumber && ord.orderNumber.toLowerCase().includes(query)) ||
        ord.id.toLowerCase().includes(query);
      const matchesPhone = ord.customerPhone?.includes(query);
      const matchesName = ord.customerName?.toLowerCase().includes(query);
      const matchesItem = ord.items?.some((i) => i.name.toLowerCase().includes(query));

      return matchesId || matchesPhone || matchesName || matchesItem;
    });
  }, [selectedTab, activeOrders, deliveredOrders, searchTerm]);

  // Total spent calculation
  const totalSpent = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders]);

  // Returns integer stage index (1-5) for visual progress bar
  const getStageIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'Pending':
        return 1;
      case 'Confirmed':
        return 2;
      case 'Processing':
        return 3;
      case 'Shipped':
        return 4;
      case 'Delivered':
        return 5;
      default:
        return 1;
    }
  };

  // Status Badge Styling Helper
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Delivered & Received'
        };
      case 'Shipped':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
          label: 'Shipped (In Transit)'
        };
      case 'Processing':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dot: 'bg-purple-500',
          label: 'Packing & Preparing'
        };
      case 'Confirmed':
        return {
          bg: 'bg-teal-50 text-teal-800 border-teal-200',
          dot: 'bg-teal-500',
          label: 'Order Confirmed'
        };
      case 'Cancelled':
        return {
          bg: 'bg-red-50 text-red-800 border-red-200',
          dot: 'bg-red-500',
          label: 'Cancelled'
        };
      case 'Pending':
      default:
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'Pending Confirmation'
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E3A2F]/10 text-[#1E3A2F] text-xs font-bold mb-3">
                <PackageCheck className="w-4 h-4 text-[#C85A32]" />
                <span>Orders & Live Tracking Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C] tracking-tight">
                My Orders & Tracking
              </h1>
              <p className="text-xs sm:text-sm text-[#626C66] mt-1.5 max-w-2xl leading-relaxed">
                Track pending items currently in progress or view all delivered products you have received with full receipts and invoices.
              </p>
            </div>

            {/* Quick Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('/track-order')}
                className="px-4 py-2.5 rounded-xl border border-[#1E3A2F] text-[#1E3A2F] hover:bg-[#1E3A2F] hover:text-white transition-all text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Truck className="w-4 h-4 text-[#C85A32]" />
                <span>Track Specific Order</span>
              </button>

              <button
                onClick={() => onNavigate('/shop')}
                className="px-4 py-2.5 rounded-xl bg-[#1E3A2F] text-white hover:bg-[#162B23] transition-all text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-300" />
                <span>Continue Shopping</span>
              </button>
            </div>
          </div>

          {/* Account Profile Strip */}
          <div className="mt-6 pt-6 border-t border-[#EFEBE5] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 text-[#1A1E1C]">
              <div className="w-9 h-9 rounded-full bg-[#1E3A2F] text-white flex items-center justify-center font-bold">
                {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold block text-sm">
                  {currentUser ? currentUser.displayName || 'Customer Account' : 'Guest Account / Phone Lookup'}
                </span>
                <span className="text-[#626C66] text-xs">
                  {currentUser ? currentUser.email : phoneLookup ? `Linked Phone: ${phoneLookup}` : 'Not signed in'}
                </span>
              </div>
            </div>

            {!currentUser && (
              <button
                onClick={() => onNavigate('/account')}
                className="px-3.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1E3A2F] text-xs font-bold transition-all cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Guest Phone Lookup Card */}
        {!currentUser && (
          <div className="bg-gradient-to-r from-emerald-50 via-white to-[#FAF8F5] border border-emerald-200 rounded-3xl p-6 mb-8 shadow-xs">
            <div className="max-w-3xl">
              <h3 className="text-base font-bold text-[#1E3A2F] flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#C85A32]" />
                <span>Search Orders by Phone Number</span>
              </h3>
              <p className="text-xs text-[#3E4844] mt-1 mb-4">
                If you placed orders with Cash on Delivery or as a guest, enter your 11-digit phone number to load your live active and delivered orders.
              </p>
              <form onSubmit={handlePhoneSearch} className="flex flex-col sm:flex-row gap-2 max-w-md">
                <input
                  type="tel"
                  placeholder="e.g. 01708943242"
                  value={phoneLookup}
                  onChange={(e) => setPhoneLookup(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5DFD7] bg-white text-xs font-medium text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
                <button
                  type="submit"
                  disabled={isSearchingPhone}
                  className="px-5 py-2.5 rounded-xl bg-[#1E3A2F] text-white text-xs font-bold hover:bg-[#162B23] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSearchingPhone ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Find Orders</span>
                </button>
              </form>
              {phoneSearchError && (
                <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{phoneSearchError}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Primary Filter Tabs: ONLY Active/Pending vs Delivered (No "All Orders") */}
        <div className="bg-white border border-[#E5DFD7] rounded-3xl p-5 sm:p-6 shadow-xs mb-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EFEBE5]">
            
            {/* Exactly 2 Tab Buttons: Active (Pending/In-Transit) and Delivered */}
            <div className="flex items-center gap-3">
              {/* Tab 1: Active / In-Progress Orders (Pending items not yet received) */}
              <button
                type="button"
                onClick={() => setSelectedTab('ACTIVE')}
                className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2.5 border ${
                  selectedTab === 'ACTIVE'
                    ? 'bg-[#1E3A2F] text-white border-[#1E3A2F] shadow-md ring-2 ring-[#1E3A2F]/20'
                    : 'bg-[#FAF8F5] hover:bg-stone-100 text-[#1A1E1C] border-[#E5DFD7]'
                }`}
              >
                <Clock className={`w-4 h-4 ${selectedTab === 'ACTIVE' ? 'text-amber-300' : 'text-amber-600'}`} />
                <span>In Progress & Pending Orders</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    selectedTab === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-800'
                  }`}
                >
                  {activeOrders.length}
                </span>
              </button>

              {/* Tab 2: Delivered Orders (Purchased items already received) */}
              <button
                type="button"
                onClick={() => setSelectedTab('DELIVERED')}
                className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2.5 border ${
                  selectedTab === 'DELIVERED'
                    ? 'bg-[#1E3A2F] text-white border-[#1E3A2F] shadow-md ring-2 ring-[#1E3A2F]/20'
                    : 'bg-[#FAF8F5] hover:bg-stone-100 text-[#1A1E1C] border-[#E5DFD7]'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${selectedTab === 'DELIVERED' ? 'text-emerald-300' : 'text-emerald-600'}`} />
                <span>Delivered Orders</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    selectedTab === 'DELIVERED' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-800'
                  }`}
                >
                  {deliveredOrders.length}
                </span>
              </button>
            </div>

            {/* Quick Refresh */}
            <button
              onClick={loadAccountOrders}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl border border-[#E5DFD7] hover:border-[#1E3A2F] text-xs font-bold text-[#1A1E1C] flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-white self-end sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A2F] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Description banner explaining the active view */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#626C66]">
              {selectedTab === 'ACTIVE' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    Showing <strong>{activeOrders.length}</strong> active orders in progress that have not yet arrived. Live tracking status is shown inside each card below.
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>
                    Showing <strong>{deliveredOrders.length}</strong> completed orders that have been successfully delivered to your hands.
                  </span>
                </>
              )}
            </div>

            {/* Search filter input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Order ID, item, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] placeholder-stone-400 focus:outline-hidden focus:border-[#1E3A2F]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders Listing Area */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white border border-[#E5DFD7] rounded-3xl p-6 animate-pulse space-y-4">
                <div className="h-6 bg-stone-200 rounded w-1/3" />
                <div className="h-24 bg-stone-100 rounded w-full" />
                <div className="h-10 bg-stone-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : displayedOrders.length > 0 ? (
          <div className="space-y-6">
            {displayedOrders.map((ord) => {
              const est = calculateEstimatedDelivery(ord);
              const badge = getStatusBadge(ord.orderStatus);
              const orderIdDisplay = ord.orderNumber || ord.id;
              const currentStage = getStageIndex(ord.orderStatus);

              return (
                <div
                  key={ord.id}
                  className="bg-white border border-[#E5DFD7] hover:border-[#1E3A2F]/40 rounded-3xl p-5 sm:p-7 shadow-xs transition-all space-y-5"
                >
                  {/* Top Bar: Order ID, Date, Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#EFEBE5] gap-3">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E5DFD7] px-3 py-1.5 rounded-xl">
                        <span className="text-xs text-[#626C66] font-semibold">Order ID:</span>
                        <span className="text-sm font-black font-mono text-[#1E3A2F]">
                          #{orderIdDisplay}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(orderIdDisplay, ord.id)}
                          className="p-1 text-stone-400 hover:text-[#1E3A2F] transition-colors cursor-pointer"
                          title="Copy Order ID"
                        >
                          {copiedId === ord.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#626C66]">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span>Placed: {est.orderDateFormatted}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${badge.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* 🚚 LIVE ORDER STATUS & PROGRESS TIMELINE (Shows what condition/stage the order is in) */}
                  {selectedTab === 'ACTIVE' && (
                    <div className="bg-[#FAF8F5] border border-[#E5DFD7] rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#C85A32] shrink-0" />
                          <span className="text-xs font-black text-[#1E3A2F]">
                            Current Status: <span className="text-[#C85A32]">{badge.label}</span>
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#1E3A2F] bg-white px-2.5 py-1 rounded-lg border border-[#E5DFD7]">
                          Estimated Delivery: {est.windowFormatted} ({est.relativeTimeText})
                        </span>
                      </div>

                      {/* 5-Step Visual Stepper Bar */}
                      <div className="pt-2">
                        <div className="grid grid-cols-5 gap-1 sm:gap-2">
                          {ORDER_TIMELINE_STAGES.map((stg) => {
                            const isCompleted = currentStage >= stg.step;
                            const isCurrent = currentStage === stg.step;

                            return (
                              <div key={stg.step} className="flex flex-col items-center text-center">
                                {/* Indicator Bar */}
                                <div
                                  className={`h-2 w-full rounded-full transition-all ${
                                    isCompleted
                                      ? 'bg-[#1E3A2F]'
                                      : 'bg-stone-200'
                                  }`}
                                />
                                <span
                                  className={`text-[10px] sm:text-[11px] font-bold mt-1.5 leading-tight truncate max-w-full ${
                                    isCurrent
                                      ? 'text-[#C85A32] underline font-black'
                                      : isCompleted
                                      ? 'text-[#1E3A2F]'
                                      : 'text-stone-400'
                                  }`}
                                >
                                  {stg.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivered Confirmation Banner for Delivered Tab */}
                  {selectedTab === 'DELIVERED' && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-900">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold">
                          Package successfully delivered to customer. All items received in good condition.
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        Completed
                      </span>
                    </div>
                  )}

                  {/* Delivery Destination Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7] text-xs">
                    <div className="flex items-center gap-2 flex-wrap text-[#1E3A2F]">
                      <Truck className="w-4 h-4 text-[#C85A32] shrink-0" />
                      <span className="font-bold">
                        {ord.shippingAddress?.district || 'Bangladesh'} Courier Delivery
                      </span>
                      <span className="text-stone-300 hidden sm:inline">•</span>
                      <span className="text-stone-600 text-[11px]">
                        Payment: <strong>{ord.paymentMethod === 'Cash on Delivery' || (ord.paymentMethod as string) === 'cod' ? 'Cash on Delivery' : ord.paymentMethod}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#3E4844] text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate max-w-sm">
                        {ord.shippingAddress?.fullName || ord.customerName} ({ord.shippingAddress?.phone || ord.customerPhone}) • {ord.shippingAddress?.fullAddress}
                      </span>
                    </div>
                  </div>

                  {/* Ordered Items List */}
                  <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden bg-white text-xs">
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-[#FAF8F5]/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-12 object-cover rounded-lg border border-[#E5DFD7] bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-12 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-stone-400" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-[#1A1E1C] truncate">{item.name}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#626C66] mt-0.5">
                              {item.selectedSize && <span className="bg-stone-100 px-1.5 py-0.2 rounded text-stone-700">Size: {item.selectedSize}</span>}
                              {item.selectedColor && <span className="bg-stone-100 px-1.5 py-0.2 rounded text-stone-700">Color: {item.selectedColor}</span>}
                              {item.selectedVariantTitle && <span>• {item.selectedVariantTitle}</span>}
                              <span className="font-semibold text-stone-700">• Qty: {item.quantity}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-xs sm:text-sm text-[#1E3A2F] block">
                            ৳{(item.price * item.quantity).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            ৳{item.price.toLocaleString()} ea
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: Amount & Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-t border-[#EFEBE5]">
                    {/* Financial Summary */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#626C66]">
                      <span className="font-black text-sm text-[#1E3A2F]">
                        Total Amount: ৳{ord.total?.toLocaleString()}
                      </span>
                      <span className="text-stone-300">•</span>
                      <span>Delivery Fee: ৳{ord.deliveryCharge}</span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E5DFD7] text-[#C85A32] font-semibold">
                        {ord.paymentStatus || 'Pending Payment'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {selectedTab === 'ACTIVE' ? (
                        <button
                          onClick={() =>
                            onNavigate(
                              `/track-order?id=${encodeURIComponent(orderIdDisplay)}&phone=${encodeURIComponent(
                                ord.customerPhone || ''
                              )}`
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-[#1E3A2F] text-white hover:bg-[#162B23] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Track Live Status</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigate('/shop')}
                          className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-[#1E3A2F] border border-[#E5DFD7] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-[#C85A32]" />
                          <span>Buy Again</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedInvoiceOrder(ord)}
                        className="px-3.5 py-2 rounded-xl bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-xs font-semibold text-[#1A1E1C] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-stone-500" />
                        <span>View Invoice</span>
                      </button>

                      <a
                        href={`https://wa.me/88${(settings.whatsapp || '01700000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hello, I would like to inquire about my order #${orderIdDisplay}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-[#16A34A] hover:bg-emerald-50 border border-emerald-200 transition-colors"
                        title="WhatsApp Order Support"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-[#E5DFD7] rounded-3xl p-8 sm:p-12 text-center shadow-xs">
            <EmptyState
              icon={
                selectedTab === 'DELIVERED' ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                ) : (
                  <Boxes className="w-12 h-12 text-[#1E3A2F]" />
                )
              }
              title={
                selectedTab === 'DELIVERED'
                  ? 'No Delivered Orders Yet'
                  : 'No Active Orders In Progress'
              }
              description={
                selectedTab === 'DELIVERED'
                  ? "You don't have any delivered orders yet. Once your active orders arrive, they will be archived here."
                  : "You have no pending or in-transit orders right now. Discover our latest collections and shop with Cash on Delivery nationwide!"
              }
              actionText="Browse Latest Collections"
              onAction={() => onNavigate('/shop')}
            />
          </div>
        )}
      </div>

      {/* Printable Invoice / Official Memo Modal */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD7]">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C85A32]">
                  Official Customer Invoice
                </span>
                <h3 className="text-xl font-black text-[#1A1E1C]">
                  Order #{selectedInvoiceOrder.orderNumber || selectedInvoiceOrder.id}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-[#E5DFD7] hover:bg-stone-50 text-stone-600 cursor-pointer"
                  title="Print Invoice"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedInvoiceOrder(null)}
                  className="p-2 rounded-xl border border-[#E5DFD7] hover:bg-stone-50 text-stone-600 cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Store & Customer Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-bold text-[#1E3A2F] text-sm">{settings.storeName}</h4>
                <p className="text-stone-500 mt-1">{settings.tagline}</p>
                <p className="text-stone-500">Phone: {settings.phone}</p>
                <p className="text-stone-500">Email: {settings.email}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-stone-800">Billed To:</span>
                <p className="text-stone-700 font-semibold">{selectedInvoiceOrder.shippingAddress?.fullName || selectedInvoiceOrder.customerName}</p>
                <p className="text-stone-500">{selectedInvoiceOrder.shippingAddress?.phone || selectedInvoiceOrder.customerPhone}</p>
                <p className="text-stone-500">{selectedInvoiceOrder.shippingAddress?.fullAddress}</p>
                <p className="text-stone-500">{selectedInvoiceOrder.shippingAddress?.district}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-xs text-left border-collapse border border-[#E5DFD7] rounded-xl overflow-hidden">
              <thead className="bg-[#FAF8F5] text-[#1E3A2F] border-b border-[#E5DFD7]">
                <tr>
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {selectedInvoiceOrder.items.map((it, i) => (
                  <tr key={i}>
                    <td className="p-3">
                      <span className="font-bold text-stone-900 block">{it.name}</span>
                      <span className="text-[10px] text-stone-500">
                        {it.selectedSize ? `Size: ${it.selectedSize} ` : ''}
                        {it.selectedColor ? `| Color: ${it.selectedColor}` : ''}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold">{it.quantity}</td>
                    <td className="p-3 text-right">৳{it.price.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-stone-900">
                      ৳{(it.price * it.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="flex justify-end text-xs">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>৳{selectedInvoiceOrder.subtotal?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Delivery Charge:</span>
                  <span>৳{selectedInvoiceOrder.deliveryCharge?.toLocaleString()}</span>
                </div>
                {selectedInvoiceOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Discount:</span>
                    <span>-৳{selectedInvoiceOrder.discount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-[#1E3A2F] pt-2 border-t border-[#E5DFD7]">
                  <span>Total Payable:</span>
                  <span>৳{selectedInvoiceOrder.total?.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-stone-500 pt-1 text-right">
                  Payment Method: <strong>{selectedInvoiceOrder.paymentMethod === 'Cash on Delivery' || (selectedInvoiceOrder.paymentMethod as string) === 'cod' ? 'Cash on Delivery' : selectedInvoiceOrder.paymentMethod}</strong>
                </div>
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="pt-4 border-t border-[#E5DFD7] flex items-center justify-between">
              <span className="text-[11px] text-stone-400">Thank you for shopping with {settings.storeName}.</span>
              <button
                onClick={() => setSelectedInvoiceOrder(null)}
                className="px-5 py-2 rounded-xl bg-[#1E3A2F] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
