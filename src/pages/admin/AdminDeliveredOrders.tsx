import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Search,
  Printer,
  Clock,
  Phone,
  MapPin,
  X,
  Trash2,
  RotateCcw,
  Calendar,
  ShieldCheck,
  PackageCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  getAllOrders,
  deleteOrder,
  purgeExpiredDeliveredOrders,
  getLocalOrdersCache,
  logAdminAction
} from '../../firebase/db';
import type { Order } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

export const AdminDeliveredOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => getLocalOrdersCache());
  const [loading, setLoading] = useState(() => getLocalOrdersCache().length === 0);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  const loadDeliveredOrders = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      // Run automatic purge of delivered orders older than 10 days
      const purgedCount = await purgeExpiredDeliveredOrders();
      if (purgedCount > 0) {
        setPurgeMessage(`Automatically purged ${purgedCount} expired order(s) (>10 days retention).`);
      }

      const all = await getAllOrders();
      setOrders(all);
    } catch (err) {
      console.warn('Error loading delivered orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveredOrders(orders.length === 0);

    const handleOrdersUpdated = () => {
      setOrders(getLocalOrdersCache());
    };

    window.addEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('aesthetx-orders-updated', handleOrdersUpdated);
    };
  }, []);

  // Filter delivered orders only
  const deliveredOrders = orders.filter((o) => o.orderStatus === 'Delivered');

  // Helper to calculate days and hours remaining for the 10-day retention
  const getRetentionInfo = (order: Order) => {
    let deliveryTime = 0;
    if (order.deliveredAt) {
      if (typeof order.deliveredAt.toDate === 'function') {
        deliveryTime = order.deliveredAt.toDate().getTime();
      } else if (order.deliveredAt.seconds) {
        deliveryTime = order.deliveredAt.seconds * 1000;
      } else {
        deliveryTime = new Date(order.deliveredAt).getTime();
      }
    } else if (order.updatedAt) {
      deliveryTime = order.updatedAt.seconds ? order.updatedAt.seconds * 1000 : new Date(order.updatedAt).getTime();
    } else if (order.createdAt) {
      deliveryTime = order.createdAt.seconds ? order.createdAt.seconds * 1000 : new Date(order.createdAt).getTime();
    } else {
      deliveryTime = Date.now();
    }

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    const purgeTime = deliveryTime + TEN_DAYS_MS;
    const remainingMs = purgeTime - Date.now();

    const daysRemaining = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));
    const hoursRemaining = Math.max(0, Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));

    const deliveryDateStr = new Date(deliveryTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const purgeDateStr = new Date(purgeTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      deliveryTime,
      purgeTime,
      daysRemaining,
      hoursRemaining,
      deliveryDateStr,
      purgeDateStr,
      isExpired: remainingMs <= 0,
      isExpiringSoon: daysRemaining <= 2
    };
  };

  const handleManualPurge = async () => {
    setPurging(true);
    try {
      const purged = await purgeExpiredDeliveredOrders();
      await loadDeliveredOrders();
      if (purged > 0) {
        setPurgeMessage(`Successfully cleaned up ${purged} expired delivered order(s).`);
      } else {
        setPurgeMessage('All active delivered orders are currently within the 10-day retention period.');
      }
      setTimeout(() => setPurgeMessage(null), 6000);
    } catch (err) {
      console.warn('Purge error:', err);
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteImmediately = async (orderId: string, orderNumber: string) => {
    const confirmed = window.confirm(
      `Permanently delete Delivered Order #${orderNumber} from database now?\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteOrder(orderId);
      await logAdminAction(
        'ORDER_DELETED_EARLY',
        `#${orderNumber}`,
        'Admin permanently deleted delivered order before 10-day auto-purge.',
        currentUser?.uid,
        currentUser?.email || undefined
      );
      await loadDeliveredOrders();
      setSelectedOrder(null);
    } catch (err) {
      console.warn('Delete error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered by search query
  const filteredOrders = deliveredOrders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const matchNum = o.orderNumber?.toLowerCase().includes(s) || o.id.toLowerCase().includes(s);
    const matchCust = o.customerName?.toLowerCase().includes(s);
    const matchPhone = o.customerPhone?.includes(s);
    const matchEmail = o.customerEmail?.toLowerCase().includes(s);
    const matchCity = o.shippingAddress?.district?.toLowerCase().includes(s);
    const matchItem = o.items?.some((it) => it.name.toLowerCase().includes(s));
    return matchNum || matchCust || matchPhone || matchEmail || matchCity || matchItem;
  });

  const totalDeliveredValue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#1A1E1C]">Delivered Orders Archive</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-700 text-white">
              {deliveredOrders.length}
            </span>
          </div>
          <p className="text-xs text-[#626C66] mt-0.5">
            Orders confirmed as delivered are safely quarantined here for 10 days before automatic deletion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualPurge}
            disabled={purging}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1A1E1C] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Scan database and remove records older than 10 days"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A2F] ${purging ? 'animate-spin' : ''}`} />
            <span>{purging ? 'Scanning...' : 'Verify & Purge Expired'}</span>
          </button>
        </div>
      </div>

      {/* Info & Policy Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4.5 sm:p-5 text-xs text-emerald-950 space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm text-emerald-900">10-Day Retention & Automatic Deletion Policy</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Active System
              </span>
            </div>
            <p className="text-[#3E5549] text-xs leading-relaxed">
              When an order is confirmed as Delivered, it is removed from active operations and preserved here with all customer info, product details, address, and status history for exactly <strong>10 days</strong>. Once the 10-day retention period ends, the record is permanently deleted from Firestore.
            </p>
          </div>
        </div>

        {purgeMessage && (
          <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-emerald-300 text-emerald-900 font-semibold text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{purgeMessage}</span>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#626C66] font-semibold uppercase tracking-wider block">
            Delivered in Archive
          </span>
          <div className="text-2xl font-black text-[#1E3A2F] mt-1">
            {deliveredOrders.length} Orders
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            Retained for 10 days
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#626C66] font-semibold uppercase tracking-wider block">
            Gross Delivered Value
          </span>
          <div className="text-2xl font-black text-[#1A1E1C] mt-1">
            ৳{totalDeliveredValue.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            Preserved revenue records
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#626C66] font-semibold uppercase tracking-wider block">
            Auto-Purge Schedule
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {deliveredOrders.filter((o) => getRetentionInfo(o).daysRemaining <= 2).length} Expiring Soon
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            Within 48 hours of deletion
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order ID, customer name, phone, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7] font-bold">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Delivered At</th>
                  <th className="py-3 px-4">Scheduled Deletion</th>
                  <th className="py-3 px-4">Retention Countdown</th>
                  <th className="py-3 px-4">Customer & Phone</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {filteredOrders.map((ord) => {
                  const retention = getRetentionInfo(ord);

                  return (
                    <tr key={ord.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                        #{ord.orderNumber || ord.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-[#1A1E1C]">
                        <span className="font-semibold block">{retention.deliveryDateStr}</span>
                        <span className="text-[10px] text-[#626C66]">Completed</span>
                      </td>
                      <td className="py-3 px-4 text-[#626C66]">
                        <span className="block font-medium text-[#1A1E1C]">{retention.purgeDateStr}</span>
                        <span className="text-[10px] text-amber-700">Permanent delete</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            retention.isExpired
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : retention.isExpiringSoon
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {retention.isExpired
                              ? 'Purging Now'
                              : retention.daysRemaining === 0
                              ? `Today (${retention.hoursRemaining}h left)`
                              : `${retention.daysRemaining} Days Left`}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#1A1E1C] block">{ord.customerName}</span>
                        <span className="text-[#626C66] font-mono text-[11px]">{ord.customerPhone}</span>
                      </td>
                      <td className="py-3 px-4 text-[#626C66] max-w-[150px] truncate">
                        {ord.shippingAddress?.district || ord.shippingAddress?.fullAddress || 'Bangladesh'}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1A1E1C]">
                        ৳{ord.total?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            ord.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {ord.paymentStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="px-3 py-1 bg-[#1E3A2F] text-white rounded-lg text-xs font-bold hover:bg-[#162B23] transition-colors cursor-pointer"
                        >
                          Inspect & Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600/60 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Delivered Orders in Archive</h3>
          <p className="text-xs text-[#626C66] max-w-md mx-auto">
            {search
              ? 'No delivered orders matched your search query.'
              : 'When customer orders are marked as Delivered, they are moved here and retained for 10 days before automatic deletion.'}
          </p>
        </div>
      )}

      {/* Inspect & Full Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E5DFD7] max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD7]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-[#1A1E1C]">
                    Delivered Order #{selectedOrder.orderNumber || selectedOrder.id}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Delivered</span>
                  </span>
                </div>
                <span className="text-xs text-[#626C66]">
                  Created: {selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Retention & Deletion Schedule Banner */}
            {(() => {
              const ret = getRetentionInfo(selectedOrder);
              return (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950">
                          10-Day Retention Schedule
                        </h4>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Delivered On: <strong>{ret.deliveryDateStr}</strong>
                        </p>
                        <p className="text-[11px] text-emerald-800">
                          Scheduled Purge: <strong>{ret.purgeDateStr}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-700 text-white shrink-0">
                      {ret.daysRemaining} Days Left
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Recipient & Shipping Details */}
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
                    <strong>Customer Note:</strong> &ldquo;{selectedOrder.customerNote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Ordered Items Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider mb-2">
                Delivered Items ({selectedOrder.items?.length || 0})
              </h4>
              <div className="border border-[#E5DFD7] rounded-xl overflow-hidden divide-y divide-[#EFEBE5]">
                {selectedOrder.items?.map((item, idx) => (
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
                          Size: {item.selectedSize || 'Standard'} | Color: {item.selectedColor || 'Default'} | Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-[#1E3A2F]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E5DFD7] mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-[#626C66]">
                  <span>Subtotal:</span>
                  <span>৳{selectedOrder.subtotal?.toLocaleString()}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-৳{selectedOrder.discount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#626C66]">
                  <span>Delivery Charge:</span>
                  <span>৳{selectedOrder.deliveryCharge?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#E5DFD7] font-black text-sm text-[#1E3A2F]">
                  <span>Total Amount:</span>
                  <span>৳{selectedOrder.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#626C66] pt-1">
                  <span>Payment Method: {selectedOrder.paymentMethod}</span>
                  <span className="font-bold text-[#1A1E1C]">Payment Status: {selectedOrder.paymentStatus}</span>
                </div>
              </div>
            </div>

            {/* Complete Status Timeline History */}
            {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider mb-2">
                  Complete Status Lifecycle History
                </h4>
                <div className="space-y-2 border border-[#E5DFD7] rounded-xl p-3 bg-[#FAF8F5] max-h-48 overflow-y-auto">
                  {selectedOrder.timeline.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1A1E1C]">{step.status}</span>
                          <span className="text-[10px] text-[#626C66]">
                            {step.timestamp ? new Date(step.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        {step.note && <p className="text-[11px] text-[#626C66]">{step.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EFEBE5]">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-white border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50"
              >
                <Printer className="w-4 h-4 text-[#1E3A2F]" />
                <span>Print Invoice</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDeleteImmediately(
                    selectedOrder.id,
                    selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)
                  )
                }
                disabled={actionLoading}
                className="px-3.5 py-2.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Permanently remove order immediately without waiting 10 days"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Data Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
