import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Boxes,
  TrendingUp,
  Send,
  RefreshCw,
  Copy,
  Check,
  Search,
  Plus,
  MessageSquare,
  AlertTriangle,
  PackageCheck,
  Sparkles,
  Loader2,
  ShoppingBag
} from 'lucide-react';
import {
  getAllProductsAdmin,
  getAllOrders,
  getAllSupportConversations,
  getSupportMessages,
  getLocalProductsCache,
  getLocalOrdersCache,
  getLocalSupportConversations,
  getLocalSupportMessages
} from '../../firebase/db';
import type { Product, Order, SupportConversation, SupportMessage } from '../../types';
import type { AdminTab } from './AdminLayout';

interface AdminStockDemandAIProps {
  onNavigateTab?: (tab: AdminTab) => void;
}

interface ChatMessage {
  id: string;
  role: 'admin' | 'ai';
  text: string;
  timestamp: Date;
}

interface StockDemandAnalytics {
  totalProducts: number;
  activeProducts: number;
  totalUnits: number;
  outOfStockItems: {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    sizes: string;
  }[];
  lowStockItems: {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    sizes: string;
  }[];
  healthyStockItems: {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    sizes: string;
  }[];
  categoryBreakdown: {
    category: string;
    itemCount: number;
    totalUnits: number;
    outOfStockCount: number;
    lowStockCount: number;
  }[];
  topOrderedProducts: {
    name: string;
    totalQty: number;
    orderCount: number;
    currentStock: number | null;
  }[];
  newProductDemands: {
    topic: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[];
  outOfStockDemands: {
    productName: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[];
  existingProductDemands: {
    matchedProduct: string;
    requestedVariant: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[];
  otherCustomerRequests: {
    quote: string;
    customerName: string;
    timestamp: string;
  }[];
  totalAnalyzedInquiries: number;
}

const QUICK_PROMPTS = [
  'আমার স্টকের সকল খবরা-খবর জানাও',
  'কোন কোন প্রোডাক্টের স্টক কম বা শেষ হয়ে গেছে?',
  'নতুন কোন জিনিসের কোনো ডিমান্ড আছে নাকি?',
  'কাস্টমারদের ডিমান্ড কী? কাস্টমাররা কী কী চাচ্ছে?',
  'কোন ক্যাটাগরিতে কতগুলো স্টক আছে?',
  'বেশি অর্ডার হচ্ছে কোনগুলো আর কোনটা রিস্টক করব?'
];

export const AdminStockDemandAI: React.FC<AdminStockDemandAIProps> = () => {
  const [products, setProducts] = useState<Product[]>(() => getLocalProductsCache());
  const [orders, setOrders] = useState<Order[]>(() => getLocalOrdersCache());
  const [inquiries, setInquiries] = useState<
    { text: string; customerName: string; timestamp: string }[]
  >([]);
  const [analytics, setAnalytics] = useState<StockDemandAnalytics | null>(null);
  const [isSyncingData, setIsSyncingData] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [inspectorTab, setInspectorTab] = useState<'demands' | 'stock'>('demands');
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low'>('all');
  const [stockSearch, setStockSearch] = useState<string>('');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-stock-ai',
      role: 'ai',
      text:
        'আসসালামু আলাইকুম এডমিন। আমি আপনার **Stock & Customer Demand AI**।\n\n' +
        'আমি আপনার স্টোরের দুটি বিষয়ের ওপর সার্বক্ষণিক নজর রাখি:\n' +
        '১. **স্টকের সকল খবরা-খবর:** কোন প্রোডাক্ট কত পিস বাকি আছে, কোনগুলোর স্টক কম (৫ পিস বা তার নিচে) এবং কোনগুলো আউট অফ স্টক (০ পিস)।\n' +
        '২. **কাস্টমারের ডিমান্ড ও নতুন চাহিদা:** লাইভ চ্যাটে কাস্টমাররা কোন কোন প্রোডাক্ট, সাইজ বা কালার খুঁজছে এবং এমন কোনো নতুন জিনিসের ডিমান্ড আছে কি না যা এখনো স্টোরে তোলা হয়নি।\n\n' +
        'আপনি নিচের যেকোনো প্রশ্ন বাছাই করতে পারেন অথবা সরাসরি বাংলা বা ইংরেজিতে জিজ্ঞাসা করতে পারেন। (নতুন প্রোডাক্ট সাইটে যোগ করতে ওপরের **AI Product Adder** বাটন ব্যবহার করুন।)',
      timestamp: new Date()
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const buildInquiriesList = (
    convs: SupportConversation[],
    msgs: SupportMessage[]
  ): { text: string; customerName: string; timestamp: string }[] => {
    const convById = new Map<string, SupportConversation>();
    convs.forEach((c) => convById.set(c.id, c));

    const combined: { text: string; customerName: string; timestamp: string }[] = [];

    for (const m of msgs) {
      if (m.sender === 'customer' && m.text && m.text.trim()) {
        const parentConv = convById.get(m.conversationId);
        const ts = m.createdAt?.seconds
          ? new Date(m.createdAt.seconds * 1000).toLocaleDateString([], {
              month: 'short',
              day: 'numeric'
            })
          : '';
        combined.push({
          text: m.text.trim(),
          customerName: m.senderName || parentConv?.customerName || 'Guest Customer',
          timestamp: ts
        });
      }
    }

    for (const c of convs) {
      if (
        c.lastMessage &&
        c.lastMessage.trim() &&
        c.lastMessage !== 'Conversation started' &&
        (c.lastSender === 'customer' || !c.lastSender)
      ) {
        const ts = c.updatedAt?.seconds
          ? new Date(c.updatedAt.seconds * 1000).toLocaleDateString([], {
              month: 'short',
              day: 'numeric'
            })
          : '';
        combined.push({
          text: c.lastMessage.trim(),
          customerName: c.customerName || 'Guest Customer',
          timestamp: ts
        });
      }
    }

    return combined;
  };

  const syncStoreIntelligence = async () => {
    setIsSyncingData(true);
    try {
      const [freshProducts, freshOrders, freshConvs] = await Promise.all([
        getAllProductsAdmin().catch(() => getLocalProductsCache()),
        getAllOrders().catch(() => getLocalOrdersCache()),
        getAllSupportConversations().catch(() => getLocalSupportConversations())
      ]);

      // Fetch messages for recent conversations so Firestore chats are included
      const recentConvIds = freshConvs.slice(0, 20).map((c) => c.id);
      const fetchedMsgLists = await Promise.all(
        recentConvIds.map((cid) => getSupportMessages(cid).catch(() => [] as SupportMessage[]))
      );

      const localMsgs = getLocalSupportMessages();
      const mergedMsgsMap = new Map<string, SupportMessage>();
      [...localMsgs, ...fetchedMsgLists.flat()].forEach((m) => {
        if (m && m.id) mergedMsgsMap.set(m.id, m);
      });

      const inquiryEntries = buildInquiriesList(freshConvs, Array.from(mergedMsgsMap.values()));

      setProducts(freshProducts);
      setOrders(freshOrders);
      setInquiries(inquiryEntries);

      // Compute initial live analytics from backend
      const serializedInventory = freshProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        subcategory: p.subcategory || '',
        brand: p.brand || '',
        price: p.salePrice || p.price || 0,
        totalStock: p.totalStock ?? 0,
        sizes: p.sizes || [],
        colors: p.colors || [],
        active: p.active !== false
      }));

      const res = await fetch('/api/ai/stock-demand-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'স্টকের অবস্থা কি',
          inventory: serializedInventory,
          orders: freshOrders.slice(0, 150),
          customerInquiries: inquiryEntries
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analytics) {
          setAnalytics(data.analytics);
        }
      }
    } catch (err) {
      console.warn('Sync stock & demand data error:', err);
    } finally {
      setIsSyncingData(false);
    }
  };

  useEffect(() => {
    syncStoreIntelligence();

    const handleRefreshEvent = () => {
      syncStoreIntelligence();
    };

    window.addEventListener('aesthetx-products-updated', handleRefreshEvent);
    window.addEventListener('aesthetx-orders-updated', handleRefreshEvent);
    window.addEventListener('aesthetx-support-convs-updated', handleRefreshEvent);
    window.addEventListener('aesthetx-support-msgs-updated', handleRefreshEvent);

    return () => {
      window.removeEventListener('aesthetx-products-updated', handleRefreshEvent);
      window.removeEventListener('aesthetx-orders-updated', handleRefreshEvent);
      window.removeEventListener('aesthetx-support-convs-updated', handleRefreshEvent);
      window.removeEventListener('aesthetx-support-msgs-updated', handleRefreshEvent);
    };
  }, []);

  const handleAskAI = async (customPrompt?: string) => {
    const queryText = (customPrompt || inputQuery).trim();
    if (!queryText || isSending) return;

    setInputQuery('');
    const adminMsg: ChatMessage = {
      id: `adm_${Date.now()}`,
      role: 'admin',
      text: queryText,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, adminMsg]);
    setIsSending(true);

    try {
      const serializedInventory = products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        subcategory: p.subcategory || '',
        brand: p.brand || '',
        price: p.salePrice || p.price || 0,
        totalStock: p.totalStock ?? 0,
        sizes: p.sizes || [],
        colors: p.colors || [],
        active: p.active !== false
      }));

      const res = await fetch('/api/ai/stock-demand-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          inventory: serializedInventory,
          orders: orders.slice(0, 150),
          customerInquiries: inquiries,
          conversationHistory: messages.slice(-4).map((m) => ({
            role: m.role,
            text: m.text
          }))
        })
      });

      const data = await res.json();
      if (data.analytics) {
        setAnalytics(data.analytics);
      }

      const replyText =
        data.success && data.text
          ? data.text
          : 'দুঃখিত, এই মুহূর্তে তথ্য বিশ্লেষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'ai',
          text: replyText,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.error('Stock & Demand AI request error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'ai',
          text: 'সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে পুনরায় প্রশ্নটি পাঠান।',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openPreviousProductAI = (prefillTopic?: string) => {
    window.dispatchEvent(
      new CustomEvent('aesthetx-open-product-ai', {
        detail: prefillTopic ? { topic: prefillTopic } : undefined
      })
    );
  };

  const totalUnits =
    analytics?.totalUnits ?? products.reduce((sum, p) => sum + (p.totalStock || 0), 0);
  const outOfStockCount =
    analytics?.outOfStockItems.length ??
    products.filter((p) => (p.totalStock || 0) <= 0).length;
  const lowStockCount =
    analytics?.lowStockItems.length ??
    products.filter((p) => (p.totalStock || 0) > 0 && (p.totalStock || 0) <= 5).length;
  const newDemandCount = analytics?.newProductDemands.length ?? 0;
  const totalInquiriesCount = analytics?.totalAnalyzedInquiries ?? inquiries.length;

  const filteredStockProducts = products.filter((p) => {
    const qty = p.totalStock || 0;
    if (stockFilter === 'out' && qty > 0) return false;
    if (stockFilter === 'low' && (qty <= 0 || qty > 5)) return false;
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1A1E1C] tracking-tight">
            Stock & Customer Demand AI
          </h1>
          <p className="text-xs text-[#626C66] mt-1">
            স্টকের সকল খবরা-খবর, রিস্টক অ্যালার্ট এবং লাইভ কাস্টমার চ্যাট থেকে নতুন পণ্যের ডিমান্ড বিশ্লেষণ
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={syncStoreIntelligence}
            disabled={isSyncingData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A2F] ${isSyncingData ? 'animate-spin' : ''}`} />
            <span>লাইভ ডেটা রিফ্রেশ</span>
          </button>

          <button
            type="button"
            onClick={() => openPreviousProductAI()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#8FA89B]" />
            <span>AI Product Adder (প্রোডাক্ট যোগ)</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4">
          <span className="text-xs font-semibold text-[#626C66] block">
            মোট মজুত স্টক (Total Stock)
          </span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#1A1E1C] font-mono tabular-nums">
              {totalUnits}
            </span>
            <span className="text-xs text-[#626C66] font-mono tabular-nums">
              {products.length} টি প্রোডাক্ট
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4">
          <span className="text-xs font-semibold text-[#626C66] block">
            রিস্টক সতর্কতা (Low / Out of Stock)
          </span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-2xl font-black font-mono tabular-nums ${
                outOfStockCount + lowStockCount > 0 ? 'text-[#C85A32]' : 'text-[#1E3A2F]'
              }`}
            >
              {outOfStockCount + lowStockCount}
            </span>
            <span className="text-xs text-[#626C66] font-mono tabular-nums">
              {outOfStockCount} শেষ · {lowStockCount} কম
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4">
          <span className="text-xs font-semibold text-[#626C66] block">
            নতুন জিনিসের ডিমান্ড (New Demands)
          </span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span
              className={`text-2xl font-black font-mono tabular-nums ${
                newDemandCount > 0 ? 'text-[#1E3A2F]' : 'text-[#1A1E1C]'
              }`}
            >
              {newDemandCount}
            </span>
            <span className="text-xs text-[#626C66]">
              {newDemandCount > 0 ? 'কাস্টমার নতুন পণ্য চেয়েছে' : 'নতুন চাহিদা পর্যবেক্ষণে'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4">
          <span className="text-xs font-semibold text-[#626C66] block">
            বিশ্লেষিত কাস্টমার প্রশ্ন (Inquiries)
          </span>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#1A1E1C] font-mono tabular-nums">
              {totalInquiriesCount}
            </span>
            <span className="text-xs text-[#626C66] font-mono tabular-nums">
              {orders.length} টি অর্ডার
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Conversational Stock & Customer Demand AI */}
        <div className="lg:col-span-7 bg-white border border-[#E5DFD7] rounded-2xl flex flex-col overflow-hidden min-h-[620px]">
          {/* Chat Header */}
          <div className="px-5 py-4 bg-[#162B23] text-white flex items-center justify-between border-b border-[#2D5042]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A2F] border border-[#8FA89B]/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#8FA89B]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">
                  স্টক ও কাস্টমার ডিমান্ড সহকারী (AI Analyst)
                </h2>
                <p className="text-xs text-[#8FA89B]">
                  ইনভেন্টরি হিসাব · রিস্টক তালিকা · কাস্টমার ডিমান্ড ও নতুন পণ্যের চাহিদা
                </p>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#FAF8F5] max-h-[430px]">
            {messages.map((m) => {
              const isAdmin = m.role === 'admin';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-[92%] ${isAdmin ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      isAdmin
                        ? 'bg-[#1A1E1C] text-white'
                        : 'bg-[#1E3A2F] text-[#8FA89B]'
                    }`}
                  >
                    {isAdmin ? 'আপনি' : <Sparkles className="w-4 h-4" />}
                  </div>

                  <div className="space-y-1.5 max-w-[88%]">
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                        isAdmin
                          ? 'bg-[#1A1E1C] text-white rounded-tr-xs'
                          : 'bg-white border border-[#E5DFD7] text-[#1A1E1C] rounded-tl-xs'
                      }`}
                    >
                      {m.text}
                    </div>

                    {!isAdmin && (
                      <div className="flex items-center gap-3 px-1 text-[11px] text-[#626C66]">
                        <button
                          type="button"
                          onClick={() => handleCopy(m.text, m.id)}
                          className="inline-flex items-center gap-1 hover:text-[#1A1E1C] font-semibold cursor-pointer"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#1E3A2F]" />
                              <span>কপি হয়েছে</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>উত্তর কপি করুন</span>
                            </>
                          )}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {m.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3 max-w-[80%] items-center">
                <div className="w-8 h-8 rounded-xl bg-[#1E3A2F] text-[#8FA89B] flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3.5 bg-white border border-[#E5DFD7] rounded-2xl rounded-tl-xs text-xs text-[#626C66]">
                  লাইভ স্টক ও কাস্টমার চ্যাট ডেটা বিশ্লেষণ করা হচ্ছে...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Question Buttons */}
          <div className="px-4 py-2.5 bg-white border-t border-[#E5DFD7] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-[#626C66] shrink-0 pr-1">
              দ্রুত প্রশ্ন:
            </span>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAskAI(prompt)}
                disabled={isSending}
                className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] rounded-lg text-[11px] font-semibold text-[#1A1E1C] whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskAI();
            }}
            className="p-4 bg-white border-t border-[#E5DFD7] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="স্টকের অবস্থা, কোনটা কম আছে, কাস্টমারের ডিমান্ড বা নতুন পণ্যের চাহিদা সম্পর্কে জিজ্ঞাসা করুন..."
              className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-[#E5DFD7] bg-[#FAF8F5] text-[#1A1E1C] placeholder:text-[#626C66] focus:outline-hidden focus:border-[#1E3A2F]"
            />
            <button
              type="submit"
              disabled={isSending || !inputQuery.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>জিজ্ঞাসা করুন</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Customer Demand & Stock Breakdown Inspector */}
        <div className="lg:col-span-5 bg-white border border-[#E5DFD7] rounded-2xl flex flex-col overflow-hidden min-h-[620px]">
          {/* Segmented Switcher */}
          <div className="p-4 border-b border-[#E5DFD7] bg-[#FAF8F5]">
            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setInspectorTab('demands')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  inspectorTab === 'demands'
                    ? 'bg-white text-[#1A1E1C] shadow-2xs'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                কাস্টমার ও নতুন ডিমান্ড ({newDemandCount + (analytics?.outOfStockDemands.length || 0)})
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('stock')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  inspectorTab === 'stock'
                    ? 'bg-white text-[#1A1E1C] shadow-2xs'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                লাইভ স্টক তালিকা ({products.length})
              </button>
            </div>
          </div>

          {inspectorTab === 'demands' ? (
            <div className="flex-1 p-5 overflow-y-auto space-y-6 max-h-[540px]">
              {/* Section 1: New Item Demands (Not in Catalog) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#1A1E1C] uppercase tracking-wider">
                    ১. নতুন জিনিসের ডিমান্ড (যা স্টোরে নেই)
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-[#626C66]">
                    {analytics?.newProductDemands.length || 0} টি
                  </span>
                </div>

                {analytics && analytics.newProductDemands.length > 0 ? (
                  <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                    {analytics.newProductDemands.map((d, idx) => (
                      <div key={idx} className="p-3.5 bg-white space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#1E3A2F]">
                            {d.topic}
                          </span>
                          <button
                            type="button"
                            onClick={() => openPreviousProductAI(d.topic)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>AI দিয়ে যোগ করুন</span>
                          </button>
                        </div>
                        <p className="text-xs text-[#1A1E1C] bg-[#FAF8F5] px-3 py-2 rounded-lg border border-[#E5DFD7]">
                          "{d.quote}"
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#626C66]">
                          <span>{d.customerName}</span>
                          {d.timestamp && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{d.timestamp}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[#E5DFD7] bg-[#FAF8F5] text-xs text-[#626C66]">
                    লাইভ সাপোর্ট চ্যাটে এখনো স্টোরের বাইরের নতুন কোনো পণ্যের অনুরোধ পাওয়া যায়নি। কাস্টমাররা নতুন কোনো জিনিস চাইলে সাথে সাথে এখানে তালিকাভুক্ত হবে।
                  </div>
                )}
              </div>

              {/* Section 2: Out-of-Stock Demands */}
              {analytics && analytics.outOfStockDemands.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-[#C85A32] uppercase tracking-wider">
                      ২. স্টক শেষ হওয়া পণ্যের চাহিদা (০ স্টক)
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[#626C66]">
                      {analytics.outOfStockDemands.length} টি
                    </span>
                  </div>
                  <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                    {analytics.outOfStockDemands.map((d, idx) => (
                      <div key={idx} className="p-3 bg-white space-y-1">
                        <div className="text-xs font-bold text-[#1A1E1C]">{d.productName}</div>
                        <div className="text-xs text-[#626C66]">"{d.quote}"</div>
                        <div className="text-[11px] text-[#626C66]">
                          {d.customerName} {d.timestamp ? `· ${d.timestamp}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Existing Product / Size / Color Demands */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#1A1E1C] uppercase tracking-wider">
                    চলমান প্রোডাক্ট, সাইজ ও কালার ডিমান্ড
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-[#626C66]">
                    {analytics?.existingProductDemands.length || 0} টি
                  </span>
                </div>

                {analytics && analytics.existingProductDemands.length > 0 ? (
                  <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                    {analytics.existingProductDemands.slice(0, 8).map((d, idx) => (
                      <div key={idx} className="p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#1A1E1C]">
                            {d.matchedProduct}
                          </span>
                          {d.requestedVariant && (
                            <span className="text-[11px] font-semibold text-[#1E3A2F]">
                              {d.requestedVariant}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#626C66]">"{d.quote}"</p>
                        <div className="text-[11px] text-[#626C66]">
                          {d.customerName} {d.timestamp ? `· ${d.timestamp}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[#E5DFD7] bg-[#FAF8F5] text-xs text-[#626C66]">
                    কাস্টমারদের চলমান পণ্যের সাইজ বা কালার জিজ্ঞাসা এখানে প্রদর্শিত হবে।
                  </div>
                )}
              </div>

              {/* Section 4: Top Ordered Products */}
              {analytics && analytics.topOrderedProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-[#1A1E1C] uppercase tracking-wider">
                      সর্বাধিক অর্ডারকৃত প্রোডাক্ট
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[#626C66]">
                      শীর্ষ {analytics.topOrderedProducts.length}
                    </span>
                  </div>
                  <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                    {analytics.topOrderedProducts.slice(0, 6).map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-bold text-[#1A1E1C] truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-[11px]">
                          <span className="font-bold text-[#1E3A2F]">{item.totalQty} অর্ডার</span>
                          {item.currentStock !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  item.currentStock <= 5 ? 'text-[#C85A32] font-bold' : 'text-[#626C66]'
                                }
                              >
                                স্টক {item.currentStock}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[540px]">
              {/* Search & Stock Filter */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#626C66] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="প্রোডাক্ট বা ক্যাটাগরি দিয়ে খুঁজুন..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#E5DFD7] bg-[#FAF8F5] text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      stockFilter === 'all'
                        ? 'bg-[#1E3A2F] text-white'
                        : 'bg-[#FAF8F5] text-[#626C66] border border-[#E5DFD7]'
                    }`}
                  >
                    সব ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('out')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      stockFilter === 'out'
                        ? 'bg-[#C85A32] text-white'
                        : 'bg-[#FAF8F5] text-[#626C66] border border-[#E5DFD7]'
                    }`}
                  >
                    স্টক শেষ ({outOfStockCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('low')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      stockFilter === 'low'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#FAF8F5] text-[#626C66] border border-[#E5DFD7]'
                    }`}
                  >
                    লো স্টক ({lowStockCount})
                  </button>
                </div>
              </div>

              {/* Compact Inventory List */}
              {filteredStockProducts.length === 0 ? (
                <div className="p-8 text-center border border-[#E5DFD7] rounded-xl bg-[#FAF8F5] text-xs text-[#626C66] space-y-2">
                  <p>এই ফিল্টারে কোনো প্রোডাক্ট পাওয়া যায়নি।</p>
                  {products.length === 0 && (
                    <button
                      type="button"
                      onClick={() => openPreviousProductAI()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A2F] text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>AI দিয়ে প্রথম প্রোডাক্ট যোগ করুন</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                  {filteredStockProducts.map((prod) => {
                    const qty = prod.totalStock || 0;
                    const isOut = qty <= 0;
                    const isLow = qty > 0 && qty <= 5;
                    return (
                      <div
                        key={prod.id}
                        className="p-3 bg-white hover:bg-[#FAF8F5] flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1A1E1C] truncate">
                            {prod.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-[#626C66] mt-0.5">
                            <span>{prod.category || 'General'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              ৳{(prod.salePrice || prod.price || 0).toLocaleString()}
                            </span>
                            {prod.sizes && prod.sizes.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{prod.sizes.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-black font-mono tabular-nums block ${
                              isOut
                                ? 'text-[#C85A32]'
                                : isLow
                                ? 'text-amber-700'
                                : 'text-[#1E3A2F]'
                            }`}
                          >
                            {qty} টি
                          </span>
                          <span className="text-[11px] text-[#626C66]">
                            {isOut ? 'স্টক শেষ' : isLow ? 'রিস্টক জরুরি' : 'পর্যাপ্ত'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
