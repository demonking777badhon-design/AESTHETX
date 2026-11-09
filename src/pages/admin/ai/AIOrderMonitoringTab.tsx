import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Eye,
  AlertOctagon,
  Calendar,
  Phone,
  User,
  ShieldCheck
} from 'lucide-react';
import { getLocalOrdersCache, getAllOrders } from '../../../firebase/db';
import type { Order, OrderStatus } from '../../../types';

interface AIOrderMonitoringTabProps {
  onNavigateToOrder?: (order: Order) => void;
  onShowToast: (msg: string) => void;
}

export const AIOrderMonitoringTab: React.FC<AIOrderMonitoringTabProps> = ({
  onNavigateToOrder,
  onShowToast
}) => {
  const [orders, setOrders] = useState<Order[]>(getLocalOrdersCache);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getAllOrders().then((list) => setOrders(list));
  }, []);

  // Compute status metrics
  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Stalled orders (Processing or Pending for > 3 days)
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const stalledOrders = orders.filter((o) => {
    if (o.orderStatus !== 'Processing' && o.orderStatus !== 'Pending') return false;
    const timeMs = o.createdAt?.seconds
      ? o.createdAt.seconds * 1000
      : new Date(o.createdAt || 0).getTime();
    return timeMs > 0 && nowMs - timeMs > THREE_DAYS_MS;
  });

  // Wrong delivery flagged orders
  const wrongDeliveryOrders = orders.filter(
    (o) => o.isWrongDelivery || o.orderStatus === 'Wrong Delivery'
  );

  // Search filter
  const filteredOrders = orders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(s) ||
      o.customerName?.toLowerCase().includes(s) ||
      o.customerPhone?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. Header with Pipeline Breakdown */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#1E3A2F]" />
            <h2 className="text-lg font-black text-[#1A1E1C]">
              AI Order Fulfillment & Safety Monitor
            </h2>
          </div>
          <span className="text-xs font-bold text-stone-500">
            Total Orders: {orders.length}
          </span>
        </div>

        {/* Status Pipeline Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mt-5">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Pending</span>
            <span className="text-xl font-black text-amber-600">{statusCounts['Pending'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Processing</span>
            <span className="text-xl font-black text-blue-700">{statusCounts['Processing'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-center">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Shipped</span>
            <span className="text-xl font-black text-purple-700">{statusCounts['Shipped'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Delivered</span>
            <span className="text-xl font-black text-emerald-700">{statusCounts['Delivered'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-center">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Wrong Deliv.</span>
            <span className="text-xl font-black text-rose-700">{statusCounts['Wrong Delivery'] || wrongDeliveryOrders.length || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Cancelled</span>
            <span className="text-xl font-black text-stone-700">{statusCounts['Cancelled'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Refunded</span>
            <span className="text-xl font-black text-amber-700">{statusCounts['Refunded'] || 0}</span>
          </div>

          <div className="p-3 rounded-xl bg-red-50/70 border border-red-100 text-center">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Stalled (3d+)</span>
            <span className="text-xl font-black text-red-700">{stalledOrders.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Critical Alert: Wrong Delivery Section */}
      {wrongDeliveryOrders.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-black text-rose-900">
              Critical Attention: Wrong Delivery Orders ({wrongDeliveryOrders.length})
            </h3>
          </div>
          <p className="text-xs text-rose-800">
            Customers have reported receiving incorrect packages. Per store policy, these orders are held for review with automatic 10-day retention countdown.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {wrongDeliveryOrders.map((o) => (
              <div key={o.id} className="bg-white p-3.5 rounded-xl border border-rose-200 flex justify-between items-start gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-stone-900">
                      #{o.orderNumber}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                      Wrong Delivery
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Customer: <strong>{o.customerName}</strong> ({o.customerPhone})
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Reason: {o.wrongDeliveryReason || 'Wrong size/item delivered'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-stone-900 block">
                    ৳{o.total}
                  </span>
                  <span className="text-[10px] text-amber-700 font-mono">10d Countdown</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Stalled Orders Alert (> 3 days in processing) */}
      {stalledOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-black text-amber-900">
              Stalled Orders Alert: {stalledOrders.length} Orders Pending Fulfillment &gt; 3 Days
            </h3>
          </div>
          <p className="text-xs text-amber-800">
            AI Assistant proactively detects delayed parcels so customers do not face unexpected delivery delays.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stalledOrders.slice(0, 6).map((o) => (
              <div key={o.id} className="bg-white p-3 rounded-xl border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-stone-900">#{o.orderNumber}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                    {o.orderStatus}
                  </span>
                </div>
                <div className="text-xs text-stone-600 truncate">{o.customerName} • {o.customerPhone}</div>
                <div className="text-[11px] text-stone-400">Total: ৳{o.total} • COD</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Interactive Order Grounding Simulator */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-black text-[#1A1E1C]">
              AI Grounded Order Lookup Tester
            </h3>
            <p className="text-xs text-stone-500">
              Search any order number or phone to inspect exactly what real data AI feeds into customer support chats.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Order # or Phone..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-[#FAF8F5] focus:border-[#1E3A2F] outline-hidden"
            />
          </div>
        </div>

        {/* Filtered Orders List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                <th className="p-3">Order #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Total</th>
                <th className="p-3">AI View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredOrders.slice(0, 10).map((o) => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition-colors">
                  <td className="p-3 font-mono font-bold text-stone-900">
                    #{o.orderNumber}
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-stone-800 block">{o.customerName}</span>
                    <span className="text-[11px] text-stone-500 font-mono">{o.customerPhone}</span>
                  </td>
                  <td className="p-3 text-stone-600 max-w-xs truncate">
                    {o.items?.map((i) => `${i.name} (x${i.quantity})`).join(', ') || 'Item'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        o.orderStatus === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : o.orderStatus === 'Shipped'
                          ? 'bg-purple-100 text-purple-800'
                          : o.orderStatus === 'Cancelled'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {o.orderStatus}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-stone-600">
                    {o.paymentMethod} • {o.paymentStatus}
                  </td>
                  <td className="p-3 font-bold text-stone-900">
                    ৳{o.total}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedOrder(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-stone-100 hover:bg-[#1E3A2F] hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal / Preview Drawer for AI Inspection */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-black text-stone-900">
                    AI Context Grounding for #{selectedOrder.orderNumber}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs font-mono text-stone-700">
                <p><strong>Order Number:</strong> #{selectedOrder.orderNumber}</p>
                <p><strong>Status:</strong> {selectedOrder.orderStatus}</p>
                <p><strong>Payment Status:</strong> {selectedOrder.paymentStatus} ({selectedOrder.paymentMethod})</p>
                <p><strong>Total Amount:</strong> ৳{selectedOrder.total}</p>
                <p><strong>Delivery Address:</strong> {selectedOrder.shippingAddress?.fullAddress}, {selectedOrder.shippingAddress?.district}</p>
                <p><strong>Ordered Items:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  {selectedOrder.items?.map((it, idx) => (
                    <li key={idx}>
                      {it.name} — Qty: {it.quantity} @ ৳{it.price} {it.selectedSize ? `(Size: ${it.selectedSize})` : ''}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] text-stone-500">
                When a customer asks in live chat "Where is order #{selectedOrder.orderNumber}?", AI automatically queries this real dataset and provides accurate status without guessing.
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
