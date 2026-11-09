import React, { useState, useEffect } from 'react';
import {
  Bot,
  MessageSquare,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  Send,
  Search,
  RefreshCw,
  Headphones,
  Check,
  AlertCircle,
  FileText,
  UserCheck,
  Lock,
  ChevronRight,
  History,
  BookOpen,
  ShoppingBag,
  Boxes,
  Bell,
  Play,
  Pause,
  Power,
  RotateCcw
} from 'lucide-react';
import {
  getSupportSettings,
  saveSupportSettings,
  getAllSupportConversations,
  getSupportMessages,
  sendSupportMessage,
  updateSupportConversation,
  getAIActivityLogs,
  getLocalSupportSettings,
  getAIApprovalActions,
  getLocalProductsCache,
  getLocalOrdersCache,
  getAllOrders,
  getAllProductsAdmin,
  getLocalAIKnowledgeBase
} from '../../firebase/db';
import type {
  SupportSettings,
  SupportConversation,
  SupportMessage,
  AIActivityLog,
  AIApprovalAction
} from '../../types';

// AI Subcomponents
import { AIDashboardOverview } from './ai/AIDashboardOverview';
import { AIKnowledgeBaseTab } from './ai/AIKnowledgeBaseTab';
import { AIOrderMonitoringTab } from './ai/AIOrderMonitoringTab';
import { AIInventoryMonitoringTab } from './ai/AIInventoryMonitoringTab';
import { AIApprovalsTab } from './ai/AIApprovalsTab';
import { AINotificationsReportsTab } from './ai/AINotificationsReportsTab';

type AISubTab =
  | 'dashboard'
  | 'inbox'
  | 'knowledge-base'
  | 'order-monitoring'
  | 'inventory-monitoring'
  | 'approval-queue'
  | 'notifications-reports'
  | 'ai-logs';

