import React, { useState } from 'react';
import { Tag, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface CouponInputProps {
  className?: string;
}

export const CouponInput: React.FC<CouponInputProps> = ({ className = '' }) => {
  const { appliedCoupon, couponDiscount, applyCouponCode, removeCoupon } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleApply = async () => {
    const targetCode = couponCode.trim();
    if (!targetCode) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await applyCouponCode(targetCode);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
        setCouponCode('');
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to apply coupon. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-3 bg-[#FAF8F5] border border-[#E5DFD7] rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#1A1E1C] flex items-center gap-1.5 uppercase tracking-wider">
          <Tag className="w-3.5 h-3.5 text-[#C85A32]" />
          <span>Discount Coupon</span>
        </label>
        {appliedCoupon && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Active
          </span>
        )}
      </div>

      {/* Applied Coupon View */}
      {appliedCoupon ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-950 font-mono tracking-wider">
                  {appliedCoupon.code}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                  {appliedCoupon.discountType === 'percentage'
                    ? `${appliedCoupon.discountAmount}% OFF`
                    : `৳${appliedCoupon.discountAmount} OFF`}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-medium">
                You saved <strong className="font-bold">৳{couponDiscount.toLocaleString()}</strong> on this order!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={removeCoupon}
            className="p-1.5 rounded-lg text-emerald-700 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            title="Remove Coupon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Manual Coupon Input Form */
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleApply();
                }
              }}
              className="flex-1 bg-white border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-[#1A1E1C] placeholder:text-stone-400 placeholder:font-normal outline-hidden"
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !couponCode.trim()}
              className="px-4 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Apply</span>
            </button>
          </div>

          {/* Feedback Message */}
          {feedback && (
            <p
              className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                feedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
