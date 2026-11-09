import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  X,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Search,
  Check
} from 'lucide-react';
import { getProducts, getCategories, getLocalProductsCache, getLocalCategoriesCache } from '../firebase/db';
import type { Product, Category } from '../types';
import { ProductCard } from '../components/common/ProductCard';
import { ProductCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';

interface ShopPageProps {
  initialSearch?: string;
  initialCategory?: string;
  onNavigate: (path: string) => void;
  onQuickView?: (product: Product) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({
  initialSearch = '',
  initialCategory = '',
  onNavigate,
  onQuickView
}) => {
  const [products, setProducts] = useState<Product[]>(() =>
    getLocalProductsCache().filter((p) => p.active !== false)
  );
  const [categories, setCategories] = useState<Category[]>(() => getLocalCategoriesCache());
  const [loading, setLoading] = useState(
    () => getLocalProductsCache().length === 0 && getLocalCategoriesCache().length === 0
  );

  // Filters state
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [priceRange, setPriceRange] = useState<number>(25000); // max slider
  const [sortBy, setSortBy] = useState<string>('newest');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setSelectedCategory(initialCategory);
    setSelectedSubcategory('');
  }, [initialCategory]);

  useEffect(() => {
    async function loadData() {
      try {
        const [prods, cats] = await Promise.all([
          getProducts({ activeOnly: true }),
          getCategories(true)
        ]);
        setProducts(prods);
        setCategories(cats);
      } catch (err) {
        console.warn('Error fetching shop data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const handleCategoryUpdate = () => {
      setCategories(getLocalCategoriesCache());
    };

    const handleProductUpdate = () => {
      setProducts(getLocalProductsCache().filter((p) => p.active !== false));
    };

    window.addEventListener('aesthetx-categories-updated', handleCategoryUpdate);
    window.addEventListener('aesthetx-products-updated', handleProductUpdate);

    return () => {
      window.removeEventListener('aesthetx-categories-updated', handleCategoryUpdate);
      window.removeEventListener('aesthetx-products-updated', handleProductUpdate);
    };
  }, []);

  // Compute available brands
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand?.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Current selected category object
  const currentCategoryObj = useMemo(() => {
    if (!selectedCategory) return null;
    const catLow = selectedCategory.toLowerCase();
    return categories.find(
      (c) => c.slug.toLowerCase() === catLow || c.name.toLowerCase() === catLow
    ) || null;
  }, [categories, selectedCategory]);

  // Compute available sizes and colors from loaded products
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.sizes?.forEach((s) => set.add(s));
    });
    return Array.from(set);
  }, [products]);

  const availableColors = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      p.colors?.forEach((c) => {
        if (c.name && !map.has(c.name)) {
          map.set(c.name, c.hexCode || '#000000');
        }
      });
    });
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (search) {
          const s = search.toLowerCase();
          const matchesName = p.name.toLowerCase().includes(s);
          const matchesCategory = p.category?.toLowerCase().includes(s);
          const matchesSubcat = p.subcategory?.toLowerCase().includes(s);
          const matchesBrand = p.brand?.toLowerCase().includes(s);
          const matchesModel = p.model?.toLowerCase().includes(s);
          const matchesSku = p.sku?.toLowerCase().includes(s);
          const matchesTags = p.tags?.some((t) => t.toLowerCase().includes(s));
          const matchesSpecs = p.specifications?.some(
            (sp) => sp.key.toLowerCase().includes(s) || sp.value.toLowerCase().includes(s)
          );
          if (
            !matchesName &&
            !matchesCategory &&
            !matchesSubcat &&
            !matchesBrand &&
            !matchesModel &&
            !matchesSku &&
            !matchesTags &&
            !matchesSpecs
          ) {
            return false;
          }
        }

        // Category matching (supports slug, title, normalized slug)
        if (selectedCategory) {
          const cat = selectedCategory.toLowerCase();
          const pCat = (p.category || '').toLowerCase();
          const pSlug = (p.categorySlug || '').toLowerCase();
          const pSub = (p.subcategory || '').toLowerCase();

          const catNameLower = (currentCategoryObj?.name || '').toLowerCase();
          const catSlugLower = (currentCategoryObj?.slug || '').toLowerCase();

          const matchesCategory =
            pCat === cat ||
            pSlug === cat ||
            (catNameLower && pCat === catNameLower) ||
            (catSlugLower && (pSlug === catSlugLower || pCat.replace(/[^a-z0-9]+/g, '-') === catSlugLower)) ||
            pCat.replace(/[^a-z0-9]+/g, '-') === cat ||
            pSub === cat ||
            (catNameLower && pSub === catNameLower);

          if (!matchesCategory) {
            return false;
          }
        }

        // Subcategory
        if (selectedSubcategory) {
          if (p.subcategory?.toLowerCase() !== selectedSubcategory.toLowerCase()) {
            return false;
          }
        }

        // Brand
        if (selectedBrand) {
          if (p.brand?.toLowerCase() !== selectedBrand.toLowerCase()) {
            return false;
          }
        }

        // Size
        if (selectedSize && (!p.sizes || !p.sizes.includes(selectedSize))) {
          return false;
        }

        // Color
        if (
          selectedColor &&
          (!p.colors ||
            !p.colors.some((c) => c.name.toLowerCase() === selectedColor.toLowerCase()))
        ) {
          return false;
        }

        // Stock
        if (inStockOnly && (p.totalStock || 0) <= 0) {
          return false;
        }

        // Price
        const effectivePrice = p.salePrice || p.price;
        if (effectivePrice > priceRange) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = a.salePrice || a.price;
        const priceB = b.salePrice || b.price;

        if (sortBy === 'price-low') return priceA - priceB;
        if (sortBy === 'price-high') return priceB - priceA;
        if (sortBy === 'popular') return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
        if (sortBy === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);

        // default: newest
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });
  }, [
    products,
    search,
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    selectedSize,
    selectedColor,
    inStockOnly,
    priceRange,
    sortBy
  ]);

  const hasActiveFilters = Boolean(
    search ||
      selectedCategory ||
      selectedSubcategory ||
      selectedBrand ||
      selectedSize ||
      selectedColor ||
      inStockOnly ||
      priceRange < 25000
  );

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedBrand('');
    setSelectedSize('');
    setSelectedColor('');
    setInStockOnly(false);
    setPriceRange(25000);
    setSortBy('newest');
  };

  const FilterSidebarContent = (
    <div className="space-y-6">
      {/* Category Filter */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] mb-3">
          Departments
        </h4>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          <button
            onClick={() => {
              setSelectedCategory('');
              setSelectedSubcategory('');
            }}
            className={`w-full text-left text-xs py-1.5 px-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
              !selectedCategory
                ? 'bg-[#1E3A2F] text-white font-bold'
                : 'text-[#626C66] hover:bg-stone-100'
            }`}
          >
            All Departments
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCategory(c.slug || c.name);
                setSelectedSubcategory('');
              }}
              className={`w-full text-left text-xs py-1.5 px-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory.toLowerCase() === (c.slug || c.name).toLowerCase()
                  ? 'bg-[#1E3A2F] text-white font-bold'
                  : 'text-[#626C66] hover:bg-stone-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory Filter (when available) */}
      {currentCategoryObj?.subcategories && currentCategoryObj.subcategories.length > 0 && (
        <div className="pt-4 border-t border-[#EFEBE5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] mb-2.5">
            Subcategories
          </h4>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSubcategory('')}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                !selectedSubcategory
                  ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white font-bold'
                  : 'border-[#E5DFD7] text-stone-700 bg-white hover:border-stone-400'
              }`}
            >
              All
            </button>
            {currentCategoryObj.subcategories.map((sub) => (
              <button
                key={sub}
                onClick={() =>
                  setSelectedSubcategory(selectedSubcategory === sub ? '' : sub)
                }
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                  selectedSubcategory === sub
                    ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white font-bold'
                    : 'border-[#E5DFD7] text-stone-700 bg-white hover:border-stone-400'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brand Filter */}
      {availableBrands.length > 0 && (
        <div className="pt-4 border-t border-[#EFEBE5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] mb-2.5">
            Brands
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            <button
              onClick={() => setSelectedBrand('')}
              className={`w-full text-left text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                !selectedBrand
                  ? 'bg-stone-200 text-[#1A1E1C] font-bold'
                  : 'text-[#626C66] hover:bg-stone-100'
              }`}
            >
              All Brands
            </button>
            {availableBrands.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(selectedBrand === b ? '' : b)}
                className={`w-full text-left text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                  selectedBrand.toLowerCase() === b.toLowerCase()
                    ? 'bg-[#1E3A2F] text-white font-bold'
                    : 'text-[#626C66] hover:bg-stone-100'
                }`}
              >
                <span>{b}</span>
                {selectedBrand.toLowerCase() === b.toLowerCase() && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size Filter */}
      {availableSizes.length > 0 && (
        <div className="pt-4 border-t border-[#EFEBE5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] mb-3">
            Sizes
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(selectedSize === size ? '' : size)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  selectedSize === size
                    ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white'
                    : 'border-[#E5DFD7] text-[#1A1E1C] bg-white hover:border-stone-400'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Filter */}
      {availableColors.length > 0 && (
        <div className="pt-4 border-t border-[#EFEBE5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] mb-3">
            Colors
          </h4>
          <div className="flex flex-wrap gap-2">
            {availableColors.map((c) => (
              <button
                key={c.name}
                onClick={() => setSelectedColor(selectedColor === c.name ? '' : c.name)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  selectedColor.toLowerCase() === c.name.toLowerCase()
                    ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white'
                    : 'border-[#E5DFD7] text-[#1A1E1C] bg-white hover:border-stone-400'
                }`}
                title={c.name}
              >
                <span
                  className="w-3 h-3 rounded-full border border-stone-300 inline-block shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range Slider */}
      <div className="pt-4 border-t border-[#EFEBE5]">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C]">
            Max Price
          </h4>
          <span className="text-xs font-bold text-[#1E3A2F]">
            ৳{priceRange.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min="500"
          max="10000"
          step="100"
          value={priceRange}
          onChange={(e) => setPriceRange(Number(e.target.value))}
          className="w-full accent-[#1E3A2F] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[#626C66] mt-1">
          <span>৳500</span>
          <span>৳10,000+</span>
        </div>
      </div>

      {/* Availability */}
      <div className="pt-4 border-t border-[#EFEBE5]">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1A1E1C]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 rounded text-[#1E3A2F] focus:ring-[#1E3A2F] border-stone-300 accent-[#1E3A2F]"
          />
          <span>In Stock Only</span>
        </label>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-[#EFEBE5]">
          <button
            onClick={clearAllFilters}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#FAF8F5] hover:bg-stone-100 text-[#C85A32] rounded-lg text-xs font-bold transition-colors cursor-pointer border border-[#E5DFD7]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Title & Sort Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E5DFD7] gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C]">
            {selectedCategory
              ? `Department: ${currentCategoryObj?.name || selectedCategory}`
              : 'Marketplace Catalog'}
          </h1>
          <p className="text-xs sm:text-sm text-[#626C66] mt-1">
            Discover quality products across fashion, electronics, home essentials & more.
            Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* Search, Filter Trigger & Sort dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search inside shop */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in shop..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD7] rounded-xl text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Sheet Trigger */}
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E5DFD7] rounded-xl text-xs font-bold text-[#1A1E1C]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#1E3A2F]" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#C85A32]" />
            )}
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-[#E5DFD7] rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F] cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="popular">Most Popular</option>
              <option value="featured">Featured First</option>
            </select>
            <ChevronDown className="w-4 h-4 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Layout: Desktop Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pt-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-1">
          <div className="sticky top-28 bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#EFEBE5] mb-5">
              <span className="font-bold text-sm text-[#1A1E1C] flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#1E3A2F]" />
                <span>Filter Items</span>
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-[#C85A32] font-semibold hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            {FilterSidebarContent}
          </div>
        </aside>

        {/* Product Grid Area */}
        <main className="lg:col-span-3">
          {/* Subcategories Quick Pills for Selected Category */}
          {currentCategoryObj && currentCategoryObj.subcategories && currentCategoryObj.subcategories.length > 0 && (
            <div className="mb-6 p-4 bg-white border border-[#E5DFD7] rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-[#626C66] uppercase tracking-wider block mb-2">
                Subcategories in {currentCategoryObj.name}:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSubcategory('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !selectedSubcategory
                      ? 'bg-[#1E3A2F] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-[#1A1E1C] border border-[#E5DFD7] hover:border-[#1E3A2F]'
                  }`}
                >
                  All {currentCategoryObj.name}
                </button>
                {currentCategoryObj.subcategories.map((sub, i) => {
                  const isSubActive = selectedSubcategory.toLowerCase() === sub.toLowerCase();
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedSubcategory(isSubActive ? '' : sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSubActive
                          ? 'bg-[#1E3A2F] text-white font-bold shadow-xs'
                          : 'bg-[#FAF8F5] text-[#1A1E1C] border border-[#E5DFD7] hover:border-[#1E3A2F]'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-white border border-[#E5DFD7] rounded-xl text-xs">
              <span className="font-bold text-[#1A1E1C] shrink-0">Filters:</span>

              {selectedCategory && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Dept: {currentCategoryObj?.name || selectedCategory}</span>
                  <button
                    onClick={() => {
                      setSelectedCategory('');
                      setSelectedSubcategory('');
                    }}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedSubcategory && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Subcat: {selectedSubcategory}</span>
                  <button onClick={() => setSelectedSubcategory('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedBrand && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Brand: {selectedBrand}</span>
                  <button onClick={() => setSelectedBrand('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {search && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Search: &quot;{search}&quot;</span>
                  <button onClick={() => setSearch('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {inStockOnly && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>In Stock Only</span>
                  <button onClick={() => setInStockOnly(false)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {priceRange < 25000 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Under ৳{priceRange.toLocaleString()}</span>
                  <button onClick={() => setPriceRange(25000)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedSize && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Size: {selectedSize}</span>
                  <button onClick={() => setSelectedSize('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedColor && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-lg font-medium text-[#1E3A2F]">
                  <span>Color: {selectedColor}</span>
                  <button onClick={() => setSelectedColor('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="ml-auto text-xs text-[#C85A32] font-bold hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={onQuickView}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={hasActiveFilters ? 'No Matching Products' : 'No Products Available Yet'}
              description={
                hasActiveFilters
                  ? 'No items matched your current filter criteria. Try resetting filters or adjusting search terms.'
                  : 'There are currently no products published in this store collection. Check back soon!'
              }
              actionText={hasActiveFilters ? 'Reset Filters' : 'Go Home'}
              onAction={hasActiveFilters ? clearAllFilters : () => onNavigate('/')}
            />
          )}
        </main>
      </div>

      {/* Mobile Filters Bottom Sheet / Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5DFD7] mb-4">
              <h3 className="font-bold text-base text-[#1A1E1C] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#1E3A2F]" />
                <span>Refine Results</span>
              </h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-full text-stone-500 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {FilterSidebarContent}

            <div className="pt-6 mt-6 border-t border-[#E5DFD7]">
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full py-3 bg-[#1E3A2F] text-white rounded-xl font-bold text-sm text-center"
              >
                Apply Filters ({filteredProducts.length} Results)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
