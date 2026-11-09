import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

// Common Components
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { MobileNavigation } from './components/common/MobileNavigation';
import { CustomerSupportChat } from './components/common/CustomerSupportChat';

// Customer Pages
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { WishlistPage } from './pages/WishlistPage';
import { AccountPage } from './pages/AccountPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { StaticInfoPage } from './pages/StaticInfoPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin Portal
import { AdminPortal } from './pages/admin/AdminPortal';
import type { Product } from './types';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    // Read route from hash or pathname
    const hash = window.location.hash.replace('#', '');
    return hash || window.location.pathname || '/';
  });

  const [lastPlacedOrderId, setLastPlacedOrderId] = useState<string | null>(null);
  const [lastPlacedOrderNum, setLastPlacedOrderNum] = useState<string | null>(null);

  // Sync route on popstate or hashchange
  useEffect(() => {
    const handleRouteChange = () => {
      const hash = window.location.hash.replace('#', '');
      const path = hash || window.location.pathname || '/';
      setCurrentRoute(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSuccess = (orderId: string, orderNumber: string) => {
    setLastPlacedOrderId(orderId);
    setLastPlacedOrderNum(orderNumber);
    navigate(`/order-confirmation/${orderId}`);
  };

  // Route parser
  const renderRoute = () => {
    // Check Admin Route first
    if (currentRoute.startsWith('/admin')) {
      return <AdminPortal onNavigateHome={() => navigate('/')} />;
    }

    // Checkout Route
    if (currentRoute.startsWith('/checkout')) {
      return (
        <CheckoutPage
          onNavigate={navigate}
          onOrderSuccess={handleOrderSuccess}
        />
      );
    }

    // Order Confirmation Route
    if (currentRoute.startsWith('/order-confirmation')) {
      const parts = currentRoute.split('/');
      const orderIdFromUrl = parts[2] || lastPlacedOrderId || '';
      return (
        <OrderConfirmationPage
          orderId={orderIdFromUrl}
          orderNumber={lastPlacedOrderNum || undefined}
          onNavigate={navigate}
        />
      );
    }

    // Cart Route
    if (currentRoute.startsWith('/cart')) {
      return <CartPage onNavigate={navigate} />;
    }

    // Wishlist Route
    if (currentRoute.startsWith('/wishlist')) {
      return <WishlistPage onNavigate={navigate} />;
    }

    // Account Route
    if (currentRoute.startsWith('/account')) {
      return <AccountPage onNavigate={navigate} />;
    }

    // My Orders Route (All orders placed from this account with full details)
    if (currentRoute.startsWith('/my-orders') || currentRoute.startsWith('/orders')) {
      return <MyOrdersPage onNavigate={navigate} />;
    }

    // Track Order Route
    if (currentRoute.startsWith('/track-order')) {
      const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
      const initialId = urlParams.get('id') || '';
      const initialPhone = urlParams.get('phone') || '';
      return (
        <TrackOrderPage
          initialOrderId={initialId}
          initialPhone={initialPhone}
          onNavigate={navigate}
        />
      );
    }

    // Product Detail Route
    if (currentRoute.startsWith('/product/')) {
      const parts = currentRoute.split('/');
      const productIdOrSlug = parts[2] || '';
      return (
        <ProductDetailPage
          productIdOrSlug={productIdOrSlug}
          onNavigate={navigate}
        />
      );
    }

    // Category Route
    if (currentRoute.startsWith('/category/')) {
      const parts = currentRoute.split('/');
      const categorySlug = decodeURIComponent(parts[2] || '');
      return (
        <ShopPage
          initialCategory={categorySlug}
          onNavigate={navigate}
        />
      );
    }

    // Shop Route with query params
    if (currentRoute.startsWith('/shop')) {
      const urlParams = new URLSearchParams(currentRoute.split('?')[1] || '');
      const searchParam = urlParams.get('search') || '';
      const catParam = urlParams.get('category') || '';
      return (
        <ShopPage
          initialSearch={searchParam}
          initialCategory={catParam}
          onNavigate={navigate}
        />
      );
    }

    // Static Information Pages
    const staticSlugs = [
      'about',
      'contact',
      'privacy-policy',
      'terms',
      'shipping-policy',
      'return-policy',
      'size-guide',
      'faq'
    ];

    const matchedStatic = staticSlugs.find((s) => currentRoute === `/${s}`);
    if (matchedStatic) {
      return <StaticInfoPage slug={matchedStatic} onNavigate={navigate} />;
    }

    // Home Page
    if (currentRoute === '/' || currentRoute === '') {
      return <HomePage onNavigate={navigate} />;
    }

    // 404
    return <NotFoundPage onNavigate={navigate} />;
  };

  const isAdminRoute = currentRoute.startsWith('/admin');

  return (
    <SettingsProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1A1E1C]">
              {!isAdminRoute && (
                <Navbar
                  currentPath={currentRoute}
                  onNavigate={navigate}
                  onSearch={(term) => navigate(`/shop?search=${encodeURIComponent(term)}`)}
                />
              )}

              <main className="flex-1">
                {renderRoute()}
              </main>

              {!isAdminRoute && (
                <>
                  <Footer onNavigate={navigate} />
                  <MobileNavigation currentPath={currentRoute} onNavigate={navigate} />
                  <CustomerSupportChat onNavigate={navigate} />
                </>
              )}
            </div>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
