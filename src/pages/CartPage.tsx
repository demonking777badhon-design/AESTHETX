import React, { useState } from 'react';
import {
  Trash2,
  ArrowRight,
  ShoppingBag,
  Tag,
  Truck,
  Check,
  AlertCircle
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { EmptyState } from '../components/common/EmptyState';
import { CouponInput } from '../components/common/CouponInput';

interface CartPageProps {
  onNavigate: (path: string) => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onNavigate }) => {
  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    subtotal,
    appliedCoupon,
    couponDiscount,
    applyCouponCode,
    removeCoupon,
    selectedZone,
    setSelectedZone,
    deliveryCharge,
    grandTotal
  } = useCart();
  const { deliveryZones, settings } = useSettings();

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-[#1E3A2F]" />}
          title="Your Shopping Cart is Empty"
          description="Looks like you haven't added any clothing pieces to your cart yet. Explore our latest drops and find your next favorite outfit."
          actionText="Start Shopping"
          onAction={() => onNavigate('/shop')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C] mb-8">
        Your Shopping Bag ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
        {/* Left 2 Cols: Cart Items Table/List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden divide-y divide-[#EFEBE5] shadow-xs">
            {cartItems.map((item) => (
              <div
                key={`${item.productId}_${item.selectedSize}_${item.selectedColor}`}
                className="p-4 sm:p-5 flex gap-4 items-center"
              >
                {/* Thumbnail */}
                <div
                  className="w-20 sm:w-24 aspect-[3/4] bg-[#FAF8F5] rounded-xl overflow-hidden border border-[#E5DFD7] shrink-0 cursor-pointer"
                  onClick={() => onNavigate(`/product/${item.productId}`)}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    onClick={() => onNavigate(`/product/${item.productId}`)}
                    className="font-bold text-sm sm:text-base text-[#1A1E1C] truncate cursor-pointer hover:text-[#1E3A2F]"
                  >
                    {item.name}
                  </h3>

                  <div className="flex flex-wrap gap-2 text-xs text-[#626C66] mt-1">
                    {item.selectedSize && (
                      <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded font-medium">
                        Size / Quantity: <strong className="text-[#1A1E1C]">{item.selectedSize}</strong>
                      </span>
                    )}
                    {item.selectedColor && (
                      <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded font-medium">
                        Color: <strong className="text-[#1A1E1C]">{item.selectedColor}</strong>
                      </span>
                    )}
                    {item.selectedVariantTitle && !item.selectedSize && (
                      <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded font-medium">
                        <strong className="text-[#1A1E1C]">{item.selectedVariantTitle}</strong>
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-[#1E3A2F] mt-2">
                    ৳{item.price.toLocaleString()}
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="inline-flex items-center border border-[#E5DFD7] rounded-lg bg-white overflow-hidden text-xs">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.selectedSize,
                            item.selectedColor,
                            item.quantity - 1
                          )
                        }
                        className="px-2.5 py-1 text-stone-600 hover:bg-stone-50 font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-bold text-[#1A1E1C]">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.selectedSize,
                            item.selectedColor,
                            item.quantity + 1
                          )
                        }
                        className="px-2.5 py-1 text-stone-600 hover:bg-stone-50 font-bold cursor-pointer"
                        disabled={item.maxStock ? item.quantity >= item.maxStock : false}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        removeFromCart(item.productId, item.selectedSize, item.selectedColor)
                      }
                      className="text-stone-400 hover:text-red-600 transition-colors p-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtotal on right */}
                <div className="hidden sm:block text-right shrink-0">
                  <span className="text-sm font-black text-[#1A1E1C]">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onNavigate('/shop')}
              className="text-xs font-bold text-[#1E3A2F] hover:underline cursor-pointer"
            >
              ← Continue Shopping
            </button>
          </div>
        </div>

        {/* Right Col: Order Summary & Coupon */}
        <div className="space-y-6">
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-5">
            <h2 className="text-lg font-extrabold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
              Order Summary
            </h2>

            {/* Delivery Zone selection preview */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#1E3A2F]" />
                <span>Delivery Location</span>
              </label>
              <div className="space-y-2">
                {deliveryZones.map((zone) => (
                  <label
                    key={zone.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedZone?.id === zone.id
                        ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-1 ring-[#1E3A2F]'
                        : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="deliveryZone"
                        checked={selectedZone?.id === zone.id}
                        onChange={() => setSelectedZone(zone)}
                        className="text-[#1E3A2F] focus:ring-[#1E3A2F]"
                      />
                      <span className="font-semibold text-[#1A1E1C]">{zone.name}</span>
                    </div>
                    <span className="font-bold text-[#1E3A2F]">৳{zone.charge}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Discount Coupon Box */}
            <CouponInput />

            {/* Calculations Breakdown */}
            <div className="pt-4 border-t border-[#EFEBE5] space-y-2 text-xs">
              <div className="flex justify-between text-[#626C66]">
                <span>Bag Subtotal</span>
                <span className="font-bold text-[#1A1E1C]">৳{subtotal.toLocaleString()}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-[#C85A32] font-semibold">
                  <span>Coupon Discount</span>
                  <span>-৳{couponDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-[#626C66]">
                <span>Delivery Charge</span>
                <span className="font-bold text-[#1A1E1C]">৳{deliveryCharge}</span>
              </div>

              <div className="pt-3 border-t border-[#E5DFD7] flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#1A1E1C]">Total Payable</span>
                <span className="text-xl font-black text-[#1E3A2F]">
                  ৳{grandTotal.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 text-right">
                (Pay with Cash upon delivery)
              </p>
            </div>

            {/* Checkout CTA */}
            <button
              onClick={() => onNavigate('/checkout')}
              className="w-full py-4 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
