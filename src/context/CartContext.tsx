import React, { createContext, useContext, useEffect, useState } from 'react';
import type { CartItem, Coupon, DeliveryZone } from '../types';
import { validateCoupon } from '../firebase/db';
import { useSettings } from './SettingsContext';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => { success: boolean; message?: string };
  removeFromCart: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, selectedSize?: string, selectedColor?: string, quantity?: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotal: number;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  applyCouponCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  selectedZone: DeliveryZone | null;
  setSelectedZone: (zone: DeliveryZone) => void;
  deliveryCharge: number;
  grandTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'aesthetx_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { deliveryZones, settings } = useSettings();
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);

  // Default zone to inside-dhaka or first available zone
  useEffect(() => {
    if (!selectedZone && deliveryZones.length > 0) {
      const defaultZone = deliveryZones.find((z) => z.id === 'inside-dhaka') || deliveryZones[0];
      setSelectedZone(defaultZone);
    }
  }, [deliveryZones, selectedZone]);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [cartItems]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Recalculate coupon discount if subtotal drops below coupon threshold
  useEffect(() => {
    if (appliedCoupon) {
      if (appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) {
        setAppliedCoupon(null);
        setCouponDiscount(0);
      } else {
        if (appliedCoupon.discountType === 'percentage') {
          let disc = Math.round((subtotal * appliedCoupon.discountAmount) / 100);
          if (appliedCoupon.maxDiscount && disc > appliedCoupon.maxDiscount) {
            disc = appliedCoupon.maxDiscount;
          }
          setCouponDiscount(Math.min(disc, subtotal));
        } else {
          setCouponDiscount(Math.min(appliedCoupon.discountAmount, subtotal));
        }
      }
    } else {
      setCouponDiscount(0);
    }
  }, [subtotal, appliedCoupon]);

  // Free delivery check if order exceeds threshold
  const isFreeDelivery = settings.freeDeliveryThreshold && subtotal >= settings.freeDeliveryThreshold;
  const deliveryCharge = isFreeDelivery ? 0 : (selectedZone?.charge ?? 80);
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryCharge);
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const addToCart = (newItem: CartItem): { success: boolean; message?: string } => {
    let result = { success: true, message: 'Added to cart' };

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) =>
          i.productId === newItem.productId &&
          i.selectedSize === newItem.selectedSize &&
          i.selectedColor === newItem.selectedColor
      );

      if (existingIndex > -1) {
        const existing = prevItems[existingIndex];
        const newQty = existing.quantity + newItem.quantity;

        if (newItem.maxStock && newQty > newItem.maxStock) {
          result = {
            success: false,
            message: `Only ${newItem.maxStock} items available in stock for this variant.`
          };
          return prevItems;
        }

        const updated = [...prevItems];
        updated[existingIndex] = { ...existing, quantity: newQty };
        return updated;
      }

      if (newItem.maxStock && newItem.quantity > newItem.maxStock) {
        result = {
          success: false,
          message: `Only ${newItem.maxStock} items available in stock for this variant.`
        };
        return prevItems;
      }

      return [...prevItems, newItem];
    });

    return result;
  };

  const removeFromCart = (productId: string, selectedSize?: string, selectedColor?: string) => {
    setCartItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.productId === productId &&
            (selectedSize === undefined || item.selectedSize === selectedSize) &&
            (selectedColor === undefined || item.selectedColor === selectedColor)
          )
      )
    );
  };

  const updateQuantity = (
    productId: string,
    selectedSize?: string,
    selectedColor?: string,
    quantity: number = 1
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSize, selectedColor);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (
          item.productId === productId &&
          (selectedSize === undefined || item.selectedSize === selectedSize) &&
          (selectedColor === undefined || item.selectedColor === selectedColor)
        ) {
          const clampedQty = item.maxStock ? Math.min(quantity, item.maxStock) : quantity;
          return { ...item, quantity: clampedQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  const applyCouponCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const res = await validateCoupon(code, subtotal);
    if (res.valid && res.coupon) {
      setAppliedCoupon(res.coupon);
      setCouponDiscount(res.discount);
      return { success: true, message: `Coupon ${res.coupon.code} applied! Saved ৳${res.discount}` };
    }
    return { success: false, message: res.message || 'Invalid coupon code' };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItemsCount,
        subtotal,
        appliedCoupon,
        couponDiscount,
        applyCouponCode,
        removeCoupon,
        selectedZone,
        setSelectedZone,
        deliveryCharge,
        grandTotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
