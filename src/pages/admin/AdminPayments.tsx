import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  Sparkles,
  Bot,
  ExternalLink,
  ChevronRight,
  Send,
  AlertTriangle,
  FileCheck,
  HelpCircle,
  Terminal,
  Activity
} from 'lucide-react';
import { getAllOrders, getLocalOrdersCache, logAdminAction } from '../../firebase/db';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import type { Order, PaymentVerificationStatus } from '../../types';

interface ConfigStatus {
  bkash: {
    isConfigured: boolean;
    mode: 'sandbox' | 'live';
    merchantNumber: string;
    docsUrl: string;
  };
  nagad: {
    isConfigured: boolean;
    mode: 'sandbox' | 'live';
    accountNumber: string;
    docsUrl: string;
  };
}

export const AdminPayments: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(() => getLocalOrdersCache());
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTrx, setCopiedTrx] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Gateway Config Status
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);

  // AI Payment Assistant State
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(true);

  // Scenario Testing Lab (Requirement 9)
  const [testScenarioLoading, setTestScenarioLoading] = useState<string | null>(null);
  const [testScenarioResult, setTestScenarioResult] = useState<any | null>(null);
  const [testLabOpen, setTestLabOpen] = useState(false);

  // Re-verification loading
  const [reverifyingId, setReverifyingId] = useState<string | null>(null);

  // Store Settings & Gateway Enable/Disable controls
  const { settings, updateSettings } = useSettings();
  const { currentUser } = useAuth();
  const [togglingProvider, setTogglingProvider] = useState<'bKash' | 'Nagad' | null>(null);
  const [gatewayStatusBanner, setGatewayStatusBanner] = useState<string | null>(null);

  const handleToggleGateway = async (provider: 'bKash' | 'Nagad', nextState: boolean) => {
    setTogglingProvider(provider);
    setGatewayStatusBanner(null);
    try {
      if (provider === 'bKash') {
        await updateSettings({ bkashEnabled: nextState });
      } else {
        await updateSettings({ nagadEnabled: nextState });
      }
      await logAdminAction(
        nextState ? 'PAYMENT_GATEWAY_ENABLED' : 'PAYMENT_GATEWAY_DISABLED',
        `${provider} Payment Gateway`,
        `${provider} payment turned ${nextState ? 'ON' : 'OFF'} from Payments Dashboard`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      await fetchConfigStatus();
      setGatewayStatusBanner(
        nextState
          ? `✅ ${provider} পেমেন্ট সক্রিয় (ON) করা হয়েছে — এখন কাস্টমাররা ${provider} দিয়ে পেমেন্ট করতে পারবেন।`
          : `⛔ ${provider} পেমেন্ট বন্ধ (OFF) করা হয়েছে — কাস্টমার চেকআউট থেকে ${provider} অপশন সরানো হয়েছে।`
      );
      setTimeout(() => setGatewayStatusBanner(null), 4000);
    } catch (err: any) {
      setGatewayStatusBanner(`Error toggling ${provider}: ${err?.message || 'Unknown error'}`);
    } finally {
      setTogglingProvider(null);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getAllOrders(true);
      setOrders(data);
    } catch (err) {
      console.warn('Error fetching orders for payments dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigStatus = async () => {
    try {
      const res = await fetch('/api/payments/config-status');
      const data = await res.json();
      if (data.success) {
        setConfigStatus(data);
      }
    } catch (err) {
      console.warn('Config status check note:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchConfigStatus();
  }, []);

  // Filter only digital payments (bKash & Nagad)
  const digitalOrders = orders.filter(
    (o) => o.paymentMethod === 'bKash' || o.paymentMethod === 'Nagad'
  );

  // Filtered orders list
  const filteredOrders = digitalOrders.filter((order) => {
    const vStatus = order.paymentVerificationStatus || (order.paymentStatus === 'Paid' ? 'VERIFIED' : 'PENDING');

    if (filterStatus !== 'ALL' && vStatus !== filterStatus) {
      return false;
    }

    if (providerFilter !== 'ALL' && order.paymentMethod !== providerFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = order.orderNumber?.toLowerCase().includes(q);
      const matchName = order.customerName?.toLowerCase().includes(q);
      const matchPhone = order.customerPhone?.toLowerCase().includes(q);
      const matchTrx = order.paymentTrxId?.toLowerCase().includes(q);
      const matchSender = order.paymentSenderNumber?.toLowerCase().includes(q);
      return matchNum || matchName || matchPhone || matchTrx || matchSender;
    }

    return true;
  });

  // Calculate Metrics
  const verifiedOrders = digitalOrders.filter(
    (o) => o.paymentVerificationStatus === 'VERIFIED' || o.paymentStatus === 'Paid'
  );
  const totalVerifiedRevenue = verifiedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = digitalOrders.filter(
    (o) =>
      (!o.paymentVerificationStatus || o.paymentVerificationStatus === 'PENDING') &&
      o.paymentStatus !== 'Paid'
  );
  const failedOrders = digitalOrders.filter(
    (o) => o.paymentVerificationStatus === 'FAILED' || o.paymentStatus === 'Failed'
  );

  // Duplicate TrxID detection check
  const trxMap = new Map<string, number>();
  digitalOrders.forEach((o) => {
    if (o.paymentTrxId) {
      const count = trxMap.get(o.paymentTrxId) || 0;
      trxMap.set(o.paymentTrxId, count + 1);
    }
  });
  const duplicateTrxCount = Array.from(trxMap.values()).filter((c) => c > 1).length;

  // Ask AI Payment Assistant
  const handleAskAI = async (promptText?: string) => {
    const q = promptText || aiQuery;
    if (!q.trim()) return;

    setAiLoading(true);
    setAiResponse(null);
    try {
      const res = await fetch('/api/payments/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          transactionsContext: digitalOrders.map((o) => ({
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            paymentMethod: o.paymentMethod,
            trxId: o.paymentTrxId,
            senderNumber: o.paymentSenderNumber,
            total: o.total,
            status: o.paymentVerificationStatus || o.paymentStatus,
            isDuplicateFlagged: o.paymentTrxId ? (trxMap.get(o.paymentTrxId) || 0) > 1 : false
          })),
          currentTransaction: selectedOrder
            ? {
                orderNumber: selectedOrder.orderNumber,
                total: selectedOrder.total,
                trxId: selectedOrder.paymentTrxId,
                senderNumber: selectedOrder.paymentSenderNumber,
                status: selectedOrder.paymentVerificationStatus || selectedOrder.paymentStatus,
                providerResponse: selectedOrder.paymentVerification
              }
            : undefined
        })
      });

      const data = await res.json();
      setAiResponse(data.advice || 'বিশ্লেষণ সম্পন্ন হয়েছে।');
    } catch (err: any) {
      setAiResponse(`AI Assistant error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Run Provider Testing Scenario (Requirement 9)
  const handleRunScenario = async (scenarioKey: string) => {
    setTestScenarioLoading(scenarioKey);
    setTestScenarioResult(null);
    try {
      const res = await fetch('/api/payments/test-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioKey,
          provider: 'bKash',
          expectedAmount: 1500
        })
      });
      const data = await res.json();
      setTestScenarioResult(data);
    } catch (err: any) {
      setTestScenarioResult({ error: err.message });
    } finally {
      setTestScenarioLoading(null);
    }
  };

  // Re-verify order with official provider API
  const handleReverify = async (order: Order) => {
    if (!order.paymentTrxId) return;
    setReverifyingId(order.id);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          provider: order.paymentMethod,
          trxId: order.paymentTrxId,
          senderNumber: order.paymentSenderNumber,
          expectedAmount: order.total
        })
      });
      const data = await res.json();
      alert(
        data.verified
          ? `✅ Verification Successful!\n\n${data.userMessageBn}\nStatus: VERIFIED (৳${data.paidAmount})`
          : `❌ Verification Failed!\n\nReason: ${data.failureReason}\n${data.userMessageBn}`
      );
      await fetchOrders();
    } catch (err: any) {
      alert(`Network error verifying transaction: ${err.message}`);
    } finally {
      setReverifyingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTrx(id);
    setTimeout(() => setCopiedTrx(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Gateway Mode Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A2F] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1A1E1C]">
                Automatic Payment Verification System
              </h1>
              <p className="text-xs text-[#626C66] mt-0.5">
                বিকাশ ও নগদ অফিসিয়াল মার্চেন্ট এপিআই ইন্টিগ্রেশন ও রিয়েল-টাইম অটোমেটিক ভেরিফিকেশন ইঞ্জিন
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* bKash Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-200 bg-pink-50/70 text-xs font-bold text-[#E2136E]">
            <span className="w-2 h-2 rounded-full bg-[#E2136E] animate-pulse"></span>
            <span>bKash: {configStatus?.bkash.mode === 'live' ? 'LIVE MERCHANT' : 'SANDBOX MODE'}</span>
          </div>

          {/* Nagad Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-200 bg-orange-50/70 text-xs font-bold text-[#F7941D]">
            <span className="w-2 h-2 rounded-full bg-[#F7941D] animate-pulse"></span>
            <span>Nagad: {configStatus?.nagad.mode === 'live' ? 'LIVE PGW' : 'SANDBOX MODE'}</span>
          </div>

          <button
            onClick={() => {
              fetchOrders();
              fetchConfigStatus();
            }}
            disabled={loading}
            className="p-2 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1E3A2F] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Refresh Orders & Verification Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live Gateway Enable / Disable Controls */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#EFEBE5]">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              পেমেন্ট গেটওয়ে নিয়ন্ত্রণ (bKash & Nagad Availability Control)
            </h2>
            <p className="text-[11px] text-[#626C66]">
              এখান থেকে যেকোনো পেমেন্ট মেথড বন্ধ করলে গ্রাহকের চেকআউট এবং সার্ভারে তা তাৎক্ষণিকভাবে বন্ধ হয়ে যাবে
            </p>
          </div>
        </div>

        {gatewayStatusBanner && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
            {gatewayStatusBanner}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* bKash Quick Switch */}
          <div
            className={`p-3.5 rounded-xl border-2 flex items-center justify-between transition-all ${
              settings.bkashEnabled !== false
                ? 'border-[#E2136E]/30 bg-pink-50/30'
                : 'border-stone-200 bg-stone-50 opacity-80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E2136E] text-white font-black text-xs flex items-center justify-center">
                bK
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#1A1E1C]">bKash Payment</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      settings.bkashEnabled !== false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.bkashEnabled !== false ? 'চালু (ON)' : 'বন্ধ (OFF)'}
                  </span>
                </div>
                <span className="text-[10px] text-[#626C66] block">
                  {settings.bkashEnabled !== false
                    ? 'চেকআউটে বিকাশ পেমেন্ট অপশন দৃশ্যমান আছে'
                    : 'চেকআউট থেকে বিকাশ সম্পূর্ণ বন্ধ আছে'}
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.bkashEnabled !== false}
              disabled={togglingProvider === 'bKash'}
              onClick={() => handleToggleGateway('bKash', !(settings.bkashEnabled !== false))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.bkashEnabled !== false ? 'bg-[#E2136E]' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.bkashEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Nagad Quick Switch */}
          <div
            className={`p-3.5 rounded-xl border-2 flex items-center justify-between transition-all ${
              settings.nagadEnabled !== false
                ? 'border-[#F7941D]/30 bg-orange-50/30'
                : 'border-stone-200 bg-stone-50 opacity-80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F7941D] text-white font-black text-xs flex items-center justify-center">
                N
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#1A1E1C]">Nagad Payment</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      settings.nagadEnabled !== false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.nagadEnabled !== false ? 'চালু (ON)' : 'বন্ধ (OFF)'}
                  </span>
                </div>
                <span className="text-[10px] text-[#626C66] block">
                  {settings.nagadEnabled !== false
                    ? 'চেকআউটে নগদ পেমেন্ট অপশন দৃশ্যমান আছে'
                    : 'চেকআউট থেকে নগদ সম্পূর্ণ বন্ধ আছে'}
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.nagadEnabled !== false}
              disabled={togglingProvider === 'Nagad'}
              onClick={() => handleToggleGateway('Nagad', !(settings.nagadEnabled !== false))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.nagadEnabled !== false ? 'bg-[#F7941D]' : 'bg-stone-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.nagadEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#626C66] text-xs font-semibold mb-1">
            <span>Verified Payments</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">
            ৳{totalVerifiedRevenue.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            {verifiedOrders.length} টি সফলভাবে যাচাইকৃত
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#626C66] text-xs font-semibold mb-1">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">
            {pendingOrders.length}
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            অপেক্ষমাণ পেমেন্ট
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#626C66] text-xs font-semibold mb-1">
            <span>Failed / Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {failedOrders.length}
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            ভুল বা অসম্পূর্ণ TrxID
          </span>
        </div>

        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#626C66] text-xs font-semibold mb-1">
            <span>Duplicate TrxID Alerts</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700">
            {duplicateTrxCount}
          </div>
          <span className="text-[11px] text-[#626C66] mt-0.5 block">
            ডুপ্লিকেট ট্রানজেকশন ঝুঁকি
          </span>
        </div>
      </div>

      {/* AI PAYMENT ASSISTANT (Requirement 5) */}
      <div className="bg-gradient-to-br from-[#1E3A2F] to-[#14261F] rounded-2xl p-6 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#2D5042]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">AI Payment Security & Audit Assistant</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gemini 3.8 Flash Powered
                </span>
              </div>
              <p className="text-[11px] text-[#8FA89B]">
                পেমেন্ট ভেরিফিকেশন ফলাফল বিশ্লেষণ, ডুপ্লিকেট TrxID শনাক্তকরণ এবং এরর কোড ব্যাখ্যা
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#8FA89B] hidden sm:block">
            🛡️ Strict Guardrail: AI Never Declares Payment Success
          </div>
        </div>

        {/* Quick Query Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleAskAI('Show verified, pending and failed payments audit summary')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer border border-white/10"
          >
            📊 পেমেন্ট সারসংক্ষেপ অডিট করুন
          </button>
          <button
            onClick={() => handleAskAI('Identify duplicate transaction IDs and suspicious payments')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer border border-white/10"
          >
            ⚠️ ডুপ্লিকেট TrxID ও নিরাপত্তা অডিট
          </button>
          <button
            onClick={() => handleAskAI('Explain common bKash (2023, 2001) and Nagad (9999) error codes')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer border border-white/10"
          >
            ❓ বিকাশ ও নগদ এরর কোড ব্যাখ্যা
          </button>
        </div>

        {/* Input Form */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="পেমেন্ট বা TrxID সম্পর্কে যেকোনো প্রশ্ন করুন (যেমন: TrxID BL89XK241P কেন ফেইল্ড হয়েছে?)..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-stone-400 focus:outline-hidden focus:border-emerald-400"
          />
          <button
            onClick={() => handleAskAI()}
            disabled={aiLoading || !aiQuery.trim()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {aiLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>জিজ্ঞেস করুন</span>
              </>
            )}
          </button>
        </div>

        {/* AI Output Card */}
        {aiResponse && (
          <div className="bg-black/30 border border-white/15 rounded-xl p-4 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Security Advisor Analysis</span>
              </span>
              <span className="text-[10px] text-stone-400">
                Official API Verification Is Authoritative
              </span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-stone-200">
              {aiResponse}
            </div>
          </div>
        )}
      </div>

      {/* TESTING LABORATORY (Requirement 9) */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#C85A32]" />
            <h3 className="text-sm font-black text-[#1A1E1C]">
              Payment Verification Testing Laboratory (Requirement 9)
            </h3>
          </div>
          <button
            onClick={() => setTestLabOpen(!testLabOpen)}
            className="text-xs font-bold text-[#1E3A2F] hover:underline cursor-pointer"
          >
            {testLabOpen ? 'ল্যাব লুকান (Hide)' : 'টেস্টিং ল্যাব খুলুন (Open Test Scenarios)'}
          </button>
        </div>

        {testLabOpen && (
          <div className="pt-2 border-t border-[#EFEBE5] space-y-4">
            <p className="text-xs text-[#626C66]">
              নিচের বাটনগুলোতে ক্লিক করে সকল সিকিউরিটি সিনারিও (সফল, ভুল পরিমাণ, অবৈধ TrxID, ডুপ্লিকেট TrxID, ভুল প্রাপক, এপিআই ফেইলিউর) পরীক্ষা করতে পারেন।
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleRunScenario('success')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-emerald-900 block">1. Successful Match</span>
                <span className="text-[10px] text-emerald-700">সঠিক পরিমাণ ও বৈধ TrxID</span>
              </button>

              <button
                onClick={() => handleRunScenario('incorrect_amount')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-amber-900 block">2. Incorrect Amount</span>
                <span className="text-[10px] text-amber-700">অর্ডার ৳১৫০০, পাঠানো ৳৫০০</span>
              </button>

              <button
                onClick={() => handleRunScenario('invalid_trx_id')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-rose-900 block">3. Invalid TrxID</span>
                <span className="text-[10px] text-rose-700">নেটওয়ার্কে অস্তিত্বহীন আইডি</span>
              </button>

              <button
                onClick={() => handleRunScenario('duplicate_trx_id')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-purple-900 block">4. Duplicate TrxID</span>
                <span className="text-[10px] text-purple-700">পূর্বে ব্যবহৃত TrxID রি-সাবমিট</span>
              </button>

              <button
                onClick={() => handleRunScenario('incorrect_receiver')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-orange-200 bg-orange-50/70 hover:bg-orange-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-orange-900 block">5. Wrong Receiver</span>
                <span className="text-[10px] text-orange-700">ভুল মার্চেন্টে টাকা পাঠানো</span>
              </button>

              <button
                onClick={() => handleRunScenario('api_failure')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-red-900 block">6. API Failure</span>
                <span className="text-[10px] text-red-700">প্রোভাইডার নেটওয়ার্ক ত্রুটি</span>
              </button>

              <button
                onClick={() => handleRunScenario('pending')}
                disabled={Boolean(testScenarioLoading)}
                className="p-3 text-left rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-blue-900 block">7. Pending State</span>
                <span className="text-[10px] text-blue-700">অসম্পূর্ণ ট্রানজেকশন</span>
              </button>
            </div>

            {testScenarioResult && (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7] text-xs font-mono space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD7]">
                  <span className="font-bold text-[#1A1E1C]">
                    Scenario Result: {testScenarioResult.scenarioTested}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      testScenarioResult.verificationDecision?.verified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {testScenarioResult.verificationDecision?.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                  <div className="bg-white p-2 rounded border">
                    Exists: {testScenarioResult.verificationDecision?.matchedCriteria?.transactionExists ? '✅ PASS' : '❌ FAIL'}
                  </div>
                  <div className="bg-white p-2 rounded border">
                    Status: {testScenarioResult.verificationDecision?.matchedCriteria?.statusSuccess ? '✅ PASS' : '❌ FAIL'}
                  </div>
                  <div className="bg-white p-2 rounded border">
                    Amount: {testScenarioResult.verificationDecision?.matchedCriteria?.amountMatched ? '✅ PASS' : '❌ FAIL'}
                  </div>
                  <div className="bg-white p-2 rounded border">
                    Receiver: {testScenarioResult.verificationDecision?.matchedCriteria?.merchantAccountMatched ? '✅ PASS' : '❌ FAIL'}
                  </div>
                  <div className="bg-white p-2 rounded border">
                    Unique: {testScenarioResult.verificationDecision?.matchedCriteria?.uniqueNotDuplicate ? '✅ PASS' : '❌ FAIL'}
                  </div>
                </div>

                <p className="text-[#1A1E1C] font-sans font-semibold pt-1">
                  সিদ্ধান্ত: {testScenarioResult.verificationDecision?.userMessageBn}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, TrxID, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl px-3 py-2 text-xs font-bold text-[#1A1E1C] cursor-pointer"
            >
              <option value="ALL">সকল মেথড (All Providers)</option>
              <option value="bKash">বিকাশ (bKash)</option>
              <option value="Nagad">নগদ (Nagad)</option>
            </select>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          {[
            { id: 'ALL', label: `সব ডিজিটাল লেনদেন (${digitalOrders.length})` },
            { id: 'VERIFIED', label: `VERIFIED (${verifiedOrders.length})` },
            { id: 'PENDING', label: `PENDING (${pendingOrders.length})` },
            { id: 'FAILED', label: `FAILED (${failedOrders.length})` },
            { id: 'MANUAL_REVIEW', label: `MANUAL REVIEW` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-[#1E3A2F] text-white font-bold shadow-xs'
                  : 'bg-[#FAF8F5] text-[#626C66] hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Transactions Table */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer Info</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Sender Phone</th>
                <th className="py-3 px-4">Transaction ID (TrxID)</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((ord) => {
                  const vStatus: PaymentVerificationStatus =
                    ord.paymentVerificationStatus ||
                    (ord.paymentStatus === 'Paid' ? 'VERIFIED' : 'PENDING');

                  const isDuplicate = ord.paymentTrxId ? (trxMap.get(ord.paymentTrxId) || 0) > 1 : false;

                  return (
                    <tr key={ord.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#1E3A2F]">
                        #{ord.orderNumber || ord.id.slice(0, 8)}
                        <span className="block text-[10px] text-[#626C66] font-normal">
                          {ord.createdAt?.seconds
                            ? new Date(ord.createdAt.seconds * 1000).toLocaleDateString()
                            : 'Recent'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-[#1A1E1C] block">{ord.customerName}</span>
                        <span className="font-mono text-[#626C66] text-[11px]">{ord.customerPhone}</span>
                      </td>

                      <td className="py-3 px-4">
                        {ord.paymentMethod === 'bKash' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-[#E2136E] text-white">
                            bKash
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-[#F7941D] text-white">
                            Nagad
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-stone-700">
                        {ord.paymentSenderNumber || ord.customerPhone}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#1A1E1C]">
                            {ord.paymentTrxId || 'N/A'}
                          </span>
                          {ord.paymentTrxId && (
                            <button
                              onClick={() => copyToClipboard(ord.paymentTrxId!, ord.id)}
                              className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
                              title="Copy TrxID"
                            >
                              {copiedTrx === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {isDuplicate && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                            DUPLICATE TRX
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-black text-[#1A1E1C]">
                        ৳{ord.total?.toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        {vStatus === 'VERIFIED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </span>
                        ) : vStatus === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3" />
                            <span>FAILED</span>
                          </span>
                        ) : vStatus === 'MANUAL_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            <span>MANUAL REVIEW</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-300">
                            <Clock className="w-3 h-3" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReverify(ord)}
                            disabled={reverifyingId === ord.id}
                            className="px-2.5 py-1 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1E3A2F] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Query provider official API"
                          >
                            {reverifyingId === ord.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Re-verify'
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              handleAskAI(`Audit transaction #${ord.orderNumber} with TrxID ${ord.paymentTrxId}`);
                            }}
                            className="px-2.5 py-1 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Audit AI</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[#626C66]">
                    কোনো লেনদেনের তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
