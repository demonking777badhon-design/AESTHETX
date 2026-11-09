import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Shirt,
  FolderTree,
  ShoppingBag,
  Boxes,
  Users,
  Tag,
  Truck,
  Image as ImageIcon,
  FileText,
  Star,
  Settings,
  History,
  LogOut,
  ExternalLink,
  Menu,
  X,
  CheckCircle2,
  ShieldCheck,
  Headphones,
  MessageSquareText,
  Bot,
  Sparkles,
  CreditCard,
  TrendingUp,
  PlusCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import {
  getLocalSupportConversations,
  getAllSupportConversations,
  getLocalProductsCache
} from '../../firebase/db';
import { AdminAICopilotModal } from '../../components/admin/AdminAICopilotModal';

export type AdminTab =
  | 'dashboard'
  | 'stock-demand-ai'
  | 'products'
  | 'product-new'
  | 'product-edit'
  | 'categories'
  | 'orders'
  | 'payments'
  | 'delivered-orders'
  | 'customer-chat'
  | 'support'
  | 'inventory'
  | 'customers'
  | 'coupons'
  | 'delivery'
  | 'banners'
  | 'pages'
  | 'reviews'
  | 'settings'
  | 'audit-logs';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onNavigateHome: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onTabChange,
  onNavigateHome,
  children
}) => {
  const { currentUser, logout } = useAuth();
  const { settings } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotTopicHint, setCopilotTopicHint] = useState<string | null>(null);
  const [lowStockAlertCount, setLowStockAlertCount] = useState<number>(() => {
    try {
      return getLocalProductsCache().filter((p) => (p.totalStock ?? 0) <= 5).length;
    } catch {
      return 0;
    }
  });
  const [unreadChatCount, setUnreadChatCount] = useState<number>(() => {
    try {
      const convs = getLocalSupportConversations();
      return convs.filter((c) => c.status === 'open' && c.unreadByAdmin).length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const updateCounts = () => {
      try {
        const convs = getLocalSupportConversations();
        setUnreadChatCount(convs.filter((c) => c.status === 'open' && c.unreadByAdmin).length);
        const prods = getLocalProductsCache();
        setLowStockAlertCount(prods.filter((p) => (p.totalStock ?? 0) <= 5).length);
      } catch {
        // ignore
      }
    };

    const handleOpenProductAI = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setCopilotTopicHint(detail?.topic ? String(detail.topic) : null);
      setIsCopilotOpen(true);
    };

    const handleOpenStockDemandAI = () => {
      onTabChange('stock-demand-ai');
    };

    updateCounts();
    getAllSupportConversations().then(() => updateCounts()).catch(() => {});
    const interval = setInterval(updateCounts, 3000);
    window.addEventListener('aesthetx-open-product-ai', handleOpenProductAI);
    window.addEventListener('aesthetx-open-stock-demand-ai', handleOpenStockDemandAI);
    window.addEventListener('aesthetx-products-updated', updateCounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('aesthetx-open-product-ai', handleOpenProductAI);
      window.removeEventListener('aesthetx-open-stock-demand-ai', handleOpenStockDemandAI);
      window.removeEventListener('aesthetx-products-updated', updateCounts);
    };
  }, [onTabChange]);

  const menuItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock-demand-ai' as AdminTab, label: 'Stock & Demand AI', icon: TrendingUp },
    { id: 'support' as AdminTab, label: 'Website AI Manager', icon: Bot },
    { id: 'customer-chat' as AdminTab, label: 'Customer Live Chat', icon: MessageSquareText },
    { id: 'products' as AdminTab, label: 'Products', icon: Shirt },
    { id: 'categories' as AdminTab, label: 'Categories', icon: FolderTree },
    { id: 'orders' as AdminTab, label: 'Orders', icon: ShoppingBag },
    { id: 'payments' as AdminTab, label: 'Payment Verifications', icon: CreditCard },
    { id: 'delivered-orders' as AdminTab, label: 'Delivered Orders', icon: CheckCircle2 },
    { id: 'inventory' as AdminTab, label: 'Inventory / Stock', icon: Boxes },
    { id: 'customers' as AdminTab, label: 'Customers', icon: Users },
    { id: 'coupons' as AdminTab, label: 'Coupons & Promos', icon: Tag },
    { id: 'delivery' as AdminTab, label: 'Delivery & Zones', icon: Truck },
    { id: 'banners' as AdminTab, label: 'Homepage Banners', icon: ImageIcon },
    { id: 'pages' as AdminTab, label: 'Information Pages', icon: FileText },
    { id: 'reviews' as AdminTab, label: 'Product Reviews', icon: Star },
    { id: 'settings' as AdminTab, label: 'Store Settings', icon: Settings },
    { id: 'audit-logs' as AdminTab, label: 'Audit Logs', icon: History }
  ];

  const logoSrc = settings.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

  const SidebarContent = (
    <div className="h-full flex flex-col justify-between py-5 px-3">
      <div>
        {/* Brand Header */}
        <div className="px-3 pb-6 border-b border-[#2D5042] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg">
              <img
                src={logoSrc}
                alt={settings.storeName}
                className="h-9 w-auto object-contain"
              />
            </div>
            <div>
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                Admin Console
              </h2>
              <span className="text-[10px] text-[#8FA89B] block font-mono">v1.0 • Bangladesh</span>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-stone-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'products' &&
                (currentTab === 'product-new' || currentTab === 'product-edit'));

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#8FA89B] text-[#0E1D17] font-bold shadow-xs'
                    : 'text-[#EDE7DC] hover:bg-[#1E3A2F] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.id === 'stock-demand-ai' && lowStockAlertCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums bg-[#C85A32] text-white">
                    {lowStockAlertCount}
                  </span>
                )}
                {item.id === 'customer-chat' && unreadChatCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums bg-amber-400 text-stone-900">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="pt-4 border-t border-[#2D5042] space-y-2">
        <div className="px-3 py-2 rounded-xl bg-[#13281F] text-[11px] text-stone-300">
          <span className="text-[#8FA89B] font-semibold block">Logged In:</span>
          <p className="truncate font-mono">{currentUser?.email}</p>
        </div>

        <button
          onClick={onNavigateHome}
          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-stone-300 hover:text-white hover:bg-[#1E3A2F] rounded-xl transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[#8FA89B]" />
            <span>View Storefront</span>
          </span>
          <span className="text-[10px] text-stone-400">Live</span>
        </button>

        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 bg-[#162B23] border-r border-[#2D5042] fixed inset-y-0 left-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-[#162B23] shadow-2xl z-50">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E5DFD7] px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1E3A2F]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#1E3A2F]">
                {settings.storeName} Management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => onTabChange('stock-demand-ai')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentTab === 'stock-demand-ai'
                  ? 'bg-[#1E3A2F] text-white shadow-xs'
                  : 'bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1A1E1C]'
              }`}
              title="স্টকের সকল খবরা-খবর ও কাস্টমার ডিমান্ড AI"
            >
              <TrendingUp className={`w-3.5 h-3.5 ${currentTab === 'stock-demand-ai' ? 'text-[#8FA89B]' : 'text-[#1E3A2F]'}`} />
              <span>Stock & Demand AI</span>
            </button>

            <button
              onClick={() => {
                setCopilotTopicHint(null);
                setIsCopilotOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#162B23] hover:bg-[#1E3A2F] text-white rounded-lg text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              title="আগের AI — ছবি ও বিবরণ দিয়ে প্রোডাক্ট যোগ করুন"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#8FA89B]" />
              <span>AI Product Adder</span>
            </button>

            <button
              onClick={() => onTabChange('customer-chat')}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentTab === 'customer-chat'
                  ? 'bg-[#1E3A2F] text-white shadow-xs'
                  : 'bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1A1E1C]'
              }`}
              title="Open Customer Live Chat"
            >
              <MessageSquareText className={`w-3.5 h-3.5 ${currentTab === 'customer-chat' ? 'text-[#8FA89B]' : 'text-[#1E3A2F]'}`} />
              <span>Customer Chat</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums bg-amber-400 text-stone-900">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-stone-400 text-[#1A1E1C] rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Customer Store</span>
            </button>
          </div>
        </header>

        {/* Subpage Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Floating Dual-AI Quick Triggers */}
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          {currentTab !== 'stock-demand-ai' && (
            <button
              type="button"
              onClick={() => onTabChange('stock-demand-ai')}
              className="bg-white text-[#1A1E1C] hover:bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-full px-3.5 py-2.5 shadow-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="স্টক ও কাস্টমার ডিমান্ড AI খুলুন"
            >
              <TrendingUp className="w-4 h-4 text-[#1E3A2F]" />
              <span className="text-xs font-bold">Stock & Demand AI</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCopilotTopicHint(null);
              setIsCopilotOpen(true);
            }}
            className="bg-[#162B23] text-white hover:bg-[#1E3A2F] border border-[#2D5042] rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="আগের AI দিয়ে সাইটে প্রোডাক্ট যোগ করুন"
          >
            <Bot className="w-4 h-4 text-[#8FA89B]" />
            <span className="text-xs font-bold">AI Product Adder</span>
          </button>
        </div>

        {/* Previous AI Modal — Product Adder */}
        <AdminAICopilotModal
          isOpen={isCopilotOpen}
          onClose={() => {
            setIsCopilotOpen(false);
            setCopilotTopicHint(null);
          }}
          onNavigateTab={(tab) => onTabChange(tab as AdminTab)}
          initialTopic={copilotTopicHint}
        />
      </div>
    </div>
  );
};
