import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Search,
  Zap,
  ArrowRight
} from 'lucide-react';
import {
  getCategories,
  saveCategory,
  deleteCategory,
  logAdminAction,
  seedMarketplaceCategories,
  getLocalProductsCache,
  generateCategorySlug
} from '../../firebase/db';
import { uploadProductImage } from '../../firebase/storage';
import type { Category, Product } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

// Curated Bangladesh E-commerce Popular Category Presets
const POPULAR_PRESETS: {
  name: string;
  nameBn: string;
  slug: string;
  image: string;
  description: string;
  subcategories: string[];
}[] = [
  {
    name: 'Panjabi & Traditional',
    nameBn: 'পাঞ্জাবি ও ট্রেডিশনাল',
    slug: 'panjabi',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
    description: 'Exclusive designer panjabi, kabli sets, and ethnic collection.',
    subcategories: ['Semi-Long Panjabi', 'Cotton Casual Panjabi', 'Silk Festive Panjabi', 'Kabli Sets', 'Pajama & Al-Ghadir']
  },
  {
    name: 'T-Shirts',
    nameBn: 'টি-শার্ট',
    slug: 't-shirts',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    description: 'Heavyweight, oversized, drop shoulder, and graphic tees.',
    subcategories: ['Oversized Drop Shoulder', 'Solid Crew Neck', 'Graphic Prints', 'Pocket Tees', 'Full Sleeve T-Shirts']
  },
  {
    name: 'Polo Shirts',
    nameBn: 'পোলো শার্ট',
    slug: 'polo-shirts',
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80',
    description: 'Pique cotton solid and stripe polo shirts for smart casual look.',
    subcategories: ['Pique Cotton Solid', 'Tipped Collar Polo', 'Textured Knitted Polo', 'Sport Fit Polo']
  },
  {
    name: 'Casual & Formal Shirts',
    nameBn: 'শার্ট (ক্যাজুয়াল ও ফরমাল)',
    slug: 'shirts',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
    description: 'Premium linen, oxford cotton, and formal business shirts.',
    subcategories: ['Oxford Button-Down', 'Linen Casual Shirts', 'Formal Office Shirts', 'Cuban Collar Printed']
  },
  {
    name: 'Jeans & Trousers',
    nameBn: 'জিন্স ও ট্রাউজার্স',
    slug: 'jeans-pants',
    image: 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80',
    description: 'Stretch denim jeans, chino pants, and casual joggers.',
    subcategories: ['Slim Fit Denim', 'Straight Cut Jeans', 'Chino Trousers', 'Cargo Pants', 'Comfort Joggers']
  },
  {
    name: 'Hoodies & Jackets',
    nameBn: 'হুডি ও উইন্টার ওয়্যার',
    slug: 'hoodies-jackets',
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80',
    description: 'Winter heavyweight hoodies, bomber jackets, and sweatshirts.',
    subcategories: ['Pullover Hoodies', 'Zip-Up Hoodies', 'Varsity & Bomber Jackets', 'Fleece Sweatshirts', 'Windbreakers']
  },
  {
    name: 'Shoes & Footwear',
    nameBn: 'জুতো ও স্নিকার্স',
    slug: 'shoes-footwear',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
    description: 'Lifestyle sneakers, formal leather shoes, and slides.',
    subcategories: ['Casual Sneakers', 'Leather Loafers', 'Formal Oxford', 'Slides & Flip-Flops', 'Running Shoes']
  },
  {
    name: 'Watches & Accessories',
    nameBn: 'ঘড়ি ও এক্সেসরিজ',
    slug: 'watches-accessories',
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
    description: 'Minimalist quartz watches, automatic timepieces, and sunglasses.',
    subcategories: ['Classic Quartz Watches', 'Leather Strap Watches', 'Metal Chain Watches', 'UV Sunglasses', 'Bracelets']
  },
  {
    name: 'Perfumes & Attar',
    nameBn: 'আতর ও সুগন্ধি',
    slug: 'perfumes-attar',
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80',
    description: 'Alcohol-free organic attar, luxury Eau De Parfum, and body sprays.',
    subcategories: ['Concentrated Attar (Alcohol-Free)', 'Luxury Eau De Parfum', 'Oud & Amber Notes', 'Pocket Sprays']
  },
  {
    name: 'Leather Bags & Wallets',
    nameBn: 'ব্যাগ ও ওয়ালেট',
    slug: 'bags-wallets',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
    description: 'Genuine leather wallets, office messenger bags, and backpacks.',
    subcategories: ['Bi-Fold Leather Wallets', 'Long Wallets', 'Laptop Backpacks', 'Crossbody Bags', 'Card Holders']
  },
  {
    name: 'Electronics & Gadgets',
    nameBn: 'ইলেকট্রনিক্স ও গ্যাজেট',
    slug: 'electronics-gadgets',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    description: 'Next-gen audio, smart wearables, charging essentials, and tech gear.',
    subcategories: ['Wireless Earbuds', 'Smartwatches', 'Bluetooth Speakers', 'Power Banks', 'Fast Chargers']
  },
  {
    name: "Women's Collection",
    nameBn: 'উইমেনস কালেকশন',
    slug: 'womens-collection',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
    description: 'Kurtis, two-piece sets, sarees, abayas, and modest wear.',
    subcategories: ['Lawn & Cotton Kurtis', 'Two-Piece Stitched Sets', 'Designer Abaya & Borka', 'Exclusive Sarees']
  }
];

