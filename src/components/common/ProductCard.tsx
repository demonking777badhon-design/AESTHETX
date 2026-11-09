import React, { useState } from 'react';
import { Heart, ShoppingBag, Eye, Check } from 'lucide-react';
import type { Product } from '../../types';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onNavigate?: (path: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView, onNavigate }) => {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [isHovered, setIsHovered] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes?.[0] || 'M');
  const [addedNotice, setAddedNotice] = useState(false);

  const isLiked = isInWishlist(product.id);
  const primaryImg = product.thumbnail || product.images?.[0] || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';
  const secondaryImg = product.images?.[1] || primaryImg;

  const hasDiscount = Boolean(product.salePrice && product.salePrice < product.price);
  const discountPercent = hasDiscount
    ? Math.round(((product.price - (product.salePrice || 0)) / product.price) * 100)
    : product.discountPercent || 0;

  const isOutOfStock = (product.totalStock || 0) <= 0;

  const handleProductClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const targetUrl = `/product/${product.id}`;
    if (onNavigate) {
      onNavigate(targetUrl);
    } else {
      window.location.hash = targetUrl;
    }
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    const variantType =
      product.variantType ||
      (product.sizes?.length || product.colors?.length
        ? 'clothing'
        : product.variants?.length
        ? 'custom'
        : 'none');

    let variantTitle: string | undefined = undefined;
    let variantId: string | undefined = undefined;
    let sizeParam: string | undefined = undefined;
    let colorParam: string | undefined = undefined;
    let maxStockParam = product.totalStock ?? 10;
    let itemPrice = product.salePrice || product.price;

    if (variantType === 'clothing') {
      const firstColor = product.colors?.[0]?.name || 'Standard';
      const variant = product.variants?.find(
        (v) => (v.size === selectedSize || !selectedSize) && v.colorName === firstColor
      );
      sizeParam = selectedSize;
      colorParam = firstColor;
      variantId = variant?.id;
      maxStockParam = variant?.stock ?? product.totalStock ?? 10;
      if (variant?.price && variant.price > 0) itemPrice = variant.price;
    } else if (variantType === 'custom') {
      const firstVariant = product.variants?.[0];
      if (firstVariant) {
        variantId = firstVariant.id;
        variantTitle = firstVariant.name;
        maxStockParam = firstVariant.stock ?? product.totalStock ?? 10;
        if (firstVariant.price && firstVariant.price > 0) itemPrice = firstVariant.price;
      }
    }

    const res = addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: primaryImg,
      price: itemPrice,
      originalPrice: hasDiscount ? product.price : undefined,
      selectedSize: sizeParam,
      selectedColor: colorParam,
      selectedVariantTitle: variantTitle,
      selectedVariantId: variantId,
      quantity: 1,
      maxStock: maxStockParam
    });

    if (res.success) {
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 1800);
    }
  };

  return (
    <div
      className="group relative bg-white border border-[#E5DFD7] rounded-xl overflow-hidden card-hover-lift animate-scale-in transition-all duration-300 flex flex-col justify-between"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Image Container */}
      <div className="relative aspect-[3/4] bg-[#FAF8F5] overflow-hidden cursor-pointer" onClick={handleProductClick}>
        {/* Main Image */}
        <img
          src={isHovered && secondaryImg !== primaryImg ? secondaryImg : primaryImg}
          alt={product.name}
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          {hasDiscount && (
            <span className="bg-[#C85A32] text-white text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase shadow-xs">
              -{discountPercent}% OFF
            </span>
          )}
          {product.newArrival && (
            <span className="bg-[#1E3A2F] text-[#F9F6F0] text-[11px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase shadow-xs">
              New
            </span>
          )}
          {product.bestSeller && (
            <span className="bg-[#8FA89B] text-[#162B23] text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase shadow-xs">
              Popular
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-stone-800 text-stone-200 text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase shadow-xs">
              Sold Out
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product);
          }}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
            isLiked
              ? 'bg-[#C85A32] text-white'
              : 'bg-white/90 backdrop-blur-xs text-[#1A1E1C] hover:text-[#C85A32] hover:bg-white'
          }`}
          title={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        {/* Desktop Quick Actions Overlay */}
        <div className="hidden sm:flex absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-2">
          {onQuickView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
              className="flex-1 bg-white/95 backdrop-blur-xs text-[#1A1E1C] hover:bg-[#1E3A2F] hover:text-white py-2 px-3 rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Quick View</span>
            </button>
          )}

          {!isOutOfStock && (
            <button
              onClick={handleQuickAdd}
              disabled={addedNotice}
              className="flex-1 bg-[#1E3A2F]/95 hover:bg-[#162B23] text-white py-2 px-3 rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              {addedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Details Container */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Brand info */}
          <div className="flex items-center justify-between text-[11px] text-[#626C66] mb-1">
            <span className="uppercase tracking-wider font-semibold text-[#C85A32] truncate">
              {product.category || 'Product'}
            </span>
            {product.brand ? (
              <span className="truncate max-w-[110px] text-stone-600 font-medium">
                {product.brand}
              </span>
            ) : product.model ? (
              <span className="truncate max-w-[110px] text-stone-500 font-light">
                {product.model}
              </span>
            ) : product.fabric ? (
              <span className="truncate max-w-[110px] text-stone-500 font-light">
                {product.fabric}
              </span>
            ) : null}
          </div>

          {/* Product Name */}
          <h3
            onClick={handleProductClick}
            className="font-bold text-[#1A1E1C] text-sm sm:text-base leading-snug line-clamp-1 hover:text-[#1E3A2F] cursor-pointer mb-1.5"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Color swatches preview for clothing */}
          {product.colors && product.colors.length > 0 && (
            <div className="flex items-center gap-1.5 my-1.5">
              {product.colors.slice(0, 5).map((color, idx) => (
                <span
                  key={idx}
                  className="w-3 h-3 rounded-full border border-stone-300 inline-block shadow-2xs"
                  style={{ backgroundColor: color.hexCode || '#222' }}
                  title={color.name}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-[10px] text-[#626C66]">+{product.colors.length - 5}</span>
              )}
            </div>
          )}

          {/* Custom option pills (e.g. Storage, Shoe size, Pack weight) */}
          {product.customOptionValues && product.customOptionValues.length > 0 && (
            <div className="flex items-center gap-1 my-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {product.customOptionValues.slice(0, 4).map((val) => (
                <span
                  key={val}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E5DFD7] text-stone-700 whitespace-nowrap"
                >
                  {val}
                </span>
              ))}
              {product.customOptionValues.length > 4 && (
                <span className="text-[10px] text-stone-500">+{product.customOptionValues.length - 4}</span>
              )}
            </div>
          )}

          {/* Size Chips for clothing */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="flex items-center gap-1 my-2 overflow-x-auto pb-0.5 scrollbar-none">
              {product.sizes.slice(0, 5).map((size) => (
                <button
                  key={size}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSize(size);
                  }}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                    selectedSize === size
                      ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white'
                      : 'border-[#E5DFD7] text-[#626C66] hover:border-stone-400 bg-white'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Mobile Add */}
        <div className="pt-2 border-t border-[#EFEBE5] flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-[#1E3A2F]">
              ৳{hasDiscount ? product.salePrice?.toLocaleString() : product.price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-[#626C66] line-through">
                ৳{product.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Mobile Direct Add Button */}
          <div className="sm:hidden">
            {!isOutOfStock ? (
              <button
                onClick={handleQuickAdd}
                disabled={addedNotice}
                className="w-8 h-8 rounded-lg bg-[#1E3A2F] text-white flex items-center justify-center active:scale-95 transition-transform"
                title="Add to Cart"
              >
                {addedNotice ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              </button>
            ) : (
              <span className="text-[10px] text-stone-500 font-medium">Sold</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
