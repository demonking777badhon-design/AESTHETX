import React from 'react';
import {
  Bot,
  Sparkles,
  Play,
  Pause,
  Power,
  ShieldCheck,
  ShieldAlert,
  Clock,
  MessageSquare,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import type { SupportSettings, AIActivityLog, AIStatusMode } from '../../../types';

interface AIDashboardOverviewProps {
  settings: SupportSettings;
  onUpdateSettings: (updates: Partial<SupportSettings>) => Promise<void>;
  stats: {
    totalConversations: number;
    unansweredCount: number;
    unresolvedCount: number;
    pendingApprovalsCount: number;
    lowStockCount: number;
    totalOrders: number;
    aiLogsCount: number;
  };
  recentLogs: AIActivityLog[];
  onNavigateSubTab: (tab: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const AIDashboardOverview: React.FC<AIDashboardOverviewProps> = ({
  settings,
  onUpdateSettings,
  stats,
  recentLogs,
  onNavigateSubTab,
  onRefresh,
  isLoading
}) => {
  const currentMode: AIStatusMode = settings.aiAssistantEnabled
    ? settings.aiStatusMode || 'active'
    : 'disabled';

  const handleActivateAI = async () => {
    await onUpdateSettings({
      aiAssistantEnabled: true,
      aiStatusMode: 'active'
    });
  };

  const handlePauseAI = async () => {
    await onUpdateSettings({
      aiAssistantEnabled: true,
      aiStatusMode: 'paused'
    });
  };

  const handleDisableAI = async () => {
    await onUpdateSettings({
      aiAssistantEnabled: false,
      aiStatusMode: 'disabled'
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Master Status Banner & Control Station */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                currentMode === 'active'
                  ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-600'
                  : currentMode === 'paused'
                  ? 'bg-amber-50 border-2 border-amber-500 text-amber-600'
                  : 'bg-stone-100 border-2 border-stone-300 text-stone-500'
              }`}
            >
              <Bot className="w-8 h-8" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-black text-[#1A1E1C]">
                  Website AI Manager — Smart Assistant
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    currentMode === 'active'
                      ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                      : currentMode === 'paused'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentMode === 'active'
                        ? 'bg-emerald-500'
                        : currentMode === 'paused'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                  AI Status: {currentMode.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Powered by server-side Gemini 3.8 Flash • Real Catalog Grounding • Bangladesh E-Commerce Optimized
              </p>
            </div>
          </div>

          {/* Quick Action Control Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleActivateAI}
              disabled={currentMode === 'active'}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs opacity-95 ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 border border-stone-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Turn Active (ON)</span>
            </button>

            <button
              onClick={handlePauseAI}
              disabled={currentMode === 'paused'}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'paused'
                  ? 'bg-amber-500 text-white shadow-xs opacity-95 ring-2 ring-amber-400 ring-offset-1'
                  : 'bg-stone-100 hover:bg-amber-50 text-stone-700 hover:text-amber-700 border border-stone-200'
              }`}
              title="Temporarily route all customer messages to Human Support without turning off configurations"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause AI</span>
            </button>

            <button
              onClick={handleDisableAI}
              disabled={currentMode === 'disabled'}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'disabled'
                  ? 'bg-stone-800 text-white shadow-xs ring-2 ring-stone-600 ring-offset-1'
                  : 'bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 border border-stone-200'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>Turn OFF</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors cursor-pointer"
              title="Refresh metrics"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feature Switches Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">Customer Live Chat</span>
              <span className="text-[11px] text-stone-500">Floating widget on storefront</span>
            </div>
            <button
              onClick={() => onUpdateSettings({ customerChatEnabled: !settings.customerChatEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.customerChatEnabled !== false ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.customerChatEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">Human Support Inbox</span>
              <span className="text-[11px] text-stone-500">Live agent replies & takeover</span>
            </div>
            <button
              onClick={() => onUpdateSettings({ humanSupportEnabled: !settings.humanSupportEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.humanSupportEnabled !== false ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.humanSupportEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">Order Status Lookup</span>
              <span className="text-[11px] text-stone-500">Auto answer order tracking</span>
            </div>
            <button
              onClick={() => onUpdateSettings({ autoOrderInquiryEnabled: !settings.autoOrderInquiryEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.autoOrderInquiryEnabled !== false ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.autoOrderInquiryEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-800 block">Admin Approval Gate</span>
              <span className="text-[11px] text-stone-500">Require approval for refunds/cancels</span>
            </div>
            <button
              onClick={() => onUpdateSettings({ requireAdminApprovalForActions: !settings.requireAdminApprovalForActions })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                settings.requireAdminApprovalForActions !== false ? 'bg-emerald-600' : 'bg-stone-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.requireAdminApprovalForActions !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-[#E5DFD7] shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Conversations</span>
            <MessageSquare className="w-4 h-4 text-[#1E3A2F]" />
          </div>
          <div className="text-2xl font-black text-[#1A1E1C]">{stats.totalConversations}</div>
          <span className="text-[10px] text-stone-400 mt-1 block">Total customer threads</span>
        </div>

        <div
          onClick={() => onNavigateSubTab('inbox')}
          className="bg-white p-4 rounded-2xl border border-[#E5DFD7] hover:border-amber-400 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Unanswered</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          </div>
          <div className="text-2xl font-black text-amber-600">{stats.unansweredCount}</div>
          <span className="text-[10px] text-stone-400 group-hover:text-amber-700 mt-1 flex items-center gap-1 font-semibold">
            View pending <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>

        <div
          onClick={() => onNavigateSubTab('inbox')}
          className="bg-white p-4 rounded-2xl border border-[#E5DFD7] hover:border-blue-400 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unresolved</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.unresolvedCount}</div>
          <span className="text-[10px] text-stone-400 group-hover:text-blue-700 mt-1 flex items-center gap-1 font-semibold">
            Open inquiries <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>

        <div
          onClick={() => onNavigateSubTab('approval-queue')}
          className="bg-white p-4 rounded-2xl border border-[#E5DFD7] hover:border-purple-400 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Approvals</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">{stats.pendingApprovalsCount}</div>
          <span className="text-[10px] text-stone-400 group-hover:text-purple-700 mt-1 flex items-center gap-1 font-semibold">
            Review proposals <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>

        <div
          onClick={() => onNavigateSubTab('inventory-monitoring')}
          className="bg-white p-4 rounded-2xl border border-[#E5DFD7] hover:border-red-400 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Low Stock</span>
            <Boxes className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600">{stats.lowStockCount}</div>
          <span className="text-[10px] text-stone-400 group-hover:text-red-700 mt-1 flex items-center gap-1 font-semibold">
            Restock alerts <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>

        <div
          onClick={() => onNavigateSubTab('ai-logs')}
          className="bg-white p-4 rounded-2xl border border-[#E5DFD7] hover:border-[#1E3A2F] transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">AI Operations</span>
            <Sparkles className="w-4 h-4 text-[#1E3A2F]" />
          </div>
          <div className="text-2xl font-black text-[#1E3A2F]">{stats.aiLogsCount}</div>
          <span className="text-[10px] text-stone-400 group-hover:text-[#1E3A2F] mt-1 flex items-center gap-1 font-semibold">
            Activity stream <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* 3. Operational Health & Safety Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anti-Hallucination & Guardrails Card */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Safety & Accuracy Guardrails
            </h3>
          </div>

          <div className="space-y-2 text-xs text-stone-600">
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Real Catalog Grounding:</strong> AI answers product questions strictly using live database prices, stock, and sizes.</span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Zero Hallucination:</strong> If an item or order is not found, AI politely explains and routes to human support instead of inventing data.</span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Admin Approval Gate:</strong> Refunds, cancellations, and price adjustments require explicit 1-click Admin authorization.</span>
            </div>
          </div>
        </div>

        {/* Quick Navigators */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1E3A2F]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
                Assistant Management Modules
              </h3>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Click to manage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigateSubTab('knowledge-base')}
              className="p-3 text-left rounded-xl border border-stone-200 hover:border-[#1E3A2F] hover:bg-[#FAF8F5] transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-stone-800 block group-hover:text-[#1E3A2F]">
                  Knowledge Base Manager
                </span>
                <span className="text-[11px] text-stone-500">Shipping rates, policies, custom FAQs</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3A2F] group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateSubTab('order-monitoring')}
              className="p-3 text-left rounded-xl border border-stone-200 hover:border-[#1E3A2F] hover:bg-[#FAF8F5] transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-stone-800 block group-hover:text-[#1E3A2F]">
                  Order & Delivery Monitor
                </span>
                <span className="text-[11px] text-stone-500">Pipeline summary, stalled orders, tracking</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3A2F] group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateSubTab('inventory-monitoring')}
              className="p-3 text-left rounded-xl border border-stone-200 hover:border-[#1E3A2F] hover:bg-[#FAF8F5] transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-stone-800 block group-hover:text-[#1E3A2F]">
                  Inventory & Quality Monitor
                </span>
                <span className="text-[11px] text-stone-500">Stock alerts, missing images, AI audit</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3A2F] group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateSubTab('notifications-reports')}
              className="p-3 text-left rounded-xl border border-stone-200 hover:border-[#1E3A2F] hover:bg-[#FAF8F5] transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-stone-800 block group-hover:text-[#1E3A2F]">
                  Executive Reports & Alerts
                </span>
                <span className="text-[11px] text-stone-500">Daily business report, store insights</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3A2F] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Activity Stream Preview */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#1E3A2F]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Recent AI Activity Timeline
            </h3>
          </div>
          <button
            onClick={() => onNavigateSubTab('ai-logs')}
            className="text-xs font-bold text-[#1E3A2F] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-8 text-center text-stone-400 text-xs">
            No recent AI operations recorded. Turn AI ON to start serving customer inquiries.
          </div>
        ) : (
          <div className="divide-y divide-stone-100 mt-2">
            {recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="text-xs font-bold text-stone-800 truncate">
                      "{log.query}"
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 truncate" title={log.response}>
                    {log.response}
                  </p>
                </div>

                <div className="text-[11px] font-mono text-stone-400 shrink-0">
                  {log.timestamp?.seconds
                    ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
