import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
  Check,
  X,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { getAIApprovalActions, reviewAIApprovalAction } from '../../../firebase/db';
import type { AIApprovalAction } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface AIApprovalsTabProps {
  onShowToast: (msg: string) => void;
  onRefreshStats?: () => void;
}

export const AIApprovalsTab: React.FC<AIApprovalsTabProps> = ({ onShowToast, onRefreshStats }) => {
  const { currentUser } = useAuth();
  const [actions, setActions] = useState<AIApprovalAction[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      const list = await getAIApprovalActions();
      setActions(list);
    } catch (err) {
      console.error('Error loading AI approval actions:', err);
    }
  };

  const handleDecision = async (actionId: string, decision: 'approved' | 'rejected') => {
    setProcessingId(actionId);
    const note = adminNoteInput[actionId] || (decision === 'approved' ? 'Approved by Admin' : 'Rejected by Admin');
    const adminEmail = currentUser?.email || 'admin@aesthetx.com';

    try {
      const ok = await reviewAIApprovalAction(actionId, decision, note, adminEmail);
      if (ok) {
        onShowToast(
          decision === 'approved'
            ? 'Action approved and executed on database.'
            : 'Proposal rejected.'
        );
        await loadApprovals();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      onShowToast('Failed to review action.');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = actions.filter((a) => (filter === 'all' ? true : a.status === filter));
  const pendingCount = actions.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-700" />
            <h2 className="text-lg font-black text-[#1A1E1C]">
              AI Permissions & Sensitive Action Approvals
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Safety Guardrail: AI can read catalog and order details safely, but CANNOT cancel orders, issue refunds, or change prices without your explicit 1-click approval.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'approved'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'rejected'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* 2. Proposals List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-12 text-center text-stone-400 text-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-stone-700 text-sm">No actions currently in this state</p>
          <p className="text-[11px] text-stone-400 mt-1">
            When customers request cancellations or refunds in live chat, AI stages them here for your confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((action) => {
            const isPending = action.status === 'pending';

            return (
              <div
                key={action.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs transition-all space-y-4 ${
                  isPending
                    ? 'border-purple-200 ring-2 ring-purple-100'
                    : action.status === 'approved'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-stone-200 opacity-80'
                }`}
              >
                {/* Proposal Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        action.actionType === 'order_cancellation'
                          ? 'bg-rose-100 text-rose-800'
                          : action.actionType === 'order_refund'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {action.actionType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-bold text-stone-900">
                      Target: {action.targetReference || action.targetId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {action.createdAt?.seconds
                        ? new Date(action.createdAt.seconds * 1000).toLocaleString()
                        : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Reason & Payload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                      AI Reason & Context
                    </span>
                    <p className="text-stone-800 font-medium">{action.reason}</p>
                    {action.customerName && (
                      <p className="text-[11px] text-stone-500 pt-1">
                        Customer: {action.customerName}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                      Payload / Query Details
                    </span>
                    <pre className="text-[11px] font-mono text-stone-700 whitespace-pre-wrap">
                      {JSON.stringify(action.payload || {}, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Action Controls for Pending items */}
                {isPending ? (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Add admin review note (optional)..."
                      value={adminNoteInput[action.id] || ''}
                      onChange={(e) =>
                        setAdminNoteInput({ ...adminNoteInput, [action.id]: e.target.value })
                      }
                      className="w-full sm:w-80 text-xs p-2 rounded-xl border border-stone-200 bg-[#FAF8F5] focus:border-stone-500 outline-hidden"
                    />

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => handleDecision(action.id, 'approved')}
                        disabled={processingId === action.id}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Execute</span>
                      </button>

                      <button
                        onClick={() => handleDecision(action.id, 'rejected')}
                        disabled={processingId === action.id}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex items-center justify-between text-xs text-stone-500 border-t border-stone-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          action.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {action.status}
                      </span>
                      {action.adminDecisionNotes && (
                        <span>Note: {action.adminDecisionNotes}</span>
                      )}
                    </div>
                    <span className="font-mono text-[11px]">
                      Reviewed by {action.reviewedBy || 'Admin'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
