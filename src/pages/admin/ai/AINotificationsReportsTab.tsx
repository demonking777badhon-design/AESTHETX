import React, { useState, useEffect } from 'react';
import {
  Bell,
  FileText,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Copy,
  Printer,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Download,
  Check
} from 'lucide-react';
import {
  getLocalAINotifications,
  markAINotificationAsRead,
  markAllAINotificationsAsRead,
  scanAndGenerateAINotifications,
  getLocalAIDailyReports,
  saveAIDailyReport,
  getLocalOrdersCache,
  getLocalProductsCache,
  getLocalSupportConversations
} from '../../../firebase/db';
import type { AINotification, AIDailyReport } from '../../../types';

interface AINotificationsReportsTabProps {
  onShowToast: (msg: string) => void;
  onNavigateSubTab: (tab: string) => void;
}

export const AINotificationsReportsTab: React.FC<AINotificationsReportsTabProps> = ({
  onShowToast,
  onNavigateSubTab
}) => {
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [reports, setReports] = useState<AIDailyReport[]>(getLocalAIDailyReports);
  const [activeReport, setActiveReport] = useState<AIDailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Scan notifications on load
    const freshNotifs = scanAndGenerateAINotifications();
    setNotifications(freshNotifs);
    const savedReports = getLocalAIDailyReports();
    setReports(savedReports);
    if (savedReports.length > 0 && !activeReport) {
      setActiveReport(savedReports[0]);
    }
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await markAINotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllAINotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onShowToast('All notifications marked as read.');
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const orders = getLocalOrdersCache();
      const products = getLocalProductsCache();
      const convs = getLocalSupportConversations();

      const totalRev = orders
        .filter((o) => o.paymentStatus === 'Paid' || o.orderStatus === 'Delivered')
        .reduce((sum, o) => sum + (o.total || 0), 0);

      const deliveredCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
      const pendingCount = orders.filter((o) => o.orderStatus === 'Pending' || o.orderStatus === 'Processing').length;
      const lowStockCount = products.filter((p) => p.totalStock !== undefined && p.totalStock <= 5).length;
      const resolvedConvs = convs.filter((c) => c.status === 'resolved').length;
      const humanTakenConvs = convs.filter((c) => c.isTakenOverByAdmin).length;

      const metricsData = {
        storeName: 'AESTHETX LIFESTYLE',
        totalRevenue: totalRev,
        totalOrders: orders.length,
        deliveredOrders: deliveredCount,
        pendingOrders: pendingCount,
        lowStockItemsCount: lowStockCount,
        totalCustomerConversations: convs.length,
        resolvedInquiries: resolvedConvs,
        humanTakeovers: humanTakenConvs
      };

      const res = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricsData })
      });

      const data = await res.json();

      if (data.success && data.report) {
        const todayStr = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const newReport: AIDailyReport = {
          id: `rep_${Date.now()}`,
          dateString: todayStr,
          generatedAt: { seconds: Math.floor(Date.now() / 1000) },
          summary: data.report.summary || 'Store operations proceeding steadily.',
          metrics: {
            totalRevenue: totalRev,
            totalOrders: orders.length,
            deliveredOrders: deliveredCount,
            pendingOrders: pendingCount,
            lowStockCount,
            totalConversations: convs.length,
            aiResolvedCount: resolvedConvs,
            humanEscalatedCount: humanTakenConvs
          },
          insights: data.report.insights || [],
          recommendations: data.report.recommendations || []
        };

        await saveAIDailyReport(newReport);
        setReports([newReport, ...reports]);
        setActiveReport(newReport);
        onShowToast('New Executive Business Report generated!');
      } else {
        onShowToast(data.message || 'Report generated with local metrics.');
      }
    } catch (err) {
      console.error('Report error:', err);
      onShowToast('Failed to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReport = () => {
    if (!activeReport) return;
    const text = `
=== AESTHETX LIFESTYLE: AI EXECUTIVE BUSINESS REPORT (${activeReport.dateString}) ===
SUMMARY:
${activeReport.summary}

KEY METRICS:
- Total Orders: ${activeReport.metrics.totalOrders}
- Delivered Orders: ${activeReport.metrics.deliveredOrders}
- Pending/Processing: ${activeReport.metrics.pendingOrders}
- Low Stock Items: ${activeReport.metrics.lowStockCount}
- Customer Conversations: ${activeReport.metrics.totalConversations}

BUSINESS INSIGHTS:
${activeReport.insights.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}

ACTION RECOMMENDATIONS:
${activeReport.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast('Report copied to clipboard.');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Report Generation Action */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1E3A2F]" />
            <h2 className="text-lg font-black text-[#1A1E1C]">
              Notifications & AI Executive Reports
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Real-time proactive store alerts and AI synthesized business performance audits.
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#2D5042] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#8FA89B]" />
          )}
          <span>{isGenerating ? 'Synthesizing...' : 'Generate Real-Time Report'}</span>
        </button>
      </div>

      {/* 2. Proactive Store Notifications Feed */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#1E3A2F]" />
            <h3 className="text-sm font-black text-[#1A1E1C]">
              Active Store Alerts & Warnings ({notifications.filter((n) => !n.isRead).length} Unread)
            </h3>
          </div>
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-stone-500 hover:text-stone-900 cursor-pointer"
          >
            Mark all as read
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-stone-400 text-xs">
            No active alerts. All operations are running smoothly!
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  notif.isRead
                    ? 'bg-stone-50/50 border-stone-200 opacity-70'
                    : notif.severity === 'critical'
                    ? 'bg-rose-50 border-rose-200'
                    : notif.severity === 'high'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-stone-200 shadow-2xs'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        notif.severity === 'critical'
                          ? 'bg-rose-200 text-rose-800'
                          : notif.severity === 'high'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-stone-200 text-stone-800'
                      }`}
                    >
                      {notif.severity}
                    </span>
                    <span className="text-xs font-bold text-stone-900">{notif.title}</span>
                  </div>
                  <p className="text-xs text-stone-600">{notif.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {notif.targetTab && (
                    <button
                      onClick={() => onNavigateSubTab(notif.targetTab!)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white border border-stone-300 hover:border-stone-500 rounded-lg text-stone-800 cursor-pointer"
                    >
                      Review
                    </button>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Executive Business Report Display */}
      {activeReport ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
          {/* Report Top Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1E3A2F]" />
                <h3 className="text-base font-black text-[#1A1E1C]">
                  Executive Business Report ({activeReport.dateString})
                </h3>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                Generated {activeReport.generatedAt?.seconds ? new Date(activeReport.generatedAt.seconds * 1000).toLocaleTimeString() : 'Recently'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
              Executive AI Summary
            </span>
            <p className="text-xs font-medium text-stone-800 leading-relaxed">
              {activeReport.summary}
            </p>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-stone-200 text-center">
              <span className="text-[10px] text-stone-400 font-bold uppercase">Total Orders</span>
              <span className="text-xl font-black text-stone-900 block mt-1">{activeReport.metrics.totalOrders}</span>
            </div>
            <div className="p-3 rounded-xl border border-stone-200 text-center">
              <span className="text-[10px] text-stone-400 font-bold uppercase">Delivered</span>
              <span className="text-xl font-black text-emerald-600 block mt-1">{activeReport.metrics.deliveredOrders}</span>
            </div>
            <div className="p-3 rounded-xl border border-stone-200 text-center">
              <span className="text-[10px] text-stone-400 font-bold uppercase">Low Stock Alerts</span>
              <span className="text-xl font-black text-amber-600 block mt-1">{activeReport.metrics.lowStockCount}</span>
            </div>
            <div className="p-3 rounded-xl border border-stone-200 text-center">
              <span className="text-[10px] text-stone-400 font-bold uppercase">Customer Chats</span>
              <span className="text-xl font-black text-[#1E3A2F] block mt-1">{activeReport.metrics.totalConversations}</span>
            </div>
          </div>

          {/* Insights & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 space-y-2">
              <span className="text-xs font-black text-[#1E3A2F] uppercase tracking-wider block">
                Key Business Insights
              </span>
              <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                {activeReport.insights.map((ins, i) => (
                  <li key={i}>{ins}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 space-y-2">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-wider block">
                Recommended Actions
              </span>
              <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                {activeReport.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center text-stone-400 text-xs">
          Click "Generate Real-Time Report" to create your first executive store audit.
        </div>
      )}
    </div>
  );
};