export const AdminSupport: React.FC = () => {
  const [settings, setSettings] = useState<SupportSettings>(getLocalSupportSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [aiLogs, setAiLogs] = useState<AIActivityLog[]>([]);
  const [approvals, setApprovals] = useState<AIApprovalAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'human' | 'resolved'>('all');
  const [activeSubTab, setActiveSubTab] = useState<AISubTab>('dashboard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load all support & AI data
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [freshSettings, freshConvs, freshLogs, freshApprovals] = await Promise.all([
        getSupportSettings(),
        getAllSupportConversations(),
        getAIActivityLogs(50),
        getAIApprovalActions()
      ]);

      setSettings(freshSettings);
      setConversations(freshConvs);
      setAiLogs(freshLogs);
      setApprovals(freshApprovals);

      if (!selectedConvId && freshConvs.length > 0) {
        setSelectedConvId(freshConvs[0].id);
      }
    } catch (err) {
      console.error('Error loading AI support data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 5s for realtime live monitoring
    const timer = setInterval(() => {
      loadData(true);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Fetch messages when selected conversation changes in Inbox
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    getSupportMessages(selectedConvId).then((list) => {
      setMessages(list);
    });

    updateSupportConversation(selectedConvId, { unreadByAdmin: false });
  }, [selectedConvId]);

  // Handle setting updates
  const handleUpdateSettings = async (updates: Partial<SupportSettings>) => {
    setIsSavingSettings(true);
    const newSettings: SupportSettings = {
      ...settings,
      ...updates
    };

    setSettings(newSettings);

    try {
      await saveSupportSettings(updates);
      if (updates.aiStatusMode) {
        showToast(`AI Status updated: ${updates.aiStatusMode.toUpperCase()}`);
      } else if (updates.aiAssistantEnabled !== undefined) {
        showToast(
          updates.aiAssistantEnabled
            ? 'AI Assistant enabled: AI will now answer new customer queries.'
            : 'AI Assistant disabled: All inquiries strictly routed to Human Support.'
        );
      } else {
        showToast('Settings saved successfully.');
      }
    } catch (err) {
      console.error('Error saving support settings:', err);
      showToast('Failed to save settings to database.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Fast AI Smart Reply Draft for Admin
  const handleGenerateAIReply = async () => {
    if (!selectedConvId || isGeneratingAIDraft) return;

    const lastCustomerMsg = [...messages].reverse().find((m) => m.sender === 'customer');
    const customerPrompt = lastCustomerMsg?.text || 'আমাদের প্রোডাক্ট ও সার্ভিস সম্পর্কে জানতে চাই';

    setIsGeneratingAIDraft(true);

    try {
      const kb = getLocalAIKnowledgeBase();
      const catalog = getLocalProductsCache();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/support/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: customerPrompt,
          userMessage: customerPrompt,
          isBangla: true,
          catalogContext: catalog,
          knowledgeBase: kb,
          conversationHistory: messages.slice(-8).map((m) => ({
            sender: m.sender === 'customer' ? 'customer' : 'admin',
            text: m.text
          }))
        })
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      const draft = data?.text || data?.reply;
      if (draft && draft.trim()) {
        setReplyText(draft.trim());
        showToast('✨ AI বুদ্ধিমান উত্তরের খসড়া প্রস্তুত করেছে!');
      } else {
        setReplyText('ধন্যবাদ যোগাযোগের জন্য! আপনার বিষয়টি আমরা দ্রুত সমাধান করছি।');
      }
    } catch {
      setReplyText('ধন্যবাদ যোগাযোগের জন্য! আপনার বিষয়টি আমরা দ্রুত সমাধান করছি।');
      showToast('দ্রুত উত্তরের খসড়া যুক্ত করা হয়েছে!');
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  // Admin live reply handler (Optimistic 0ms UI update!)
  const handleSendAdminReply = () => {
    if (!replyText.trim() || !selectedConvId) return;

    const currentConv = conversations.find((c) => c.id === selectedConvId);
    if (!currentConv) return;

    const textToSend = replyText.trim();
    setReplyText('');

    const optimisticId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = { seconds: Math.floor(Date.now() / 1000) };

    const newMsg: SupportMessage = {
      id: optimisticId,
      conversationId: selectedConvId,
      sessionId: currentConv.sessionId,
      sender: 'admin',
      senderName: 'Admin Support Agent',
      text: textToSend,
      createdAt: now
    };

    // 1. Update UI immediately (0ms)
    setMessages((prev) => {
      const map = new Map<string, SupportMessage>();
      prev.forEach((m) => m.id && map.set(m.id, m));
      map.set(newMsg.id, newMsg);
      return Array.from(map.values());
    });

    // 2. Mark takeover locally
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? {
              ...c,
              lastMessage: textToSend,
              lastSender: 'admin',
              unreadByAdmin: false,
              isTakenOverByAdmin: true
            }
          : c
      )
    );

    showToast('Reply sent directly to customer.');

    // 3. Persist in background asynchronously (passing matching ID)
    sendSupportMessage({
      id: optimisticId,
      conversationId: selectedConvId,
      sessionId: currentConv.sessionId,
      sender: 'admin',
      senderName: 'Admin Support Agent',
      text: textToSend
    }).catch((err) => {
      console.warn('Background save note:', err);
    });

    if (!currentConv.isTakenOverByAdmin) {
      updateSupportConversation(selectedConvId, {
        isTakenOverByAdmin: true,
        unreadByAdmin: false
      }).catch((err) => {
        console.warn('Background takeover note:', err);
      });
    }
  };

  // Toggle Human Agent Takeover
  const handleToggleTakeover = async (convId: string, currentStatus: boolean) => {
    try {
      await updateSupportConversation(convId, {
        isTakenOverByAdmin: !currentStatus
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, isTakenOverByAdmin: !currentStatus } : c))
      );

      showToast(
        !currentStatus
          ? 'Conversation taken over by Human Agent. AI is muted for this customer.'
          : 'Conversation released. AI can respond if enabled.'
      );
    } catch (err) {
      console.error('Error updating takeover:', err);
    }
  };

  // Toggle Resolved status
  const handleToggleResolved = async (convId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'open' : 'resolved';
    try {
      await updateSupportConversation(convId, {
        status: nextStatus as any
      });

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status: nextStatus as any } : c))
      );

      showToast(
        nextStatus === 'resolved'
          ? 'Conversation marked as Resolved.'
          : 'Conversation reopened.'
      );
    } catch (err) {
      console.error('Error resolving conversation:', err);
    }
  };

  // Compute key stats
  const totalConvs = conversations.length;
  const unreadCount = conversations.filter((c) => c.unreadByAdmin).length;
  const unresolvedCount = conversations.filter((c) => c.status !== 'resolved').length;
  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;
  const products = getLocalProductsCache();
  const lowStockCount = products.filter(
    (p) => p.totalStock !== undefined && p.totalStock <= 5
  ).length;
  const orders = getLocalOrdersCache();

  // Filter conversations for inbox
  const filteredConversations = conversations.filter((c) => {
    if (statusFilter === 'open' && c.status === 'resolved') return false;
    if (statusFilter === 'resolved' && c.status !== 'resolved') return false;
    if (statusFilter === 'human' && !c.isTakenOverByAdmin) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.customerName?.toLowerCase().includes(q);
      const matchPhone = c.customerPhone?.includes(q);
      const matchLastMsg = c.lastMessage?.toLowerCase().includes(q);
      const matchSession = c.sessionId.toLowerCase().includes(q);
      return matchName || matchPhone || matchLastMsg || matchSession;
    }

    return true;
  });

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-[#162B23] text-white text-xs font-semibold rounded-xl shadow-2xl border border-[#8FA89B]/40 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Module Header & Sub-Navigation */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#1E3A2F]" />
              <h1 className="text-xl font-black text-[#1A1E1C] tracking-tight">
                Website AI Manager — Smart Assistant
              </h1>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Comprehensive e-commerce intelligence: customer support, order fulfillment, inventory monitoring & knowledge base.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                settings.aiAssistantEnabled && settings.aiStatusMode !== 'disabled' && settings.aiStatusMode !== 'paused'
                  ? 'bg-emerald-100 text-emerald-800'
                  : settings.aiStatusMode === 'paused'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {settings.aiAssistantEnabled && settings.aiStatusMode !== 'disabled' && settings.aiStatusMode !== 'paused'
                ? '🟢 Active'
                : settings.aiStatusMode === 'paused'
                ? '🟡 Paused'
                : '⚪ Disabled'}
            </span>

            <button
              onClick={() => loadData()}
              className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-600 transition-colors cursor-pointer"
              title="Refresh AI Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inbox')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'inbox'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Customer Chat</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-stone-900 text-[10px] rounded-full font-black animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('knowledge-base')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'knowledge-base'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
          </button>

          <button
            onClick={() => setActiveSubTab('order-monitoring')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'order-monitoring'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Order Fulfillment</span>
          </button>

          <button
            onClick={() => setActiveSubTab('inventory-monitoring')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'inventory-monitoring'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Inventory Health</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[10px] rounded-full font-black">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('approval-queue')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'approval-queue'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Action Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-purple-600 text-white text-[10px] rounded-full font-black animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('notifications-reports')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'notifications-reports'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Reports & Alerts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ai-logs')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'ai-logs'
                ? 'bg-[#1E3A2F] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity Logs</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: AI Assistant Dashboard (Overview) */}
      {activeSubTab === 'dashboard' && (
        <AIDashboardOverview
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          stats={{
            totalConversations: totalConvs,
            unansweredCount: unreadCount,
            unresolvedCount: unresolvedCount,
            pendingApprovalsCount,
            lowStockCount,
            totalOrders: orders.length,
            aiLogsCount: aiLogs.length
          }}
          recentLogs={aiLogs}
          onNavigateSubTab={(tab) => setActiveSubTab(tab as AISubTab)}
          onRefresh={() => loadData()}
          isLoading={isLoading}
        />
      )}

      {/* SUB-TAB 2: Knowledge Base Manager */}
      {activeSubTab === 'knowledge-base' && (
        <AIKnowledgeBaseTab onShowToast={showToast} />
      )}

      {/* SUB-TAB 3: Order Monitoring */}
      {activeSubTab === 'order-monitoring' && (
        <AIOrderMonitoringTab onShowToast={showToast} />
      )}

      {/* SUB-TAB 4: Inventory & Quality Monitoring */}
      {activeSubTab === 'inventory-monitoring' && (
        <AIInventoryMonitoringTab onShowToast={showToast} />
      )}

      {/* SUB-TAB 5: Action Approvals Queue */}
      {activeSubTab === 'approval-queue' && (
        <AIApprovalsTab
          onShowToast={showToast}
          onRefreshStats={() => loadData(true)}
        />
      )}

      {/* SUB-TAB 6: Notifications & Reports */}
      {activeSubTab === 'notifications-reports' && (
        <AINotificationsReportsTab
          onShowToast={showToast}
          onNavigateSubTab={(tab) => setActiveSubTab(tab as AISubTab)}
        />
      )}

      {/* SUB-TAB 7: Support Inbox & Live Human Takeover */}
      {activeSubTab === 'inbox' && (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl shadow-xs overflow-hidden flex flex-col lg:flex-row min-h-[620px]">
          {/* Left: Conversation List */}
          <div className="w-full lg:w-80 border-r border-stone-200 flex flex-col bg-stone-50/40">
            {/* Search & Filter */}
            <div className="p-3.5 border-b border-stone-200 space-y-2.5 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer, phone, message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-[#FAF8F5] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>

              <div className="flex items-center gap-1">
                {(['all', 'open', 'human', 'resolved'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg capitalize transition-colors cursor-pointer ${
                      statusFilter === filter
                        ? 'bg-[#1E3A2F] text-white'
                        : 'text-stone-600 hover:bg-stone-200/60'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  No conversations matching criteria.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === selectedConvId;
                  const isTakenOver = conv.isTakenOverByAdmin;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`p-3.5 transition-colors cursor-pointer relative ${
                        isSelected
                          ? 'bg-white border-l-4 border-l-[#1E3A2F]'
                          : 'hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-xs text-stone-900 truncate">
                            {conv.customerName || 'Guest Customer'}
                          </span>
                          {conv.unreadByAdmin && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
                          )}
                        </div>

                        <span className="text-[10px] text-stone-400 font-mono shrink-0">
                          {conv.updatedAt?.seconds
                            ? new Date(conv.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>

                      <p className="text-xs text-stone-500 truncate mb-1.5" title={conv.lastMessage}>
                        {conv.lastSender === 'customer' ? 'Customer: ' : conv.lastSender === 'admin' ? 'Agent: ' : 'AI: '}
                        {conv.lastMessage || 'No messages yet'}
                      </p>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                            conv.status === 'resolved'
                              ? 'bg-stone-200 text-stone-600'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {conv.status}
                        </span>

                        {isTakenOver && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 flex items-center gap-0.5">
                            <UserCheck className="w-2.5 h-2.5" />
                            <span>Human Agent</span>
                          </span>
                        )}

                        {conv.customerPhone && (
                          <span className="text-[10px] text-stone-400 font-mono ml-auto">
                            {conv.customerPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Conversation Dialogue */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedConv ? (
              <>
                {/* Thread Header */}
                <div className="p-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1E3A2F] text-white flex items-center justify-center font-bold text-sm">
                      {selectedConv.customerName ? selectedConv.customerName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-stone-900">
                        {selectedConv.customerName || 'Guest Customer'}
                      </h3>
                      <p className="text-[11px] text-stone-500 font-mono">
                        {selectedConv.customerPhone || selectedConv.customerEmail || `Session: ${selectedConv.sessionId.slice(-8)}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions: Takeover & Resolve */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleTakeover(selectedConv.id, selectedConv.isTakenOverByAdmin)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        selectedConv.isTakenOverByAdmin
                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      title={
                        selectedConv.isTakenOverByAdmin
                          ? 'You are managing this conversation. Click to release back to AI.'
                          : 'Take over from AI to chat directly with customer.'
                      }
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{selectedConv.isTakenOverByAdmin ? 'Human Active (Mute AI)' : 'Take Over Chat'}</span>
                    </button>

                    <button
                      onClick={() => handleToggleResolved(selectedConv.id, selectedConv.status)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        selectedConv.status === 'resolved'
                          ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{selectedConv.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}</span>
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/60 max-h-[460px]">
                  {messages.length === 0 ? (
                    <div className="py-12 text-center text-stone-400 text-xs">
                      No messages recorded in this conversation yet.
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isCustomer = msg.sender === 'customer';
                      const isAi = msg.sender === 'ai';
                      const isAdmin = msg.sender === 'admin';
                      const isSystem = msg.sender === 'system';

                      return (
                        <div
                          key={`${msg.id || 'sup-msg'}-${idx}`}
                          className={`flex flex-col ${
                            isCustomer ? 'items-start' : isSystem ? 'items-center' : 'items-end'
                          }`}
                        >
                          <span className="text-[10px] text-stone-400 font-bold mb-1 px-1">
                            {msg.senderName || msg.sender.toUpperCase()}
                          </span>

                          <div
                            className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                              isCustomer
                                ? 'bg-white border border-stone-200 text-stone-900 rounded-tl-xs'
                                : isAdmin
                                ? 'bg-[#1E3A2F] text-white rounded-tr-xs'
                                : isAi
                                ? 'bg-[#2D5042] text-white rounded-tr-xs'
                                : 'bg-stone-200/80 text-stone-700 italic rounded-xl text-center text-[11px]'
                            }`}
                          >
                            {msg.text}
                          </div>

                          <span className="text-[9px] text-stone-400 font-mono mt-1 px-1">
                            {msg.createdAt?.seconds
                              ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Canned Responses with AI Draft */}
                <div className="p-2 border-t border-stone-100 bg-stone-50 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  <button
                    type="button"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingAIDraft}
                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-black shrink-0 flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    title="AI দিয়ে কাস্টমারের জন্য খসড়া উত্তর তৈরি করুন"
                  >
                    <Sparkles className={`w-3 h-3 text-amber-300 ${isGeneratingAIDraft ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAIDraft ? 'AI ভাবছে...' : '✨ AI স্মার্ট ড্রাফট'}</span>
                  </button>

                  <span className="text-stone-400 font-bold text-[10px] uppercase shrink-0 px-1 border-l border-stone-300">Quick:</span>
                  <button
                    onClick={() => setReplyText('আপনার অর্ডারটি সফলভাবে চেক করা হয়েছে এবং শিঘ্রই পাঠানো হবে।')}
                    className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 rounded-lg shrink-0 cursor-pointer text-stone-700"
                  >
                    অর্ডার প্রস্তুত
                  </button>
                  <button
                    onClick={() => setReplyText('Inside Dhaka ডেলিভারি ২-৩ কার্যদিবস এবং Outside Dhaka ৩-৫ কার্যদিবস সময় লাগে।')}
                    className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 rounded-lg shrink-0 cursor-pointer text-stone-700"
                  >
                    ডেলিভারি টাইম
                  </button>
                  <button
                    onClick={() => setReplyText('আমরা ৭ দিনের মধ্যে সাইজ বা ডিফেক্ট এক্সচেঞ্জের সুবিধা প্রদান করি।')}
                    className="px-2 py-1 bg-white border border-stone-200 hover:border-stone-400 rounded-lg shrink-0 cursor-pointer text-stone-700"
                  >
                    রিপ্লেসমেন্ট পলিসি
                  </button>
                </div>

                {/* Reply Input Bar */}
                <div className="p-3.5 border-t border-stone-200 bg-white flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAdminReply()}
                    placeholder="Write a direct human reply to the customer..."
                    className="flex-1 text-xs p-2.5 rounded-xl border border-stone-200 focus:border-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
                  />

                  <button
                    onClick={handleSendAdminReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1E3A2F] text-white text-xs font-bold rounded-xl hover:bg-[#2D5042] transition-colors shadow-xs cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-stone-400 text-xs">
                <MessageSquare className="w-8 h-8 text-stone-300 mb-2" />
                <p>Select a conversation from the left to view messages and reply.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 8: AI Activity Logs */}
      {activeSubTab === 'ai-logs' && (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-black text-[#1A1E1C]">
                AI Assistant Execution Audit Logs ({aiLogs.length})
              </h3>
              <p className="text-xs text-stone-500">
                Transparent activity stream of customer prompts, generated replies, grounding hits, and human handovers.
              </p>
            </div>

            <button
              onClick={() => loadData()}
              className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-600 transition-colors cursor-pointer"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {aiLogs.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              No AI activity logs found. Turn AI ON in the Dashboard to start automated customer dialogue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    <th className="p-3 font-bold">Timestamp</th>
                    <th className="p-3 font-bold">Session ID</th>
                    <th className="p-3 font-bold">Customer Query</th>
                    <th className="p-3 font-bold">AI Response</th>
                    <th className="p-3 font-bold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {aiLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50/60">
                      <td className="p-3 text-[11px] font-mono text-stone-500 whitespace-nowrap">
                        {log.timestamp?.seconds
                          ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                          : new Date(log.timestamp || 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                        {log.conversationId ? log.conversationId.slice(0, 10) : '—'}...
                      </td>
                      <td className="p-3 font-medium text-stone-800 max-w-xs truncate" title={log.query}>
                        {log.query}
                      </td>
                      <td className="p-3 text-stone-600 max-w-md truncate" title={log.response}>
                        {log.response}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
