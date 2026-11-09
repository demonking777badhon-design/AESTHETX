import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Package,
  Truck,
  Printer,
  ArrowRight,
  MapPin,
  Phone,
  Calendar,
  CreditCard
} from 'lucide-react';
import { getOrderById } from '../firebase/db';
import type { Order } from '../types';
import { useSettings } from '../context/SettingsContext';
import { calculateEstimatedDelivery } from '../utils/deliveryEstimation';

interface OrderConfirmationPageProps {
  orderId: string;
  orderNumber?: string;
  onNavigate: (path: string) => void;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderId,
  orderNumber,
  onNavigate
}) => {
  const { settings } = useSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fire celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }

    async function loadOrder() {
      try {
        const data = await getOrderById(orderId);
        setOrder(data);
      } catch (err) {
        console.warn('Error loading confirmation order:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const displayOrderNum = order?.orderNumber || orderNumber || orderId;
  const estimate = order ? calculateEstimatedDelivery(order) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Top Success Badge */}
      <div className="text-center space-y-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-[#1A1E1C]">
          Order Confirmed!
        </h1>
        <p className="text-xs sm:text-sm text-[#626C66] max-w-md mx-auto">
          Thank you for shopping with <strong className="text-[#1E3A2F]">{settings.storeName}</strong>. Your order has been placed successfully and is being prepared for dispatch.
        </p>

        <div className="inline-flex items-center gap-2 bg-[#FAF8F5] border border-[#E5DFD7] px-4 py-2 rounded-xl text-xs font-mono text-[#1E3A2F] font-bold">
          <span>Order ID: #{displayOrderNum}</span>
        </div>
      </div>

      {/* Prominent Estimated Delivery Card */}
      {estimate && (
        <div className="mb-8 p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#1E3A2F] to-[#162B23] text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#8FA89B] flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#C85A32]" />
              <span>Estimated Delivery Window</span>
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {estimate.windowFormatted}
            </h3>
            <p className="text-xs text-stone-300">
              {estimate.relativeTimeText} • {estimate.durationLabel}
            </p>
          </div>

          <button
            onClick={() => onNavigate(`/track-order?id=${encodeURIComponent(displayOrderNum)}&phone=${encodeURIComponent(order?.customerPhone || '')}`)}
            className="px-5 py-3 rounded-xl bg-[#C85A32] hover:bg-[#B24E2A] text-white font-bold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
          >
            <span>Live Order Track</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Order Details Card (Printable ID: printable-invoice) */}
      <div id="printable-invoice" className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
        {/* Printable Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[#EFEBE5] gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1E3A2F]">{settings.storeName}</h2>
            <p className="text-xs text-[#626C66]">{settings.tagline}</p>
            <p className="text-xs text-[#626C66] mt-1">Hotline: {settings.phone} | {settings.email}</p>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg uppercase tracking-wider">
              {order?.orderStatus || 'Pending Dispatch'}
            </span>
            <p className="text-xs text-[#626C66] mt-1">
              Date: {order?.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Customer & Shipping Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7] text-xs">
          <div className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#1A1E1C] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#C85A32]" />
              <span>Delivery Address</span>
            </h3>
            <p className="font-semibold text-[#1A1E1C]">{order?.customerName || order?.shippingAddress?.fullName}</p>
            <p className="text-[#626C66]">{order?.shippingAddress?.fullAddress}</p>
            <p className="text-[#626C66]">
              {order?.shippingAddress?.upazilaOrArea}, {order?.shippingAddress?.district}, {order?.shippingAddress?.division}
            </p>
            <p className="text-[#1A1E1C] font-semibold flex items-center gap-1 mt-1">
              <Phone className="w-3.5 h-3.5 text-[#1E3A2F]" />
              <span>{order?.customerPhone || order?.shippingAddress?.phone}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#1A1E1C] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#1E3A2F]" />
              <span>Payment & Timing</span>
            </h3>
            <p className="text-[#1A1E1C]">
              Payment: <strong>{order?.paymentMethod || 'Cash on Delivery (COD)'}</strong>
            </p>
            {order?.paymentTrxId && (
              <p className="text-[#1E3A2F] font-mono font-bold">
                TrxID: <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{order.paymentTrxId}</span>
              </p>
            )}
            {order?.paymentSenderNumber && (
              <p className="text-[#626C66] font-mono">
                Sender No: <strong>{order.paymentSenderNumber}</strong>
              </p>
            )}
            <p className="text-[#626C66]">
              Payment Status: <strong>{order?.paymentStatus || 'Pending upon delivery'}</strong>
            </p>
            <p className="text-[#1E3A2F] font-bold flex items-center gap-1.5 mt-2">
              <Truck className="w-4 h-4 text-[#C85A32]" />
              <span>
                {estimate ? `ETA: ${estimate.windowFormatted} (${estimate.durationLabel})` : 'Estimated Delivery: 2-3 Business Days'}
              </span>
            </p>
          </div>
        </div>

        {/* Purchased Items Table */}
        <div>
          <h3 className="font-bold text-sm text-[#1A1E1C] mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#1E3A2F]" />
            <span>Items Ordered</span>
          </h3>

          <div className="border border-[#E5DFD7] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Options</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {order?.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-semibold text-[#1A1E1C] flex items-center gap-2">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-8 h-10 object-cover rounded border border-[#E5DFD7]"
                        />
                      )}
                      <span>{item.name}</span>
                    </td>
                    <td className="p-3 text-[#626C66]">
                      {item.selectedSize} / {item.selectedColor}
                    </td>
                    <td className="p-3 text-center font-bold text-[#1A1E1C]">{item.quantity}</td>
                    <td className="p-3 text-right text-[#626C66]">৳{item.price.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-[#1E3A2F]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-[#EFEBE5] flex justify-end">
          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-[#626C66]">
              <span>Subtotal:</span>
              <span className="font-bold text-[#1A1E1C]">৳{order?.subtotal?.toLocaleString()}</span>
            </div>

            {order?.discount && order.discount > 0 ? (
              <div className="flex justify-between text-[#C85A32]">
                <span>Discount ({order.couponCode || 'Coupon'}):</span>
                <span>-৳{order.discount.toLocaleString()}</span>
              </div>
            ) : null}

            <div className="flex justify-between text-[#626C66]">
              <span>Delivery Fee:</span>
              <span className="font-bold text-[#1A1E1C]">৳{order?.deliveryCharge}</span>
            </div>

            <div className="pt-2 border-t border-[#E5DFD7] flex justify-between text-sm font-black text-[#1E3A2F]">
              <span>Grand Total:</span>
              <span>৳{order?.total?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#E5DFD7] bg-white hover:bg-stone-50 text-[#1A1E1C] text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4 text-[#1E3A2F]" />
          <span>Print Receipt / Invoice</span>
        </button>

        <button
          onClick={() => onNavigate(`/track-order?id=${encodeURIComponent(displayOrderNum)}&phone=${encodeURIComponent(order?.customerPhone || '')}`)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E3A2F] hover:bg-[#162B23] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Truck className="w-4 h-4" />
          <span>Track This Order</span>
        </button>

        <button
          onClick={() => onNavigate('/my-orders')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#1E3A2F] bg-white hover:bg-[#FAF8F5] text-[#1E3A2F] text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Package className="w-4 h-4 text-[#C85A32]" />
          <span>My Orders & Tracking</span>
        </button>

        <button
          onClick={() => onNavigate('/shop')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C85A32] hover:bg-[#B24E2A] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
