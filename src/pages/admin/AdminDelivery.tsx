import React, { useEffect, useState } from 'react';
import { Truck, Plus, Edit, Trash2, Check } from 'lucide-react';
import { getDeliveryZones, saveDeliveryZone, deleteDeliveryZone, logAdminAction } from '../../firebase/db';
import type { DeliveryZone } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

export const AdminDelivery: React.FC = () => {
  const { currentUser } = useAuth();
  const { refreshSettings } = useSettings();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [charge, setCharge] = useState<number>(80);
  const [estimatedDays, setEstimatedDays] = useState('1-2 Business Days');
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryZones();
      setZones(data);
    } catch (err) {
      console.warn('Error fetching zones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const openCreateModal = () => {
    setEditingZone(null);
    setName('');
    setCharge(80);
    setEstimatedDays('1-2 Business Days');
    setActive(true);
    setSortOrder(zones.length + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (z: DeliveryZone) => {
    setEditingZone(z);
    setName(z.name);
    setCharge(z.charge);
    setEstimatedDays(z.estimatedDays || '');
    setActive(z.active);
    setSortOrder(z.sortOrder || 1);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload: Partial<DeliveryZone> = {
        name: name.trim(),
        charge: Number(charge),
        estimatedDays: estimatedDays.trim(),
        active,
        sortOrder: Number(sortOrder)
      };

      await saveDeliveryZone(payload, editingZone?.id);

      await logAdminAction(
        editingZone ? 'DELIVERY_ZONE_UPDATED' : 'DELIVERY_ZONE_CREATED',
        name.trim(),
        `Charge: ৳${charge}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadZones();
      await refreshSettings();
      setIsModalOpen(false);
    } catch (err) {
      console.warn('Error saving delivery zone:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (z: DeliveryZone) => {
    setDeleteTarget(z);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const idToDelete = deleteTarget.id;
      await deleteDeliveryZone(idToDelete);
      setZones((prev) => prev.filter((z) => z.id !== idToDelete));
      await logAdminAction(
        'DELIVERY_ZONE_DELETED',
        deleteTarget.name,
        `Zone ID: ${idToDelete}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      await refreshSettings();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting delivery zone:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Delivery & Shipping Zones</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Configure delivery fees across Dhaka, Outside Dhaka, and regional Bangladesh zones.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Delivery Zone</span>
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : zones.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Zone Name</th>
                <th className="py-3 px-4">Delivery Fee</th>
                <th className="py-3 px-4">Estimated Transit</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {zones.map((z) => (
                <tr key={z.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#1A1E1C]">{z.name}</td>
                  <td className="py-3 px-4 font-black text-[#1E3A2F]">৳{z.charge}</td>
                  <td className="py-3 px-4 text-[#626C66]">{z.estimatedDays || '1-3 Days'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        z.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-500 border border-stone-200'
                      }`}
                    >
                      {z.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(z)}
                        className="p-1.5 text-stone-600 hover:text-[#1E3A2F] hover:bg-stone-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(z)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Delete zone"
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
          <Truck className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Delivery Zones Set</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            Configure delivery fees so checkout can compute shipping totals accurately.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Zone</span>
          </button>
        </div>
      )}

      {/* Zone Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E5DFD7] space-y-4">
            <h3 className="text-lg font-black text-[#1A1E1C]">
              {editingZone ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g. Inside Dhaka or Outside Dhaka"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Delivery Charge (৳ BDT)
                </label>
                <input
                  type="number"
                  min="0"
                  value={charge}
                  onChange={(e) => setCharge(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Estimated Delivery Timeframe
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1-2 Business Days"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A1E1C]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
                />
                <span>Active delivery option</span>
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
                  {saving ? 'Saving...' : 'Save Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Delivery Zone?"
        itemName={deleteTarget?.name}
        message="Are you sure you want to permanently remove this delivery zone? Checkout shipping estimates for this region will be removed."
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
