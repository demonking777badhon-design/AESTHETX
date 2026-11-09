import React, { useState, useEffect } from 'react';
import {
  Boxes,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Tag,
  Shirt,
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';
import { getLocalProductsCache, getAllProductsAdmin } from '../../../firebase/db';
import type { Product } from '../../../types';

interface AIInventoryMonitoringTabProps {
  onShowToast: (msg: string) => void;
}

export const AIInventoryMonitoringTab: React.FC<AIInventoryMonitoringTabProps> = ({ onShowToast }) => {
  const [products, setProducts] = useState<Product[]>(getLocalProductsCache);
  const [filterMode, setFilterMode] = useState<'all' | 'out_of_stock' | 'low_stock' | 'quality_issues'>('low_stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    criticalAlerts?: string[];
    catalogQualityIssues?: string[];
    restockRecommendations?: string[];
  } | null>(null);

  useEffect(() => {
    getAllProductsAdmin().then((list) => setProducts(list));
  }, []);

  // Compute metrics
  const outOfStock = products.filter((p) => p.totalStock === 0);
  const lowStock = products.filter(
    (p) => p.totalStock !== undefined && p.totalStock > 0 && p.totalStock <= 5
  );
  const qualityIssues = products.filter(
    (p) =>
      !p.images ||
      p.images.length === 0 ||
      !p.description ||
      p.description.trim() === '' ||
      !p.price ||
      p.price <= 0
  );

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    if (filterMode === 'out_of_stock') return p.totalStock === 0;
    if (filterMode === 'low_stock')
      return p.totalStock !== undefined && p.totalStock > 0 && p.totalStock <= 5;
    if (filterMode === 'quality_issues')
      return (
        !p.images ||
        p.images.length === 0 ||
        !p.description ||
        p.description.trim() === '' ||
        !p.price ||
        p.price <= 0
      );
    return true;
  }).filter((p) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s);
  });

  const handleRunAIAudit = async () => {
    setIsAuditing(true);
    try {
      const catalogSummary = products.map((p) => ({
        name: p.name,
        price: p.price,
        stock: p.totalStock,
        category: p.category,
        hasImage: !!p.images?.length,
        hasDescription: !!p.description
      }));

      const res = await fetch('/api/ai/audit-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogSummary })
      });

      const data = await res.json();
      if (data.success && data.audit) {
        setAuditResults(data.audit);
        onShowToast('AI Inventory Audit completed successfully!');
      } else {
        onShowToast(data.message || 'Audit returned with fallback results.');
      }
    } catch (err) {
      console.error('Audit failed:', err);
      onShowToast('Could not complete AI audit.');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Audit Action */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#1E3A2F]" />
            <h2 className="text-lg font-black text-[#1A1E1C]">
              Product & Inventory Health Monitor
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            AI constantly watches your inventory counts to alert on shortages and prevent selling out-of-stock items.
          </p>
        </div>

        <button
          onClick={handleRunAIAudit}
          disabled={isAuditing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#2D5042] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isAuditing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#8FA89B]" />
          )}
          <span>{isAuditing ? 'Auditing Catalog...' : 'Run AI Inventory Audit'}</span>
        </button>
      </div>

      {/* 2. Inventory Health Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterMode('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterMode === 'all'
              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
              : 'bg-white border-[#E5DFD7] hover:border-stone-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
            Total Catalog
          </span>
          <span className="text-2xl font-black mt-1 block">{products.length} Items</span>
        </button>

        <button
          onClick={() => setFilterMode('low_stock')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterMode === 'low_stock'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white border-[#E5DFD7] hover:border-amber-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
            Low Stock (&le; 5)
          </span>
          <span className="text-2xl font-black mt-1 block">{lowStock.length} Items</span>
        </button>

        <button
          onClick={() => setFilterMode('out_of_stock')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterMode === 'out_of_stock'
              ? 'bg-red-600 text-white border-red-600 shadow-xs'
              : 'bg-white border-[#E5DFD7] hover:border-red-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
            Out of Stock (0)
          </span>
          <span className="text-2xl font-black mt-1 block">{outOfStock.length} Items</span>
        </button>

        <button
          onClick={() => setFilterMode('quality_issues')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterMode === 'quality_issues'
              ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
              : 'bg-white border-[#E5DFD7] hover:border-purple-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
            Catalog Data Issues
          </span>
          <span className="text-2xl font-black mt-1 block">{qualityIssues.length} Items</span>
        </button>
      </div>

      {/* 3. AI Audit Insights Panel (if run) */}
      {auditResults && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-700" />
            <h3 className="text-sm font-black text-emerald-900">
              AI Intelligent Inventory Analysis Results
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2">
              <span className="text-xs font-bold text-red-700 block uppercase tracking-wider">
                Critical Restock Priority
              </span>
              <ul className="text-xs space-y-1 text-stone-700 list-disc pl-4">
                {auditResults.criticalAlerts?.map((a, i) => (
                  <li key={i}>{a}</li>
                )) || <li>No critical shortages found.</li>}
              </ul>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2">
              <span className="text-xs font-bold text-amber-700 block uppercase tracking-wider">
                Catalog Quality Gaps
              </span>
              <ul className="text-xs space-y-1 text-stone-700 list-disc pl-4">
                {auditResults.catalogQualityIssues?.map((q, i) => (
                  <li key={i}>{q}</li>
                )) || <li>All listed products have images and descriptions.</li>}
              </ul>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2">
              <span className="text-xs font-bold text-emerald-700 block uppercase tracking-wider">
                AI Sourcing Advice
              </span>
              <ul className="text-xs space-y-1 text-stone-700 list-disc pl-4">
                {auditResults.restockRecommendations?.map((r, i) => (
                  <li key={i}>{r}</li>
                )) || <li>Maintain current replenishment cadence.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 4. Products Table */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <h3 className="text-sm font-black text-[#1A1E1C]">
            Filtered Inventory Items ({filteredProducts.length})
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-[#FAF8F5] focus:border-[#1E3A2F] outline-hidden"
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs">
            No products match the selected inventory condition.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock Units</th>
                  <th className="p-3">AI Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {filteredProducts.map((p) => {
                  const isOut = p.totalStock === 0;
                  const isLow = p.totalStock !== undefined && p.totalStock > 0 && p.totalStock <= 5;
                  const hasImage = !!p.images?.length;

                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {hasImage ? (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-9 h-9 object-cover rounded-lg border border-stone-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-stone-900 block truncate max-w-xs">{p.name}</span>
                            <span className="text-[11px] text-stone-400 font-mono">ID: {p.id.slice(0, 10)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-stone-600">
                        {p.category || 'General'}
                      </td>
                      <td className="p-3 font-bold text-stone-900">
                        ৳{p.salePrice || p.price}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-black font-mono px-2 py-0.5 rounded-md ${
                            isOut
                              ? 'bg-red-100 text-red-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.totalStock !== undefined ? `${p.totalStock} left` : 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isOut
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isOut ? 'Muted / Out of Stock' : isLow ? 'Low Stock Warning' : 'Active for Sale'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
