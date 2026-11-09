import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  CheckCircle2,
  Clock,
  User,
  RefreshCw,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  Headphones,
  Check,
  AlertCircle,
  Copy,
  ArrowRight,
  Filter,
  UserCheck
} from 'lucide-react';
import {
  getAllSupportConversations,
  getSupportMessages,
  sendSupportMessage,
  updateSupportConversation,
  getSupportSettings,
  getLocalSupportConversations,
  getLocalAIKnowledgeBase,
  getLocalProductsCache
} from '../../firebase/db';
import type { SupportConversation, SupportMessage, SupportSettings } from '../../types';

interface AdminCustomerChatProps {
  onNavigateToAISettings?: () => void;
}

export const AdminCustomerChat: React.FC<AdminCustomerChatProps> = ({
  onNavigateToAISettings
}) => {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'resolved'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [supportSettings, setSupportSettings] = useState<SupportSettings | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Quick reply canned templates
  const quickReplies = [
    {
      title: '📦 Delivery Status',
      bn: 'ডেলিভারি সংক্রান্ত',
      text: 'আপনার অর্ডারটি প্রসেসিং শেষ হয়েছে এবং খুব শীঘ্রই ডেলিভারির জন্য পাঠানো হবে। ট্র্যাকিং আইডি দিয়ে আপনি ট্র্যাক করতে পারবেন।'
    },
    {
      title: '💳 Payment Confirm',
      bn: 'পেমেন্ট কনফার্মেশন',
      text: 'আপনার পেমেন্ট আমরা সফলভাবে পেয়েছি এবং ভেরিফাই করা হয়েছে। ধন্যবাদ!'
    },
    {
      title: '🔍 Product Stock',
      bn: 'স্টক তথ্য',
      text: 'এই প্রোডাক্টটি বর্তমানে আমাদের স্টকে অ্যাভেইলএবল রয়েছে। আপনি এখনই অর্ডার প্লেস করতে পারেন।'
    },
    {
      title: '🔄 Return Policy',
      bn: 'রিটার্ন পলিসি',
      text: 'পণ্যটি ডেলিভারি পাওয়ার ৭ দিনের মধ্যে অক্ষত অবস্থায় থাকলে সহজে এক্সচেঞ্জ অথবা রিটার্ন করা যাবে।'
    },
    {
      title: '✅ Problem Resolved',
      bn: 'সমাধান সম্পন্ন',
      text: 'আপনার সমস্যার সমাধান করা হয়েছে। আমাদের সাথে থাকার জন্য ধন্যবাদ! আর কোনো প্রয়োজন হলে জানাবেন।'
    }
  ];

  // Load conversations
  const loadConversations = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [convList, settings] = await Promise.all([
        getAllSupportConversations(),
        getSupportSettings()
      ]);

      setConversations(convList);
      setSupportSettings(settings);

      // Auto-select first if none is selected
      if (!selectedConvId && convList.length > 0) {
        setSelectedConvId(convList[0].id);
      }
    } catch (err) {
      console.error('Failed to load customer conversations:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();

    // Auto poll every 4 seconds for live customer replies
    const interval = setInterval(() => {
      loadConversations(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Fetch messages for active conversation
  const loadMessages = async (convId: string) => {
    try {
      const list = await getSupportMessages(convId);
      setMessages(list);

      // Mark unread as cleared when opened by admin
      await updateSupportConversation(convId, { unreadByAdmin: false });

      // Update local state to remove badge immediately
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadByAdmin: false } : c))
      );
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // AI Smart Suggestion for Admin Reply (Ultra fast, drafts directly into reply box)
  const handleGenerateAIReply = async () => {
    if (!selectedConvId || isGeneratingAIDraft) return;

    // Find the latest message from customer
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
        setReplyText('ধন্যবাদ আমাদের সাথে যোগাযোগের জন্য! আপনার বিষয়টি আমরা গুরুত্বের সাথে দেখছি এবং দ্রুত সমাধান করছি।');
      }
    } catch {
      setReplyText('ধন্যবাদ আমাদের সাথে যোগাযোগের জন্য! আপনার বিষয়টি আমরা গুরুত্বের সাথে দেখছি এবং দ্রুত সমাধান করছি।');
      showToast('দ্রুত উত্তরের খসড়া যুক্ত করা হয়েছে!');
    } finally {
      setIsGeneratingAIDraft(false);
      textareaRef.current?.focus();
    }
  };

  // Send admin reply (Optimistic 0ms UI update!)
  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConvId) return;

    const currentConv = conversations.find((c) => c.id === selectedConvId);
    if (!currentConv) return;

    const content = replyText.trim();
    setReplyText('');

    const optimisticId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = { seconds: Math.floor(Date.now() / 1000) };

    const newMsg: SupportMessage = {
      id: optimisticId,
      conversationId: selectedConvId,
      sessionId: currentConv.sessionId,
      sender: 'admin',
      senderName: 'Support Team (Admin)',
      text: content,
      createdAt: now
    };

    // 1. Update UI immediately (0ms latency!)
    setMessages((prev) => {
      const map = new Map<string, SupportMessage>();
      prev.forEach((m) => m.id && map.set(m.id, m));
      map.set(newMsg.id, newMsg);
      return Array.from(map.values());
    });

    // 2. Update conversation list immediately (0ms)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? {
              ...c,
              lastMessage: content,
              lastSender: 'admin',
              unreadByAdmin: false,
              isTakenOverByAdmin: true
            }
          : c
      )
    );

    showToast('উত্তর পাঠানো হয়েছে (Reply sent)');
    textareaRef.current?.focus();

    // 3. Persist in background asynchronously without blocking UI (passing matching ID)
    sendSupportMessage({
      id: optimisticId,
      conversationId: selectedConvId,
      sessionId: currentConv.sessionId,
      sender: 'admin',
      senderName: 'Support Team (Admin)',
      text: content
    }).catch((err) => {
      console.warn('Background save admin message note:', err);
    });

    updateSupportConversation(selectedConvId, {
      isTakenOverByAdmin: true,
      unreadByAdmin: false,
      status: 'open'
    }).catch((err) => {
      console.warn('Background update conversation note:', err);
    });
  };

  // Toggle resolve status
  const handleToggleResolve = async () => {
    if (!selectedConvId) return;
    const currentConv = conversations.find((c) => c.id === selectedConvId);
    if (!currentConv) return;

    const newStatus = currentConv.status === 'resolved' ? 'open' : 'resolved';

    try {
      await updateSupportConversation(selectedConvId, { status: newStatus });
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConvId ? { ...c, status: newStatus } : c))
      );
      showToast(
        newStatus === 'resolved'
          ? 'Conversation marked as Resolved (সমস্যা সমাধান চিহ্নিত)'
          : 'Conversation Reopened (কথোপকথন পুনরায় চালু)'
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Take over conversation
  const handleTakeOver = async () => {
    if (!selectedConvId) return;
    try {
      await updateSupportConversation(selectedConvId, {
        isTakenOverByAdmin: true,
        status: 'open'
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConvId ? { ...c, isTakenOverByAdmin: true } : c))
      );
      showToast('Conversation taken over by Admin. AI will not respond here.');
    } catch (err) {
      console.error('Failed to take over conversation:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Status filter
    if (statusFilter === 'pending') {
      if (!c.unreadByAdmin && c.lastSender === 'admin') return false;
      if (c.status === 'resolved') return false;
    } else if (statusFilter === 'active') {
      if (c.status === 'resolved') return false;
    } else if (statusFilter === 'resolved') {
      if (c.status !== 'resolved') return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.customerName?.toLowerCase().includes(q);
      const matchPhone = c.customerPhone?.toLowerCase().includes(q);
      const matchEmail = c.customerEmail?.toLowerCase().includes(q);
      const matchMsg = c.lastMessage?.toLowerCase().includes(q);
      const matchSession = c.sessionId?.toLowerCase().includes(q);
      return matchName || matchPhone || matchEmail || matchMsg || matchSession;
    }

    return true;
  });

  const selectedConv = conversations.find((c) => c.id === selectedConvId);
  const unreadTotal = conversations.filter((c) => c.unreadByAdmin).length;
  const pendingTotal = conversations.filter((c) => c.status !== 'resolved' && (c.unreadByAdmin || c.lastSender === 'customer')).length;
  const resolvedTotal = conversations.filter((c) => c.status === 'resolved').length;

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(date.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#162B23] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-[#8FA89B]/40 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <Check className="w-4 h-4 text-[#8FA89B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E5DFD7] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1E3A2F] text-white shadow-xs">
              <MessageSquare className="w-5 h-5 text-[#8FA89B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#1A1E1C]">Customer Live Chat & Problem Resolution</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8FA89B]/20 text-[#1E3A2F]">
                  Admin Support Desk
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                কাস্টমারদের সাথে সরাসরি কথা বলুন, প্রশ্নের উত্তর দিন ও সমস্যা সমাধান করুন (Talk directly with customers and resolve issues).
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E5DFD7] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-stone-600">AI Status:</span>
            <span className={`font-black ${supportSettings?.aiAssistantEnabled ? 'text-purple-600' : 'text-stone-700'}`}>
              {supportSettings?.aiAssistantEnabled ? 'Enabled' : 'Disabled (Human Only)'}
            </span>
          </div>

          {onNavigateToAISettings && (
            <button
              onClick={onNavigateToAISettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Settings</span>
            </button>
          )}

          <button
            onClick={() => loadConversations(false)}
            className="p-2 rounded-xl border border-[#E5DFD7] hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            title="Refresh All Chats"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1E3A2F]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 3-Column / 2-Column Chat Desk */}
      <div className="bg-white rounded-2xl border border-[#E5DFD7] shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        
        {/* Left Column: Conversations List (4 of 12 cols) */}
        <div className="lg:col-span-4 border-r border-[#E5DFD7] flex flex-col bg-[#FDFCFB]">
          
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-[#E5DFD7] space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, phone, message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5DFD7] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#1E3A2F]"
              />
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1 bg-[#F5F2EC] p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center ${
                  statusFilter === 'all'
                    ? 'bg-white text-[#1A1E1C] shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <span>Pending</span>
                {pendingTotal > 0 && (
                  <span className={`px-1 rounded-full text-[9px] ${statusFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                    {pendingTotal}
                  </span>
                )}
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center ${
                  statusFilter === 'active'
                    ? 'bg-[#1E3A2F] text-white shadow-2xs font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`flex-1 py-1 px-2 rounded-lg transition-all cursor-pointer text-center ${
                  statusFilter === 'resolved'
                    ? 'bg-white text-[#1A1E1C] shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Done ({resolvedTotal})
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E5DFD7]/60 max-h-[600px]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-stone-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="text-xs font-semibold">কোনো কথোপকথন পাওয়া যায়নি</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  {searchQuery ? 'Try another search keyword' : 'No customer messages in this filter'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const isUnread = conv.unreadByAdmin;
                const isPendingHuman = conv.lastSender === 'customer' || isUnread;

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-3.5 transition-colors cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#EBF2EE] border-l-4 border-l-[#1E3A2F]'
                        : isUnread
                        ? 'bg-amber-50/70 hover:bg-amber-100/60'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isUnread
                            ? 'bg-amber-500 text-white'
                            : conv.status === 'resolved'
                            ? 'bg-stone-200 text-stone-600'
                            : 'bg-[#1E3A2F] text-white'
                        }`}>
                          {conv.customerName ? conv.customerName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs truncate ${isUnread ? 'font-black text-stone-900' : 'font-bold text-stone-800'}`}>
                              {conv.customerName || `Customer #${conv.sessionId.substring(0, 6)}`}
                            </span>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                          {conv.customerPhone && (
                            <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                              <Phone className="w-2.5 h-2.5 text-stone-400" />
                              {conv.customerPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-stone-400 whitespace-nowrap shrink-0">
                        {formatTimestamp(conv.updatedAt)}
                      </span>
                    </div>

                    {/* Last message preview */}
                    <div className="mt-2 text-[11px] text-stone-600 line-clamp-1">
                      <span className="font-semibold text-stone-500">
                        {conv.lastSender === 'customer'
                          ? 'Customer: '
                          : conv.lastSender === 'admin'
                          ? 'You: '
                          : conv.lastSender === 'ai'
                          ? 'AI: '
                          : ''}
                      </span>
                      {conv.lastMessage || 'No message yet'}
                    </div>

                    {/* Status badges */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {conv.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600">
                          <CheckCircle2 className="w-3 h-3 text-stone-500" />
                          Resolved
                        </span>
                      ) : isPendingHuman ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Needs Reply
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          <Headphones className="w-3 h-3 text-emerald-600" />
                          Replied
                        </span>
                      )}

                      {conv.isTakenOverByAdmin && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1E3A2F]/10 text-[#1E3A2F]">
                          Admin Active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Live Chat Screen (8 of 12 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-white">
          {selectedConv ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-4 border-b border-[#E5DFD7] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1E3A2F] text-white flex items-center justify-center font-bold text-sm">
                    {selectedConv.customerName ? selectedConv.customerName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-stone-900">
                        {selectedConv.customerName || `Customer #${selectedConv.sessionId.substring(0, 8)}`}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedConv.status === 'resolved'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {selectedConv.status === 'resolved' ? 'Resolved' : 'Active Conversation'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-0.5 flex-wrap">
                      {selectedConv.customerPhone && (
                        <button
                          onClick={() => copyToClipboard(selectedConv.customerPhone!, 'Phone')}
                          className="inline-flex items-center gap-1 hover:text-stone-800 cursor-pointer"
                        >
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{selectedConv.customerPhone}</span>
                          <Copy className="w-2.5 h-2.5 text-stone-400" />
                        </button>
                      )}
                      {selectedConv.customerEmail && (
                        <button
                          onClick={() => copyToClipboard(selectedConv.customerEmail!, 'Email')}
                          className="inline-flex items-center gap-1 hover:text-stone-800 cursor-pointer"
                        >
                          <Mail className="w-3 h-3 text-stone-400" />
                          <span>{selectedConv.customerEmail}</span>
                          <Copy className="w-2.5 h-2.5 text-stone-400" />
                        </button>
                      )}
                      <span className="text-[10px] text-stone-400 font-mono">
                        Session: {selectedConv.sessionId.substring(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conversation Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleResolve}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedConv.status === 'resolved'
                        ? 'bg-stone-800 hover:bg-black text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedConv.status === 'resolved' ? 'Reopen Thread' : 'Mark Resolved'}</span>
                  </button>

                  {!selectedConv.isTakenOverByAdmin && (
                    <button
                      onClick={handleTakeOver}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A2F] text-white hover:bg-[#162B23] text-xs font-bold transition-all cursor-pointer"
                      title="Take over so AI does not reply"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#8FA89B]" />
                      <span>Take Over</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[460px] bg-[#FAF8F5]/50">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="text-xs font-semibold">No messages in this conversation yet</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isAdmin = msg.sender === 'admin';
                    const isAi = msg.sender === 'ai';
                    const isCustomer = msg.sender === 'customer';

                    return (
                      <div
                        key={`${msg.id || 'admin-msg'}-${idx}`}
                        className={`flex flex-col ${isAdmin ? 'items-end' : isCustomer ? 'items-start' : 'items-center'}`}
                      >
                        {/* Sender Label */}
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-500">
                          {isAdmin ? (
                            <span className="font-bold text-[#1E3A2F] flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-[#1E3A2F]" />
                              {msg.senderName || 'Admin (You)'}
                            </span>
                          ) : isAi ? (
                            <span className="font-bold text-purple-700 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              AI Assistant
                            </span>
                          ) : (
                            <span className="font-bold text-stone-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-stone-500" />
                              {msg.senderName || selectedConv.customerName || 'Customer'}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400">• {formatTimestamp(msg.createdAt)}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed whitespace-pre-wrap ${
                            isAdmin
                              ? 'bg-[#1E3A2F] text-white rounded-tr-xs'
                              : isAi
                              ? 'bg-purple-50 text-purple-950 border border-purple-200/60 rounded-tl-xs'
                              : 'bg-white text-stone-900 border border-[#E5DFD7] rounded-tl-xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Replies Bar (এক ক্লিকে উত্তর ও AI ড্রাফট) */}
              <div className="px-4 py-2 bg-[#F7F4EE] border-t border-[#E5DFD7] flex items-center gap-2 overflow-x-auto scrollbar-thin">
                <button
                  type="button"
                  onClick={handleGenerateAIReply}
                  disabled={isGeneratingAIDraft}
                  className="shrink-0 px-3 py-1 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white rounded-lg text-[11px] font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="কাস্টমারের সর্বশেষ প্রশ্নের ওপর ভিত্তি করে AI দিয়ে স্বয়ংক্রিয় উত্তর তৈরি করুন"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isGeneratingAIDraft ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAIDraft ? 'AI ভাবছে...' : '✨ AI স্মার্ট উত্তর'}</span>
                </button>

                <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap shrink-0 flex items-center gap-1 pl-1 border-l border-stone-300">
                  ⚡ Quick:
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setReplyText(qr.text);
                      textareaRef.current?.focus();
                    }}
                    className="shrink-0 px-2.5 py-1 bg-white hover:bg-[#1E3A2F] hover:text-white text-stone-700 rounded-lg text-[11px] font-semibold border border-[#E5DFD7] transition-all cursor-pointer"
                    title={qr.text}
                  >
                    {qr.title}
                  </button>
                ))}
              </div>

              {/* Reply Input Form */}
              <div className="p-4 bg-white border-t border-[#E5DFD7]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendReply();
                  }}
                  className="space-y-2"
                >
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      placeholder="কাস্টমারের সমস্যার উত্তর লিখুন... (Type answer here, press Enter to send)"
                      className="w-full p-3 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#1E3A2F] focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-stone-400">
                      Press <kbd className="px-1 py-0.5 rounded bg-stone-100 border text-stone-600">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-stone-100 border text-stone-600">Shift+Enter</kbd> for new line
                    </span>

                    <button
                      type="submit"
                      disabled={!replyText.trim() || isSendingReply}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {isSendingReply ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-[#8FA89B]" />
                          <span>Send Reply (উত্তর পাঠান)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-400">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-stone-700">No Conversation Selected</h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Select a customer from the left conversation list to read their question and send a live answer.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
