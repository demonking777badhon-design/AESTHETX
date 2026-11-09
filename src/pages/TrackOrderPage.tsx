import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  Package,
  Truck,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  MessageCircle,
  Printer,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { trackOrderByNumberAndPhone, getOrderById, getOrdersByPhone } from '../firebase/db';
import type { Order, OrderStatus } from '../types';
import { useSettings } from '../context/SettingsContext';
import { calculateEstimatedDelivery } from '../utils/deliveryEstimation';

interface TrackOrderPageProps {
  initialOrderId?: string;
  initialPhone?: string;
  onNavigate: (path: string) => void;
}

const ORDER_STEPS: { status: OrderStatus; label: string; stepNumber: number }[] = [
  { status: 'Pending', label: 'Order Placed', stepNumber: 1 },
  { status: 'Confirmed', label: 'Confirmed', stepNumber: 2 },
  { status: 'Processing', label: 'Processing & Packed', stepNumber: 3 },
  { status: 'Packed', label: 'Ready for Courier', stepNumber: 4 },
  { status: 'Shipped', label: 'In Transit', stepNumber: 5 },
  { status: 'Delivered', label: 'Delivered', stepNumber: 6 }
];

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({
  initialOrderId = '',
  initialPhone = '',
  onNavigate
}) => {
  const { settings } = useSettings();
  const [orderNumber, setOrderNumber] = useState(initialOrderId);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<Order | null>(null);
  const [multipleOrders, setMultipleOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const executeTrack = async (num: string, ph: string) => {
    if (!num.trim() && !ph.trim()) {
      setErrorMessage('Please enter an Order ID or your Phone Number.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setHasSearched(true);
    setMultipleOrders([]);

    try {
      if (num.trim()) {
        const found = await trackOrderByNumberAndPhone(num.trim(), ph.trim());
        if (found) {
          setOrder(found);
        } else {
          // If order not found by ID, try looking up by phone if phone was provided
          if (ph.trim()) {
            const byPhone = await getOrdersByPhone(ph.trim());
            if (byPhone.length === 1) {
              setOrder(byPhone[0]);
            } else if (byPhone.length > 1) {
              setMultipleOrders(byPhone);
              setOrder(null);
            } else {
              setOrder(null);
            }
          } else {
            setOrder(null);
          }
        }
      } else if (ph.trim()) {
        // Look up all orders by phone number
        const byPhone = await getOrdersByPhone(ph.trim());
        if (byPhone.length === 1) {
          setOrder(byPhone[0]);
        } else if (byPhone.length > 1) {
          setMultipleOrders(byPhone);
          setOrder(null);
        } else {
          setOrder(null);
        }
      }
    } catch (err) {
      console.warn('Track order lookup error:', err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderId || initialPhone) {
      executeTrack(initialOrderId, initialPhone);
    }
  }, [initialOrderId, initialPhone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTrack(orderNumber, phone);
  };

  const getStepStatus = (step: OrderStatus) => {
    if (!order) return 'upcoming';
    const orderStatuses: OrderStatus[] = [
      'Pending',
      'Confirmed',
      'Processing',
      'Packed',
      'Shipped',
      'Delivered'
    ];
    const currentIdx = orderStatuses.indexOf(order.orderStatus);
    const stepIdx = orderStatuses.indexOf(step);

    if (order.orderStatus === 'Cancelled') return 'cancelled';
    if (order.orderStatus === 'Returned' || order.orderStatus === 'Refunded') return 'returned';

    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'upcoming';
  };

  // Calculate delivery estimate if order is present
  const estimate = order ? calculateEstimatedDelivery(order) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Page Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E3A2F]/10 text-[#1E3A2F] text-xs font-bold uppercase tracking-wider">
          <Truck className="w-3.5 h-3.5 text-[#C85A32]" />
          <span>Live Order Tracking & Delivery ETA</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-[#1A1E1C]">
          Track Your Order & Arrival Time
        </h1>
        <p className="text-xs sm:text-sm text-[#626C66] max-w-lg mx-auto">
          Enter your Order Number or Phone Number to view your ordered items and see real-time shipment status and estimated delivery time.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              Order ID / Number
            </label>
            <input
              type="text"
              placeholder={`e.g. ${settings.orderPrefix || 'AL'}-84192`}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs uppercase font-mono text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              Recipient Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 01708943242"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
            />
          </div>

          <div className="sm:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Searching...' : 'Track Order'}</span>
            </button>
          </div>
        </form>

        <p className="text-[11px] text-[#626C66] mt-2.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
          <span>You can search using either your Order ID, Phone Number, or both together.</span>
        </p>

        {errorMessage && (
          <p className="text-xs text-red-600 mt-3 flex items-center gap-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        )}
      </div>

      {/* Multiple Orders Found for this Phone Number */}
      {multipleOrders.length > 1 && !order && (
        <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
            <h3 className="text-sm font-bold text-[#1A1E1C]">
              Found {multipleOrders.length} Orders for Phone: {phone}
            </h3>
            <span className="text-xs text-[#626C66]">Select an order to view full details and delivery ETA</span>
          </div>

          <div className="space-y-3">
            {multipleOrders.map((ord) => {
              const est = calculateEstimatedDelivery(ord);
              return (
                <div
                  key={ord.id}
                  onClick={() => setOrder(ord)}
                  className="p-4 rounded-2xl border border-[#E5DFD7] bg-[#FAF8F5] hover:bg-white hover:border-[#1E3A2F] transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#1E3A2F]">
                        #{ord.orderNumber || ord.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {ord.orderStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#626C66] mt-1">
                      Placed on {est.orderDateFormatted} • {ord.items.length} item(s) • ৳{ord.total?.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-[#C85A32] mt-0.5 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      <span>{est.relativeTimeText}</span>
                    </p>
                  </div>

                  <button className="px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-[#162B23] cursor-pointer">
                    <span>View & Track</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result Section */}
      {order && estimate ? (
        <div className="space-y-6">
          {/* 1. Main Delivery ETA Highlight Banner */}
          <div className="bg-gradient-to-br from-[#1E3A2F] via-[#162B23] to-[#0E1D17] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-[#8FA89B] border border-white/10">
                  <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Estimated Delivery Window</span>
                </span>

                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#C85A32] text-white">
                  {estimate.durationLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    {estimate.isCompleted ? 'Package Delivered' : estimate.windowFormatted}
                  </h2>
                  <p className="text-sm sm:text-base font-semibold text-[#8FA89B] mt-1">
                    {estimate.relativeTimeText}
                  </p>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    {estimate.stepDescription}
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-stone-200 mb-2">
                      <span>Delivery Progress</span>
                      <span>{estimate.progressPercent}%</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div
                        className="bg-gradient-to-r from-[#C85A32] to-[#16A34A] h-full rounded-full transition-all duration-1000"
                        style={{ width: `${estimate.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between text-xs text-stone-300 border-t border-white/10 mt-3">
                    <span className="font-mono text-stone-200">Order #{order.orderNumber || order.id}</span>
                    <span className="font-bold text-white uppercase">{order.orderStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Visual Stepper Timeline */}
          <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#EFEBE5]">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#1A1E1C]">
                  Live Shipment Progress
                </h3>
                <p className="text-xs text-[#626C66] mt-0.5">
                  Ordered on {estimate.orderDateFormatted} • Recipient: {order.customerName} ({order.customerPhone})
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5DFD7] text-xs font-bold text-[#1E3A2F] hover:bg-[#FAF8F5] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {ORDER_STEPS.map((step) => {
                const state = getStepStatus(step.status);

                let cardClass = 'bg-[#FAF8F5] border-[#E5DFD7] text-[#626C66]';
                if (state === 'completed') {
                  cardClass = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold';
                } else if (state === 'current') {
                  cardClass = 'bg-[#1E3A2F] border-[#1E3A2F] text-white font-bold ring-2 ring-[#1E3A2F]/20 shadow-md';
                }

                return (
                  <div
                    key={step.status}
                    className={`p-3 rounded-2xl border text-center transition-all ${cardClass}`}
                  >
                    <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-bold">
                      {state === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : state === 'current' ? (
                        <Truck className="w-5 h-5 text-white animate-bounce" />
                      ) : (
                        <span className="opacity-40">{step.stepNumber}</span>
                      )}
                    </div>
                    <span className="text-xs block leading-tight font-bold">{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Current Status Note */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] flex items-start gap-3 text-xs">
              <Package className="w-5 h-5 text-[#C85A32] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#1A1E1C]">
                  Current Status: {order.orderStatus}
                </p>
                <p className="text-[#626C66] mt-0.5">
                  {estimate.stepDescription}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Items in this Package */}
          <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#EFEBE5]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#1E3A2F]/10 text-[#1E3A2F] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#1A1E1C]">
                    Items in this Package
                  </h3>
                  <span className="text-xs text-[#626C66]">
                    Total {order.items.reduce((sum, it) => sum + it.quantity, 0)} item(s) in this shipment
                  </span>
                </div>
              </div>

              <span className="font-black text-sm text-[#1E3A2F]">
                Total: ৳{order.total?.toLocaleString()}
              </span>
            </div>

            <div className="divide-y divide-[#EFEBE5] border border-[#EFEBE5] rounded-2xl overflow-hidden">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white hover:bg-[#FAF8F5]/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-16 object-cover rounded-xl border border-[#E5DFD7] shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-16 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center font-bold text-stone-400 text-xs">
                        Item
                      </div>
                    )}

                    <div>
                      <h4 className="font-bold text-sm text-[#1A1E1C] line-clamp-1">
                        {item.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#626C66]">
                        {item.selectedSize && (
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E5DFD7] text-[11px] font-semibold">
                            Size: {item.selectedSize}
                          </span>
                        )}
                        {item.selectedColor && (
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E5DFD7] text-[11px] font-semibold">
                            Color: {item.selectedColor}
                          </span>
                        )}
                        {item.selectedVariantTitle && (
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E5DFD7] text-[11px] font-semibold">
                            Option: {item.selectedVariantTitle}
                          </span>
                        )}
                        <span className="text-stone-700 font-bold">
                          Qty: {item.quantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:self-center w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end">
                    <span className="text-xs text-[#626C66] sm:mb-0.5">
                      ৳{item.price.toLocaleString()} × {item.quantity}
                    </span>
                    <strong className="text-sm font-extrabold text-[#1E3A2F]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing & Destination Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Shipping Address */}
              <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#E5DFD7] space-y-2 text-xs">
                <h4 className="font-bold text-sm text-[#1A1E1C] flex items-center gap-1.5 pb-2 border-b border-[#EFEBE5]">
                  <MapPin className="w-4 h-4 text-[#C85A32]" />
                  <span>Destination Address</span>
                </h4>
                <p className="font-bold text-[#1A1E1C] text-sm">
                  {order.customerName || order.shippingAddress?.fullName}
                </p>
                <p className="text-[#626C66] leading-relaxed">
                  {order.shippingAddress?.fullAddress}
                </p>
                <p className="text-[#626C66]">
                  {order.shippingAddress?.upazilaOrArea}, {order.shippingAddress?.district}, {order.shippingAddress?.division}
                </p>
                <p className="text-[#1A1E1C] font-semibold flex items-center gap-1.5 pt-1">
                  <Phone className="w-3.5 h-3.5 text-[#1E3A2F]" />
                  <span>{order.customerPhone || order.shippingAddress?.phone}</span>
                </p>
                {order.customerNote && (
                  <p className="text-stone-500 italic pt-1 border-t border-[#EFEBE5]">
                    Note: "{order.customerNote}"
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#E5DFD7] space-y-2.5 text-xs">
                <h4 className="font-bold text-sm text-[#1A1E1C] flex items-center gap-1.5 pb-2 border-b border-[#EFEBE5]">
                  <ShieldCheck className="w-4 h-4 text-[#1E3A2F]" />
                  <span>Billing & Payment Summary</span>
                </h4>

                <div className="flex justify-between text-[#626C66]">
                  <span>Items Subtotal:</span>
                  <span>৳{order.subtotal?.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-[#626C66]">
                  <span>Delivery Charge ({estimate.isInsideDhaka ? 'Dhaka City' : 'Outside Dhaka'}):</span>
                  <span>৳{order.deliveryCharge?.toLocaleString() || '0'}</span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon Discount:</span>
                    <span>-৳{order.discount?.toLocaleString()}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-[#EFEBE5] flex justify-between items-center text-sm">
                  <span className="font-bold text-[#1A1E1C]">Total Payable:</span>
                  <span className="font-black text-base text-[#1E3A2F]">
                    ৳{order.total?.toLocaleString()}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-[#626C66]">
                  <span>Payment Method:</span>
                  <strong className="text-[#1A1E1C]">{order.paymentMethod}</strong>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#626C66]">
                  <span>Payment Status:</span>
                  <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-emerald-100 text-emerald-800">
                    {order.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Customer Support Contact Strip */}
          <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1A1E1C]">
                  Need Help or Delivery Inquiries?
                </h4>
                <p className="text-[11px] text-[#626C66]">
                  Connect directly with our support team regarding order #{order.orderNumber || order.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {settings.whatsapp && (
                <a
                  href={`https://wa.me/88${settings.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello! I need an update on my order #${order.orderNumber || order.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Support</span>
                </a>
              )}

              <a
                href={`tel:${settings.phone}`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1E3A2F] rounded-xl text-xs font-bold transition-all"
              >
                <Phone className="w-4 h-4 text-[#C85A32]" />
                <span>Call Hotline</span>
              </a>
            </div>
          </div>
        </div>
      ) : hasSearched && !loading ? (
        <div className="bg-white border border-[#E5DFD7] rounded-3xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#1A1E1C]">
            No Matching Order Found
          </h3>
          <p className="text-xs sm:text-sm text-[#626C66] max-w-md mx-auto leading-relaxed">
            We couldn't locate an active order matching your input. Please verify your <strong>Order Number</strong> or <strong>Phone Number</strong>, or contact customer support for live assistance.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`tel:${settings.phone}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl text-xs font-bold text-[#1E3A2F] hover:bg-stone-100"
            >
              <Phone className="w-4 h-4 text-[#C85A32]" />
              <span>Call Helpline: {settings.phone}</span>
            </a>
            {settings.whatsapp && (
              <a
                href={`https://wa.me/88${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-xs font-bold"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp: {settings.whatsapp}</span>
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
