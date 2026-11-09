import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-[#E5DFD7] rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-[#EDE7DC] w-full" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-[#E5DFD7] rounded w-1/3" />
        <div className="h-5 bg-[#EDE7DC] rounded w-3/4" />
        <div className="h-4 bg-[#E5DFD7] rounded w-1/2" />
        <div className="pt-2 flex gap-1">
          <div className="h-6 w-8 bg-[#EDE7DC] rounded" />
          <div className="h-6 w-8 bg-[#EDE7DC] rounded" />
          <div className="h-6 w-8 bg-[#EDE7DC] rounded" />
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="bg-white border border-[#E5DFD7] rounded-xl overflow-hidden p-4 animate-pulse">
      <div className="h-8 bg-[#EDE7DC] rounded w-full mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-b border-[#EFEBE5] flex items-center justify-between gap-4 px-2">
          <div className="h-4 bg-[#EDE7DC] rounded w-1/4" />
          <div className="h-4 bg-[#EDE7DC] rounded w-1/6" />
          <div className="h-4 bg-[#EDE7DC] rounded w-1/5" />
          <div className="h-4 bg-[#EDE7DC] rounded w-1/8" />
        </div>
      ))}
    </div>
  );
};

export const DashboardStatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-[#E5DFD7] rounded-xl p-5 space-y-3">
          <div className="h-4 bg-[#EDE7DC] rounded w-1/2" />
          <div className="h-8 bg-[#E5DFD7] rounded w-3/4" />
          <div className="h-3 bg-[#EDE7DC] rounded w-1/3" />
        </div>
      ))}
    </div>
  );
};
