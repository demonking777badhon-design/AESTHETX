import React, { useEffect, useState } from 'react';
import { Star, Check, Trash2, XCircle, MessageSquare } from 'lucide-react';
import { getAllReviewsAdmin, updateReviewStatus, deleteReview } from '../../firebase/db';
import type { Review } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';

export const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllReviewsAdmin();
      setReviews(data);
    } catch (err) {
      console.warn('Reviews fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (review: Review) => {
    try {
      const newStatus = !review.approved;
      await updateReviewStatus(review.id, newStatus);
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, approved: newStatus } : r))
      );
    } catch (err) {
      console.warn('Review update error:', err);
    }
  };

  const handleOpenDelete = (r: Review) => {
    setDeleteTarget(r);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReview(deleteTarget.id);
      setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.warn('Review delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Product Reviews Moderation</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Approve genuine customer reviews before they appear on product pages.
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : reviews.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Feedback</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#1A1E1C]">
                    {r.customerDisplayName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= r.rating ? 'fill-current' : 'text-stone-300'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#1A1E1C] max-w-sm">
                    <p className="line-clamp-2">{r.comment}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        r.approved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {r.approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleStatus(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          r.approved
                            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {r.approved ? 'Hide' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleOpenDelete(r)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Delete review"
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
          <MessageSquare className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Reviews Yet</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            Customer reviews submitted on product detail pages will appear here for approval.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Customer Review?"
        itemName={deleteTarget ? `${deleteTarget.customerDisplayName} (${deleteTarget.rating} Stars)` : undefined}
        message="Are you sure you want to permanently remove this review? It will be deleted from the database."
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
