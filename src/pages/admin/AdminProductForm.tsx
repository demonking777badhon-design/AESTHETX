import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Trash2,
  Plus,
  Star,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Sliders,
  Loader2,
  DollarSign,
  Tag,
  X
} from 'lucide-react';
import {
  saveProduct,
  getCategories,
  getLocalCategoriesCache,
  DEFAULT_MARKETPLACE_CATEGORIES,
  logAdminAction
} from '../../firebase/db';
import { uploadProductImage } from '../../firebase/storage';
import { useAuth } from '../../context/AuthContext';
import {
  SmartSizeQuantityManager,
  type SizeQuantityOption
} from '../../components/admin/SmartSizeQuantityManager';
import type {
  Product,
  Category,
  ProductVariant,
  ProductColor,
  ProductSpecification,
  VariantSystemType
} from '../../types';

interface AdminProductFormProps {
  initialProduct?: Product | null;
  onCancel: () => void;
  onSaved: () => void;
}

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const AdminProductForm: React.FC<AdminProductFormProps> = ({
  initialProduct,
  onCancel,
  onSaved
}) => {
  const { currentUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = getLocalCategoriesCache();
    if (cached && cached.length > 0) return cached;
    return DEFAULT_MARKETPLACE_CATEGORIES.map((c, i) => ({
      id: `cat_${c.slug}`,
      ...c,
      sortOrder: c.sortOrder ?? i + 1,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    }));
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Core Fields
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [shortDescription, setShortDescription] = useState(initialProduct?.shortDescription || '');
  const [category, setCategory] = useState(initialProduct?.category || '');
  const [subcategory, setSubcategory] = useState(initialProduct?.subcategory || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [model, setModel] = useState(initialProduct?.model || '');
  const [warranty, setWarranty] = useState(initialProduct?.warranty || '');
  const [dimensions, setDimensions] = useState(initialProduct?.dimensions || '');
  const [unit, setUnit] = useState(initialProduct?.unit || 'Piece');
  const [weight, setWeight] = useState(initialProduct?.weight || '');
  const [tagsInput, setTagsInput] = useState(initialProduct?.tags?.join(', ') || '');

  // Pricing
  const [price, setPrice] = useState<number>(initialProduct?.price || 1200);
  const [salePrice, setSalePrice] = useState<string>(
    initialProduct?.salePrice ? String(initialProduct.salePrice) : ''
  );
  const [costPrice, setCostPrice] = useState<string>(
    initialProduct?.costPrice ? String(initialProduct.costPrice) : ''
  );

  // Images
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);
  const [thumbnail, setThumbnail] = useState(initialProduct?.thumbnail || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [directImageUrl, setDirectImageUrl] = useState('');

  // Variant Configuration (Defaults to 'custom' Smart Size & Quantity System)
  const [variantType, setVariantType] = useState<VariantSystemType>(() => {
    if (initialProduct?.variantType) return initialProduct.variantType;
    if (initialProduct?.colors && initialProduct.colors.length > 0) return 'clothing';
    if (
      initialProduct?.sizes?.length ||
      initialProduct?.variants?.length ||
      initialProduct?.customOptionValues?.length
    ) {
      return 'custom';
    }
    // Default to 'custom' (Smart Size & Quantity Suggestion System) so suggestions are always ready!
    return 'custom';
  });

  // Smart Size & Quantity Options (Drinks, Groceries, Packs, Shoes, Clothing, Tech)
  const [smartOptions, setSmartOptions] = useState<SizeQuantityOption[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 0) {
      return initialProduct.variants.map((v, i) => ({
        id: v.id || `opt_${i}_${Date.now()}`,
        name: v.size || v.name || `Option ${i + 1}`,
        sku: v.sku || (initialProduct.sku ? `${initialProduct.sku}-${v.size || i + 1}` : ''),
        stock: Number(v.stock) || 0,
        price: v.price,
        colorName: v.colorName,
        colorCode: v.colorCode
      }));
    }
    if (initialProduct?.customOptionValues && initialProduct.customOptionValues.length > 0) {
      return initialProduct.customOptionValues.map((val, i) => ({
        id: `opt_${i}_${val.replace(/\s+/g, '_')}`,
        name: val,
        sku: initialProduct.sku ? `${initialProduct.sku}-${val.replace(/\s+/g, '')}` : '',
        stock: Math.round((initialProduct.totalStock || 25) / initialProduct.customOptionValues!.length) || 10,
        price: undefined
      }));
    }
    if (initialProduct?.sizes && initialProduct.sizes.length > 0) {
      return initialProduct.sizes.map((sz, i) => ({
        id: `opt_${i}_${sz}`,
        name: sz,
        sku: initialProduct.sku ? `${initialProduct.sku}-${sz}` : '',
        stock: Math.round((initialProduct.totalStock || 25) / initialProduct.sizes.length) || 10,
        price: undefined
      }));
    }
    // For new products, pre-select popular M, L, XL sizes as requested
    return [
      { id: 'opt_init_m', name: 'M', stock: 15 },
      { id: 'opt_init_l', name: 'L', stock: 15 },
      { id: 'opt_init_xl', name: 'XL', stock: 15 }
    ];
  });

  const [smartOptionTitle, setSmartOptionTitle] = useState<string>(
    initialProduct?.customOptionName || 'Size / Quantity'
  );

  // Clothing options (when fashion color swatches mode is used)
  const [clothingSizes, setClothingSizes] = useState<string[]>(
    initialProduct?.sizes || ['S', 'M', 'L', 'XL']
  );
  const [customClothingSize, setCustomClothingSize] = useState('');

  const [clothingColors, setClothingColors] = useState<ProductColor[]>(
    initialProduct?.colors || [
      { name: 'Black', hexCode: '#111111' },
      { name: 'Navy Blue', hexCode: '#1B2A4A' }
    ]
  );
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#1E3A2F');

  // Single stock for 'none' variant type
  const [simpleStock, setSimpleStock] = useState<number>(initialProduct?.totalStock ?? 25);

  // Variants Matrix (used when in clothing mode)
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialProduct?.variants || []
  );

  // Flexible Specifications (key-value)
  const [specifications, setSpecifications] = useState<ProductSpecification[]>(
    initialProduct?.specifications || [
      { key: 'Brand', value: initialProduct?.brand || 'Aesthetx' },
      { key: 'Origin', value: 'Bangladesh' }
    ]
  );
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  // Flags
  const [featured, setFeatured] = useState(initialProduct?.featured || false);
  const [newArrival, setNewArrival] = useState(initialProduct?.newArrival ?? true);
  const [bestSeller, setBestSeller] = useState(initialProduct?.bestSeller || false);
  const [active, setActive] = useState(initialProduct?.active ?? true);

  // SEO
  const [seoTitle, setSeoTitle] = useState(initialProduct?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(initialProduct?.seoDescription || '');

  useEffect(() => {
    let isMounted = true;
    getCategories(false).then((cats) => {
      if (!isMounted) return;
      let merged = cats && cats.length > 0 ? cats : getLocalCategoriesCache();
      if (!merged || merged.length === 0) {
        merged = DEFAULT_MARKETPLACE_CATEGORIES.map((c, i) => ({
          id: `cat_${c.slug}`,
          ...c,
          sortOrder: c.sortOrder ?? i + 1,
          createdAt: { seconds: Math.floor(Date.now() / 1000) }
        }));
      }

      // If initialProduct has a category that isn't in categories, include it so it's always selectable!
      if (initialProduct?.category && !merged.some((c) => c.name.toLowerCase() === initialProduct.category.toLowerCase())) {
        merged = [
          ...merged,
          {
            id: `cat_custom_${Date.now()}`,
            name: initialProduct.category,
            slug: initialProduct.categorySlug || initialProduct.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            active: true,
            sortOrder: merged.length + 1
          }
        ];
      }

      setCategories(merged);

      if (!category && merged.length > 0) {
        setCategory(initialProduct?.category || merged[0].name);
      }
    }).catch(console.warn);

    const handleUpdate = () => {
      getCategories(false).then((cats) => {
        if (!isMounted) return;
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
      });
    };

    window.addEventListener('aesthetx-categories-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('aesthetx-categories-updated', handleUpdate);
    };
  }, [initialProduct]);

  // Keep state in sync whenever initialProduct changes (e.g. switching products to edit)
  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '');
      setSlug(initialProduct.slug || '');
      setSku(initialProduct.sku || '');
      setDescription(initialProduct.description || '');
      setShortDescription(initialProduct.shortDescription || '');
      setCategory(initialProduct.category || '');
      setSubcategory(initialProduct.subcategory || '');
      setBrand(initialProduct.brand || '');
      setModel(initialProduct.model || '');
      setWarranty(initialProduct.warranty || '');
      setDimensions(initialProduct.dimensions || '');
      setUnit(initialProduct.unit || 'Piece');
      setPrice(initialProduct.price || 1200);
      setSalePrice(initialProduct.salePrice ? String(initialProduct.salePrice) : '');
      setImages(initialProduct.images || []);
      setThumbnail(initialProduct.thumbnail || '');
      setActive(initialProduct.active ?? true);
    }
  }, [initialProduct]);

  const selectedCategoryObj = categories.find((c) => c.name === category);

  // Auto-generate slug when title changes
  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialProduct) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
    }
  };

  // Recompute variants for Clothing mode
  useEffect(() => {
    if (variantType === 'clothing') {
      const updated: ProductVariant[] = [];
      clothingSizes.forEach((sz) => {
        clothingColors.forEach((col) => {
          const varId = `${sz}_${col.name.replace(/\s+/g, '_')}`;
          const existing = variants.find((v) => v.id === varId);
          if (existing) {
            updated.push(existing);
          } else {
            updated.push({
              id: varId,
              name: `${sz} / ${col.name}`,
              sku: sku ? `${sku}-${sz}-${col.name.slice(0, 3).toUpperCase()}` : '',
              size: sz,
              colorName: col.name,
              colorCode: col.hexCode,
              stock: 10
            });
          }
        });
      });
      setVariants(updated);
    }
  }, [variantType, clothingSizes, clothingColors, sku]);

  const handleVariantStockChange = (varId: string, val: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === varId ? { ...v, stock: Math.max(0, val) } : v))
    );
  };

  const handleVariantPriceChange = (varId: string, val: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === varId ? { ...v, price: val > 0 ? val : undefined } : v))
    );
  };

  // Multi-image upload handler with instant preview and concurrent fast upload
  const handleFileUpload = async (filesList: FileList | File[] | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    setUploadingImage(true);
    setUploadProgress(25);
    setErrorMsg('');

    try {
      // 1. Process all selected files concurrently
      const uploadPromises = files.map(async (file, idx) => {
        const url = await uploadProductImage(file, 'products', (prog) => {
          if (idx === 0) setUploadProgress(prog);
        });
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      setImages((prev) => {
        const merged = [...prev, ...uploadedUrls];
        if (!thumbnail && merged.length > 0) {
          setThumbnail(merged[0]);
        }
        return merged;
      });
    } catch (err: any) {
      console.warn('Image upload notice:', err);
      setErrorMsg('Image processing notice: ' + (err.message || 'Check connection'));
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleAddDirectUrl = () => {
    if (directImageUrl.trim()) {
      setImages((prev) => [...prev, directImageUrl.trim()]);
      if (!thumbnail) setThumbnail(directImageUrl.trim());
      setDirectImageUrl('');
    }
  };

  const handleRemoveImage = (imgUrl: string) => {
    const updated = images.filter((img) => img !== imgUrl);
    setImages(updated);
    if (thumbnail === imgUrl) {
      setThumbnail(updated[0] || '');
    }
  };

  // Specifications
  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    setSpecifications((prev) => [
      ...prev,
      { key: newSpecKey.trim(), value: newSpecVal.trim() }
    ]);
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpec = (index: number) => {
    setSpecifications((prev) => prev.filter((_, i) => i !== index));
  };

  const applySpecTemplate = (type: 'electronics' | 'shoes' | 'furniture' | 'grocery' | 'clothing' | 'beauty' | 'watches') => {
    switch (type) {
      case 'electronics':
        setSpecifications([
          { key: 'Brand', value: brand || 'Brand' },
          { key: 'Model', value: model || 'Model No.' },
          { key: 'Warranty', value: warranty || '1 Year Official' },
          { key: 'Battery', value: '4500 mAh / Fast Charging' },
          { key: 'Connectivity', value: 'Bluetooth 5.3 / USB-C' },
          { key: 'In The Box', value: 'Product, Charging Cable, Manual, Warranty Card' }
        ]);
        break;
      case 'shoes':
        setSpecifications([
          { key: 'Upper Material', value: 'Breathable Mesh / Premium Synthetic' },
          { key: 'Sole Material', value: 'Anti-Slip Grip Rubber' },
          { key: 'Insole', value: 'Cushioned Memory Foam' },
          { key: 'Closure Type', value: 'Lace-Up' },
          { key: 'Ideal For', value: 'Casual & Lifestyle Wear' }
        ]);
        break;
      case 'furniture':
        setSpecifications([
          { key: 'Dimensions', value: dimensions || '120cm x 60cm x 75cm' },
          { key: 'Primary Material', value: 'Engineered High-Grade Wood & Alloy Frame' },
          { key: 'Finish', value: 'Matte Scratch-Resistant Finish' },
          { key: 'Assembly', value: 'DIY Easy Assembly (Hardware Included)' }
        ]);
        break;
      case 'grocery':
        setSpecifications([
          { key: 'Net Quantity', value: weight || '500g' },
          { key: 'Best Before', value: '12 Months from Manufacturing' },
          { key: 'Storage Condition', value: 'Store in a cool, dry place' },
          { key: 'Dietary Preference', value: '100% Halal & Pure' }
        ]);
        break;
      case 'clothing':
        setSpecifications([
          { key: 'Fabric Material', value: '100% Combed Compact Cotton' },
          { key: 'GSM Weight', value: '180-200 GSM Heavyweight' },
          { key: 'Fit Type', value: 'Relaxed / Regular Comfort Fit' },
          { key: 'Wash Care', value: 'Machine wash cold inside out, do not bleach' }
        ]);
        break;
      case 'beauty':
        setSpecifications([
          { key: 'Skin Type', value: 'Suitable for all skin types' },
          { key: 'Net Volume', value: '100 ml' },
          { key: 'Key Ingredients', value: 'Niacinamide, Hyaluronic Acid, Aloe Vera' },
          { key: 'Usage', value: 'Apply twice daily after cleansing' }
        ]);
        break;
      case 'watches':
        setSpecifications([
          { key: 'Movement', value: 'Japanese Quartz Precision Movement' },
          { key: 'Case Material', value: 'Ion-Plated Stainless Steel' },
          { key: 'Water Resistance', value: '30 Meters / 3 ATM' },
          { key: 'Dial Window', value: 'Hardened Scratch-Proof Mineral Glass' },
          { key: 'Warranty', value: '1 Year Machine Warranty' }
        ]);
        break;
    }
  };

  // Clothing color & size helpers
  const handleAddColor = () => {
    if (!newColorName.trim()) return;
    setClothingColors((prev) => [
      ...prev,
      { name: newColorName.trim(), hexCode: newColorHex }
    ]);
    setNewColorName('');
  };

  const handleRemoveColor = (nameToRemove: string) => {
    setClothingColors((prev) => prev.filter((c) => c.name !== nameToRemove));
  };

  const handleToggleClothingSize = (sz: string) => {
    if (clothingSizes.includes(sz)) {
      setClothingSizes(clothingSizes.filter((s) => s !== sz));
    } else {
      setClothingSizes([...clothingSizes, sz]);
    }
  };

  const handleAddCustomClothingSize = () => {
    if (customClothingSize.trim() && !clothingSizes.includes(customClothingSize.trim())) {
      setClothingSizes([...clothingSizes, customClothingSize.trim()]);
      setCustomClothingSize('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter a product title.');
      return;
    }

    if (!price || price <= 0) {
      setErrorMsg('Please specify a valid product price.');
      return;
    }

    setSaving(true);

    try {
      const calculatedTotalStock =
        variantType === 'none'
          ? Number(simpleStock) || 0
          : variantType === 'custom'
          ? smartOptions.reduce((sum, opt) => sum + (Number(opt.stock) || 0), 0)
          : variants.reduce((sum, v) => sum + (v.stock || 0), 0);

      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const categorySlug =
        categories.find((c) => c.name === category)?.slug ||
        category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      let cleanVariants: ProductVariant[] = [];
      let finalSizes: string[] = [];

      if (variantType === 'custom') {
        finalSizes = smartOptions.map((o) => o.name);
        cleanVariants = smartOptions.map((opt) => {
          const cleanV: ProductVariant = {
            id: opt.id || `opt_${opt.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            name: opt.name,
            sku: opt.sku?.trim() || (sku ? `${sku}-${opt.name.replace(/\s+/g, '')}` : opt.name),
            stock: Number(opt.stock) || 0,
            size: opt.name,
            attributes: {
              [smartOptionTitle || 'Size / Quantity']: opt.name
            }
          };
          if (
            opt.price !== undefined &&
            opt.price !== null &&
            !isNaN(Number(opt.price)) &&
            Number(opt.price) > 0
          ) {
            cleanV.price = Number(opt.price);
          }
          if (opt.colorName?.trim()) {
            cleanV.colorName = opt.colorName.trim();
          }
          if (opt.colorCode?.trim()) {
            cleanV.colorCode = opt.colorCode.trim();
          }
          return cleanV;
        });
      } else if (variantType === 'clothing') {
        finalSizes = clothingSizes;
        cleanVariants = variants.map((v) => {
          const cleanV: ProductVariant = {
            id: v.id,
            name: v.name || '',
            sku: v.sku?.trim() || `${sku ? sku + '-' : ''}${v.id}`,
            stock: Number(v.stock) || 0
          };
          if (
            v.price !== undefined &&
            v.price !== null &&
            !isNaN(Number(v.price)) &&
            Number(v.price) > 0
          ) {
            cleanV.price = Number(v.price);
          }
          if (v.size?.trim()) cleanV.size = v.size.trim();
          if (v.colorName?.trim()) cleanV.colorName = v.colorName.trim();
          if (v.colorCode?.trim()) cleanV.colorCode = v.colorCode.trim();
          if (v.attributes && Object.keys(v.attributes).length > 0) {
            cleanV.attributes = v.attributes;
          }
          return cleanV;
        });
      }

      // Extract colors from custom options if present
      const customColorsMap = new Map<string, { name: string; code: string }>();
      if (variantType === 'custom') {
        smartOptions.forEach((opt) => {
          if (opt.colorName && opt.colorCode) {
            customColorsMap.set(opt.colorCode.toLowerCase(), {
              name: opt.colorName,
              code: opt.colorCode
            });
          }
        });
      }

      const cleanSpecs = (specifications || [])
        .filter((s) => s.key && s.key.trim() && s.value && s.value.trim())
        .map((s) => ({
          key: s.key.trim(),
          value: s.value.trim()
        }));

      const productPayload: Record<string, any> = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sku: sku.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        category: category || (categories[0]?.name ?? 'General'),
        categorySlug,
        unit: unit.trim() || 'Piece',
        images,
        thumbnail: thumbnail || images[0] || '',
        price: Number(price),
        variantType,
        sizes: finalSizes,
        colors:
          variantType === 'clothing'
            ? clothingColors
            : Array.from(customColorsMap.values()),
        variants: cleanVariants,
        specifications: cleanSpecs,
        totalStock: calculatedTotalStock,
        tags: tagsArray,
        featured,
        newArrival,
        bestSeller,
        active,
        seoTitle: seoTitle.trim() || name.trim(),
        seoDescription: seoDescription.trim() || shortDescription.trim()
      };

      if (subcategory.trim()) productPayload.subcategory = subcategory.trim();
      if (brand.trim()) productPayload.brand = brand.trim();
      if (model.trim()) productPayload.model = model.trim();
      if (warranty.trim()) productPayload.warranty = warranty.trim();
      if (dimensions.trim()) productPayload.dimensions = dimensions.trim();
      if (weight.trim()) productPayload.weight = weight.trim();
      if (salePrice && !isNaN(Number(salePrice))) productPayload.salePrice = Number(salePrice);
      if (costPrice && !isNaN(Number(costPrice))) productPayload.costPrice = Number(costPrice);

      if (variantType === 'custom') {
        productPayload.customOptionName = smartOptionTitle || 'Size / Quantity';
        productPayload.customOptionValues = smartOptions.map((o) => o.name);
      }

      await saveProduct(productPayload, initialProduct?.id);

      await logAdminAction(
        initialProduct ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
        name.trim(),
        `Category: ${category}, Price: ৳${price}, Stock: ${calculatedTotalStock}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      onSaved();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setErrorMsg(err.message || 'Failed to save product in Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#E5DFD7]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-[#E5DFD7] bg-white hover:bg-stone-50 text-stone-600 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1A1E1C]">
              {initialProduct ? 'Edit Product' : 'Create Marketplace Product'}
            </h1>
            <p className="text-xs text-[#626C66]">
              Add any kind of product: Electronics, Fashion, Home, Groceries, Footwear, or Accessories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[#E5DFD7] text-stone-700 bg-white hover:bg-stone-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Product'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main Info, Images, Variants */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
              Product Identity & Department
            </h2>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Product Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Wireless ANC Earbuds, Heavyweight T-Shirt, or Ergonomic Office Chair"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  SKU (Stock Keeping Unit)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AL-PROD-900"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs uppercase font-mono text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  placeholder="product-name-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>
            </div>

            {/* Category & Subcategory Selection with Clickable Chips & Safe White Styling */}
            <div className="space-y-4 p-4.5 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7]">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <label className="text-xs font-bold text-[#1A1E1C] flex items-center gap-1.5">
                    <span>Category</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-[#626C66]">
                    Click a category chip or select from the dropdown
                  </span>
                </div>

                {/* Clickable Category Chips */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {categories.map((c) => {
                      const isSelected = category.toLowerCase().trim() === c.name.toLowerCase().trim();
                      return (
                        <button
                          key={c.id || c.name}
                          type="button"
                          onClick={() => {
                            setCategory(c.name);
                            setSubcategory('');
                            if (variantType === 'none') {
                              setVariantType('custom');
                            }
                          }}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shadow-2xs ${
                            isSelected
                              ? 'bg-[#1E3A2F] text-white border-2 border-[#1E3A2F] ring-2 ring-[#1E3A2F]/25 scale-102'
                              : 'bg-white hover:bg-stone-100 text-[#1A1E1C] border border-[#E5DFD7]'
                          }`}
                        >
                          {c.image ? (
                            <img
                              src={c.image}
                              alt=""
                              className="w-5 h-5 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-[#1E3A2F]'
                              }`}
                            >
                              {c.name.slice(0, 1)}
                            </span>
                          )}
                          <span>{c.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-300 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Clean Dropdown with Explicit White Background (No Black Box) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setSubcategory('');
                        if (variantType === 'none') {
                          setVariantType('custom');
                        }
                      }}
                      style={{ backgroundColor: '#ffffff', color: '#1a1e1c', colorScheme: 'light' }}
                      className="w-full bg-white border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl p-3 text-xs font-semibold text-[#1A1E1C] focus:outline-hidden cursor-pointer shadow-2xs"
                      required
                    >
                      <option value="" style={{ backgroundColor: '#ffffff', color: '#1a1e1c' }}>
                        -- Select Category from List --
                      </option>
                      {categories.map((c) => (
                        <option
                          key={c.id || c.name}
                          value={c.name}
                          style={{ backgroundColor: '#ffffff', color: '#1a1e1c' }}
                        >
                          {c.name}
                        </option>
                      ))}
                      {category && !categories.some((c) => c.name.toLowerCase().trim() === category.toLowerCase().trim()) && (
                        <option
                          value={category}
                          style={{ backgroundColor: '#ffffff', color: '#1a1e1c' }}
                        >
                          {category} (Current)
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Or Type a Custom Category */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="বা কাস্টম ক্যাটাগরি লিখুন..."
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setSubcategory('');
                      }}
                      style={{ backgroundColor: '#ffffff', color: '#1a1e1c', colorScheme: 'light' }}
                      className="w-full bg-white border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl p-3 text-xs font-medium text-[#1A1E1C] outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {category && (
                  <div className="mt-2 text-xs font-semibold text-[#1E3A2F] flex items-center gap-1.5">
                    <span className="text-[#626C66] font-normal">সিলেক্টেড ক্যাটাগরি:</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      {category}
                    </span>
                  </div>
                )}
              </div>

              {/* Subcategory Section with Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1A1E1C] block">
                    Subcategory (Optional)
                  </label>
                  <span className="text-[10px] text-[#626C66]">Select chip or type below</span>
                </div>

                {selectedCategoryObj?.subcategories && selectedCategoryObj.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {selectedCategoryObj.subcategories.map((sub) => {
                      const isSubSelected = subcategory === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSubcategory(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isSubSelected
                              ? 'bg-[#1E3A2F] text-white border border-[#1E3A2F]'
                              : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#E5DFD7]'
                          }`}
                        >
                          {isSubSelected && '✓ '}
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="e.g. Semi-Long Panjabi, Oversized T-Shirt, Casual, etc..."
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: '#1a1e1c', colorScheme: 'light' }}
                  className="w-full bg-white border border-[#E5DFD7] focus:border-[#1E3A2F] rounded-xl p-2.5 text-xs text-[#1A1E1C] outline-hidden shadow-2xs"
                />
              </div>

              {/* Brand field */}
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aesthetx Lifestyle, Apple, Sony, Nike"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  style={{ backgroundColor: '#ffffff', color: '#1a1e1c', colorScheme: 'light' }}
                  className="w-full bg-white border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] outline-hidden shadow-2xs"
                />
              </div>
            </div>

            {/* Model, Warranty, Unit, Dimensions */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Model No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pro-2026, Series 9"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Warranty Info
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 Year Official, 6 Months"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Unit Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Piece, Kg, Set, Pack"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Dimensions / Size
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15 x 8 x 2 cm"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Full Description
              </label>
              <textarea
                rows={4}
                placeholder="Detailed product features, materials, unboxing package contents, and usage guidance..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
              />
            </div>
          </div>

          {/* Product Photography & Upload Card (Fixed, No 0% hang) */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5] flex items-center justify-between">
              <span>Product Photography & Gallery</span>
              <span className="text-xs text-[#626C66] font-normal">
                {images.length} {images.length === 1 ? 'image' : 'images'} added
              </span>
            </h2>

            {/* Gallery Previews */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[#E5DFD7] group bg-[#FAF8F5]"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />

                  {thumbnail === img && (
                    <span className="absolute top-1.5 left-1.5 bg-[#1E3A2F] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      Thumbnail
                    </span>
                  )}

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setThumbnail(img)}
                      className="p-1.5 bg-white text-stone-800 rounded-lg text-[10px] font-bold"
                      title="Set as Thumbnail"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img)}
                      className="p-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Upload Box with Multi-Image & Drag/Drop */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
                className="border-2 border-dashed border-[#E5DFD7] hover:border-[#1E3A2F] rounded-xl aspect-[3/4] flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors bg-[#FAF8F5] hover:bg-stone-50"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-6 h-6 text-[#1E3A2F] animate-spin mb-1" />
                    <span className="text-[11px] font-bold text-[#1E3A2F]">
                      Uploading ({uploadProgress || 60}%)...
                    </span>
                    <span className="text-[9px] text-stone-500 mt-0.5">Compressing images</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-[#1E3A2F] mb-1" />
                    <span className="text-[11px] font-bold text-[#1A1E1C]">Upload Photos</span>
                    <span className="text-[9px] text-[#626C66] mt-0.5">Select multiple or drag & drop</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Direct Image URL input option */}
            <div className="flex gap-2 pt-2">
              <input
                type="url"
                placeholder="Or paste external image URL..."
                value={directImageUrl}
                onChange={(e) => setDirectImageUrl(e.target.value)}
                className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl px-3 py-2 text-xs text-[#1A1E1C] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddDirectUrl}
                className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:bg-stone-900"
              >
                Add URL
              </button>
            </div>
          </div>

          {/* Pricing & Cost Section (মূল্য নির্ধারণ - সাইজ ও ওজনের ঠিক উপরে) */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
              <h2 className="text-sm font-bold text-[#1A1E1C] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#1E3A2F]" />
                <span>Pricing & Cost (মূল্য নির্ধারণ)</span>
              </h2>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                BDT (৳)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Regular Selling Price (মূল বিক্রয়মূল্য) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#626C66]">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Sale / Discount Price (ছাড়ের মূল্য - ঐচ্ছিক)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#626C66]">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Regular price থাকলে খালি রাখুন"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Cost Price (ক্রয়মূল্য / গোপনীয়)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#626C66]">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="কেনা খরচ / ইনভেন্টরি কস্ট"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs font-mono text-[#626C66] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Universal Variants System (সাইজ, ওজন, আয়তন ও পরিমাণের অপশন — মূল্য নির্ধারণের ঠিক নিচে) */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#EFEBE5] gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#1A1E1C] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1E3A2F]" />
                  <span>Product Size, Weight & Quantity Options (সাইজ, ওজন ও পরিমাণের অপশন)</span>
                </h2>
                <p className="text-[11px] text-[#626C66] mt-0.5">
                  উপরের মূল্যের ওপর ভিত্তি করে পণ্যের সাইজ, ওজন, আয়তন বা প্যাকেটের পরিমাণের অপশন নির্ধারণ করুন।
                </p>
              </div>
            </div>

            {/* Variant Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  variantType === 'custom'
                    ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-2 ring-[#1E3A2F]/20'
                    : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="variantType"
                  checked={variantType === 'custom'}
                  onChange={() => setVariantType('custom')}
                  className="hidden"
                />
                <span className="font-bold text-[#1A1E1C] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E3A2F]" />
                  <span>Smart Size & Quantity System</span>
                </span>
                <span className="text-[11px] text-[#626C66] mt-0.5 block">
                  সাইজ (S, M, L), জুতার সাইজ, খেলনা ও গাড়ির স্কেল, ডাইমেনশন, প্যাকেট, খাদ্য ও পানীয়ের অটো-সাজেশন ও কাস্টম অপশন।
                </span>
              </label>

              <label
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  variantType === 'none'
                    ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-2 ring-[#1E3A2F]/20'
                    : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="variantType"
                  checked={variantType === 'none'}
                  onChange={() => setVariantType('none')}
                  className="hidden"
                />
                <span className="font-bold text-[#1A1E1C] block">Single Item (No Variants)</span>
                <span className="text-[11px] text-[#626C66] mt-0.5 block">
                  যেকোনো সাধারণ পণ্য যাতে সাইজ বা পরিমাণের কোনো অপশন থাকবে না।
                </span>
              </label>

              <label
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  variantType === 'clothing'
                    ? 'border-[#1E3A2F] bg-[#FAF8F5] ring-2 ring-[#1E3A2F]/20'
                    : 'border-[#E5DFD7] hover:border-stone-400 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="variantType"
                  checked={variantType === 'clothing'}
                  onChange={() => setVariantType('clothing')}
                  className="hidden"
                />
                <span className="font-bold text-[#1A1E1C] block">Fashion Mode (Sizes + Colors)</span>
                <span className="text-[11px] text-[#626C66] mt-0.5 block">
                  পোশাকের একাধিক কালার সোয়াচ এবং সাইজ মেট্রিক্স।
                </span>
              </label>
            </div>

            {/* Case 1: Simple Stock */}
            {variantType === 'none' && (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7]">
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Total Available Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={simpleStock}
                  onChange={(e) => setSimpleStock(Number(e.target.value))}
                  className="w-36 bg-white border border-[#E5DFD7] rounded-xl p-2.5 text-xs font-bold text-[#1A1E1C]"
                />
                <p className="text-[11px] text-[#626C66] mt-1">
                  Customers can order this product directly without choosing sizes or options.
                </p>
              </div>
            )}

            {/* Case 2: Smart Size & Quantity Suggestion System */}
            {variantType === 'custom' && (
              <SmartSizeQuantityManager
                category={category}
                subcategory={subcategory}
                productSku={sku}
                basePrice={price}
                options={smartOptions}
                onChange={setSmartOptions}
                optionTitle={smartOptionTitle}
                onOptionTitleChange={setSmartOptionTitle}
              />
            )}

            {/* Case 3: Clothing Mode */}
            {variantType === 'clothing' && (
              <div className="space-y-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD7]">
                {/* Sizes */}
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-2">Sizes</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CLOTHING_SIZES.map((sz) => (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => handleToggleClothingSize(sz)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          clothingSizes.includes(sz)
                            ? 'border-[#1E3A2F] bg-[#1E3A2F] text-white'
                            : 'border-[#E5DFD7] bg-white text-[#1A1E1C] hover:border-stone-400'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 max-w-xs">
                    <input
                      type="text"
                      placeholder="Custom size (e.g. 40, Free)"
                      value={customClothingSize}
                      onChange={(e) => setCustomClothingSize(e.target.value)}
                      className="flex-1 bg-white border border-[#E5DFD7] rounded-lg px-3 py-1.5 text-xs text-[#1A1E1C]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomClothingSize}
                      className="px-3 py-1.5 bg-white border border-[#E5DFD7] hover:border-[#1E3A2F] text-xs font-bold rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Colors */}
                <div className="pt-3 border-t border-[#E5DFD7]">
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-2">Colors</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {clothingColors.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5DFD7] bg-white text-xs font-semibold"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-stone-300"
                          style={{ backgroundColor: c.hexCode }}
                        />
                        <span>{c.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(c.name)}
                          className="text-stone-400 hover:text-red-600 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-[#E5DFD7] cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Color Name (e.g. Navy, Beige)"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      className="flex-1 bg-white border border-[#E5DFD7] rounded-lg px-3 py-1.5 text-xs text-[#1A1E1C]"
                    />
                    <button
                      type="button"
                      onClick={handleAddColor}
                      className="px-3 py-1.5 bg-[#1E3A2F] text-white text-xs font-bold rounded-lg"
                    >
                      Add Color
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Variant Stock Matrix Table for Clothing Mode */}
            {variantType === 'clothing' && variants.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-bold text-[#1A1E1C] mb-2 uppercase tracking-wider">
                  Variant Stock & Pricing Matrix ({variants.length} Variants)
                </h3>
                <div className="border border-[#E5DFD7] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#626C66] border-b border-[#E5DFD7]">
                      <tr>
                        <th className="p-2.5">Variant Option</th>
                        <th className="p-2.5">Stock Quantity</th>
                        <th className="p-2.5">Price Override (Optional ৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEBE5]">
                      {variants.map((v) => (
                        <tr key={v.id}>
                          <td className="p-2.5 font-bold text-[#1E3A2F]">
                            {v.name || v.id}
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              value={v.stock}
                              onChange={(e) =>
                                handleVariantStockChange(v.id, Number(e.target.value))
                              }
                              className="w-24 bg-white border border-[#E5DFD7] rounded p-1 text-xs font-bold text-[#1A1E1C]"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              placeholder={`Default (৳${price})`}
                              value={v.price || ''}
                              onChange={(e) =>
                                handleVariantPriceChange(v.id, Number(e.target.value))
                              }
                              className="w-32 bg-white border border-[#E5DFD7] rounded p-1 text-xs text-[#1A1E1C]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Specifications & Highlights */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#EFEBE5] gap-2">
              <h2 className="text-sm font-bold text-[#1A1E1C]">
                Specifications & Technical Attributes
              </h2>
              <span className="text-xs text-[#626C66]">Flexible key-value pairs for any category</span>
            </div>

            {/* Template Presets */}
            <div>
              <span className="text-[11px] font-bold text-[#626C66] uppercase tracking-wider block mb-2">
                1-Click Preset Templates
              </span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => applySpecTemplate('electronics')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Electronics Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('shoes')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Footwear Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('clothing')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Clothing Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('furniture')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Furniture Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('grocery')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Grocery Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('beauty')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Beauty Specs
                </button>
                <button
                  type="button"
                  onClick={() => applySpecTemplate('watches')}
                  className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] rounded-lg text-[11px] font-semibold text-[#1A1E1C]"
                >
                  + Watches Specs
                </button>
              </div>
            </div>

            {/* List */}
            {specifications.length > 0 ? (
              <div className="divide-y divide-[#EFEBE5] border border-[#E5DFD7] rounded-xl overflow-hidden">
                {specifications.map((spec, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between text-xs bg-white">
                    <div className="flex gap-4">
                      <strong className="text-stone-700 min-w-32">{spec.key}:</strong>
                      <span className="text-[#1A1E1C]">{spec.value}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(i)}
                      className="text-stone-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#626C66]">No technical specifications added yet.</p>
            )}

            {/* Add Spec Pair */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Attribute (e.g. Battery, RAM, Material)"
                value={newSpecKey}
                onChange={(e) => setNewSpecKey(e.target.value)}
                className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
              />
              <input
                type="text"
                placeholder="Value (e.g. 5000 mAh, 8GB, Solid Wood)"
                value={newSpecVal}
                onChange={(e) => setNewSpecVal(e.target.value)}
                className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
              />
              <button
                type="button"
                onClick={handleAddSpec}
                className="px-4 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#162B23]"
              >
                Add Spec
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Overview, Flags, SEO */}
        <div className="space-y-6">
          {/* Quick Overview & Publish Action */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
              <h2 className="text-sm font-bold text-[#1A1E1C]">
                Publish & Overview
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>
                {active ? 'Live' : 'Hidden'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>মূল বিক্রয়মূল্য:</span>
                <span className="font-bold text-[#1A1E1C]">৳{price.toLocaleString()}</span>
              </div>
              {salePrice && Number(salePrice) > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>ডিসকাউন্ট মূল্য:</span>
                  <span className="font-bold text-emerald-700">৳{Number(salePrice).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>সাইজ / পরিমাণের অপশন:</span>
                <span className="font-bold text-[#1E3A2F]">
                  {variantType === 'custom' ? `${smartOptions.length} টি অপশন` : variantType === 'clothing' ? `${clothingSizes.length} টি সাইজ` : '১টি সিঙ্গেল পণ্য'}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>মোট ইনভেন্টরি স্টক:</span>
                <span className="font-bold text-[#1E3A2F]">
                  {variantType === 'custom'
                    ? smartOptions.reduce((s, o) => s + (Number(o.stock) || 0), 0)
                    : variantType === 'clothing'
                    ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
                    : simpleStock}{' '}
                  pcs
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : initialProduct ? 'Update Product' : 'Save Product (সংরক্ষণ করুন)'}</span>
            </button>
          </div>

          {/* Catalog Badges & Visibility */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
              Badges & Status
            </h2>

            <label className="flex items-center justify-between cursor-pointer py-1 text-xs">
              <span className="font-semibold text-[#1A1E1C]">Active on Website</span>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 text-xs">
              <span className="font-semibold text-[#1A1E1C]">Featured Product</span>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 text-xs">
              <span className="font-semibold text-[#1A1E1C]">New Arrival Tag</span>
              <input
                type="checkbox"
                checked={newArrival}
                onChange={(e) => setNewArrival(e.target.checked)}
                className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 text-xs">
              <span className="font-semibold text-[#1A1E1C]">Best Seller Tag</span>
              <input
                type="checkbox"
                checked={bestSeller}
                onChange={(e) => setBestSeller(e.target.checked)}
                className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
              />
            </label>
          </div>

          {/* Tags & Weight */}
          <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
              Tags & Logistics
            </h2>
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Weight / Package Size
              </label>
              <input
                type="text"
                placeholder="e.g. 500g, 1.2 kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Comma-separated Tags
              </label>
              <input
                type="text"
                placeholder="wireless, premium, summer, gadgets"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C] focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
