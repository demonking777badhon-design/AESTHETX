import React, { useEffect, useState } from 'react';
import { getAllProductsAdmin, saveProduct, logAdminAction, getLocalProductsCache } from '../../firebase/db';
import type { Product } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { Boxes, Save, Check, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminInventory: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => getLocalProductsCache());
  const [loading, setLoading] = useState(() => getLocalProductsCache().length === 0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedNoticeId, setSavedNoticeId] = useState<string | null>(null);

  useEffect(() => {
    getAllProductsAdmin().then(setProducts).finally(() => setLoading(false));

    const handleUpdate = () => {
      setProducts(getLocalProductsCache());
    };
    window.addEventListener('aesthetx-products-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetx-products-updated', handleUpdate);
    };
  }, []);

  const handleVariantStockChange = (productId: string, variantId: string, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedVariants = (p.variants || []).map((v) =>
          v.id === variantId ? { ...v, stock: Math.max(0, newStock) } : v
        );
        const total = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        return {
          ...p,
          variants: updatedVariants,
          totalStock: total
        };
      })
    );
  };

  const handleSaveStock = async (product: Product) => {
    setSavingId(product.id);
    try {
      await saveProduct(
        {
          variants: product.variants,
          totalStock: product.totalStock
        },
        product.id
      );

      await logAdminAction(
        'INVENTORY_ADJUSTED',
        product.name,
        `New Total Stock: ${product.totalStock}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      setSavedNoticeId(product.id);
      setTimeout(() => setSavedNoticeId(null), 2000);
    } catch (err) {
      console.warn('Inventory save error:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Inventory & Variant Stock</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Quickly monitor, restock, and adjust stock levels across all departments and variant options.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('aesthetx-open-stock-demand-ai'))}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <TrendingUp className="w-4 h-4 text-[#8FA89B]" />
          <span>Stock & Demand AI জিজ্ঞাসা করুন</span>
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : products.length > 0 ? (
        <div className="space-y-6">
          {products.map((product) => {
            const isLow = (product.totalStock || 0) <= 5;
            const isOut = (product.totalStock || 0) <= 0;

            return (
              <div
                key={product.id}
                className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEBE5]">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        product.thumbnail ||
                        product.images?.[0] ||
                        '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg'
                      }
                      alt=""
                      className="w-10 h-12 object-cover rounded-lg border border-[#E5DFD7]"
                    />
                    <div>
                      <h3 className="font-bold text-sm text-[#1A1E1C]">{product.name}</h3>
                      <span className="text-xs text-[#626C66] font-mono">
                        SKU: {product.sku || 'N/A'} • {product.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-[#626C66] block uppercase tracking-wider">
                        Total Stock
                      </span>
                      <span
                        className={`text-base font-black ${
                          isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-[#1E3A2F]'
                        }`}
                      >
                        {product.totalStock || 0} Units
                      </span>
                    </div>

                    <button
                      onClick={() => handleSaveStock(product)}
                      disabled={savingId === product.id}
                      className="px-4 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savedNoticeId === product.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingId === product.id ? 'Updating...' : 'Save Stock'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Variant Matrix or Single Stock Inline Inputs */}
                {product.variants && product.variants.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {product.variants.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-xl border border-[#E5DFD7] bg-[#FAF8F5] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1E3A2F] truncate" title={v.name || v.size || v.id}>
                            {v.name || v.size || v.id}
                          </span>
                          {v.colorName && (
                            <span className="text-[11px] text-[#626C66] truncate max-w-[70px]">
                              {v.colorName}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) =>
                            handleVariantStockChange(product.id, v.id, Number(e.target.value))
                          }
                          className="w-full bg-white border border-[#E5DFD7] rounded-lg p-1.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-[#FAF8F5] rounded-xl border border-[#E5DFD7] max-w-sm">
                    <span className="text-xs font-bold text-[#1A1E1C]">Single Item Stock:</span>
                    <input
                      type="number"
                      min="0"
                      value={product.totalStock || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setProducts((prev) =>
                          prev.map((p) => (p.id === product.id ? { ...p, totalStock: val } : p))
                        );
                      }}
                      className="w-24 bg-white border border-[#E5DFD7] rounded-lg p-1.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                    />
                    <span className="text-xs text-[#626C66]">units available</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <Boxes className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Inventory Available</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            Products must be added before variant stock can be adjusted.
          </p>
        </div>
      )}
    </div>
  );
};
