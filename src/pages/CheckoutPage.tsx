import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Truck,
  ArrowRight,
  AlertCircle,
  MapPin,
  Phone,
  User,
  FileText,
  Lock,
  Copy,
  Check,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { createOrder } from '../firebase/db';
import type { ShippingAddress, PaymentMethod } from '../types';
import { CouponInput } from '../components/common/CouponInput';
import { isDhakaAddress } from '../utils/deliveryEstimation';

interface CheckoutPageProps {
  onNavigate: (path: string) => void;
  onOrderSuccess: (orderId: string, orderNumber: string) => void;
}

const BD_DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh'
];

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate, onOrderSuccess }) => {
  const {
    cartItems,
    subtotal,
    appliedCoupon,
    couponDiscount,
    selectedZone,
    setSelectedZone,
    deliveryCharge,
    grandTotal,
    clearCart
  } = useCart();
  const { currentUser } = useAuth();
  const { deliveryZones, settings, refreshSettings } = useSettings();

  // Form State
  const [fullName, setFullName] = useState(currentUser?.displayName || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [fullAddress, setFullAddress] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazilaOrArea, setUpazilaOrArea] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash on Delivery');

  // Digital payment inputs (bKash & Nagad)
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Ensure latest gateway availability is loaded when entering Checkout
  useEffect(() => {
    refreshSettings();
  }, []);

  // Automatically reset selected payment method if Admin disables bKash or Nagad
  useEffect(() => {
    if (paymentMethod === 'bKash' && settings.bkashEnabled === false) {
      setPaymentMethod('Cash on Delivery');
      setSenderNumber('');
      setTrxId('');
    } else if (paymentMethod === 'Nagad' && settings.nagadEnabled === false) {
      setPaymentMethod('Cash on Delivery');
      setSenderNumber('');
      setTrxId('');
    }
  }, [settings.bkashEnabled, settings.nagadEnabled, paymentMethod]);

  // Auto-detect Dhaka vs Outside Dhaka and match configured delivery zones
  useEffect(() => {
    if (deliveryZones && deliveryZones.length > 0) {
      const isInside = isDhakaAddress(district, division, fullAddress);
      if (isInside) {
        const insideZone = deliveryZones.find(
          (z) => z.id === 'inside-dhaka' || z.name.toLowerCase().includes('inside') || z.name.includes('ভেতরে')
        );
        if (insideZone && selectedZone?.id !== insideZone.id) {
          setSelectedZone(insideZone);
        }
      } else {
        const outsideZone = deliveryZones.find(
          (z) => z.id === 'outside-dhaka' || z.name.toLowerCase().includes('outside') || z.name.includes('বাইরে')
        );
        if (outsideZone && selectedZone?.id !== outsideZone.id) {
          setSelectedZone(outsideZone);
        }
      }
    }
  }, [division, district, fullAddress, deliveryZones]);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-[#1A1E1C] mb-3">Your Cart is Empty</h2>
        <p className="text-sm text-[#626C66] mb-6">
          Please add clothing items to your bag before heading to checkout.
        </p>
        <button
          onClick={() => onNavigate('/shop')}
          className="px-6 py-3 bg-[#1E3A2F] text-white rounded-xl text-sm font-bold"
        >
          Go to Shop
        </button>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }

    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 11) {
      setFormError('Please provide a valid 11-digit Bangladesh phone number (e.g. 01708943242).');
      return;
    }

    if (!fullAddress.trim()) {
      setFormError('Please provide your complete delivery address.');
      return;
    }

    if (!upazilaOrArea.trim()) {
      setFormError('Please provide your area / upazila (e.g., Banani, Mirpur, Sylhet Sadar).');
      return;
    }

    // Guard against disabled payment gateways
    if (
      (paymentMethod === 'bKash' && settings.bkashEnabled === false) ||
      (paymentMethod === 'Nagad' && settings.nagadEnabled === false)
    ) {
      setFormError(`${paymentMethod} payment is currently turned off by the store. Please select Cash on Delivery.`);
      setPaymentMethod('Cash on Delivery');
      setSenderNumber('');
      setTrxId('');
      return;
    }

    // Digital Payment Validation (bKash & Nagad)
    if (paymentMethod === 'bKash' || paymentMethod === 'Nagad') {
      const cleanSender = senderNumber.trim().replace(/[^0-9]/g, '');
      if (cleanSender.length < 11) {
        setFormError(`Please provide your 11-digit sender ${paymentMethod} mobile number.`);
        return;
      }
      if (!trxId.trim() || trxId.trim().length < 4) {
        setFormError(`Please enter the official Transaction ID (TrxID) received after completing your ${paymentMethod} payment.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      // Generate clean unique Order ID
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      const generatedOrderNumber = `${settings.orderPrefix || 'AL'}-${randomSuffix}`;

      let verificationDetails: any = null;
      let finalPaymentStatus: 'Pending' | 'Paid' = 'Pending';
      let finalOrderStatus: 'Pending' | 'Confirmed' = 'Pending';
      let finalVerificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED' = 'PENDING';

      // =========================================================================
      // AUTOMATIC BACKEND PAYMENT VERIFICATION (bKash & Nagad)
      // Never trust customer input alone; verify with official provider API
      // =========================================================================
      if (paymentMethod === 'bKash' || paymentMethod === 'Nagad') {
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: generatedOrderNumber,
            orderNumber: generatedOrderNumber,
            provider: paymentMethod,
            trxId: trxId.trim().toUpperCase(),
            senderNumber: phone.trim(),
            expectedAmount: grandTotal
          })
        });

        const verifyData = await verifyRes.json();
        verificationDetails = verifyData;

        if (!verifyData.verified) {
          // Verification failed: Stop order confirmation and alert the customer
          setSubmitting(false);
          setFormError(
            verifyData.userMessageEn ||
              verifyData.userMessageBn ||
              verifyData.failureReason ||
              'Payment verification failed. Please verify your Transaction ID and order amount.'
          );
          return;
        }

        // Verification successful from official provider API!
        finalPaymentStatus = 'Paid';
        finalOrderStatus = 'Confirmed';
        finalVerificationStatus = 'VERIFIED';
      }

      const shippingAddress: ShippingAddress = {
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        fullAddress: fullAddress.trim(),
        division,
        district: district.trim(),
        upazilaOrArea: upazilaOrArea.trim(),
        deliveryNotes: deliveryNotes.trim() || undefined,
        zoneId: selectedZone?.id,
        zoneName: selectedZone?.name
      };

      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        variantId: item.selectedVariantId,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));

      const newOrderId = await createOrder({
        orderNumber: generatedOrderNumber,
        customerId: currentUser?.uid || undefined,
        customerName: fullName.trim(),
        customerPhone: cleanPhone,
        customerEmail: email.trim() || undefined,
        items: orderItems,
        subtotal,
        discount: couponDiscount,
        couponCode: appliedCoupon?.code,
        deliveryCharge,
        total: grandTotal,
        paymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentVerificationStatus: finalVerificationStatus,
        paymentVerification: verificationDetails || undefined,
        paymentSenderNumber:
          paymentMethod === 'bKash' || paymentMethod === 'Nagad'
            ? senderNumber.trim()
            : undefined,
        paymentTrxId:
          paymentMethod === 'bKash' || paymentMethod === 'Nagad'
            ? trxId.trim().toUpperCase()
            : undefined,
        paymentAccountType:
          paymentMethod === 'bKash'
            ? settings.bkashType || 'personal'
            : paymentMethod === 'Nagad'
            ? settings.nagadType || 'personal'
            : undefined,
        orderStatus: finalOrderStatus,
        shippingAddress,
        customerNote: deliveryNotes.trim() || undefined
      });

      // Clear local cart
      clearCart();

      // Trigger success handler
      onOrderSuccess(newOrderId, generatedOrderNumber);
    } catch (err: any) {
      console.error('Error placing order:', err);
      setFormError(err.message || 'Unable to submit your order. Please check your connection.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C]">
          Complete Your Order
        </h1>
        <p className="text-xs sm:text-sm text-[#626C66] mt-1">
          Pay with Cash on Delivery
          {settings.bkashEnabled !== false ? ', bKash' : ''}
          {settings.nagadEnabled !== false ? ', or Nagad' : ''} across all 64 districts in Bangladesh.
        </p>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
        {/* Left 2 Cols: Customer & Shipping Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details Card */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1A1E1C] flex items-center gap-2 pb-3 border-b border-[#EFEBE5]">
              <User className="w-4 h-4 text-[#1E3A2F]" />
              <span>Customer Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Badhon Ahmed"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Phone Number (Bangladesh) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#626C66]">
                    +88
                  </span>
                  <input
                    type="tel"
                    placeholder="01708943242"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-12 pr-3 py-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Email Address (Optional for order receipt)
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
              />
            </div>
          </div>

          {/* Delivery Address Card */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1A1E1C] flex items-center gap-2 pb-3 border-b border-[#EFEBE5]">
              <MapPin className="w-4 h-4 text-[#1E3A2F]" />
              <span>Delivery Address in Bangladesh</span>
            </h2>

            {/* Division & District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Division <span className="text-red-500">*</span>
                </label>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-semibold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F] cursor-pointer"
                >
                  {BD_DIVISIONS.map((div) => (
                    <option key={div} value={div}>
                      {div} Division
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  District / City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dhaka, Gazipur, Sylhet"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Area / Thana / Upazila <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Banani, Dhanmondi, Uttara, Mirpur 10"
                value={upazilaOrArea}
                onChange={(e) => setUpazilaOrArea(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Complete Street Address <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="House No, Road No, Building Name, Flat / Floor No..."
                rows={2}
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>

            {/* Delivery Zone Selector */}
            <div className="pt-2">
              <label className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Select Delivery Zone</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {deliveryZones.map((zone) => (
                  <label
                    key={zone.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedZone?.id === zone.id
                        ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-1 ring-[#1E3A2F]'
                        : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="checkoutZone"
                          checked={selectedZone?.id === zone.id}
                          onChange={() => setSelectedZone(zone)}
                          className="text-[#1E3A2F] focus:ring-[#1E3A2F]"
                        />
                        <span className="font-bold text-[#1A1E1C]">{zone.name}</span>
                      </div>
                      {zone.estimatedDays && (
                        <span className="text-[10px] text-[#626C66] block ml-5">
                          {zone.estimatedDays}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-[#1E3A2F]">৳{zone.charge}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Delivery Notes */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Order Notes (Optional instructions for courier)
              </label>
              <input
                type="text"
                placeholder="e.g. Call before delivery, deliver after 2 PM"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
              />
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#EFEBE5] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1E1C] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1E3A2F]" />
                <span>Select Payment Method</span>
              </h2>
              <span className="text-[11px] font-bold text-[#626C66]">100% Encrypted & Secure</span>
            </div>

            <div className="space-y-3">
              {/* Cash on Delivery (COD) */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === 'Cash on Delivery'
                    ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-1 ring-[#1E3A2F]'
                    : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'Cash on Delivery'}
                  onChange={() => setPaymentMethod('Cash on Delivery')}
                  className="mt-0.5 text-[#1E3A2F] focus:ring-[#1E3A2F]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#1A1E1C]">
                      Cash on Delivery (COD)
                    </span>
                    <span className="text-[10px] font-bold bg-[#1E3A2F] text-white px-2 py-0.5 rounded">
                      Popular
                    </span>
                  </div>
                  <p className="text-xs text-[#626C66] mt-1">
                    Pay in cash upon doorstep delivery after inspecting your items. No advance payment required.
                  </p>
                </div>
              </label>

              {/* bKash Payment Option */}
              {settings.bkashEnabled !== false && (
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'bKash'
                      ? 'border-[#E2136E] bg-pink-50/40 ring-1 ring-[#E2136E]'
                      : 'border-[#E5DFD7] hover:border-[#E2136E]/40 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'bKash'}
                    onChange={() => setPaymentMethod('bKash')}
                    className="mt-0.5 text-[#E2136E] focus:ring-[#E2136E]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#1A1E1C]">bKash Payment</span>
                      <span className="text-[10px] font-bold bg-[#E2136E] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                        {settings.bkashType || 'Personal'}
                      </span>
                    </div>
                    <p className="text-xs text-[#626C66] mt-1">
                      Transfer exact order total via bKash App or dial *247# and submit your TrxID for instant verification.
                    </p>
                  </div>
                </label>
              )}

              {/* Nagad Payment Option */}
              {settings.nagadEnabled !== false && (
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'Nagad'
                      ? 'border-[#F7941D] bg-orange-50/40 ring-1 ring-[#F7941D]'
                      : 'border-[#E5DFD7] hover:border-[#F7941D]/40 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'Nagad'}
                    onChange={() => setPaymentMethod('Nagad')}
                    className="mt-0.5 text-[#F7941D] focus:ring-[#F7941D]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#1A1E1C]">Nagad Payment</span>
                      <span className="text-[10px] font-bold bg-[#F7941D] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                        {settings.nagadType || 'Personal'}
                      </span>
                    </div>
                    <p className="text-xs text-[#626C66] mt-1">
                      Transfer exact order total via Nagad App or dial *167# and submit your TrxID for instant verification.
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* bKash Payment Box Details */}
            {paymentMethod === 'bKash' && settings.bkashEnabled !== false && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-50 to-white border-2 border-[#E2136E]/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-pink-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#E2136E] text-white font-black text-xs flex items-center justify-center">
                      bK
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#1A1E1C] block">
                        bKash {settings.bkashType === 'merchant' ? 'Merchant Payment' : 'Send Money'}
                      </span>
                      <span className="text-[10px] text-[#626C66]">
                        {settings.bkashType === 'merchant' ? 'Use Make Payment option' : 'Use Send Money option'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#626C66] block">Total Payable:</span>
                    <span className="text-sm font-black text-[#E2136E]">
                      ৳{grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Account Number Copy Card */}
                <div className="bg-white p-3.5 rounded-xl border border-pink-200 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#626C66] tracking-wider block">
                      bKash Wallet Number ({settings.bkashType || 'Personal'})
                    </span>
                    <span className="text-base font-black font-mono text-[#E2136E] tracking-wider">
                      {settings.bkashNumber || '01708943242'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.bkashNumber || '01708943242');
                      setCopiedNumber(true);
                      setTimeout(() => setCopiedNumber(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E2136E] hover:bg-[#C2105E] text-white transition-all shadow-xs cursor-pointer"
                  >
                    {copiedNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Instructions */}
                <p className="text-xs text-[#626C66] leading-relaxed bg-white/60 p-2.5 rounded-lg border border-pink-100">
                  {settings.bkashInstructions ||
                    'Open the bKash App or dial *247# to send the exact order total to the number above. Enter your bKash sender number and Transaction ID (TrxID) below for automatic verification.'}
                </p>

                {/* Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                      Sender bKash Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="017xxxxxxxx"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      className="w-full bg-white border border-pink-200 rounded-xl p-2.5 text-xs font-mono font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#E2136E]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                      Transaction ID (bKash TrxID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BL89XK241P"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-pink-200 rounded-xl p-2.5 text-xs font-mono font-bold uppercase text-[#1A1E1C] focus:outline-hidden focus:border-[#E2136E]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Nagad Payment Box Details */}
            {paymentMethod === 'Nagad' && settings.nagadEnabled !== false && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-white border-2 border-[#F7941D]/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-orange-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#F7941D] text-white font-black text-xs flex items-center justify-center">
                      N
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#1A1E1C] block">
                        Nagad {settings.nagadType === 'merchant' ? 'Merchant Payment' : 'Send Money'}
                      </span>
                      <span className="text-[10px] text-[#626C66]">
                        {settings.nagadType === 'merchant' ? 'Use Merchant Payment option' : 'Use Send Money option'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#626C66] block">Total Payable:</span>
                    <span className="text-sm font-black text-[#F7941D]">
                      ৳{grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Account Number Copy Card */}
                <div className="bg-white p-3.5 rounded-xl border border-orange-200 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#626C66] tracking-wider block">
                      Nagad Wallet Number ({settings.nagadType || 'Personal'})
                    </span>
                    <span className="text-base font-black font-mono text-[#F7941D] tracking-wider">
                      {settings.nagadNumber || '01708943242'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.nagadNumber || '01708943242');
                      setCopiedNumber(true);
                      setTimeout(() => setCopiedNumber(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F7941D] hover:bg-[#D97E15] text-white transition-all shadow-xs cursor-pointer"
                  >
                    {copiedNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Instructions */}
                <p className="text-xs text-[#626C66] leading-relaxed bg-white/60 p-2.5 rounded-lg border border-orange-100">
                  {settings.nagadInstructions ||
                    'Open the Nagad App or dial *167# to send the exact order total to the number above. Enter your Nagad sender number and Transaction ID (TrxID) below for automatic verification.'}
                </p>

                {/* Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                      Sender Nagad Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="017xxxxxxxx"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      className="w-full bg-white border border-orange-200 rounded-xl p-2.5 text-xs font-mono font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#F7941D]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                      Transaction ID (Nagad TrxID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 7N89XK241P"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-orange-200 rounded-xl p-2.5 text-xs font-mono font-bold uppercase text-[#1A1E1C] focus:outline-hidden focus:border-[#F7941D]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Order Breakdown & Confirm Button */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-5 sticky top-28">
            <h2 className="text-lg font-extrabold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
              Order Items ({cartItems.length})
            </h2>

            {/* Items List Preview */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1 divide-y divide-[#EFEBE5]">
              {cartItems.map((item) => (
                <div
                  key={`${item.productId}_${item.selectedSize}_${item.selectedColor}`}
                  className="pt-3 first:pt-0 flex items-center gap-3 text-xs"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-14 object-cover rounded-lg border border-[#E5DFD7] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A1E1C] truncate">{item.name}</p>
                    <p className="text-[#626C66] text-[11px]">
                      {[item.selectedSize, item.selectedColor, item.selectedVariantTitle]
                        .filter(Boolean)
                        .join(' • ') || 'Standard'} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-bold text-[#1A1E1C]">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Discount Coupon Box */}
            <CouponInput />

            {/* Price Calculations */}
            <div className="pt-4 border-t border-[#EFEBE5] space-y-2 text-xs">
              <div className="flex justify-between text-[#626C66]">
                <span>Items Subtotal</span>
                <span className="font-bold text-[#1A1E1C]">৳{subtotal.toLocaleString()}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-[#C85A32] font-semibold">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>-৳{couponDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-[#626C66]">
                <span>Delivery Charge ({selectedZone?.name})</span>
                <span className="font-bold text-[#1A1E1C]">
                  {deliveryCharge === 0 ? 'FREE' : `৳${deliveryCharge}`}
                </span>
              </div>

              <div className="pt-3 border-t border-[#E5DFD7] flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#1A1E1C]">Total Payable</span>
                <span className="text-xl font-black text-[#1E3A2F]">
                  ৳{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Dynamic Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 text-white ${
                paymentMethod === 'bKash'
                  ? 'bg-[#E2136E] hover:bg-[#C2105E]'
                  : paymentMethod === 'Nagad'
                  ? 'bg-[#F7941D] hover:bg-[#D97E15]'
                  : 'bg-[#C85A32] hover:bg-[#B24E2A]'
              }`}
            >
              {submitting ? (
                <span>Verifying & Confirming Order...</span>
              ) : paymentMethod === 'bKash' ? (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Confirm bKash Order (৳{grandTotal.toLocaleString()})</span>
                </>
              ) : paymentMethod === 'Nagad' ? (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Confirm Nagad Order (৳{grandTotal.toLocaleString()})</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Place Order — Cash on Delivery (৳{grandTotal.toLocaleString()})</span>
                </>
              )}
            </button>

            <div className="text-center">
              <span className="text-[11px] text-stone-500">
                🔒 Safe, encrypted checkout. Fast delivery all across Bangladesh.
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
