import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  User as UserIcon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Compass,
  PhoneCall,
  Info,
  PackageCheck,
  Layers
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { getCategories } from '../../firebase/db';
import type { Category } from '../../types';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onSearch?: (term: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onSearch }) => {
  const { totalItemsCount, subtotal } = useCart();
  const { wishlistIds } = useWishlist();
  const { currentUser, isAdmin } = useAuth();
  const { settings } = useSettings();

  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const catDropdownRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCatMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setCatDropdownOpen(true);
  };

  const handleCatMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setCatDropdownOpen(false);
      setActiveCategory(null);
    }, 280);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target as Node)) {
        setCatDropdownOpen(false);
        setActiveCategory(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    getCategories(true).then(setCategories).catch(console.warn);

    const handleUpdate = () => {
      getCategories(true).then(setCategories).catch(console.warn);
    };

    window.addEventListener('aesthetx-categories-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetx-categories-updated', handleUpdate);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      if (onSearch) {
        onSearch(searchTerm.trim());
      }
      onNavigate(`/shop?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchOpen(false);
    }
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/shop' }
  ];

  const logoSrc = settings.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5DFD7] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Mobile Menu Trigger + Brand Logo + Left Categories 3-Lines Icon */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-[#1A1E1C] hover:bg-[#FAF8F5] focus:outline-hidden"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* Official Website Logo */}
              <button
                onClick={() => onNavigate('/')}
                className="flex items-center gap-3 group text-left cursor-pointer focus:outline-hidden"
              >
                <img
                  src={logoSrc}
                  alt={settings.storeName}
                  className="h-14 sm:h-16 w-auto object-contain transition-transform group-hover:scale-102"
                />
              </button>

              {/* Categories with 3-Line (Menu) Icon on the Left */}
              {categories.length > 0 && (
                <div
                  ref={catDropdownRef}
                  className="hidden lg:block relative ml-2"
                  onMouseEnter={handleCatMouseEnter}
                  onMouseLeave={handleCatMouseLeave}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (catDropdownOpen) {
                        setCatDropdownOpen(false);
                        setActiveCategory(null);
                      } else {
                        setCatDropdownOpen(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs select-none ${
                      catDropdownOpen
                        ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                        : 'bg-[#FAF8F5] hover:bg-[#EDE7DC] border-[#E5DFD7] text-[#1E3A2F]'
                    }`}
                    title="All Categories"
                  >
                    <Menu className={`w-4 h-4 ${catDropdownOpen ? 'text-white' : 'text-[#1E3A2F]'}`} />
                    <span>Categories</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${catDropdownOpen ? 'rotate-180 text-white' : 'text-stone-500'}`} />
                  </button>

                  {catDropdownOpen && (
                    <div 
                      className="absolute top-full left-0 pt-2 z-50"
                      onMouseEnter={handleCatMouseEnter}
                      onMouseLeave={handleCatMouseLeave}
                    >
                      <div className="flex items-start">
                        {/* Primary Category List */}
                        <div className="w-72 bg-white border border-[#E5DFD7] rounded-2xl shadow-2xl py-2 divide-y divide-[#EFEBE5] overflow-hidden">
                          <div className="px-4 py-2.5 bg-[#FAF8F5]/80 text-[11px] font-bold uppercase tracking-wider text-[#626C66] flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[#1E3A2F]">
                              <Layers className="w-3.5 h-3.5" />
                              Browse Categories
                            </span>
                            <span className="text-[10px] text-[#C85A32] font-semibold bg-[#C85A32]/10 px-2 py-0.5 rounded-full">
                              {categories.length} Total
                            </span>
                          </div>

                          <div className="max-h-88 overflow-y-auto py-1">
                            {categories.map((cat) => {
                              const isSelected = activeCategory?.id === cat.id;
                              const hasSubs = cat.subcategories && cat.subcategories.length > 0;

                              return (
                                <div
                                  key={cat.id}
                                  onMouseEnter={() => setActiveCategory(cat)}
                                  className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-[#FAF8F5] text-[#1E3A2F]'
                                      : 'text-[#1A1E1C] hover:bg-[#FAF8F5] hover:text-[#1E3A2F]'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onNavigate(`/category/${cat.slug}`);
                                      setCatDropdownOpen(false);
                                      setActiveCategory(null);
                                    }}
                                    className="flex-1 text-left flex items-center gap-2.5 truncate"
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                                        isSelected ? 'bg-[#C85A32] scale-125' : 'bg-[#1E3A2F]/40'
                                      }`}
                                    />
                                    <span className="truncate">{cat.name}</span>
                                  </button>

                                  {hasSubs ? (
                                    <ChevronRight
                                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                        isSelected ? 'text-[#C85A32]' : 'text-stone-400'
                                      }`}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onNavigate(`/category/${cat.slug}`);
                                        setCatDropdownOpen(false);
                                        setActiveCategory(null);
                                      }}
                                      className="text-[10px] text-[#626C66] hover:text-[#1E3A2F] transition-colors shrink-0 pl-2"
                                    >
                                      &rarr;
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="p-2 bg-[#FAF8F5]/60">
                            <button
                              type="button"
                              onClick={() => {
                                onNavigate('/shop');
                                setCatDropdownOpen(false);
                                setActiveCategory(null);
                              }}
                              className="w-full py-1.5 px-3 text-center text-xs font-bold text-[#1E3A2F] hover:bg-[#EDE7DC] rounded-xl transition-colors cursor-pointer"
                            >
                              View All Products in Shop &rarr;
                            </button>
                          </div>
                        </div>

                        {/* Subcategory Flyout Panel */}
                        {activeCategory && activeCategory.subcategories && activeCategory.subcategories.length > 0 && (
                          <div className="ml-2 w-64 bg-white border border-[#E5DFD7] rounded-2xl shadow-2xl p-3 animate-in fade-in duration-150">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#626C66] mb-2 px-1 flex items-center justify-between">
                              <span className="truncate">{activeCategory.name}</span>
                              <span className="text-[10px] text-[#C85A32] font-semibold bg-[#C85A32]/10 px-2 py-0.5 rounded-full">
                                {activeCategory.subcategories.length}
                              </span>
                            </div>

                            <div className="max-h-72 overflow-y-auto space-y-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigate(`/category/${activeCategory.slug}`);
                                  setCatDropdownOpen(false);
                                  setActiveCategory(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-[#1E3A2F] font-bold bg-[#FAF8F5] hover:bg-[#EDE7DC] rounded-xl transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <span>All in {activeCategory.name}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              {activeCategory.subcategories.map((sub) => (
                                <button
                                  key={sub}
                                  type="button"
                                  onClick={() => {
                                    onNavigate(
                                      `/shop?category=${encodeURIComponent(
                                        activeCategory.name
                                      )}&subcategory=${encodeURIComponent(sub)}`
                                    );
                                    setCatDropdownOpen(false);
                                    setActiveCategory(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-[#1A1E1C] hover:bg-[#FAF8F5] hover:text-[#1E3A2F] rounded-xl font-medium transition-colors truncate cursor-pointer block"
                                >
                                  {sub}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Middle: Desktop Navigation Links (Home, Shop) */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => onNavigate(link.path)}
                    className={`text-sm font-semibold tracking-wide transition-colors relative py-2 cursor-pointer ${
                      isActive
                        ? 'text-[#1E3A2F]'
                        : 'text-[#1A1E1C] hover:text-[#1E3A2F]'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A2F] rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right: Actions (Search, Wishlist, Cart, Account, Admin) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Desktop Quick Search Input */}
              <form
                onSubmit={handleSearchSubmit}
                className="hidden md:flex items-center bg-[#FAF8F5] border border-[#E5DFD7] rounded-full px-3.5 py-1.5 focus-within:border-[#1E3A2F] focus-within:ring-1 focus-within:ring-[#1E3A2F] transition-all w-48 lg:w-64"
              >
                <Search className="w-4 h-4 text-[#626C66] shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Search products, brands, gadgets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#1A1E1C] placeholder-[#626C66] focus:outline-hidden"
                />
              </form>

              {/* Mobile Search Icon Trigger */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2 rounded-full text-[#1A1E1C] hover:bg-[#FAF8F5]"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Secondary Quick Action: About Us (Icon-based with tooltip) */}
              <button
                onClick={() => onNavigate('/about')}
                className={`hidden md:flex p-2 rounded-full transition-colors relative cursor-pointer ${
                  currentPath === '/about'
                    ? 'bg-[#1E3A2F]/10 text-[#1E3A2F]'
                    : 'text-[#1A1E1C] hover:bg-[#FAF8F5] hover:text-[#1E3A2F]'
                }`}
                title="About Us"
                aria-label="About Us"
              >
                <Info className="w-5 h-5" />
              </button>

              {/* Secondary Quick Action: Contact (Icon-based with tooltip) */}
              <button
                onClick={() => onNavigate('/contact')}
                className={`hidden md:flex p-2 rounded-full transition-colors relative cursor-pointer ${
                  currentPath === '/contact'
                    ? 'bg-[#1E3A2F]/10 text-[#1E3A2F]'
                    : 'text-[#1A1E1C] hover:bg-[#FAF8F5] hover:text-[#1E3A2F]'
                }`}
                title="Contact Us"
                aria-label="Contact Us"
              >
                <PhoneCall className="w-5 h-5" />
              </button>

              {/* Wishlist */}
              <button
                onClick={() => onNavigate('/wishlist')}
                className="button-interactive p-2 rounded-full text-[#1A1E1C] hover:bg-[#FAF8F5] relative transition-colors cursor-pointer"
                title="Wishlist"
              >
                <Heart className="w-5 h-5 hover:scale-110 transition-transform" />
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#C85A32] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                    {wishlistIds.length}
                  </span>
                )}
              </button>

              {/* Cart Button */}
              <button
                onClick={() => onNavigate('/cart')}
                className="button-interactive flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-full bg-[#FAF8F5] hover:bg-[#EDE7DC] border border-[#E5DFD7] text-[#1E3A2F] font-semibold"
                title="View Cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-[#1E3A2F]" />
                  {totalItemsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#C85A32] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-glow">
                      {totalItemsCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-[#1E3A2F]">
                  ৳{subtotal.toLocaleString()}
                </span>
              </button>

              {/* Unified Orders & Tracking Icon (Placed directly to the left of Profile icon) */}
              <button
                onClick={() => onNavigate('/my-orders')}
                className={`p-2 rounded-full transition-colors relative cursor-pointer ${
                  currentPath === '/my-orders' || currentPath === '/track-order'
                    ? 'bg-[#1E3A2F]/10 text-[#1E3A2F]'
                    : 'text-[#1A1E1C] hover:bg-[#FAF8F5] hover:text-[#1E3A2F]'
                }`}
                title="My Orders & Tracking"
                aria-label="My Orders & Tracking"
              >
                <PackageCheck className="w-5 h-5" />
              </button>

              {/* Customer Account Button */}
              <button
                onClick={() => onNavigate('/account')}
                className="p-2 rounded-full text-[#1A1E1C] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                title={currentUser ? `Account: ${currentUser.email}` : 'Customer Login'}
              >
                <UserIcon className="w-5 h-5" />
              </button>

              {/* Admin Panel Quick Entry if logged in as Admin */}
              {isAdmin && (
                <button
                  onClick={() => onNavigate('/admin')}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-[#1E3A2F] text-[#F9F6F0] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs hover:bg-[#162B23]"
                  title="Admin Portal"
                >
                  <ShieldCheck className="w-4 h-4 text-[#8FA89B]" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Search Input Drawer */}
          {searchOpen && (
            <div className="md:hidden py-3 border-t border-[#EFEBE5]">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search electronics, fashion, lifestyle items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-sm text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#1E3A2F] text-white px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  Search
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Body */}
          <div className="fixed top-0 bottom-0 left-0 w-4/5 max-w-sm bg-white shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#E5DFD7]">
                <img
                  src={logoSrc}
                  alt={settings.storeName}
                  className="h-12 w-auto object-contain"
                />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-full text-stone-500 hover:text-black"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tagline */}
              <p className="text-[11px] font-medium tracking-wider uppercase text-[#C85A32] my-3">
                {settings.tagline}
              </p>

              {/* Navigation Links */}
              <div className="space-y-1 py-4">
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => {
                      onNavigate(link.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold ${
                      currentPath === link.path
                        ? 'bg-[#FAF8F5] text-[#1E3A2F]'
                        : 'text-[#1A1E1C] hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}

                {/* Unified My Orders & Tracking Mobile Entry */}
                <button
                  onClick={() => {
                    onNavigate('/my-orders');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold flex items-center justify-between ${
                    currentPath === '/my-orders' || currentPath === '/track-order'
                      ? 'bg-[#FAF8F5] text-[#1E3A2F]'
                      : 'text-[#1A1E1C] hover:bg-stone-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-[#C85A32]" />
                    <span>My Orders & Tracking</span>
                  </span>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">Track</span>
                </button>
              </div>

              {/* Secondary Navigation: About Us & Contact */}
              <div className="pb-4 flex items-center gap-2">
                <button
                  onClick={() => {
                    onNavigate('/about');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    currentPath === '/about'
                      ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                      : 'bg-[#FAF8F5] text-[#1A1E1C] border-[#E5DFD7] hover:border-[#1E3A2F]'
                  }`}
                  title="About Us"
                >
                  <Info className="w-4 h-4 text-[#C85A32]" />
                  <span>About Us</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('/contact');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    currentPath === '/contact'
                      ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                      : 'bg-[#FAF8F5] text-[#1A1E1C] border-[#E5DFD7] hover:border-[#1E3A2F]'
                  }`}
                  title="Contact Us"
                >
                  <PhoneCall className="w-4 h-4 text-[#16A34A]" />
                  <span>Contact</span>
                </button>
              </div>

              {/* Categories Section */}
              {categories.length > 0 && (
                <div className="pt-4 border-t border-[#EFEBE5]">
                  <span className="text-xs uppercase font-bold text-[#626C66] tracking-wider mb-2 block">
                    Product Categories
                  </span>
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          onNavigate(`/category/${cat.slug}`);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left py-1.5 px-3 rounded-lg text-sm text-[#1A1E1C] hover:text-[#1E3A2F] flex items-center justify-between"
                      >
                        <span>{cat.name}</span>
                        <Compass className="w-3.5 h-3.5 text-stone-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info in mobile drawer */}
            <div className="pt-6 border-t border-[#E5DFD7] space-y-3">
              <a
                href={`tel:${settings.phone}`}
                className="flex items-center gap-2 text-sm text-[#1E3A2F] font-semibold bg-[#FAF8F5] p-3 rounded-xl border border-[#E5DFD7]"
              >
                <PhoneCall className="w-4 h-4 text-[#C85A32]" />
                <span>Call Hotline: {settings.phone}</span>
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onNavigate('/account');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 bg-[#FAF8F5] border border-[#E5DFD7] text-[#1A1E1C] rounded-lg text-xs font-semibold"
                >
                  {currentUser ? 'My Profile' : 'Sign In'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      onNavigate('/admin');
                      setMobileMenuOpen(false);
                    }}
                    className="flex-1 py-2.5 bg-[#1E3A2F] text-white rounded-lg text-xs font-semibold"
                  >
                    Admin Portal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
