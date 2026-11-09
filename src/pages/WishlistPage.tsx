import React from 'react';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/common/ProductCard';
import { EmptyState } from '../components/common/EmptyState';
import type { Product } from '../types';

interface WishlistPageProps {
  onNavigate: (path: string) => void;
  onQuickView?: (product: Product) => void;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({ onNavigate, onQuickView }) => {
  const { wishlistProducts } = useWishlist();

  if (wishlistProducts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Heart className="w-8 h-8 text-[#C85A32]" />}
          title="Your Wishlist is Empty"
          description="Explore our trendy streetwear, formal shirts, panjabis, and accessories. Save items you love to revisit anytime."
          actionText="Discover Collection"
          onAction={() => onNavigate('/shop')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center justify-between pb-6 border-b border-[#E5DFD7] mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C]">
            Saved Wishlist ({wishlistProducts.length})
          </h1>
          <p className="text-xs sm:text-sm text-[#626C66] mt-1">
            Items saved for later. Keep track of available sizes and stock drops.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/shop')}
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A2F] hover:text-[#C85A32]"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {wishlistProducts.map((prod) => (
          <ProductCard
            key={prod.id}
            product={prod}
            onQuickView={onQuickView}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};
