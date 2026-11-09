import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Printer,
  ChevronRight,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  Phone,
  MapPin,
  X,
  AlertOctagon,
  RotateCcw,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import {
  getAllOrders,
  updateOrderStatus,
  logAdminAction,
  getLocalOrdersCache,
  markOrderAsWrongDelivery,
  restoreWrongDeliveryOrder,
  deleteOrder,
  markOrderAsDelivered
} from '../../firebase/db';
import type { Order, OrderStatus, PaymentStatus } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const STATUS_OPTIONS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Wrong Delivery',
  'Cancelled',
  'Returned',
  'Refunded'
];

export const AdminOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const { settings } = useSettings();

  const [orders, setOrders] = useState<Order[]>(() => getLocalOrdersCache());
  const [loading, setLoading] = useState(() => getLocalOrdersCache().length === 0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryConfirmOrder, setDeliveryConfirmOrder] = useState<Order | null>(null);

  // Status updating state
  const [newStatus, setNewStatus] = useState<OrderStatus>('Pending');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus>('Pending');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedTrx, setCopiedTrx] = useState(false);
  const [verifyingAPI, setVerifyingAPI] = useState(false);

  const handleVerifyWithAPI = async () => {
    if (!selectedOrder || !selectedOrder.paymentTrxId) return;
    setVerifyingAPI(true);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber,
          provider: selectedOrder.paymentMethod,
          trxId: selectedOrder.paymentTrxId,
          senderNumber: selectedOrder.paymentSenderNumber,
          expectedAmount: selectedOrder.total
        })
      });
      const data = await res.json();
      if (data.verified) {
        setNewPaymentStatus('Paid');
        setNewStatus('Confirmed');
        alert(`✅ Official Provider Verification Successful!\n\nStatus: VERIFIED\nAmount: ৳${data.paidAmount}\n${data.userMessageBn}`);
      } else {
        alert(`❌ Verification Failed!\n\nReason: ${data.failureReason}\n${data.userMessageBn}`);
      }
      await loadOrders();
    } catch (err: any) {
      alert(`Verification call error: ${err.message}`);
    } finally {
      setVerifyingAPI(false);
    }
  };

  const loadOrders = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (err) {
      console.warn('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(orders.length === 0);

    const handleOrdersUpdated = () => {
      setOrders(getLocalOrdersCache());
    };

    window.addEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    };
  }, []);

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.orderStatus);
    setNewPaymentStatus(order.paymentStatus || 'Pending');
    setStatusNote('');
  };

  const handleMarkWrongDelivery = async () => {
    if (!selectedOrder) return;
    const reason = window.prompt(
      `Mark Order #${selectedOrder.orderNumber || selectedOrder.id} as Wrong Delivery?\nIt will be moved to the 10-day retention archive and auto-deleted after 10 days.\n\nEnter reason:`,
      'Wrong address / Misdirected delivery'
    );
    if (!reason) return;

    setActionLoading(true);
    try {
      await markOrderAsWrongDelivery(selectedOrder.id, reason);
      await loadOrders();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              orderStatus: 'Wrong Delivery',
              isWrongDelivery: true,
              wrongDeliveryReason: reason,
              wrongDeliveryReportedAt: new Date().toISOString()
            }
          : null
      );
    } catch (err) {
      console.warn('Failed to mark wrong delivery:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreWrongDelivery = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await restoreWrongDeliveryOrder(selectedOrder.id);
      await loadOrders();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              orderStatus: 'Pending',
              isWrongDelivery: false,
              wrongDeliveryReason: undefined,
              wrongDeliveryReportedAt: undefined
            }
          : null
      );
    } catch (err) {
      console.warn('Failed to restore wrong delivery:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrderNow = async () => {
    if (!selectedOrder) return;
    const confirmed = window.confirm('Permanently delete this order data from database? This cannot be undone.');
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteOrder(selectedOrder.id);
      await loadOrders();
      setSelectedOrder(null);
    } catch (err) {
      console.warn('Failed to delete order:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmMarkDelivered = async () => {
    if (!deliveryConfirmOrder) return;

    setActionLoading(true);
    try {
      await markOrderAsDelivered(
        deliveryConfirmOrder.id,
        'Order delivery completed and archived for 10-day retention.'
      );

      await logAdminAction(
        'ORDER_DELIVERED',
        `#${deliveryConfirmOrder.orderNumber || deliveryConfirmOrder.id}`,
        `Order marked as Delivered and transferred to Delivered Orders archive. Payment status preserved: ${deliveryConfirmOrder.paymentStatus}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadOrders();
      setDeliveryConfirmOrder(null);
      setSelectedOrder(null);
    } catch (err) {
      console.warn('Failed to mark order as delivered:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setUpdating(true);
    try {
      await updateOrderStatus(selectedOrder.id, newStatus, statusNote, newPaymentStatus);

      await logAdminAction(
        'ORDER_STATUS_UPDATED',
        `#${selectedOrder.orderNumber || selectedOrder.id}`,
        `New Status: ${newStatus}, Payment: ${newPaymentStatus}. Note: ${statusNote}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      // Refresh orders
      await loadOrders();
      if (newStatus === 'Delivered') {
        setSelectedOrder(null);
      } else {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                orderStatus: newStatus,
                paymentStatus: newPaymentStatus
              }
            : null
        );
      }
      setStatusNote('');
    } catch (err) {
      console.warn('Failed to update order status:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Orders Management exclusively manages active / in-flight orders.
  // Delivered orders are removed from this list and moved to the "Delivered Orders" archive.
  const activeOrders = orders.filter((o) => o.orderStatus !== 'Delivered');

  const filteredOrders = activeOrders.filter((o) => {
    if (statusFilter !== 'All') {
      if (statusFilter === 'Wrong Delivery') {
        if (!o.isWrongDelivery && o.orderStatus !== 'Wrong Delivery') return false;
      } else {
        if (o.orderStatus !== statusFilter) return false;
      }
    }
    if (search) {
      const s = search.toLowerCase();
      const matchNum = o.orderNumber?.toLowerCase().includes(s) || o.id.toLowerCase().includes(s);
      const matchCust = o.customerName?.toLowerCase().includes(s);
      const matchPhone = o.customerPhone?.includes(s);
      if (!matchNum && !matchCust && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Orders Management</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Process, dispatch, and track real customer orders across Bangladesh.
          </p>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order ID, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'All'
                ? 'bg-[#1E3A2F] text-white font-bold'
                : 'bg-[#FAF8F5] text-[#626C66] hover:bg-stone-100'
            }`}
          >
            All Active Orders ({activeOrders.length})
          </button>
          {STATUS_OPTIONS.map((st) => {
            const count = activeOrders.filter((o) => o.orderStatus === st).length;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-[#1E3A2F] text-white font-bold'
                    : 'bg-[#FAF8F5] text-[#626C66] hover:bg-stone-100'
                }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                      #{ord.orderNumber || ord.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 text-[#626C66]">
                      {ord.createdAt?.seconds
                        ? new Date(ord.createdAt.seconds * 1000).toLocaleDateString()
                        : 'Recent'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1A1E1C]">
                      {ord.customerName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#626C66]">
                      {ord.customerPhone}
                    </td>
                    <td className="py-3 px-4 text-[#626C66]">
                      {ord.shippingAddress?.district || 'Bangladesh'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1A1E1C]">
                        ৳{ord.total?.toLocaleString()}
                      </div>
                      <div className="mt-0.5">
                        {ord.paymentMethod === 'bKash' ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-[#E2136E] text-white">
                            bKash {ord.paymentTrxId ? `• ${ord.paymentTrxId.slice(0, 6)}...` : ''}
                          </span>
                        ) : ord.paymentMethod === 'Nagad' ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-[#F7941D] text-white">
                            Nagad {ord.paymentTrxId ? `• ${ord.paymentTrxId.slice(0, 6)}...` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#626C66] font-semibold">
                            COD
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {ord.isWrongDelivery || ord.orderStatus === 'Wrong Delivery' ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 border border-rose-300 text-rose-800">
                          Wrong Delivery
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#FAF8F5] border border-[#E5DFD7] text-[#1E3A2F]">
                          {ord.orderStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openOrderModal(ord)}
                        className="px-3 py-1 bg-[#1E3A2F] text-white rounded-lg text-xs font-bold hover:bg-[#162B23] transition-colors cursor-pointer"
                      >
                        Inspect & Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Orders Found</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            {search || statusFilter !== 'All'
              ? 'No orders matched your search or status filter.'
              : 'No orders have been submitted yet.'}
          </p>
        </div>
      )}

      {/* Order Details & Status Updater Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E5DFD7] max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD7]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-[#1A1E1C]">
                    Order #{selectedOrder.orderNumber || selectedOrder.id}
                  </h3>
                  {(selectedOrder.isWrongDelivery || selectedOrder.orderStatus === 'Wrong Delivery') && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      10-Day Quarantine
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#626C66]">
                  Placed on {selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wrong Delivery Quarantine Alert Banner */}
            {(selectedOrder.isWrongDelivery || selectedOrder.orderStatus === 'Wrong Delivery') && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">
                      Quarantined in Wrong Delivery Archive
                    </h4>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      This order was flagged as mistakenly or incorrectly delivered. It will be automatically deleted after 10 days of retention.
                    </p>
                    {selectedOrder.wrongDeliveryReason && (
                      <p className="text-[11px] font-semibold text-rose-900 mt-1">
                        Reason: {selectedOrder.wrongDeliveryReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60">
                  <button
                    type="button"
                    onClick={handleRestoreWrongDelivery}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1E3A2F] text-white hover:bg-[#162B23] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore to Active Orders</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteOrderNow}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Data Permanently</span>
                  </button>
                </div>
              </div>
            )}

            {/* Customer & Address Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#FAF8F5] p-4 rounded-xl border border-[#E5DFD7]">
              <div className="space-y-1">
                <span className="font-bold text-[#1A1E1C] block">Recipient Details</span>
                <p><strong>Name:</strong> {selectedOrder.customerName}</p>
                <p><strong>Phone:</strong> {selectedOrder.customerPhone}</p>
                {selectedOrder.customerEmail && <p><strong>Email:</strong> {selectedOrder.customerEmail}</p>}
              </div>

              <div className="space-y-1">
                <span className="font-bold text-[#1A1E1C] block">Delivery Destination</span>
                <p>{selectedOrder.shippingAddress?.fullAddress}</p>
                <p>
                  {selectedOrder.shippingAddress?.upazilaOrArea}, {selectedOrder.shippingAddress?.district}, {selectedOrder.shippingAddress?.division}
                </p>
                {selectedOrder.customerNote && (
                  <p className="text-[#C85A32] italic mt-1">
                    <strong>Note:</strong> &ldquo;{selectedOrder.customerNote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Payment Details & Verification Card */}
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 ${
                selectedOrder.paymentMethod === 'bKash'
                  ? 'bg-pink-50/50 border-[#E2136E]/30'
                  : selectedOrder.paymentMethod === 'Nagad'
                  ? 'bg-orange-50/50 border-[#F7941D]/30'
                  : 'bg-[#FAF8F5] border-[#E5DFD7]'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                <div className="flex items-center gap-2">
                  <CreditCard
                    className={`w-4 h-4 ${
                      selectedOrder.paymentMethod === 'bKash'
                        ? 'text-[#E2136E]'
                        : selectedOrder.paymentMethod === 'Nagad'
                        ? 'text-[#F7941D]'
                        : 'text-[#1E3A2F]'
                    }`}
                  />
                  <span className="font-bold text-[#1A1E1C]">
                    পেমেন্ট মেথড: {selectedOrder.paymentMethod}
                  </span>
                  {selectedOrder.paymentAccountType && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-stone-300 uppercase">
                      {selectedOrder.paymentAccountType}
                    </span>
                  )}
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedOrder.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {selectedOrder.paymentStatus || 'Pending'}
                </span>
              </div>

              {(selectedOrder.paymentMethod === 'bKash' || selectedOrder.paymentMethod === 'Nagad') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-[#626C66] text-[11px] block">
                      গ্রাহকের {selectedOrder.paymentMethod} নম্বর (Sender):
                    </span>
                    <span className="font-mono font-bold text-sm text-[#1A1E1C] flex items-center gap-2">
                      {selectedOrder.paymentSenderNumber || 'Not provided'}
                      {selectedOrder.paymentSenderNumber && (
                        <a
                          href={`tel:${selectedOrder.paymentSenderNumber}`}
                          className="text-[#1E3A2F] text-[11px] underline"
                        >
                          Call
                        </a>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[#626C66] text-[11px] block">
                      Transaction ID (TrxID):
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-[#1E3A2F] bg-white px-2 py-1 rounded border border-stone-300">
                        {selectedOrder.paymentTrxId || 'N/A'}
                      </span>
                      {selectedOrder.paymentTrxId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedOrder.paymentTrxId || '');
                            setCopiedTrx(true);
                            setTimeout(() => setCopiedTrx(false), 2000);
                          }}
                          className="p-1 text-stone-500 hover:text-stone-800 cursor-pointer"
                          title="Copy TrxID"
                        >
                          {copiedTrx ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Verify Payment button */}
              {(selectedOrder.paymentMethod === 'bKash' || selectedOrder.paymentMethod === 'Nagad') && (
                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-[#626C66]">
                    অফিসিয়াল মার্চেন্ট এপিআই দিয়ে স্বয়ংক্রিয়ভাবে যাচাই করুন:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyWithAPI}
                      disabled={verifyingAPI}
                      className="px-3 py-1.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{verifyingAPI ? 'Verifying with API...' : 'Verify with Official API'}</span>
                    </button>

                    {newPaymentStatus !== 'Paid' && (
                      <button
                        type="button"
                        onClick={() => setNewPaymentStatus('Paid')}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Manual Mark Paid</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ordered Items */}
            <div>
              <h4 className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider mb-2">
                Order Items ({selectedOrder.items.length})
              </h4>
              <div className="border border-[#E5DFD7] rounded-xl overflow-hidden divide-y divide-[#EFEBE5]">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-12 object-cover rounded border border-[#E5DFD7]"
                        />
                      )}
                      <div>
                        <span className="font-bold text-[#1A1E1C]">{item.name}</span>
                        <span className="text-[#626C66] text-[11px] block">
                          Size: {item.selectedSize} | Color: {item.selectedColor} | Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-[#1E3A2F]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-baseline pt-3 text-xs">
                <span className="text-[#626C66]">
                  Subtotal: ৳{selectedOrder.subtotal} | Delivery: ৳{selectedOrder.deliveryCharge}
                </span>
                <span className="text-base font-black text-[#1E3A2F]">
                  Total: ৳{selectedOrder.total?.toLocaleString()} ({selectedOrder.paymentMethod})
                </span>
              </div>
            </div>

            {/* Status Update Form */}
            <form onSubmit={handleUpdateStatus} className="pt-4 border-t border-[#EFEBE5] space-y-4">
              <h4 className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider">
                Update Order Lifecycle
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Order Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs font-semibold text-[#1A1E1C]"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Payment Status
                  </label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs font-semibold text-[#1A1E1C]"
                  >
                    <option value="Pending">Pending (COD)</option>
                    <option value="Paid">Paid / Collected</option>
                    <option value="Failed">Failed</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Status Timeline Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handed over to Pathao/Steadfast Courier, tracking #123456"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50"
                >
                  <Printer className="w-4 h-4 text-[#1E3A2F]" />
                  <span>Print Invoice</span>
                </button>

                {/* Replaced red Wrong Delivery Quarantine button with Mark as Delivered */}
                {selectedOrder.orderStatus !== 'Delivered' &&
                  selectedOrder.orderStatus !== 'Cancelled' &&
                  selectedOrder.orderStatus !== 'Returned' &&
                  selectedOrder.orderStatus !== 'Refunded' && (
                    <button
                      type="button"
                      onClick={() => setDeliveryConfirmOrder(selectedOrder)}
                      disabled={actionLoading || updating}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                      title="Mark order as delivered and transfer to Delivered Orders archive"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                      <span>Mark as Delivered</span>
                    </button>
                  )}

                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {updating ? 'Updating...' : 'Save Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Pop-up Modal for Marking Order as Delivered */}
      {deliveryConfirmOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E5DFD7] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-[#1A1E1C]">
                  Confirm Order Delivery
                </h3>
                <p className="text-xs text-[#626C66] leading-relaxed">
                  Are you sure you want to mark Order <strong className="text-[#1A1E1C]">#{deliveryConfirmOrder.orderNumber || deliveryConfirmOrder.id.slice(0, 8)}</strong> for <strong className="text-[#1A1E1C]">{deliveryConfirmOrder.customerName}</strong> as <strong>Delivered</strong>?
                </p>
                <div className="text-[11px] text-emerald-950 mt-2 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 space-y-1">
                  <p className="font-bold text-emerald-900">📦 Delivery Workflow Rules:</p>
                  <p>• The order will immediately move from Active Orders to the <strong>Delivered Orders</strong> archive.</p>
                  <p>• Full records will be retained for <strong>10 days</strong> before automatic permanent deletion.</p>
                  <p>• Payment Status (<span className="font-bold">{deliveryConfirmOrder.paymentStatus}</span>) remains completely independent and separate.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EFEBE5]">
              <button
                type="button"
                onClick={() => setDeliveryConfirmOrder(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-[#E5DFD7] hover:bg-stone-50 text-[#1A1E1C] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkDelivered}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Confirming...' : 'Yes, Confirm Delivery'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
