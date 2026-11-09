import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RefreshCw,
  Ruler,
  Star,
  Check,
  AlertCircle,
  Share2,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import {
  getProductById,
  getProductBySlug,
  getProducts,
  getProductReviews,
  submitReview
} from '../firebase/db';
import type { Product, Review } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { SizeChartModal } from '../components/common/SizeChartModal';
import { ProductCard } from '../components/common/ProductCard';
import { EmptyState } from '../components/common/EmptyState';

interface ProductDetailPageProps {
  productIdOrSlug: string;
  onNavigate: (path: string) => void;
  onQuickView?: (product: Product) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productIdOrSlug,
  onNavigate,
  onQuickView
}) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { currentUser } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // User selections
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedCustomOption, setSelectedCustomOption] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      try {
        let prod = await getProductById(productIdOrSlug);
        if (!prod) {
          prod = await getProductBySlug(productIdOrSlug);
        }

        if (prod) {
          setProduct(prod);
          const firstOpt =
            prod.customOptionValues?.[0] ||
            prod.sizes?.[0] ||
            prod.variants?.[0]?.size ||
            prod.variants?.[0]?.name ||
            '';
          setSelectedSize(firstOpt);
          setSelectedCustomOption(firstOpt);
          setSelectedColor(prod.colors?.[0]?.name || '');
          setQuantity(1);

          // Fetch reviews and related products
          const [revs, rel] = await Promise.all([
            getProductReviews(prod.id, true),
            getProducts({ category: prod.category, activeOnly: true, limitCount: 5 })
          ]);
          setReviews(revs);
          setRelatedProducts(rel.filter((p) => p.id !== prod?.id).slice(0, 4));
        } else {
          setProduct(null);
        }
      } catch (err) {
        console.warn('Error fetching product details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [productIdOrSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="aspect-[3/4] bg-[#EDE7DC] rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 bg-[#EDE7DC] rounded w-1/4" />
            <div className="h-8 bg-[#EDE7DC] rounded w-3/4" />
            <div className="h-6 bg-[#EDE7DC] rounded w-1/3" />
            <div className="h-24 bg-[#EDE7DC] rounded w-full" />
            <div className="h-12 bg-[#EDE7DC] rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="Product Not Found"
          description="The requested item might have been unlisted, moved, or deleted from our catalog."
          actionText="Browse All Products"
          onAction={() => onNavigate('/shop')}
        />
      </div>
    );
  }

  // Variant matching
  const hasColors = Boolean(product.colors && product.colors.length > 0);
  const variantType =
    product.variantType ||
    (hasColors
      ? 'clothing'
      : product.customOptionValues?.length || product.variants?.length || product.sizes?.length
      ? 'custom'
      : 'none');

  const currentOption = selectedCustomOption || selectedSize;

  let matchedVariant = product.variants?.find((v) => {
    if (variantType === 'clothing' && hasColors) {
      const matchSize = !selectedSize || v.size === selectedSize;
      const matchColor =
        !selectedColor || v.colorName?.toLowerCase() === selectedColor.toLowerCase();
      return matchSize && matchColor;
    }
    if (!currentOption) return false;
    if (v.size === currentOption || v.name === currentOption) return true;
    if (
      v.attributes &&
      Object.values(v.attributes).some((val) => val === currentOption)
    ) {
      return true;
    }
    if (v.id === `opt_${currentOption.replace(/\s+/g, '_')}`) return true;
    return false;
  });

  const availableStock =
    variantType === 'none'
      ? product.totalStock ?? 10
      : matchedVariant?.stock ?? product.totalStock ?? 0;

  const isOutOfStock = availableStock <= 0;

  const basePrice = product.salePrice || product.price;
  const currentPrice =
    matchedVariant?.price && matchedVariant.price > 0 ? matchedVariant.price : basePrice;

  const hasDiscount = Boolean(product.salePrice && product.salePrice < product.price);
  const discountPercent = hasDiscount
    ? Math.round(((product.price - (product.salePrice || 0)) / product.price) * 100)
    : product.discountPercent || 0;

  const isLiked = isInWishlist(product.id);

  const allImages =
    product.images && product.images.length > 0
      ? product.images
      : [product.thumbnail || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg'];

  const categoryName = product.category || '';
  const isApparelOrShoes =
    /clothing|fashion|shirt|panjabi|hoodie|shoe|footwear|sneaker/i.test(categoryName) ||
    Boolean(product.sizes?.length);

  const handleAddToCart = (redirectAfter = false) => {
    setErrorMessage('');
    if (!product.active) {
      setErrorMessage('This product is currently inactive and cannot be ordered.');
      return;
    }

    if (isOutOfStock) {
      setErrorMessage('The selected option is currently out of stock.');
      return;
    }

    if (quantity > availableStock) {
      setErrorMessage(`Only ${availableStock} items available for this option.`);
      return;
    }

    const finalSelectedSize = selectedSize || selectedCustomOption || undefined;
    const finalVariantTitle =
      variantType === 'clothing' && hasColors
        ? `${selectedSize} / ${selectedColor}`
        : finalSelectedSize
        ? `${product.customOptionName || 'Option'}: ${finalSelectedSize}`
        : undefined;

    const res = addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: allImages[activeImageIndex] || allImages[0],
      price: currentPrice,
      originalPrice: hasDiscount ? product.price : undefined,
      selectedSize: finalSelectedSize,
      selectedColor: hasColors ? selectedColor : undefined,
      selectedVariantTitle: finalVariantTitle,
      selectedVariantId: matchedVariant?.id,
      quantity,
      maxStock: availableStock
    });

    if (res.success) {
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2000);
      if (redirectAfter) {
        onNavigate('/checkout');
      }
    } else {
      setErrorMessage(res.message || 'Could not add to cart');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    setSubmittingReview(true);
    try {
      await submitReview({
        productId: product.id,
        productName: product.name,
        customerId: currentUser?.uid || 'guest_shopper',
        customerDisplayName: reviewName.trim() || currentUser?.displayName || 'Customer',
        rating: reviewRating,
        comment: reviewComment.trim(),
        approved: false,
        verifiedPurchase: false
      });
      setReviewSubmitted(true);
      setReviewComment('');
    } catch (err) {
      console.warn('Error submitting review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[#626C66] mb-6 overflow-x-auto whitespace-nowrap">
        <button onClick={() => onNavigate('/')} className="hover:text-[#1E3A2F]">
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <button onClick={() => onNavigate('/shop')} className="hover:text-[#1E3A2F]">
          Shop
        </button>
        {product.category && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <button
              onClick={() => onNavigate(`/category/${product.categorySlug || product.category}`)}
              className="hover:text-[#1E3A2F]"
            >
              {product.category}
            </button>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[#1A1E1C] font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-[#FAF8F5] border border-[#E5DFD7] rounded-2xl overflow-hidden relative shadow-sm">
            <img
              src={allImages[activeImageIndex]}
              alt={product.name}
              className="w-full h-full object-cover object-top"
            />
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-[#C85A32] text-white text-xs font-bold px-3 py-1 rounded-md shadow-md uppercase tracking-wider">
                -{discountPercent}% OFF
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                    activeImageIndex === idx
                      ? 'border-[#1E3A2F] ring-2 ring-[#1E3A2F]/20'
                      : 'border-[#E5DFD7] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info & Purchase Options */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between text-xs text-[#626C66] mb-2">
              <span className="uppercase font-bold tracking-wider text-[#C85A32]">
                {product.category || 'Clothing'}
              </span>
              {product.sku && <span>SKU: {matchedVariant?.sku || product.sku}</span>}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1E1C] leading-tight">
              {product.name}
            </h1>

            {/* Price section */}
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-2xl sm:text-3xl font-black text-[#1E3A2F]">
                ৳{currentPrice.toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-base sm:text-lg text-[#626C66] line-through">
                  ৳{product.price.toLocaleString()}
                </span>
              )}
            </div>

            {/* Stock status indicator */}
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOutOfStock ? 'bg-red-500' : availableStock <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span className="text-xs font-semibold text-[#1A1E1C]">
                {isOutOfStock
                  ? 'Currently Out of Stock'
                  : availableStock <= 5
                  ? `Only ${availableStock} left in stock - order soon!`
                  : 'In Stock (Ready to dispatch)'}
              </span>
            </div>
          </div>

          {/* Option Selector for Custom / Smart Size & Quantity Options */}
          {(variantType === 'custom' ||
            (!hasColors &&
              Boolean(
                product.customOptionValues?.length ||
                  product.variants?.length ||
                  product.sizes?.length
              ))) && (
            <div className="pt-4 border-t border-[#EFEBE5]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C]">
                  {product.customOptionName || 'Select Size / Quantity'}:{' '}
                  <span className="font-semibold text-[#1E3A2F]">{currentOption}</span>
                </span>
                {isApparelOrShoes && (
                  <button
                    type="button"
                    onClick={() => setIsSizeChartOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#C85A32] hover:underline cursor-pointer"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Size Guide</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const set = new Set<string>();
                  if (product.customOptionValues) product.customOptionValues.forEach((v) => set.add(v));
                  if (product.sizes) product.sizes.forEach((s) => set.add(s));
                  if (product.variants) {
                    product.variants.forEach((v) => {
                      if (v.size) set.add(v.size);
                      else if (v.name) set.add(v.name);
                    });
                  }
                  const allOpts = Array.from(set).filter(Boolean);
                  return allOpts.map((opt) => {
                    const isSelected = currentOption === opt;
                    const optVariant = product.variants?.find((v) => {
                      if (v.size === opt || v.name === opt) return true;
                      if (v.attributes && Object.values(v.attributes).some((val) => val === opt)) {
                        return true;
                      }
                      return v.id === `opt_${opt.replace(/\s+/g, '_')}`;
                    });
                    const optStock = optVariant ? optVariant.stock : product.totalStock;
                    const isOptOut = optStock !== undefined && optStock <= 0;

                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={isOptOut}
                        onClick={() => {
                          setSelectedCustomOption(opt);
                          setSelectedSize(opt);
                          if (optVariant?.colorName) {
                            setSelectedColor(optVariant.colorName);
                          }
                        }}
                        className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white shadow-xs cursor-pointer'
                            : isOptOut
                            ? 'border-[#E5DFD7] text-stone-400 bg-stone-100/70 line-through cursor-not-allowed opacity-60'
                            : 'border-[#E5DFD7] text-[#1A1E1C] bg-white hover:border-[#1E3A2F] cursor-pointer'
                        }`}
                      >
                        {optVariant?.colorCode && (
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-2xs"
                            style={{ backgroundColor: optVariant.colorCode }}
                            title={optVariant.colorName || optVariant.colorCode}
                          />
                        )}
                        <span>{opt}</span>
                        {optVariant?.colorName && (
                          <span
                            className={`text-[10px] font-normal truncate max-w-[100px] ${
                              isSelected ? 'text-amber-200' : 'text-stone-500'
                            }`}
                          >
                            ({optVariant.colorName.split('(')[0].trim()})
                          </span>
                        )}
                        {optVariant?.price && optVariant.price !== product.price && (
                          <span
                            className={`text-[10px] font-bold ${
                              isSelected ? 'text-emerald-200' : 'text-[#C85A32]'
                            }`}
                          >
                            (৳{optVariant.price.toLocaleString()})
                          </span>
                        )}
                        {isOptOut && (
                          <span className="text-[9px] text-red-500 font-bold ml-1">
                            (Out of Stock)
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Color Selection for Clothing with colors */}
          {variantType === 'clothing' && hasColors && product.colors && product.colors.length > 0 && (
            <div className="pt-4 border-t border-[#EFEBE5]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C]">
                  Color: <span className="font-semibold text-[#1E3A2F]">{selectedColor}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selectedColor.toLowerCase() === color.name.toLowerCase()
                        ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-1 ring-[#1E3A2F]'
                        : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-stone-300"
                      style={{ backgroundColor: color.hexCode || '#222' }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selection for Clothing with colors */}
          {variantType === 'clothing' && hasColors && product.sizes && product.sizes.length > 0 && (
            <div className="pt-4 border-t border-[#EFEBE5]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C]">
                  Select Size: <span className="font-semibold text-[#1E3A2F]">{selectedSize}</span>
                </span>
                {isApparelOrShoes && (
                  <button
                    type="button"
                    onClick={() => setIsSizeChartOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#C85A32] hover:underline cursor-pointer"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Size Guide</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-12 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      selectedSize === size
                        ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white shadow-xs'
                        : 'border-[#E5DFD7] text-[#1A1E1C] bg-white hover:border-stone-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="pt-4 border-t border-[#EFEBE5]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] block mb-2">
              Quantity
            </span>
            <div className="inline-flex items-center border border-[#E5DFD7] rounded-xl bg-white overflow-hidden shadow-2xs">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-4 py-2 text-stone-600 hover:bg-stone-50 text-base font-bold transition-colors cursor-pointer"
                disabled={quantity <= 1 || isOutOfStock}
              >
                -
              </button>
              <span className="px-5 py-2 font-bold text-sm text-[#1A1E1C]">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                className="px-4 py-2 text-stone-600 hover:bg-stone-50 text-base font-bold transition-colors cursor-pointer"
                disabled={quantity >= availableStock || isOutOfStock}
              >
                +
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-medium text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleAddToCart(false)}
              disabled={isOutOfStock}
              className={`button-interactive flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                isOutOfStock
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-[#1E3A2F] hover:bg-[#162B23] text-white hover:shadow-lg'
              }`}
            >
              {addedNotice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300 animate-scale-in" />
                  <span className="animate-fade-in-up">Item Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 hover:scale-110 transition-transform" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleAddToCart(true)}
              disabled={isOutOfStock}
              className={`button-interactive flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                isOutOfStock
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-[#C85A32] hover:bg-[#B24E2A] text-white hover:shadow-lg'
              }`}
            >
              <span>Buy Now (Cash on Delivery)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Wishlist toggle */}
            <button
              onClick={() => toggleWishlist(product)}
              className={`button-interactive p-3.5 rounded-xl border flex items-center justify-center cursor-pointer ${
                isLiked
                  ? 'bg-[#C85A32] border-[#C85A32] text-white'
                  : 'border-[#E5DFD7] text-[#1A1E1C] hover:bg-stone-50 bg-white'
              }`}
              title={isLiked ? 'Saved in Wishlist' : 'Add to Wishlist'}
            >
              <Heart className={`w-5 h-5 transition-transform hover:scale-110 ${isLiked ? 'fill-current animate-scale-in' : ''}`} />
            </button>
          </div>

          {/* Delivery & Estimated Arrival Highlights */}
          <div className="p-4 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl space-y-3 text-xs">
            <div className="flex items-start gap-2.5 text-[#1A1E1C]">
              <Truck className="w-4 h-4 text-[#1E3A2F] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-[#1E3A2F]">
                  Estimated Delivery Time:
                </div>
                <div className="text-[#3E4844] space-y-0.5">
                  <p>
                    • <strong>Inside Dhaka:</strong> 1–2 days (24–48 hours doorstep delivery) — ৳80
                  </p>
                  <p>
                    • <strong>Outside Dhaka (Nationwide):</strong> 2–4 business days — ৳150
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#1A1E1C] pt-2 border-t border-[#EFEBE5]">
              <ShieldCheck className="w-4 h-4 text-[#C85A32] shrink-0" />
              <span>Cash on Delivery available all over Bangladesh</span>
            </div>

            <div className="flex items-center gap-2.5 text-[#1A1E1C]">
              <RefreshCw className="w-4 h-4 text-[#1E3A2F] shrink-0" />
              <span>7 Days easy exchange & warranty support</span>
            </div>

            {/* Quick Track Link for existing orders */}
            <div className="pt-2 border-t border-[#EFEBE5] flex items-center justify-between text-[11px]">
              <span className="text-[#626C66]">Already placed an order?</span>
              <button
                type="button"
                onClick={() => onNavigate('/my-orders')}
                className="font-bold text-[#1E3A2F] hover:text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Track Orders & Delivery Time</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Product Description & Specifications */}
          <div className="pt-4 border-t border-[#EFEBE5] space-y-4">
            <h3 className="font-bold text-base text-[#1A1E1C]">Product Overview</h3>
            <p className="text-xs sm:text-sm text-[#626C66] leading-relaxed whitespace-pre-line">
              {product.description || product.shortDescription || 'Crafted with premium quality standards for optimal reliability and everyday comfort.'}
            </p>

            {/* Dynamic Specifications & Highlights Table */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C]">
                Product Specifications
              </h4>

              <div className="border border-[#E5DFD7] rounded-xl overflow-hidden bg-white text-xs divide-y divide-[#EFEBE5]">
                {product.brand && (
                  <div className="grid grid-cols-3 p-2.5">
                    <span className="text-[#626C66] font-medium col-span-1">Brand</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.brand}</span>
                  </div>
                )}
                {product.model && (
                  <div className="grid grid-cols-3 p-2.5 bg-[#FAF8F5]/60">
                    <span className="text-[#626C66] font-medium col-span-1">Model</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.model}</span>
                  </div>
                )}
                {product.warranty && (
                  <div className="grid grid-cols-3 p-2.5">
                    <span className="text-[#626C66] font-medium col-span-1">Warranty</span>
                    <span className="font-bold text-emerald-800 col-span-2">{product.warranty}</span>
                  </div>
                )}
                {product.dimensions && (
                  <div className="grid grid-cols-3 p-2.5 bg-[#FAF8F5]/60">
                    <span className="text-[#626C66] font-medium col-span-1">Dimensions</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.dimensions}</span>
                  </div>
                )}
                {product.weight && (
                  <div className="grid grid-cols-3 p-2.5">
                    <span className="text-[#626C66] font-medium col-span-1">Weight</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.weight}</span>
                  </div>
                )}
                {product.unit && product.unit !== 'Piece' && (
                  <div className="grid grid-cols-3 p-2.5 bg-[#FAF8F5]/60">
                    <span className="text-[#626C66] font-medium col-span-1">Unit</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.unit}</span>
                  </div>
                )}
                {product.fabric && (
                  <div className="grid grid-cols-3 p-2.5">
                    <span className="text-[#626C66] font-medium col-span-1">Fabric / Material</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.fabric}</span>
                  </div>
                )}
                {product.gender && (
                  <div className="grid grid-cols-3 p-2.5 bg-[#FAF8F5]/60">
                    <span className="text-[#626C66] font-medium col-span-1">Fit / Department</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{product.gender}</span>
                  </div>
                )}

                {/* Dynamic key-value pairs */}
                {product.specifications?.map((spec, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-3 p-2.5 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F5]/60'
                    }`}
                  >
                    <span className="text-[#626C66] font-medium col-span-1">{spec.key}</span>
                    <span className="font-bold text-[#1A1E1C] col-span-2">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section className="mt-16 pt-12 border-t border-[#E5DFD7]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1A1E1C]">Customer Reviews</h2>
              <p className="text-xs text-[#626C66] mt-0.5">
                {reviews.length} verified {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>

          {/* Reviews list */}
          {reviews.length > 0 ? (
            <div className="space-y-4 mb-10">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 bg-white border border-[#E5DFD7] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1A1E1C]">{rev.customerDisplayName}</span>
                    <div className="flex text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-current' : 'text-stone-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#626C66] leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-white border border-[#E5DFD7] rounded-xl text-center mb-8">
              <p className="text-xs text-[#626C66]">No customer reviews yet for this product. Be the first to share your thoughts!</p>
            </div>
          )}

          {/* Submit Review Box */}
          <div className="bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-5">
            <h3 className="font-bold text-sm text-[#1A1E1C] mb-3">Write a Customer Review</h3>
            {reviewSubmitted ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                Thank you! Your review has been submitted for moderation and will appear once approved.
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1A1E1C]">Your Rating:</span>
                  <div className="flex text-amber-500 cursor-pointer">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1"
                      >
                        <Star
                          className={`w-5 h-5 ${star <= reviewRating ? 'fill-current' : 'text-stone-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Your Name (e.g. Tanvir Ahmed)"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  className="w-full bg-white border border-[#E5DFD7] rounded-lg p-2.5 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />

                <textarea
                  placeholder="Tell us about the fabric quality, sizing accuracy, and comfort..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[#E5DFD7] rounded-lg p-2.5 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 bg-[#1E3A2F] text-white rounded-lg text-xs font-bold hover:bg-[#162B23] transition-colors cursor-pointer"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[#E5DFD7]">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1A1E1C] mb-6">
            You Might Also Like
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={onQuickView}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sizing Guide Modal */}
      <SizeChartModal
        isOpen={isSizeChartOpen}
        onClose={() => setIsSizeChartOpen(false)}
        category={product.category}
      />
    </div>
  );
};
