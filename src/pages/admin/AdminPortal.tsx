import React, { useState } from 'react';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminLayout, type AdminTab } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminProducts } from './AdminProducts';
import { AdminProductForm } from './AdminProductForm';
import { AdminCategories } from './AdminCategories';
import { AdminOrders } from './AdminOrders';
import { AdminDeliveredOrders } from './AdminDeliveredOrders';
import { AdminInventory } from './AdminInventory';
import { AdminCustomers } from './AdminCustomers';
import { AdminCoupons } from './AdminCoupons';
import { AdminDelivery } from './AdminDelivery';
import { AdminBanners } from './AdminBanners';
import { AdminPages } from './AdminPages';
import { AdminReviews } from './AdminReviews';
import { AdminSettings } from './AdminSettings';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminSupport } from './AdminSupport';
import { AdminCustomerChat } from './AdminCustomerChat';
import { AdminPayments } from './AdminPayments';
import { AdminStockDemandAI } from './AdminStockDemandAI';
import type { Product, Order } from '../../types';

interface AdminPortalProps {
  onNavigateHome: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onNavigateHome }) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [visitedTabs, setVisitedTabs] = useState<Set<AdminTab>>(() => new Set(['dashboard']));
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleTabChange = (tab: AdminTab) => {
    if (tab !== 'product-edit') {
      setEditingProduct(null);
    }
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setCurrentTab(tab);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    handleTabChange('product-edit');
  };

  const handleAddNewProduct = () => {
    setEditingProduct(null);
    handleTabChange('product-new');
  };

  const handleProductSaved = () => {
    setEditingProduct(null);
    handleTabChange('products');
  };

  return (
    <AdminAuthGate onNavigateHome={onNavigateHome}>
      <AdminLayout
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onNavigateHome={onNavigateHome}
      >
        {/* Persistent Kept-Alive Tabs (Instantaneous Tab Switching 0ms) */}
        {visitedTabs.has('dashboard') && (
          <div className={currentTab === 'dashboard' ? 'block' : 'hidden'}>
            <AdminDashboard
              onNavigateTab={handleTabChange}
              onOpenOrder={() => handleTabChange('orders')}
            />
          </div>
        )}

        {visitedTabs.has('stock-demand-ai') && (
          <div className={currentTab === 'stock-demand-ai' ? 'block' : 'hidden'}>
            <AdminStockDemandAI onNavigateTab={handleTabChange} />
          </div>
        )}

        {visitedTabs.has('products') && (
          <div className={currentTab === 'products' ? 'block' : 'hidden'}>
            <AdminProducts
              onAddNew={handleAddNewProduct}
              onEditProduct={handleEditProduct}
            />
          </div>
        )}

        {visitedTabs.has('categories') && (
          <div className={currentTab === 'categories' ? 'block' : 'hidden'}>
            <AdminCategories />
          </div>
        )}

        {visitedTabs.has('orders') && (
          <div className={currentTab === 'orders' ? 'block' : 'hidden'}>
            <AdminOrders />
          </div>
        )}

        {visitedTabs.has('payments') && (
          <div className={currentTab === 'payments' ? 'block' : 'hidden'}>
            <AdminPayments />
          </div>
        )}

        {visitedTabs.has('delivered-orders') && (
          <div className={currentTab === 'delivered-orders' ? 'block' : 'hidden'}>
            <AdminDeliveredOrders />
          </div>
        )}

        {visitedTabs.has('customer-chat') && (
          <div className={currentTab === 'customer-chat' ? 'block' : 'hidden'}>
            <AdminCustomerChat onNavigateToAISettings={() => handleTabChange('support')} />
          </div>
        )}

        {visitedTabs.has('support') && (
          <div className={currentTab === 'support' ? 'block' : 'hidden'}>
            <AdminSupport />
          </div>
        )}

        {visitedTabs.has('inventory') && (
          <div className={currentTab === 'inventory' ? 'block' : 'hidden'}>
            <AdminInventory />
          </div>
        )}

        {visitedTabs.has('customers') && (
          <div className={currentTab === 'customers' ? 'block' : 'hidden'}>
            <AdminCustomers />
          </div>
        )}

        {visitedTabs.has('coupons') && (
          <div className={currentTab === 'coupons' ? 'block' : 'hidden'}>
            <AdminCoupons />
          </div>
        )}

        {visitedTabs.has('delivery') && (
          <div className={currentTab === 'delivery' ? 'block' : 'hidden'}>
            <AdminDelivery />
          </div>
        )}

        {visitedTabs.has('banners') && (
          <div className={currentTab === 'banners' ? 'block' : 'hidden'}>
            <AdminBanners />
          </div>
        )}

        {visitedTabs.has('pages') && (
          <div className={currentTab === 'pages' ? 'block' : 'hidden'}>
            <AdminPages />
          </div>
        )}

        {visitedTabs.has('reviews') && (
          <div className={currentTab === 'reviews' ? 'block' : 'hidden'}>
            <AdminReviews />
          </div>
        )}

        {visitedTabs.has('settings') && (
          <div className={currentTab === 'settings' ? 'block' : 'hidden'}>
            <AdminSettings />
          </div>
        )}

        {visitedTabs.has('audit-logs') && (
          <div className={currentTab === 'audit-logs' ? 'block' : 'hidden'}>
            <AdminAuditLogs />
          </div>
        )}

        {/* Transient Edit/Create Forms (Mount/unmount for clean state) */}
        {(currentTab === 'product-new' || currentTab === 'product-edit') && (
          <AdminProductForm
            initialProduct={editingProduct}
            onCancel={() => handleTabChange('products')}
            onSaved={handleProductSaved}
          />
        )}
      </AdminLayout>
    </AdminAuthGate>
  );
};
