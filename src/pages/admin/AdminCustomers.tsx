import React, { useEffect, useState } from 'react';
import { Users, Search, ShoppingBag, DollarSign, Mail, Phone } from 'lucide-react';
import { getCustomers } from '../../firebase/db';
import type { CustomerUser } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCustomers().then(setCustomers).finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.displayName?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Registered Customers</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Real customer accounts registered with your Firebase Authentication system.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length > 0 ? (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-[#626C66] uppercase border-b border-[#E5DFD7]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Total Orders</th>
                <th className="py-3 px-4">Total Spend</th>
                <th className="py-3 px-4">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE5]">
              {filtered.map((c) => (
                <tr key={c.uid} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#1E3A2F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {c.displayName ? c.displayName.slice(0, 1).toUpperCase() : 'C'}
                      </div>
                      <span className="font-bold text-[#1A1E1C]">{c.displayName || 'Customer'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#626C66] font-mono">{c.email}</td>
                  <td className="py-3 px-4 text-[#626C66]">{c.phone || '—'}</td>
                  <td className="py-3 px-4 font-bold text-[#1A1E1C]">
                    {c.totalOrders || 0} orders
                  </td>
                  <td className="py-3 px-4 font-bold text-[#1E3A2F]">
                    ৳{(c.totalSpent || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-[#626C66]">
                    {c.createdAt?.seconds
                      ? new Date(c.createdAt.seconds * 1000).toLocaleDateString()
                      : 'Recently'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <Users className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Customers Found</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            {search
              ? 'No registered customers match your search.'
              : 'Registered customers will appear here as users create accounts or place orders.'}
          </p>
        </div>
      )}
    </div>
  );
};
