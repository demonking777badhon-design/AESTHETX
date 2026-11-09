import React, { useEffect, useState } from 'react';
import { Plus, Tag, Trash2, Edit, Check, X } from 'lucide-react';
import { getCoupons, saveCoupon, deleteCoupon, logAdminAction } from '../../firebase/db';
import type { Coupon } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { useAuth } from '../../context/AuthContext';

export const AdminCoupons: React.FC = () => {
  const { currentUser } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form Fields
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountAmount, setDiscountAmount] = useState<number>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(1000);
  const [maxDiscount, setMaxDiscount] = useState<string>('500');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(data);
    } catch (err) {
      console.warn('Error loading coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('percentage');
    setDiscountAmount(10);
    setMinOrderAmount(1000);
    setMaxDiscount('500');
    setExpiryDate('');
    setUsageLimit('');
    setActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDiscountType(c.discountType);
    setDiscountAmount(c.discountAmount);
    setMinOrderAmount(c.minOrderAmount);
    setMaxDiscount(c.maxDiscount ? String(c.maxDiscount) : '');
    setExpiryDate(c.expiryDate || '');
    setUsageLimit(c.usageLimit ? String(c.usageLimit) : '');
    setActive(c.active);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setSaving(true);
    try {
      const payload: Partial<Coupon> = {
        code: code.trim().toUpperCase(),
        discountType,
        discountAmount: Number(discountAmount),
        minOrderAmount: Number(minOrderAmount) || 0,
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        expiryDate: expiryDate || undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        active
      };

      await saveCoupon(payload, editingCoupon?.id);

      await logAdminAction(
        editingCoupon ? 'COUPON_UPDATED' : 'COUPON_CREATED',
        code.trim().toUpperCase(),
        `Discount: ${discountAmount}${discountType === 'percentage' ? '%' : ' BDT'}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadData();
      setIsModalOpen(false);
    } catch (err) {
      console.warn('Coupon save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (c: Coupon) => {
    setDeleteTarget(c);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const idToDelete = deleteTarget.id;
      await deleteCoupon(idToDelete);
      setCoupons((prev) => prev.filter((c) => c.id !== idToDelete));
      await logAdminAction(
        'COUPON_DELETED',
        deleteTarget.code,
        `Coupon ID: ${idToDelete}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting coupon:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Discount Coupons</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Create percentage or fixed promo codes with min-order thresholds.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Coupon</span>
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : coupons.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Coupon Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Min Order</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                    {c.code}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#C85A32]">
                    {c.discountType === 'percentage'
                      ? `${c.discountAmount}% OFF`
                      : `৳${c.discountAmount} Flat OFF`}
                  </td>
                  <td className="py-3 px-4 text-[#626C66]">
                    {c.minOrderAmount ? `৳${c.minOrderAmount}` : 'No minimum'}
                  </td>
                  <td className="py-3 px-4 text-[#626C66]">
                    {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-500 border border-stone-200'
                      }`}
                    >
                      {c.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-stone-600 hover:text-[#1E3A2F] hover:bg-stone-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(c)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <Tag className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Coupons Created</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            Create promotional codes like AESTHETX10 to reward shoppers.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Coupon</span>
          </button>
        </div>
      )}

      {/* Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E5DFD7] space-y-4">
            <h3 className="text-lg font-black text-[#1A1E1C]">
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Coupon Code</label>
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs uppercase font-mono text-[#1A1E1C]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs font-semibold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (৳)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Min Order (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Max Discount (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A1E1C]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
                />
                <span>Active coupon</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-[#FAF8F5] border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Promo Coupon?"
        itemName={deleteTarget?.code}
        message="Are you sure you want to permanently delete this discount coupon? Customers will no longer be able to apply it at checkout."
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
