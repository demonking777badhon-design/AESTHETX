import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Shirt,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  ArrowRight,
  PlusCircle,
  FolderPlus,
  Truck,
  Settings,
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Trash2,
  Calendar,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import {
  getAllOrders,
  getAllProductsAdmin,
  getCustomers,
  getCategories,
  getLocalOrdersCache,
  getLocalProductsCache,
  getLocalCategoriesCache,
  markOrderAsWrongDelivery,
  restoreWrongDeliveryOrder,
  deleteOrder,
  purgeExpiredWrongDeliveries,
  purgeExpiredDeliveredOrders
} from '../../firebase/db';
import type { Order, Product, Category, CustomerUser } from '../../types';
import { DashboardStatsSkeleton } from '../../components/common/LoadingSkeleton';
import type { AdminTab } from './AdminLayout';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab) => void;
  onOpenOrder: (order: Order) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab, onOpenOrder }) => {
  const [orders, setOrders] = useState<Order[]>(() => getLocalOrdersCache());
  const [products, setProducts] = useState<Product[]>(() => getLocalProductsCache());
  const [categories, setCategories] = useState<Category[]>(() => getLocalCategoriesCache());
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () =>
      getLocalOrdersCache().length === 0 &&
      getLocalProductsCache().length === 0 &&
      getLocalCategoriesCache().length === 0
  );

  useEffect(() => {
    async function loadDashboardMetrics() {
      try {
        // Run auto-purge of any wrong deliveries and delivered orders older than 10 days
        await Promise.all([
          purgeExpiredWrongDeliveries(),
          purgeExpiredDeliveredOrders()
        ]);

        const [ordersData, prodsData, catsData, custData] = await Promise.all([
          getAllOrders(),
          getAllProductsAdmin(),
          getCategories(false),
          getCustomers()
        ]);
        setOrders(ordersData);
        setProducts(prodsData);
        setCategories(catsData);
        setCustomers(custData);
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardMetrics();

    const handleOrdersUpdated = () => {
      setOrders(getLocalOrdersCache());
    };

    window.addEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    };
  }, []);

  // Separate active in-flight orders, delivered orders, and misdirected deliveries quarantined for 10 days
  const deliveredOrders = orders.filter((o) => o.orderStatus === 'Delivered');
  const activeOrders = orders.filter((o) => o.orderStatus !== 'Delivered' && !o.isWrongDelivery && o.orderStatus !== 'Wrong Delivery');
  const wrongDeliveryOrders = orders.filter((o) => o.isWrongDelivery || o.orderStatus === 'Wrong Delivery');

  const calculateDaysRemaining = (order: Order): number => {
    let reportedTime = 0;
    if (order.wrongDeliveryReportedAt) {
      if (typeof order.wrongDeliveryReportedAt.toDate === 'function') {
        reportedTime = order.wrongDeliveryReportedAt.toDate().getTime();
      } else if (order.wrongDeliveryReportedAt.seconds) {
        reportedTime = order.wrongDeliveryReportedAt.seconds * 1000;
      } else {
        reportedTime = new Date(order.wrongDeliveryReportedAt).getTime();
      }
    } else if (order.updatedAt) {
      reportedTime = order.updatedAt.seconds ? order.updatedAt.seconds * 1000 : new Date(order.updatedAt).getTime();
    } else if (order.createdAt) {
      reportedTime = order.createdAt.seconds ? order.createdAt.seconds * 1000 : new Date(order.createdAt).getTime();
    } else {
      reportedTime = Date.now();
    }
    const diffMs = Date.now() - reportedTime;
    const daysPassed = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(0, 10 - daysPassed);
  };

  const handleMarkAsWrong = async (order: Order) => {
    const reason = window.prompt(
      `Mark order #${order.orderNumber || order.id.slice(0, 8)} as Wrong Delivery?\nIt will be moved to the 10-day retention archive and auto-deleted after 10 days.\n\nEnter reason (e.g. Wrong address, Mistakenly delivered, Customer returned):`,
      'Wrong delivery / Misdirected shipment'
    );
    if (!reason) return;

    setActionLoading(order.id);
    try {
      await markOrderAsWrongDelivery(order.id, reason);
      setOrders(getLocalOrdersCache());
    } catch (err) {
      console.warn('Failed to mark wrong delivery:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await restoreWrongDeliveryOrder(orderId);
      setOrders(getLocalOrdersCache());
    } catch (err) {
      console.warn('Failed to restore wrong delivery:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePermanently = async (orderId: string) => {
    const confirmed = window.confirm('Are you sure you want to permanently delete this order data now? This action cannot be undone.');
    if (!confirmed) return;

    setActionLoading(orderId);
    try {
      await deleteOrder(orderId);
      setOrders(getLocalOrdersCache());
    } catch (err) {
      console.warn('Failed to delete order:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold text-[#1A1E1C]">Admin Dashboard Overview</h1>
        <DashboardStatsSkeleton />
      </div>
    );
  }

  // Real calculations on active orders
  const totalOrdersCount = activeOrders.length;
  const pendingOrdersCount = activeOrders.filter((o) => o.orderStatus === 'Pending').length;
  const totalProductsCount = products.length;
  const activeProductsCount = products.filter((p) => p.active).length;
  const lowStockProducts = products.filter((p) => (p.totalStock || 0) > 0 && (p.totalStock || 0) <= 5);
  const outOfStockProducts = products.filter((p) => (p.totalStock || 0) <= 0);

  // Real revenue calculated from all valid orders (both active in-flight and delivered archive)
  const totalRevenue = orders
    .filter((o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Returned' && o.orderStatus !== 'Refunded')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const isDatabaseEmpty = totalProductsCount === 0 && totalOrdersCount === 0;

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Dashboard Overview</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Real-time analytics and inventory status from your Firestore database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('payments')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Payment Verifications</span>
          </button>

          <button
            onClick={() => onNavigateTab('product-new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards (100% Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active In-Flight Orders</span>
            <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#1E3A2F]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black text-[#1A1E1C]">
              {totalOrdersCount > 0 ? totalOrdersCount : '0'}
            </div>
            {deliveredOrders.length > 0 && (
              <button
                onClick={() => onNavigateTab('delivered-orders')}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer"
              >
                {deliveredOrders.length} Delivered Archive →
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#626C66]">
            {pendingOrdersCount} orders currently pending dispatch
          </p>
        </div>

        {/* Real Revenue */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Orders Volume</span>
            <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#C85A32]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1E3A2F]">
            ৳{totalRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#626C66]">
            {totalRevenue === 0 ? 'No revenue recorded yet' : 'Calculated from valid customer orders'}
          </p>
        </div>

        {/* Products in Catalog */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Catalog Inventory</span>
            <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#1E3A2F]">
              <Shirt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1A1E1C]">
            {totalProductsCount > 0 ? totalProductsCount : '0'}
          </div>
          <p className="text-[11px] text-[#626C66]">
            {activeProductsCount} active • {categories.length} categories
          </p>
        </div>

        {/* Low Stock Warnings */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Inventory Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {lowStockProducts.length + outOfStockProducts.length}
          </div>
          <p className="text-[11px] text-[#626C66]">
            {lowStockProducts.length} low stock • {outOfStockProducts.length} sold out
          </p>
        </div>
      </div>

      {/* First-Login Setup Guide (When Database has no products yet) */}
      {isDatabaseEmpty && (
        <div className="bg-white border-2 border-dashed border-[#8FA89B] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1E3A2F] text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#8FA89B]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1A1E1C]">
                Welcome, Administrator! Database Initialized Empty.
              </h2>
              <p className="text-xs sm:text-sm text-[#626C66] mt-1 leading-relaxed">
                As requested, this application does not contain fake products, fake orders, or mock numbers. Follow the steps below to populate your real store catalog:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-[#1E3A2F] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <FolderPlus className="w-4 h-4 text-[#C85A32]" />
              </div>
              <h3 className="font-bold text-sm text-[#1A1E1C]">Create Categories</h3>
              <p className="text-xs text-[#626C66]">
                Add your clothing categories (e.g. T-Shirts, Premium Shirts, Panjabi, Pants).
              </p>
              <button
                onClick={() => onNavigateTab('categories')}
                className="w-full py-2 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-xs font-bold text-[#1E3A2F] transition-colors"
              >
                Add Category →
              </button>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-[#1E3A2F] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <Shirt className="w-4 h-4 text-[#1E3A2F]" />
              </div>
              <h3 className="font-bold text-sm text-[#1A1E1C]">Add Real Products</h3>
              <p className="text-xs text-[#626C66]">
                Upload photos, set pricing (cost, sale), configure sizes (S, M, L) and stock.
              </p>
              <button
                onClick={() => onNavigateTab('product-new')}
                className="w-full py-2 bg-[#1E3A2F] text-white rounded-lg text-xs font-bold hover:bg-[#162B23] transition-colors"
              >
                Create Product →
              </button>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-[#1E3A2F] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <Truck className="w-4 h-4 text-[#8FA89B]" />
              </div>
              <h3 className="font-bold text-sm text-[#1A1E1C]">Review Delivery Zones</h3>
              <p className="text-xs text-[#626C66]">
                Verify rates: Inside Dhaka (৳80) and Outside Dhaka (৳150).
              </p>
              <button
                onClick={() => onNavigateTab('delivery')}
                className="w-full py-2 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-xs font-bold text-[#1E3A2F] transition-colors"
              >
                Configure Delivery →
              </button>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-[#1E3A2F] text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <Settings className="w-4 h-4 text-stone-500" />
              </div>
              <h3 className="font-bold text-sm text-[#1A1E1C]">Store Settings</h3>
              <p className="text-xs text-[#626C66]">
                Confirm hotline (01708943242), social media URLs, and policies.
              </p>
              <button
                onClick={() => onNavigateTab('settings')}
                className="w-full py-2 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-xs font-bold text-[#1E3A2F] transition-colors"
              >
                Store Settings →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1A1E1C]">Recent Customer Orders</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF8F5] border border-[#E5DFD7] text-[#1E3A2F]">
                {activeOrders.length} active
              </span>
            </div>
            <p className="text-xs text-[#626C66]">
              Real customer orders submitted through Cash on Delivery checkout.
            </p>
          </div>
          {activeOrders.length > 0 && (
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-bold text-[#1E3A2F] hover:text-[#C85A32] flex items-center gap-1 cursor-pointer"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {activeOrders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1A1E1C]">
                      {order.customerName}
                    </td>
                    <td className="py-3 px-4 text-[#626C66]">{order.customerPhone}</td>
                    <td className="py-3 px-4 text-[#626C66]">
                      {order.items?.length || 0} items
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1A1E1C]">
                      ৳{order.total?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#FAF8F5] border border-[#E5DFD7] text-[#1E3A2F]">
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleMarkAsWrong(order)}
                          title="Mistakenly delivered? Move to 10-day quarantine archive"
                          disabled={actionLoading === order.id}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Wrong Delivery?
                        </button>
                        <button
                          onClick={() => onOpenOrder(order)}
                          className="text-xs font-bold text-[#1E3A2F] hover:underline cursor-pointer"
                        >
                          Manage →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-[#FAF8F5] rounded-xl border border-[#E5DFD7]">
            <p className="text-xs text-[#626C66] font-medium">
              No active orders placed yet. Orders will appear here in real-time as customers check out.
            </p>
          </div>
        )}
      </div>

      {/* Wrong Deliveries Section (10-Day Retention Archive) */}
      <div className="bg-white border-2 border-rose-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#1A1E1C]">
                  Wrong / Misdirected Deliveries Archive
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                  {wrongDeliveryOrders.length}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  10-Day Retention
                </span>
              </div>
              <p className="text-xs text-[#626C66] mt-0.5">
                Orders mistakenly or incorrectly delivered are isolated here for exactly 10 days. After 10 days, their records are permanently deleted from database.
              </p>
            </div>
          </div>
        </div>

        {wrongDeliveryOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50/60 text-[#1A1E1C] uppercase border-b border-rose-100 font-bold">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer & Phone</th>
                  <th className="py-3 px-4">Delivery Destination</th>
                  <th className="py-3 px-4">Reported Reason</th>
                  <th className="py-3 px-4">Retention Countdown</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {wrongDeliveryOrders.map((order) => {
                  const daysLeft = calculateDaysRemaining(order);
                  const isExpiringSoon = daysLeft <= 2;

                  return (
                    <tr key={order.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                        #{order.orderNumber || order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#1A1E1C] block">{order.customerName}</span>
                        <span className="text-[#626C66] font-mono text-[11px]">{order.customerPhone}</span>
                      </td>
                      <td className="py-3 px-4 text-[#626C66] max-w-xs truncate">
                        {order.shippingAddress?.fullAddress || `${order.shippingAddress?.district || 'Bangladesh'}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-[#1A1E1C] border border-[#E5DFD7]">
                          {order.wrongDeliveryReason || 'Wrong delivery / Misdirected'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isExpiringSoon
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                              : 'bg-amber-50 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {daysLeft === 0 ? 'Purges Today' : `${daysLeft} days remaining`}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1A1E1C]">
                        ৳{order.total?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRestore(order.id)}
                            disabled={actionLoading === order.id}
                            title="Restore back to active customer orders"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1E3A2F] text-white hover:bg-[#162B23] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handleDeletePermanently(order.id)}
                            disabled={actionLoading === order.id}
                            title="Delete order data immediately"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center bg-[#FAF8F5] rounded-xl border border-[#E5DFD7] space-y-1">
            <CheckCircle2 className="w-6 h-6 text-[#1E3A2F] mx-auto opacity-70" />
            <p className="text-xs font-bold text-[#1A1E1C]">No Wrong Deliveries In Quarantine</p>
            <p className="text-[11px] text-[#626C66]">
              All completed orders are accurately routed. Any order marked as wrong delivery will stay here for 10 days before auto-deletion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
