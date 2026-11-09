import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Eye,
  Shirt,
  Bot
} from 'lucide-react';
import {
  getAllProductsAdmin,
  deleteProduct,
  saveProduct,
  getCategories,
  getLocalProductsCache,
  getLocalCategoriesCache
} from '../../firebase/db';
import type { Product, Category } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';

interface AdminProductsProps {
  onAddNew: () => void;
  onEditProduct: (product: Product) => void;
}

export const AdminProducts: React.FC<AdminProductsProps> = ({ onAddNew, onEditProduct }) => {
  const [products, setProducts] = useState<Product[]>(() => getLocalProductsCache());
  const [categories, setCategories] = useState<Category[]>(() => getLocalCategoriesCache());
  const [loading, setLoading] = useState(() => getLocalProductsCache().length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        getAllProductsAdmin(),
        getCategories(false)
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.warn('Error fetching admin products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If cache is empty, fetch with skeleton. If cache has items, silent background update!
    loadData(products.length === 0);

    const handleProductsUpdated = () => {
      setProducts(getLocalProductsCache());
    };
    const handleCategoriesUpdated = () => {
      setCategories(getLocalCategoriesCache());
    };

    window.addEventListener('aesthetx-products-updated', handleProductsUpdated);
    window.addEventListener('aesthetx-categories-updated', handleCategoriesUpdated);

    return () => {
      window.removeEventListener('aesthetx-products-updated', handleProductsUpdated);
      window.removeEventListener('aesthetx-categories-updated', handleCategoriesUpdated);
    };
  }, []);

  const handleToggleActive = async (product: Product) => {
    try {
      const updatedStatus = !product.active;
      await saveProduct({ active: updatedStatus }, product.id);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, active: updatedStatus } : p))
      );
    } catch (err) {
      console.warn('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.warn('Error deleting product:', err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter((p) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const match =
        p.name.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s) ||
        p.subcategory?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.model?.toLowerCase().includes(s);
      if (!match) return false;
    }
    if (selectedCategory) {
      if (p.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Marketplace Catalog</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Manage all product types: Electronics, Fashion, Footwear, Home, Groceries, and more.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('aesthetx-open-product-ai'))}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bot className="w-4 h-4 text-[#1E3A2F]" />
            <span>AI Product Adder (AI দিয়ে যোগ)</span>
          </button>

          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, SKU, brand, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ backgroundColor: '#ffffff', color: '#1a1e1c', colorScheme: 'light' }}
            className="w-full sm:w-auto bg-white border border-[#E5DFD7] rounded-xl px-3 py-2 text-xs font-semibold text-[#1A1E1C] focus:outline-hidden cursor-pointer shadow-2xs"
          >
            <option value="" style={{ backgroundColor: '#ffffff', color: '#1a1e1c' }}>All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name} style={{ backgroundColor: '#ffffff', color: '#1a1e1c' }}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price / Sale</th>
                  <th className="py-3 px-4">Variants & Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE5]">
                {filtered.map((prod) => {
                  const img =
                    prod.thumbnail ||
                    prod.images?.[0] ||
                    '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

                  const isOut = (prod.totalStock || 0) <= 0;

                  return (
                    <tr key={prod.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* Product image & name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={img}
                            alt=""
                            className="w-10 h-12 object-cover rounded-lg border border-[#E5DFD7] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-[#1A1E1C] block truncate max-w-xs">
                              {prod.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#626C66]">
                              {prod.brand && <span className="font-semibold text-stone-700">{prod.brand}</span>}
                              {prod.subcategory && <span>• {prod.subcategory}</span>}
                              {!prod.brand && prod.fabric && <span>{prod.fabric}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono text-[#626C66]">
                        {prod.sku || '—'}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 font-medium text-[#1A1E1C]">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#E5DFD7] text-stone-800 font-semibold inline-block">
                          {prod.category || 'General'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#1E3A2F]">
                          ৳{prod.salePrice ? prod.salePrice.toLocaleString() : prod.price.toLocaleString()}
                        </span>
                        {prod.salePrice && prod.salePrice < prod.price && (
                          <span className="text-[10px] text-[#626C66] line-through block">
                            ৳{prod.price.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Variants & Stock */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold block ${
                            isOut
                              ? 'text-red-600'
                              : (prod.totalStock || 0) <= 5
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {prod.totalStock || 0} in stock
                        </span>
                        <div className="text-[10px] text-[#626C66]">
                          {prod.variantType === 'clothing' || (prod.sizes?.length && prod.colors?.length) ? (
                            `${prod.sizes?.length || 0} sizes • ${prod.colors?.length || 0} colors`
                          ) : prod.variantType === 'custom' || prod.customOptionValues?.length ? (
                            `${prod.variants?.length || prod.customOptionValues?.length || 0} options (${prod.customOptionName || 'Custom'})`
                          ) : (
                            'Single Item (No variants)'
                          )}
                        </div>
                      </td>

                      {/* Active toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(prod)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            prod.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-100 text-stone-500 border border-stone-200'
                          }`}
                        >
                          {prod.active ? 'Active' : 'Draft'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEditProduct(prod)}
                            className="p-1.5 text-stone-600 hover:text-[#1E3A2F] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmId(prod.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5DFD7] flex items-center justify-center text-[#1E3A2F] mx-auto">
            <Shirt className="w-6 h-6 opacity-75" />
          </div>
          <h3 className="font-bold text-base text-[#1A1E1C]">No Products Found</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            {searchTerm || selectedCategory
              ? 'No products matched your search or category filter.'
              : 'Your store database has no clothing items published yet.'}
          </p>
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Product</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-[#E5DFD7]">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-base text-[#1A1E1C]">Delete Product?</h3>
              <p className="text-xs text-[#626C66] mt-1">
                Are you sure you want to permanently remove this product from the database? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-[#FAF8F5] border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