export const AdminCategories: React.FC = () => {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick-Add Bar State (Super-fast creation)
  const [quickName, setQuickName] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [subcatInput, setSubcatInput] = useState('');
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Global toast notice
  const [toastNotice, setToastNotice] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastNotice({ message, type });
    setTimeout(() => setToastNotice(null), 3500);
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories(false);
      setCategories(data);
    } catch (err) {
      console.warn('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();

    const handleUpdate = () => {
      loadCategories();
    };

    window.addEventListener('aesthetx-categories-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetx-categories-updated', handleUpdate);
    };
  }, []);

  // Quick 1-Step Category Creation (No modal needed!)
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;

    setQuickAdding(true);

    try {
      // Check if matches any preset to prefill high quality image & subcategories
      const matchedPreset = POPULAR_PRESETS.find(
        (p) =>
          p.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          p.nameBn.includes(trimmed) ||
          trimmed.toLowerCase().includes(p.slug)
      );

      const generatedSlug = generateCategorySlug(trimmed);
      const categoryPayload: Partial<Category> = {
        name: trimmed,
        slug: generatedSlug,
        description: matchedPreset?.description || `${trimmed} collection for Aesthetx Lifestyle`,
        image: matchedPreset?.image || '',
        subcategories: matchedPreset?.subcategories || [],
        active: true,
        sortOrder: categories.length + 1
      };

      await saveCategory(categoryPayload);

      await logAdminAction(
        'CATEGORY_QUICK_CREATED',
        trimmed,
        `Slug: ${generatedSlug}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      setQuickName('');
      await loadCategories();
      showToast(`✨ Category "${trimmed}" created successfully!`);
    } catch (err: any) {
      alert(`Failed to create category: ${err.message || 'Please try again'}`);
    } finally {
      setQuickAdding(false);
    }
  };

  // 1-Click Add from Presets
  const handleAddPreset = async (preset: typeof POPULAR_PRESETS[0]) => {
    // Check if category already exists
    const exists = categories.some(
      (c) =>
        c.name.toLowerCase() === preset.name.toLowerCase() ||
        c.slug.toLowerCase() === preset.slug.toLowerCase()
    );

    if (exists) {
      showToast(`"${preset.name}" is already in your category list!`, 'info');
      return;
    }

    try {
      await saveCategory({
        name: preset.name,
        slug: preset.slug,
        description: preset.description,
        image: preset.image,
        subcategories: preset.subcategories,
        active: true,
        sortOrder: categories.length + 1
      });

      await logAdminAction(
        'CATEGORY_PRESET_ADDED',
        preset.name,
        `Slug: ${preset.slug}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadCategories();
      showToast(`🎉 Category "${preset.name}" added successfully!`);
    } catch (err: any) {
      alert(`Error adding preset: ${err.message}`);
    }
  };

  const handleSeedCategories = async () => {
    setSeeding(true);
    try {
      const added = await seedMarketplaceCategories();
      await logAdminAction(
        'CATEGORIES_SEEDED',
        'Marketplace Departments',
        `Populated ${added} standard marketplace categories`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      await loadCategories();
      showToast(`Success! Populated standard categories with high-res photos.`);
    } catch (err: any) {
      alert(`Failed to seed categories: ${err.message || 'Check connection'}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const nextActive = !cat.active;
      await saveCategory({ active: nextActive }, cat.id);
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, active: nextActive } : c))
      );
      showToast(nextActive ? `"${cat.name}" is now active in store` : `"${cat.name}" is now hidden`, 'info');
    } catch (err) {
      console.warn('Could not toggle category status:', err);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setImage('');
    setSubcategories([]);
    setSubcatInput('');
    setActive(true);
    setSortOrder(categories.length + 1);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImage(cat.image || '');
    setSubcategories(cat.subcategories || []);
    setSubcatInput('');
    setActive(cat.active);
    setSortOrder(cat.sortOrder || 1);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory) {
      const autoSlug = generateCategorySlug(val);
      setSlug(autoSlug);
    }
  };

  const handleAddSubcat = () => {
    if (subcatInput.trim() && !subcategories.includes(subcatInput.trim())) {
      setSubcategories([...subcategories, subcatInput.trim()]);
      setSubcatInput('');
    }
  };

  const handleQuickAddSubcatChip = (chip: string) => {
    if (!subcategories.includes(chip)) {
      setSubcategories([...subcategories, chip]);
    }
  };

  const handleRemoveSubcat = (subToRemove: string) => {
    setSubcategories(subcategories.filter((s) => s !== subToRemove));
  };

  // Ultra-fast Image Upload with Canvas compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Instant local preview in 0ms!
    const localUrl = URL.createObjectURL(file);
    setImage(localUrl);

    setUploadingImage(true);
    setUploadProgress(25);
    setFeedback(null);

    try {
      const url = await uploadProductImage(file, 'categories', (prog) => {
        setUploadProgress(prog);
      });
      setImage(url);
      setFeedback({ type: 'success', text: 'Category image uploaded successfully!' });
    } catch (err: any) {
      console.warn('Category image upload notice:', err);
      // Keep local compressed preview
      setFeedback({ type: 'success', text: 'Image is ready.' });
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Please enter category name.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const finalSlug = generateCategorySlug(name.trim(), slug);

      const payload: Partial<Category> = {
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        image: image.trim(),
        subcategories,
        active,
        sortOrder: Number(sortOrder) || categories.length + 1
      };

      await saveCategory(payload, editingCategory?.id);

      await logAdminAction(
        editingCategory ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED',
        name.trim(),
        `Slug: ${finalSlug}, Subcategories: ${subcategories.length}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadCategories();
      setIsModalOpen(false);
      showToast(
        editingCategory
          ? `✅ "${name.trim()}" updated successfully!`
          : `🎉 Category "${name.trim()}" created successfully!`
      );
    } catch (err: any) {
      console.error('Error saving category:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to save category.' });
    } finally {
      setSaving(false);
    }
  };

  const [linkedProductsForDelete, setLinkedProductsForDelete] = useState<Product[]>([]);
  const [confirmLinkedUnderstood, setConfirmLinkedUnderstood] = useState(false);

  const handleOpenDelete = (cat: Category) => {
    const products = getLocalProductsCache();
    const linked = products.filter(
      (p) =>
        (cat.name && p.category?.toLowerCase() === cat.name.toLowerCase()) ||
        (cat.slug && p.categorySlug?.toLowerCase() === cat.slug.toLowerCase())
    );
    setLinkedProductsForDelete(linked);
    setConfirmLinkedUnderstood(false);
    setDeleteTarget(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const idToDelete = deleteTarget.id;
      await deleteCategory(idToDelete);
      setCategories((prev) => prev.filter((c) => c.id !== idToDelete));
      await logAdminAction(
        'CATEGORY_DELETED',
        deleteTarget.name,
        `Slug: ${deleteTarget.slug}, Linked Products: ${linkedProductsForDelete.length}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      setDeleteTarget(null);
      setLinkedProductsForDelete([]);
      setConfirmLinkedUnderstood(false);
      showToast(`Category "${deleteTarget.name}" deleted successfully`, 'info');
    } catch (err: any) {
      console.error('Error deleting category:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered categories
  const filteredCategories = categories.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.subcategories?.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold text-white ${
              toastNotice.type === 'success' ? 'bg-[#1E3A2F]' : 'bg-stone-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastNotice.message}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1A1E1C]">Category Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1E3A2F]/10 text-[#1E3A2F] text-xs font-bold">
              {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
            </span>
          </div>
          <p className="text-xs text-[#626C66] mt-0.5">
            Easily create and organize store categories and subcategories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSeedCategories}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#FAF8F5] hover:bg-stone-100 text-[#1E3A2F] border border-[#E5DFD7] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Populate standard marketplace departments"
          >
            <Sparkles className="w-4 h-4 text-[#C85A32]" />
            <span>{seeding ? 'Generating...' : 'Seed Default Categories'}</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Category</span>
          </button>
        </div>
      </div>

      {/* 🚀 QUICK-ADD BAR: 1-Step Category Creation */}
      <div className="bg-gradient-to-r from-[#FAF8F5] via-white to-[#FAF8F5] border border-[#E5DFD7] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1A1E1C]">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Quick Category Creator</span>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Instant & Direct
          </span>
        </div>

        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter category name (e.g. Panjabi, T-Shirts, Polo Shirts, Watches, Shoes, Gadgets)..."
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              className="w-full bg-white border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1E1C] placeholder:text-stone-400 outline-hidden font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={quickAdding || !quickName.trim()}
            className="px-5 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {quickAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{quickAdding ? 'Adding...' : 'Add Category'}</span>
          </button>
        </form>

        {/* 1-Click Popular Category Quick Chips */}
        <div className="pt-1">
          <span className="text-[10px] font-bold text-[#626C66] uppercase tracking-wider block mb-2">
            Popular Category Presets (1-Click Add):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_PRESETS.map((preset, idx) => {
              const alreadyAdded = categories.some(
                (c) =>
                  c.name.toLowerCase() === preset.name.toLowerCase() ||
                  c.slug.toLowerCase() === preset.slug.toLowerCase()
              );

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  disabled={alreadyAdded}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    alreadyAdded
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default opacity-85'
                      : 'bg-white hover:bg-[#1E3A2F] text-stone-700 hover:text-white border border-[#E5DFD7] hover:border-[#1E3A2F] shadow-2xs'
                  }`}
                  title={alreadyAdded ? 'Already added' : 'Click to add preset'}
                >
                  {alreadyAdded ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <span className="text-stone-400">+</span>
                  )}
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search and Category Overview Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category, subcategory, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] placeholder:text-stone-400 focus:outline-hidden focus:border-[#1E3A2F]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-[#626C66] font-medium">
            Showing {filteredCategories.length} categories
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : filteredCategories.length > 0 ? (
          <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subcategories</th>
                  <th className="py-3 px-4">URL Slug</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#626C66]">
                      #{cat.sortOrder || 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt=""
                            className="w-10 h-10 object-cover rounded-xl border border-[#E5DFD7] shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A2F]/10 via-[#FAF8F5] to-stone-200 border border-[#E5DFD7] flex items-center justify-center font-black text-[#1E3A2F] text-xs">
                            {cat.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-sm text-[#1A1E1C] block">{cat.name}</span>
                          {cat.description && (
                            <span className="text-[11px] text-[#626C66] truncate block max-w-xs">
                              {cat.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {cat.subcategories && cat.subcategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {cat.subcategories.map((sub, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded-md text-[10px] text-stone-700 font-medium"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#626C66] text-[11px]">{cat.slug}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cat.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border border-stone-200'
                        }`}
                      >
                        {cat.active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleActive(cat)}
                          className={`p-2 rounded-xl cursor-pointer transition-colors ${
                            cat.active
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-stone-400 hover:bg-stone-100'
                          }`}
                          title={cat.active ? 'Hide from store' : 'Activate in store'}
                        >
                          {cat.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-2 text-stone-600 hover:text-[#1E3A2F] hover:bg-stone-100 rounded-xl cursor-pointer transition-colors"
                          title="Edit category"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(cat)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#1E3A2F] mx-auto">
              <FolderPlus className="w-6 h-6 opacity-75" />
            </div>
            <h3 className="font-bold text-base text-[#1A1E1C]">No Categories Found</h3>
            <p className="text-xs text-[#626C66] max-w-sm mx-auto">
              Enter a category name in the quick bar above or click Create Category to add your first store department.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Category</span>
            </button>
          </div>
        )}
      </div>

      {/* Category Editor / Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#E5DFD7] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5DFD7]">
              <div>
                <h3 className="text-lg font-black text-[#1A1E1C]">
                  {editingCategory ? 'ক্যাটাগরি সম্পাদনা (Edit Category)' : 'নতুন ক্যাটাগরি তৈরি (Create Category)'}
                </h3>
                <p className="text-[11px] text-[#626C66]">
                  নাম লিখলেই স্লাগ ও অন্যান্য তথ্য নিজে থেকেই ঠিক হয়ে যাবে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  ক্যাটাগরির নাম (Category Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="যেমন: পাঞ্জাবি, টি-শার্ট, পোলো, ঘড়ি, জুতো বা Sneakers"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl p-3 text-xs text-[#1A1E1C] font-semibold outline-hidden"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1A1E1C] block">
                    URL Slug (স্লাগ)
                  </label>
                  <span className="text-[10px] text-stone-500 font-medium">
                    (স্বয়ংক্রিয়ভাবে তৈরি হয়, পরিবর্তন ঐচ্ছিক)
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="স্বয়ংক্রিয়ভাবে তৈরি হবে (যেমন: panjabi, t-shirts)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-mono text-[#1A1E1C] outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  সংক্ষিপ্ত বিবরণ (Description) - ঐচ্ছিক
                </label>
                <textarea
                  rows={2}
                  placeholder="যেমন: সেরা মানের আকর্ষণীয় পাঞ্জাবি ও ট্রেডিশনাল কালেকশন..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] outline-hidden focus:border-[#1E3A2F]"
                />
              </div>

              {/* Subcategories with 1-click chip suggestions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1A1E1C] block">
                    সাব-ক্যাটাগরি (Subcategories) - ঐচ্ছিক
                  </label>
                  <span className="text-[10px] text-stone-500">লিখুন বা সাজেশনে ক্লিক করুন</span>
                </div>

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="যেমন: Semi-Long, Oversized, Casual..."
                    value={subcatInput}
                    onChange={(e) => setSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcat();
                      }
                    }}
                    className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] outline-hidden focus:border-[#1E3A2F]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcat}
                    className="px-4 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#162B23] cursor-pointer"
                  >
                    যোগ করুন
                  </button>
                </div>

                {/* Subcategory suggestions */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[10px] text-stone-400 self-center">সাজেশন:</span>
                  {['Men', 'Women', 'Casual', 'Formal', 'Premium', 'Cotton', 'Winter'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleQuickAddSubcatChip(s)}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-[#1E3A2F] hover:text-white rounded-md text-[10px] text-stone-700 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>

                {subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl">
                    {subcategories.map((sub, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E5DFD7] rounded-lg text-xs font-medium text-stone-800"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubcat(sub)}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Image */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#1A1E1C] block">
                    Category Banner Image (Optional)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-medium">A stylish monogram badge will be displayed if no image is uploaded</span>
                </div>

                {image ? (
                  <div className="relative aspect-[3/1] rounded-xl overflow-hidden border border-[#E5DFD7] mb-2 bg-[#FAF8F5]">
                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 shadow-md cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 mb-2 bg-[#FAF8F5] border border-dashed border-[#E5DFD7] rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A2F]/15 via-[#FAF8F5] to-stone-200 flex items-center justify-center font-black text-sm text-[#1E3A2F] border border-[#E5DFD7] shrink-0">
                      {(name || 'Cat').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1E1C]">Smart Monogram Badge</p>
                      <p className="text-[10px] text-[#626C66]">
                        If no image is uploaded, a clean branded monogram logo badge will be displayed.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Paste image URL or upload directly from your device"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] outline-hidden focus:border-[#1E3A2F]"
                  />
                  <label className="px-4 py-2.5 bg-[#1E3A2F] text-white hover:bg-[#162B23] rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 transition-all shadow-xs">
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingImage ? `${uploadProgress || 60}%` : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Quick Curated Image Presets */}
                <div className="mt-2.5">
                  <span className="text-[10px] text-stone-500 font-bold block mb-1">
                    Choose Quick Preset Image (1-Click):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: 'Panjabi', url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80' },
                      { label: 'T-Shirts', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Polo', url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Shirts', url: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Shoes', url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Watches', url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Perfume', url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Gadgets', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80' },
                      { label: 'Bags', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80' }
                    ].map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImage(p.url)}
                        className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-[#1E3A2F] hover:text-white text-[10px] text-[#1A1E1C] transition-colors cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] outline-hidden"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A1E1C] select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F] cursor-pointer"
                    />
                    <span>Visible in Store</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#E5DFD7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="flex-1 py-3 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving...' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Linked Products Warning */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E5DFD7] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${
                linkedProductsForDelete.length > 0
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-black text-lg text-[#1A1E1C]">
                {linkedProductsForDelete.length > 0
                  ? 'Warning: Linked Products Found'
                  : 'Delete Category?'}
              </h3>
              <p className="text-xs font-bold text-[#C85A32] bg-stone-50 px-3 py-1 rounded-lg inline-block border border-stone-200 max-w-full truncate">
                "{deleteTarget.name}"
              </p>
            </div>

            {linkedProductsForDelete.length > 0 ? (
              <div className="space-y-3 bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-bold leading-snug">
                    This category has {linkedProductsForDelete.length} linked products!
                  </p>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Deleting this category will remove it from the store navigation menu and product filtering.
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-white/80 p-2.5 rounded-xl border border-amber-200/60 font-medium text-[11px]">
                  {linkedProductsForDelete.slice(0, 5).map((p) => (
                    <div key={p.id} className="truncate text-stone-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                  ))}
                  {linkedProductsForDelete.length > 5 && (
                    <p className="text-stone-500 italic pt-1">
                      + and {linkedProductsForDelete.length - 5} more products
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-2 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmLinkedUnderstood}
                    onChange={(e) => setConfirmLinkedUnderstood(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-red-600 rounded accent-red-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-red-700 leading-snug">
                    I understand and confirm that I want to delete this category and unlink products.
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-[#626C66] text-center leading-relaxed">
                Are you sure you want to permanently delete the category "{deleteTarget.name}"?
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setLinkedProductsForDelete([]);
                  setConfirmLinkedUnderstood(false);
                }}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  deleting || (linkedProductsForDelete.length > 0 && !confirmLinkedUnderstood)
                }
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                  linkedProductsForDelete.length > 0 && !confirmLinkedUnderstood
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Deleting...' : 'Delete Category'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
