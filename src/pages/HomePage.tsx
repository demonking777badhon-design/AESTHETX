import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowRight,
  Sparkles,
  Truck,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  Flame,
  LayoutGrid,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import {
  getProducts,
  getCategories,
  getBanners,
  getLocalProductsCache,
  getLocalCategoriesCache,
  getLocalBannersCache
} from '../firebase/db';
import type { Product, Category, Banner } from '../types';
import { ProductCard } from '../components/common/ProductCard';
import { ProductCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useSettings } from '../context/SettingsContext';

interface HomePageProps {
  onNavigate: (path: string) => void;
  onQuickView?: (product: Product) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onQuickView }) => {
  const { settings } = useSettings();
  const [banners, setBanners] = useState<Banner[]>(() =>
    getLocalBannersCache().filter((b) => b && b.active !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  );
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);
  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState(false);

  const [categories, setCategories] = useState<Category[]>(() => getLocalCategoriesCache());
  const [allProducts, setAllProducts] = useState<Product[]>(() =>
    getLocalProductsCache().filter((p) => p.active !== false).slice(0, 40)
  );
  const [loading, setLoading] = useState(
    () => getLocalProductsCache().length === 0 && getLocalCategoriesCache().length === 0
  );
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'featured'>('all');

  // Sorted active banners
  const activeBanners = useMemo(() => {
    return banners
      .filter((b) => b && b.active !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [banners]);

  // Ensure banner index is valid if banners list changes
  useEffect(() => {
    if (activeBanners.length > 0 && currentBannerIdx >= activeBanners.length) {
      setCurrentBannerIdx(0);
    }
  }, [activeBanners.length, currentBannerIdx]);

  // Auto-change banner every 5 seconds when 2 or more banners exist
  useEffect(() => {
    if (activeBanners.length <= 1 || isAutoPlayPaused) return;

    const interval = setInterval(() => {
      setCurrentBannerIdx((prev) => (prev + 1) % activeBanners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeBanners.length, isAutoPlayPaused]);

  const handlePrevBanner = () => {
    if (activeBanners.length <= 1) return;
    setCurrentBannerIdx((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleNextBanner = () => {
    if (activeBanners.length <= 1) return;
    setCurrentBannerIdx((prev) => (prev + 1) % activeBanners.length);
  };

  const loadHomeData = async () => {
    try {
      const [bannersData, catsData, prods] = await Promise.all([
        getBanners(true),
        getCategories(true),
        getProducts({ activeOnly: true, limitCount: 40 })
      ]);

      setBanners(bannersData.filter((b) => b && b.active !== false));
      setCategories(catsData);
      setAllProducts(prods);
    } catch (err) {
      console.warn('Error loading homepage data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();

    // Listen for real-time updates from Admin without reloading
    const handleCategoryUpdate = () => {
      setCategories(getLocalCategoriesCache().filter((c) => c.active !== false));
    };

    const handleBannerUpdate = () => {
      setBanners(
        getLocalBannersCache()
          .filter((b) => b && b.active !== false)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      );
    };

    const handleProductUpdate = () => {
      setAllProducts(getLocalProductsCache().filter((p) => p.active !== false).slice(0, 40));
    };

    window.addEventListener('aesthetx-categories-updated', handleCategoryUpdate);
    window.addEventListener('aesthetx-banners-updated', handleBannerUpdate);
    window.addEventListener('aesthetx-products-updated', handleProductUpdate);

    return () => {
      window.removeEventListener('aesthetx-categories-updated', handleCategoryUpdate);
      window.removeEventListener('aesthetx-banners-updated', handleBannerUpdate);
      window.removeEventListener('aesthetx-products-updated', handleProductUpdate);
    };
  }, []);

  // Filter products by selected home category & active tabs
  const filteredHomeProducts = useMemo(() => {
    let list = allProducts;

    // 1. Filter by category if selected
    if (selectedCategorySlug && selectedCategorySlug !== 'all') {
      const targetSlug = selectedCategorySlug.toLowerCase();
      const currentCatObj = categories.find((c) => c.slug.toLowerCase() === targetSlug);
      const catNameLower = currentCatObj?.name?.toLowerCase() || '';

      list = list.filter((p) => {
        const pCat = p.category?.toLowerCase() || '';
        const pSlug = p.categorySlug?.toLowerCase() || '';
        const pSub = p.subcategory?.toLowerCase() || '';
        return (
          pSlug === targetSlug ||
          pCat === targetSlug ||
          (catNameLower && pCat === catNameLower) ||
          pSub === targetSlug ||
          (catNameLower && pSub === catNameLower)
        );
      });
    }

    // 2. Filter by status tab if chosen
    if (activeTab === 'new') {
      const newItems = list.filter((p) => p.newArrival);
      return newItems.length > 0 ? newItems : list;
    } else if (activeTab === 'featured') {
      const featItems = list.filter((p) => p.featured);
      return featItems.length > 0 ? featItems : list;
    }

    return list;
  }, [allProducts, selectedCategorySlug, activeTab, categories]);

  // Selected category object
  const activeCategoryObj = useMemo(() => {
    if (!selectedCategorySlug || selectedCategorySlug === 'all') return null;
    return categories.find((c) => c.slug === selectedCategorySlug) || null;
  }, [categories, selectedCategorySlug]);

  return (
    <div className="min-h-screen">
      {/* Hero Section with Auto-Rotating Banner Carousel (Every 5 Seconds) */}
      <section
        className="relative bg-stone-950 text-white overflow-hidden group select-none"
        onMouseEnter={() => setIsAutoPlayPaused(true)}
        onMouseLeave={() => setIsAutoPlayPaused(false)}
      >
        {activeBanners.length > 0 ? (
          <div className="relative min-h-[460px] sm:min-h-[520px] md:min-h-[580px] lg:min-h-[620px] flex items-center overflow-hidden">
            {activeBanners.map((banner, index) => {
              const isActive = index === currentBannerIdx;
              return (
                <div
                  key={banner.id || index}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out flex items-center ${
                    isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {/* Clean Natural Banner Image: Original true colors without any green tint */}
                  {banner.image ? (
                    <div className="absolute inset-0 w-full h-full">
                      <img
                        src={banner.image}
                        alt={banner.title}
                        className="w-full h-full object-cover object-center"
                      />
                      {/* Neutral dark gradient overlay for text readability without altering the photo's colors */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 md:bg-gradient-to-r md:from-black/85 md:via-black/50 md:to-black/10" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-950 to-black" />
                  )}

                  {/* Banner Content */}
                  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 z-10 w-full animate-fade-in-up">
                    <div className="max-w-2xl space-y-4 sm:space-y-5">
                      {banner.tagline && (
                        <span className="inline-flex items-center gap-2 bg-[#C85A32] text-white px-3.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase shadow-md animate-pulse-glow">
                          <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                          {banner.tagline}
                        </span>
                      )}

                      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md transition-transform duration-300">
                        {banner.title}
                      </h1>

                      {banner.subtitle && (
                        <p className="text-sm sm:text-lg text-stone-200 leading-relaxed max-w-xl font-normal drop-shadow-sm">
                          {banner.subtitle}
                        </p>
                      )}

                      <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-4">
                        <button
                          onClick={() => onNavigate(banner.buttonLink || '/shop')}
                          className="button-interactive inline-flex items-center gap-2 bg-[#C85A32] hover:bg-[#B24E2A] text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide shadow-xl hover:shadow-2xl cursor-pointer"
                        >
                          <span>{banner.buttonText || 'Shop Collection'}</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                        <button
                          onClick={() => onNavigate('/track-order')}
                          className="button-interactive inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-semibold text-xs sm:text-sm backdrop-blur-md border border-white/20 cursor-pointer"
                        >
                          <span>Track Order</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Carousel Controls (Displayed when 2 or more banners exist) */}
            {activeBanners.length > 1 && (
              <>
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={handlePrevBanner}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 cursor-pointer shadow-xl button-interactive"
                  aria-label="Previous Banner"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNextBanner}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 cursor-pointer shadow-xl button-interactive"
                  aria-label="Next Banner"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                {/* Indicator Dots */}
                <div className="absolute bottom-5 inset-x-0 z-20 flex items-center justify-center gap-2">
                  {activeBanners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentBannerIdx(idx)}
                      className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                        idx === currentBannerIdx
                          ? 'w-7 sm:w-8 bg-[#C85A32] shadow-md scale-105'
                          : 'w-2 sm:w-2.5 bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`Go to banner ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Brand Ethos Hero when database banners are not yet added */
          <div className="relative min-h-[460px] md:min-h-[540px] flex items-center justify-center text-center">
            <div className="absolute inset-0 bg-radial from-stone-800 via-stone-900 to-black opacity-95" />
            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-10 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-stone-200 text-xs font-bold uppercase tracking-wider mb-6 animate-pulse-glow">
                <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Premier Bangladeshi Multi-Category Marketplace</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F9F6F0] leading-tight mb-4">
                {settings.storeName}
              </h1>

              <p className="text-lg sm:text-2xl font-light text-[#8FA89B] italic tracking-wide max-w-2xl mx-auto mb-8">
                &ldquo;{settings.tagline}&rdquo;
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => onNavigate('/shop')}
                  className="button-interactive inline-flex items-center gap-2 bg-[#C85A32] hover:bg-[#B24E2A] text-white px-8 py-4 rounded-xl font-bold text-sm tracking-wider uppercase shadow-xl cursor-pointer"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('/track-order')}
                  className="button-interactive inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-7 py-4 rounded-xl font-semibold text-sm backdrop-blur-xs border border-white/20 cursor-pointer"
                >
                  <span>Track Existing Order</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Trust Highlights Strip with Smooth Hover Lift & Float Animations */}
      <section className="bg-white border-b border-[#E5DFD7] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="card-hover-lift flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-transparent hover:border-[#E5DFD7] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#1E3A2F]/10 flex items-center justify-center text-[#1E3A2F] shrink-0 animate-bounce-subtle">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A1E1C]">Delivery in All BD</p>
                <p className="text-[11px] text-[#626C66]">Doorstep delivery across 64 districts</p>
              </div>
            </div>

            <div className="card-hover-lift flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-transparent hover:border-[#E5DFD7] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#C85A32]/10 flex items-center justify-center text-[#C85A32] shrink-0 animate-bounce-subtle">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A1E1C]">Cash on Delivery</p>
                <p className="text-[11px] text-[#626C66]">Check items upon delivery</p>
              </div>
            </div>

            <div className="card-hover-lift flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-transparent hover:border-[#E5DFD7] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#1E3A2F]/10 flex items-center justify-center text-[#1E3A2F] shrink-0 animate-bounce-subtle">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A1E1C]">7-Day Easy Exchange</p>
                <p className="text-[11px] text-[#626C66]">Hassle-free replacement policy</p>
              </div>
            </div>

            <div className="card-hover-lift flex items-center gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-transparent hover:border-[#E5DFD7] transition-all">
              <div className="w-10 h-10 rounded-full bg-[#C85A32]/10 flex items-center justify-center text-[#C85A32] shrink-0 animate-bounce-subtle">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1A1E1C]">Fast Support</p>
                <p className="text-[11px] text-[#626C66]">WhatsApp 01708943242</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Featured & Category-Filtered Product Showcase on Home */}
      <section className="py-12 bg-white border-y border-[#E5DFD7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-[#EFEBE5] gap-4">
            <div>
              <span className="text-xs font-bold tracking-widest text-[#C85A32] uppercase">
                Explore Marketplace Products
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C] mt-1">
                {activeCategoryObj ? activeCategoryObj.name : 'Trending & New Arrivals'}
              </h2>
              {activeCategoryObj && activeCategoryObj.description && (
                <p className="text-xs sm:text-sm text-[#626C66] mt-1">
                  {activeCategoryObj.description}
                </p>
              )}
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD7] text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#1E3A2F] text-[#F9F6F0] shadow-xs'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('new')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'new'
                    ? 'bg-[#1E3A2F] text-[#F9F6F0] shadow-xs'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                New Arrivals
              </button>
              <button
                onClick={() => setActiveTab('featured')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'featured'
                    ? 'bg-[#1E3A2F] text-[#F9F6F0] shadow-xs'
                    : 'text-[#626C66] hover:text-[#1A1E1C]'
                }`}
              >
                Featured
              </button>
            </div>
          </div>

          {/* Interactive Category Selector Pills on Home Page */}
          <div className="py-4 overflow-x-auto scrollbar-none flex items-center gap-2 border-b border-[#EFEBE5]">
            <button
              onClick={() => setSelectedCategorySlug('all')}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategorySlug === 'all'
                  ? 'bg-[#1E3A2F] text-white shadow-xs'
                  : 'bg-[#FAF8F5] text-[#1A1E1C] border border-[#E5DFD7] hover:border-[#1E3A2F]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Categories</span>
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategorySlug === cat.slug;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E3A2F] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-[#1A1E1C] border border-[#E5DFD7] hover:border-[#1E3A2F]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Products Grid */}
          <div className="pt-8">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredHomeProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {filteredHomeProducts.slice(0, 12).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onQuickView={onQuickView}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-[#FAF8F5] border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
                <h3 className="font-bold text-base text-[#1A1E1C]">
                  {activeCategoryObj
                    ? `No products listed in "${activeCategoryObj.name}" yet`
                    : 'No products available right now'}
                </h3>
                <p className="text-xs text-[#626C66] max-w-sm mx-auto">
                  New inventory is added regularly. Explore the complete marketplace collection or view all categories.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  {selectedCategorySlug !== 'all' && (
                    <button
                      onClick={() => setSelectedCategorySlug('all')}
                      className="px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold"
                    >
                      Show All Categories
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('/shop')}
                    className="px-4 py-2 bg-white border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold hover:bg-stone-50"
                  >
                    View All in Shop
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7]">
            <div>
              <p className="text-xs font-bold text-[#1A1E1C]">
                {activeCategoryObj
                  ? `Browsing ${activeCategoryObj.name}`
                  : 'Browsing All Marketplace Departments'}
              </p>
              <p className="text-[11px] text-[#626C66]">
                Find the best deals with easy Cash on Delivery and fast nationwide shipping.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeCategoryObj && (
                <button
                  onClick={() => onNavigate(`/category/${activeCategoryObj.slug}`)}
                  className="inline-flex items-center gap-1.5 bg-[#C85A32] hover:bg-[#B24E2A] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <span>Open {activeCategoryObj.name} in Shop</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onNavigate('/shop')}
                className="inline-flex items-center gap-1.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                <span>View Full Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Statement Strip */}
      <section className="bg-[#FAF8F5] py-16 border-b border-[#E5DFD7]">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center mx-auto">
            <Flame className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#1A1E1C] tracking-tight">
            Elevate Your Everyday Lifestyle
          </h2>
          <p className="text-sm sm:text-base text-[#626C66] max-w-2xl mx-auto leading-relaxed">
            Crafted for style, durability, and convenience. We believe quality lifestyle goods, electronics, and fashion should be accessible with nationwide cash on delivery throughout Bangladesh.
          </p>
        </div>
      </section>
    </div>
  );
};
