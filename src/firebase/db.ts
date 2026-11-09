import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from './config';
import type {
  Product,
  Category,
  Order,
  OrderStatus,
  Coupon,
  DeliveryZone,
  Banner,
  Review,
  SiteSettings,
  StaticPage,
  AuditLog,
  CustomerUser,
  SupportSettings,
  SupportConversation,
  SupportMessage,
  AIActivityLog,
  AIStatusMode,
  AIKnowledgeBase,
  AIApprovalAction,
  AINotification,
  AIDailyReport
} from '../types';

/**
 * Deeply sanitizes any payload before sending to Firestore.
 * Firestore strictly forbids `undefined` values and throws fatal errors.
 * This recursively removes all keys with `undefined` values while preserving
 * Dates and Firestore FieldValues (serverTimestamp, increment, deleteField, etc.).
 */
export function sanitizeFirestoreData<T = any>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // Preserve Date instances and Firestore FieldValues
  if (
    data instanceof Date ||
    ('_methodName' in (data as any)) ||
    ((data as any).constructor && (data as any).constructor.name === 'FieldValue')
  ) {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as any;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      cleanObj[key] = sanitizeFirestoreData(val);
    }
  }
  return cleanObj as T;
}

/* ==================== PRODUCTS ==================== */

let memProductsCache: Product[] | null = null;
let memProductsCacheTime = 0;
const PRODUCTS_CACHE_KEY = 'aesthetx_products_cache_v3';
const PRODUCTS_CACHE_TTL = 60000; // 60s memory freshness

export function getLocalProductsCache(): Product[] {
  if (memProductsCache && memProductsCache.length > 0) {
    return memProductsCache;
  }
  try {
    const raw = sessionStorage.getItem(PRODUCTS_CACHE_KEY) || localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memProductsCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read cached products:', err);
  }
  return [];
}

export function setLocalProductsCache(list: Product[]): void {
  memProductsCache = list;
  memProductsCacheTime = Date.now();
  try {
    const json = JSON.stringify(list);
    sessionStorage.setItem(PRODUCTS_CACHE_KEY, json);
    localStorage.setItem(PRODUCTS_CACHE_KEY, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-products-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write cached products:', err);
  }
}

async function fetchFreshProductsFromFirestore(): Promise<Product[]> {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    const list: Product[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Product));

    list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return timeB - timeA;
    });

    setLocalProductsCache(list);
    return list;
  } catch (error) {
    console.error('Error fetching fresh products from Firestore:', error);
    return getLocalProductsCache();
  }
}

export async function getAllProductsAdmin(forceRefresh = false): Promise<Product[]> {
  const cached = getLocalProductsCache();
  const isFresh = Date.now() - memProductsCacheTime < PRODUCTS_CACHE_TTL;

  // If cache is fresh, return immediately (0ms)
  if (!forceRefresh && cached.length > 0 && isFresh) {
    return cached;
  }

  // If cached data exists but might be stale, return cached instantly and revalidate in background
  if (!forceRefresh && cached.length > 0) {
    setTimeout(() => {
      fetchFreshProductsFromFirestore().catch(() => {});
    }, 10);
    return cached;
  }

  return await fetchFreshProductsFromFirestore();
}

export async function getProducts(filters?: {
  category?: string;
  subcategory?: string;
  brand?: string;
  search?: string;
  activeOnly?: boolean;
  featuredOnly?: boolean;
  newArrivalOnly?: boolean;
  bestSellerOnly?: boolean;
  limitCount?: number;
}): Promise<Product[]> {
  // Use memory / local cached products for instantaneous 0ms filtering!
  const allProds = await getAllProductsAdmin();
  let list = allProds;

  // Active filter
  if (filters?.activeOnly !== false) {
    list = list.filter((p) => p.active !== false);
  }

  // Multi-category & attribute filtering
  if (filters?.category) {
    const catLower = filters.category.toLowerCase();
    list = list.filter(
      (p) =>
        p.category?.toLowerCase() === catLower ||
        p.categorySlug?.toLowerCase() === catLower ||
        p.subcategory?.toLowerCase() === catLower
    );
  }

  if (filters?.subcategory) {
    const subLower = filters.subcategory.toLowerCase();
    list = list.filter((p) => p.subcategory?.toLowerCase() === subLower);
  }

  if (filters?.brand) {
    const brandLower = filters.brand.toLowerCase();
    list = list.filter((p) => p.brand?.toLowerCase() === brandLower);
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.model?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s) ||
        p.subcategory?.toLowerCase().includes(s) ||
        p.tags?.some((t) => t.toLowerCase().includes(s))
    );
  }

  if (filters?.featuredOnly) {
    list = list.filter((p) => p.featured);
  }

  if (filters?.newArrivalOnly) {
    list = list.filter((p) => p.newArrival);
  }

  if (filters?.bestSellerOnly) {
    list = list.filter((p) => p.bestSeller);
  }

  if (filters?.limitCount && list.length > filters.limitCount) {
    list = list.slice(0, filters.limitCount);
  }

  return list;
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Product;
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return null;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Product;
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    return null;
  }
}

export async function saveProduct(productData: Partial<Product>, id?: string): Promise<string> {
  const productsRef = collection(db, 'products');
  const now = serverTimestamp();

  const cleanData = sanitizeFirestoreData({
    ...productData,
    updatedAt: now
  });

  const localTime = { seconds: Math.floor(Date.now() / 1000) };

  if (id) {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, cleanData);

    // Instant local cache update with serializable timestamps
    const current = getLocalProductsCache();
    const updated = current.map((p) =>
      p.id === id ? ({ ...p, ...productData, updatedAt: localTime } as Product) : p
    );
    setLocalProductsCache(updated);

    return id;
  } else {
    const docRef = await addDoc(productsRef, {
      ...cleanData,
      createdAt: now
    });

    // Instant local cache update
    const newProduct = {
      id: docRef.id,
      ...productData,
      createdAt: localTime,
      updatedAt: localTime
    } as Product;
    setLocalProductsCache([newProduct, ...getLocalProductsCache()]);

    return docRef.id;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const current = getLocalProductsCache();
  setLocalProductsCache(current.filter((p) => p.id !== id));
  const docRef = doc(db, 'products', id);
  await deleteDoc(docRef);
}

/* ==================== CATEGORIES ==================== */

const CATEGORIES_CACHE_KEY = 'aesthetx_categories_v2';
const DELETED_CATEGORIES_KEY = 'aesthetx_deleted_categories_v2';

export function getDeletedCategoryIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read deleted categories cache:', err);
  }
  return [];
}

export function addDeletedCategoryId(id: string): void {
  try {
    const list = getDeletedCategoryIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_CATEGORIES_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Could not save deleted category ID:', err);
  }
}

export function removeDeletedCategoryId(id: string): void {
  try {
    const list = getDeletedCategoryIds().filter((d) => d !== id);
    localStorage.setItem(DELETED_CATEGORIES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Could not clear deleted category ID:', err);
  }
}

export function getLocalCategoriesCache(): Category[] {
  const deletedIds = getDeletedCategoryIds();
  try {
    const raw = localStorage.getItem(CATEGORIES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c) => c && c.id && !deletedIds.includes(c.id));
      }
    }
  } catch (err) {
    console.warn('Could not read cached categories:', err);
  }
  return [];
}

export function setLocalCategoriesCache(list: Category[]): void {
  const deletedIds = getDeletedCategoryIds();
  const cleanList = list.filter((c) => c && c.id && !deletedIds.includes(c.id));
  try {
    localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cleanList));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-categories-updated', { detail: cleanList }));
    }
  } catch (err) {
    console.warn('Could not write categories to local cache:', err);
  }
}

export async function getCategories(activeOnly = true): Promise<Category[]> {
  const deletedIds = getDeletedCategoryIds();
  let list: Category[] = [];

  try {
    const colRef = collection(db, 'categories');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      list = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        } as Category))
        .filter((c) => !deletedIds.includes(c.id));
    }
  } catch (error) {
    console.warn('Firestore categories read note (using local cache):', error);
  }

  // If Firestore didn't return any, use local storage cache
  if (list.length === 0) {
    list = getLocalCategoriesCache().filter((c) => !deletedIds.includes(c.id));
  }

  // If still empty (first run and never deleted anything), populate with default marketplace departments
  const userHasDeletedBefore = deletedIds.length > 0;
  if (list.length === 0 && !userHasDeletedBefore) {
    list = DEFAULT_MARKETPLACE_CATEGORIES.map((c, i) => ({
      id: `cat_${c.slug}`,
      ...c,
      sortOrder: c.sortOrder ?? i + 1,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    }));
    setLocalCategoriesCache(list);

    // Asynchronously seed to Firestore so it's saved in the cloud too
    setTimeout(() => {
      seedMarketplaceCategories().catch(() => {});
    }, 500);
  } else {
    // Keep local cache fresh
    setLocalCategoriesCache(list);
  }

  if (activeOnly) {
    list = list.filter((c) => c.active !== false);
  }

  list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return list;
}

/**
 * Synchronize products whenever a category name or slug changes, ensuring
 * product links are never disconnected.
 */
export async function syncProductsCategoryRename(
  oldName: string,
  oldSlug: string,
  newName: string,
  newSlug: string
): Promise<number> {
  if (!oldName && !oldSlug) return 0;
  if (oldName === newName && oldSlug === newSlug) return 0;

  let count = 0;
  // 1. Update in-memory & local storage cache
  const localProducts = getLocalProductsCache();
  const updatedLocalProducts = localProducts.map((p) => {
    const matches =
      (oldName && p.category?.toLowerCase() === oldName.toLowerCase()) ||
      (oldSlug && p.categorySlug?.toLowerCase() === oldSlug.toLowerCase());

    if (matches) {
      count++;
      return {
        ...p,
        category: newName,
        categorySlug: newSlug
      };
    }
    return p;
  });

  if (count > 0) {
    setLocalProductsCache(updatedLocalProducts);
  }

  // 2. Update Firestore documents
  try {
    const colRef = collection(db, 'products');
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    let firestoreCount = 0;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const matches =
        (oldName && data.category?.toLowerCase() === oldName.toLowerCase()) ||
        (oldSlug && data.categorySlug?.toLowerCase() === oldSlug.toLowerCase());

      if (matches) {
        batch.update(docSnap.ref, {
          category: newName,
          categorySlug: newSlug,
          updatedAt: serverTimestamp()
        });
        firestoreCount++;
      }
    });

    if (firestoreCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Error syncing products with renamed category in Firestore:', err);
  }

  return count;
}

/**
 * Generates a clean, URL-safe slug for categories.
 * Works seamlessly with English, Bengali, or mixed titles.
 */
export function generateCategorySlug(name: string, customSlug?: string): string {
  if (customSlug && customSlug.trim()) {
    const clean = customSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    if (clean) return clean;
  }

  if (!name || !name.trim()) {
    return `category-${Date.now().toString(36)}`;
  }

  const raw = name.trim().toLowerCase();

  // Bengali to English standard transliteration map
  const bngMap: Record<string, string> = {
    'পাঞ্জাবি': 'panjabi',
    'পাঞ্জাবী': 'panjabi',
    'টি-শার্ট': 't-shirts',
    'টি শার্ট': 't-shirts',
    'শার্ট': 'shirts',
    'পোলো শার্ট': 'polo-shirts',
    'পোলো': 'polo-shirts',
    'জিন্স': 'jeans',
    'প্যান্ট': 'pants',
    'ট্রাউজার': 'trousers',
    'হুডি': 'hoodies',
    'জ্যাকেট': 'jackets',
    'জুতো': 'shoes',
    'জুতা': 'shoes',
    'স্নিকার্স': 'sneakers',
    'ঘড়ি': 'watches',
    'ঘড়ি': 'watches',
    'সুগন্ধি': 'perfumes',
    'আতর': 'attar',
    'পারফিউম': 'perfumes',
    'বোরকা': 'borka',
    'হিজাব': 'hijab',
    'ব্যাগ': 'bags',
    'ওয়ালেট': 'wallets',
    'বেল্ট': 'belts',
    'চশমা': 'sunglasses',
    'ইলেকট্রনিক্স': 'electronics',
    'গ্যাজেট': 'gadgets',
    'মোবাইল': 'mobile-phones',
    'হেডফোন': 'headphones',
    'ইয়ারবাড': 'earbuds',
    'কম্পিউটার': 'computers',
    'ল্যাপটপ': 'laptops',
    'সৌন্দর্য': 'beauty',
    'কসমেটিকস': 'cosmetics',
    'গ্রোসারি': 'groceries',
    'ফার্নিচার': 'furniture'
  };

  for (const [bn, en] of Object.entries(bngMap)) {
    if (raw.includes(bn)) {
      return en;
    }
  }

  const latinSlug = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  if (latinSlug && latinSlug.length >= 2) {
    return latinSlug;
  }

  // Fallback for purely non-latin characters
  const hash = Array.from(raw).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000, 0);
  return `cat-${hash.toString(36)}-${Date.now().toString(36).slice(-4)}`;
}

export async function saveCategory(categoryData: Partial<Category>, id?: string): Promise<string> {
  const targetId = id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  removeDeletedCategoryId(targetId);

  const now = { seconds: Math.floor(Date.now() / 1000) };

  // 1. Immediately update local cache for zero-latency UI update
  const currentList = await getCategories(false);
  const existingIdx = currentList.findIndex((c) => c.id === targetId || (id && c.id === id));

  let updatedList: Category[];
  let itemToPersist: Category;

  if (existingIdx >= 0) {
    const oldCat = currentList[existingIdx];
    const oldName = oldCat.name;
    const oldSlug = oldCat.slug;
    const newName = categoryData.name ? categoryData.name.trim() : oldName;
    const newSlug = generateCategorySlug(newName, categoryData.slug || oldSlug);

    const updatedItem: Category = {
      ...oldCat,
      ...categoryData,
      name: newName,
      slug: newSlug,
      id: targetId,
      updatedAt: now
    };
    updatedList = [...currentList];
    updatedList[existingIdx] = updatedItem;
    itemToPersist = updatedItem;

    // Check if name or slug changed, sync linked products
    if (oldName !== newName || oldSlug !== newSlug) {
      syncProductsCategoryRename(oldName, oldSlug, newName, newSlug).catch((err) => {
        console.warn('Failed background product category sync:', err);
      });
    }
  } else {
    const catName = categoryData.name ? categoryData.name.trim() : 'New Category';
    const cleanSlug = generateCategorySlug(catName, categoryData.slug);

    const newItem: Category = {
      id: targetId,
      name: catName,
      slug: cleanSlug,
      description: categoryData.description || '',
      image: categoryData.image || '',
      subcategories: categoryData.subcategories || [],
      active: categoryData.active ?? true,
      sortOrder: categoryData.sortOrder ?? (currentList.length + 1),
      createdAt: now,
      updatedAt: now,
      ...categoryData
    };
    updatedList = [...currentList, newItem];
    itemToPersist = newItem;
  }

  setLocalCategoriesCache(updatedList);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'categories', targetId);
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...itemToPersist,
        id: targetId,
        updatedAt: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore category write note (saved in local storage):', err);
  }

  return targetId;
}

export async function deleteCategory(id: string): Promise<void> {
  // 1. Permanently mark deleted
  addDeletedCategoryId(id);

  // 2. Update local cache immediately
  const currentList = getLocalCategoriesCache();
  const nextList = currentList.filter((c) => c.id !== id);
  setLocalCategoriesCache(nextList);

  // 3. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (err) {
    console.warn('Firestore category delete note:', err);
  }

  // 4. Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aesthetx-categories-updated', { detail: nextList }));
  }
}

export const DEFAULT_MARKETPLACE_CATEGORIES: Omit<Category, 'id'>[] = [
  {
    name: 'Clothing & Fashion',
    slug: 'clothing-fashion',
    description: 'Premium casuals, streetwear, panjabis, polo shirts, and winterwear.',
    subcategories: ["Men's Fashion", "Women's Fashion", "Kids' Wear", "Panjabi & Traditional", "Jackets & Hoodies", "Polo & T-Shirts"],
    active: true,
    sortOrder: 1,
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Electronics & Gadgets',
    slug: 'electronics-gadgets',
    description: 'Next-gen audio, smart wearables, charging essentials, and tech gear.',
    subcategories: ['Wireless Earbuds', 'Smartwatches', 'Bluetooth Speakers', 'Power Banks', 'Headphones', 'Cables & Adapters'],
    active: true,
    sortOrder: 2,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Mobile Phones & Accessories',
    slug: 'mobile-phones-accessories',
    description: 'Smartphones, protective shockproof cases, screen protectors, and mounts.',
    subcategories: ['Smartphones', 'Protective Cases', 'Screen Protectors', 'Magnetic Mounts', 'Gimbal & Grips'],
    active: true,
    sortOrder: 3,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Computers & Accessories',
    slug: 'computers-accessories',
    description: 'Productivity laptops, mechanical keyboards, ergonomic mice, and hubs.',
    subcategories: ['Laptops', 'Mechanical Keyboards', 'Gaming & Ergonomic Mice', 'USB-C Hubs', 'External Storage'],
    active: true,
    sortOrder: 4,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Shoes & Footwear',
    slug: 'shoes-footwear',
    description: 'Lifestyle sneakers, formal leather shoes, loafers, slides, and boots.',
    subcategories: ['Sneakers', 'Formal Shoes', 'Loafers', 'Slides & Sandals', 'Sports Shoes'],
    active: true,
    sortOrder: 5,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Bags & Accessories',
    slug: 'bags-accessories',
    description: 'Waterproof backpacks, premium leather wallets, belts, and eyewear.',
    subcategories: ['Backpacks', 'Wallets', 'Leather Belts', 'Sunglasses', 'Crossbody Bags'],
    active: true,
    sortOrder: 6,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Watches & Jewelry',
    slug: 'watches-jewelry',
    description: 'Luxury analog chronographs, minimalist timepieces, and accessories.',
    subcategories: ['Analog Watches', 'Smart Fitness Bands', 'Steel Bracelets', 'Pendants & Chains'],
    active: true,
    sortOrder: 7,
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Modern cookware, aesthetic drinkware, coffee brewers, and kitchen organizers.',
    subcategories: ['Cookware', 'Aesthetic Drinkware', 'Kitchen Organizers', 'Coffee & Tea Makers'],
    active: true,
    sortOrder: 8,
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Furniture & Home Decor',
    slug: 'furniture-home-decor',
    description: 'Ergonomic workspace furniture, accent lighting, wall frames, and rugs.',
    subcategories: ['Desk & Workspace', 'Ambient Lamps & Lighting', 'Wall Art & Frames', 'Cushions & Throws'],
    active: true,
    sortOrder: 9,
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Premium skincare, perfumes, beard care, and personal grooming essentials.',
    subcategories: ['Skincare', 'Fragrances & Perfumes', 'Hair Styling', 'Beard & Grooming Kits'],
    active: true,
    sortOrder: 10,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    description: 'Home gym equipment, yoga mats, resistance gear, and athletic accessories.',
    subcategories: ['Gym Equipment', 'Yoga & Recovery', 'Sports Water Bottles', 'Athletic Wear'],
    active: true,
    sortOrder: 11,
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Toys & Games',
    slug: 'toys-games',
    description: 'Strategy board games, collectible action figures, and puzzles.',
    subcategories: ['Board Games', 'Puzzles & Brain Teasers', 'Collectibles', 'Kids Creative Toys'],
    active: true,
    sortOrder: 12,
    image: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Books & Stationery',
    slug: 'books-stationery',
    description: 'Hardcover journals, calligraphy pens, desk planners, and bestselling reads.',
    subcategories: ['Journals & Notebooks', 'Fine Writing Pens', 'Desk Planners', 'Bestseller Books'],
    active: true,
    sortOrder: 13,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Grocery & Daily Essentials',
    slug: 'grocery-daily-essentials',
    description: 'Organic specialty teas, artisanal coffee beans, honey, dry fruits, and snacks.',
    subcategories: ['Specialty Coffee & Tea', 'Organic Honey & Ghee', 'Dry Fruits & Nuts', 'Healthy Snacks'],
    active: true,
    sortOrder: 14,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
  }
];

export async function seedMarketplaceCategories(): Promise<number> {
  const existing = await getCategories(false);
  const existingSlugs = new Set(existing.map((c) => c.slug.toLowerCase()));
  let count = 0;
  for (const cat of DEFAULT_MARKETPLACE_CATEGORIES) {
    if (!existingSlugs.has(cat.slug.toLowerCase())) {
      await saveCategory(cat);
      count++;
    }
  }
  return count;
}

/* ==================== ORDERS ==================== */

export async function createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const colRef = collection(db, 'orders');
  const now = serverTimestamp();

  const docRef = await addDoc(colRef, sanitizeFirestoreData({
    ...orderData,
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        status: orderData.orderStatus || 'Pending',
        timestamp: new Date().toISOString(),
        note: 'Order placed by customer via Cash on Delivery'
      }
    ]
  }));

  // Increment customer stats if customerId exists
  if (orderData.customerId) {
    try {
      const userRef = doc(db, 'users', orderData.customerId);
      await updateDoc(userRef, {
        totalOrders: increment(1),
        totalSpent: increment(orderData.total)
      });
    } catch {
      // User doc might not exist yet, safe ignore
    }
  }

  // Deduct stock safely if variants exist
  for (const item of orderData.items) {
    try {
      const productRef = doc(db, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const prod = productSnap.data() as Product;
        let updatedTotalStock = Math.max(0, (prod.totalStock || 0) - item.quantity);
        let updatedVariants = prod.variants || [];

        if (item.variantId && updatedVariants.length > 0) {
          updatedVariants = updatedVariants.map((v) => {
            if (v.id === item.variantId) {
              return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
            }
            return v;
          });
        }

        await updateDoc(productRef, {
          totalStock: updatedTotalStock,
          variants: updatedVariants
        });
      }
    } catch (err) {
      console.warn('Inventory update notice:', err);
    }
  }

  return docRef.id;
}

let memOrdersCache: Order[] | null = null;
let memOrdersCacheTime = 0;
const ORDERS_CACHE_KEY = 'aesthetx_orders_cache_v3';
const ORDERS_CACHE_TTL = 30000;

export function getLocalOrdersCache(): Order[] {
  if (memOrdersCache && memOrdersCache.length > 0) {
    return memOrdersCache;
  }
  try {
    const raw = sessionStorage.getItem(ORDERS_CACHE_KEY) || localStorage.getItem(ORDERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memOrdersCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read cached orders:', err);
  }
  return [];
}

export function setLocalOrdersCache(list: Order[]): void {
  memOrdersCache = list;
  memOrdersCacheTime = Date.now();
  try {
    const json = JSON.stringify(list);
    sessionStorage.setItem(ORDERS_CACHE_KEY, json);
    localStorage.setItem(ORDERS_CACHE_KEY, json);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-orders-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write cached orders:', err);
  }
}

async function fetchFreshOrdersFromFirestore(): Promise<Order[]> {
  try {
    const colRef = collection(db, 'orders');
    const snapshot = await getDocs(colRef);
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    } as Order));

    list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return timeB - timeA;
    });

    setLocalOrdersCache(list);
    return list;
  } catch (error) {
    console.error('Error fetching fresh orders:', error);
    return getLocalOrdersCache();
  }
}

export async function getAllOrders(forceRefresh = false): Promise<Order[]> {
  const cached = getLocalOrdersCache();
  const isFresh = Date.now() - memOrdersCacheTime < ORDERS_CACHE_TTL;

  // Run 10-day retention purge checks in background for delivered and wrong delivery orders
  setTimeout(() => {
    purgeExpiredWrongDeliveries().catch(() => {});
    purgeExpiredDeliveredOrders().catch(() => {});
  }, 100);

  if (!forceRefresh && cached.length > 0 && isFresh) {
    return cached;
  }

  if (!forceRefresh && cached.length > 0) {
    setTimeout(() => {
      fetchFreshOrdersFromFirestore().catch(() => {});
    }, 10);
    return cached;
  }

  return await fetchFreshOrdersFromFirestore();
}

export async function getOrderById(id: string): Promise<Order | null> {
  const cached = getLocalOrdersCache().find((o) => o.id === id);
  if (cached) return cached;

  try {
    const docRef = doc(db, 'orders', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Order;
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return null;
  }
}

export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  return getAccountOrders({ customerId });
}

export async function getAccountOrders(identifier: {
  customerId?: string;
  email?: string;
  phone?: string;
}): Promise<Order[]> {
  const cleanPhone = identifier.phone ? identifier.phone.replace(/[^0-9]/g, '') : '';
  const cleanEmail = identifier.email ? identifier.email.trim().toLowerCase() : '';
  const cleanId = identifier.customerId?.trim() || '';

  if (!cleanId && !cleanEmail && !cleanPhone) {
    return [];
  }

  // 1. Fetch fresh or cached orders
  const allOrders = await getAllOrders(false);

  const matched = allOrders.filter((o) => {
    // Match by customerId
    if (cleanId && o.customerId === cleanId) return true;

    // Match by email
    if (cleanEmail && o.customerEmail && o.customerEmail.trim().toLowerCase() === cleanEmail) {
      return true;
    }

    // Match by phone
    if (cleanPhone && o.customerPhone) {
      const orderPhone = o.customerPhone.replace(/[^0-9]/g, '');
      if (orderPhone && (orderPhone.endsWith(cleanPhone) || cleanPhone.endsWith(orderPhone))) {
        return true;
      }
    }

    return false;
  });

  // Deduplicate by order id
  const uniqueMap = new Map<string, Order>();
  matched.forEach((ord) => {
    if (!uniqueMap.has(ord.id)) {
      uniqueMap.set(ord.id, ord);
    }
  });

  const list = Array.from(uniqueMap.values());

  list.sort((a, b) => {
    const timeA = a.createdAt?.seconds
      ? a.createdAt.seconds * 1000
      : a.createdAt
      ? new Date(a.createdAt).getTime()
      : 0;
    const timeB = b.createdAt?.seconds
      ? b.createdAt.seconds * 1000
      : b.createdAt
      ? new Date(b.createdAt).getTime()
      : 0;
    return timeB - timeA;
  });

  return list;
}

export async function trackOrderByNumberAndPhone(orderNumber: string, phone: string): Promise<Order | null> {
  const cleanNum = orderNumber.trim().toUpperCase();
  const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

  // 1. Check local cached orders first for instant 0ms result!
  const cached = getLocalOrdersCache();
  const foundInCache = cached.find((o) => {
    const matchesNum = cleanNum && ((o.orderNumber && o.orderNumber.toUpperCase() === cleanNum) || o.id.toUpperCase() === cleanNum);
    const customerPhone = o.customerPhone ? o.customerPhone.replace(/[^0-9]/g, '') : '';
    const matchesPhone = cleanPhone && (customerPhone.endsWith(cleanPhone) || cleanPhone.endsWith(customerPhone));

    if (cleanNum && cleanPhone) {
      return matchesNum && matchesPhone;
    }
    return matchesNum || matchesPhone;
  });

  if (foundInCache) return foundInCache;

  // 2. Query Firestore if not found in cache
  try {
    const colRef = collection(db, 'orders');
    const snapshot = await getDocs(colRef);
    const matchedDoc = snapshot.docs.find((d) => {
      const data = d.data() as Order;
      const matchesNum = cleanNum && ((data.orderNumber && data.orderNumber.toUpperCase() === cleanNum) || d.id.toUpperCase() === cleanNum);
      const customerPhone = data.customerPhone ? data.customerPhone.replace(/[^0-9]/g, '') : '';
      const matchesPhone = cleanPhone && (customerPhone.endsWith(cleanPhone) || cleanPhone.endsWith(customerPhone));

      if (cleanNum && cleanPhone) {
        return matchesNum && matchesPhone;
      }
      return matchesNum || matchesPhone;
    });

    if (!matchedDoc) return null;
    return { id: matchedDoc.id, ...matchedDoc.data() } as Order;
  } catch (error) {
    console.error('Error tracking order:', error);
    return null;
  }
}

export async function getOrdersByPhone(phone: string): Promise<Order[]> {
  const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 6) return [];

  const filterMatches = (list: Order[]) =>
    list.filter((o) => {
      const cp = (o.customerPhone || '').replace(/[^0-9]/g, '');
      return cp && (cp.endsWith(cleanPhone) || cleanPhone.endsWith(cp));
    });

  const cached = getLocalOrdersCache();
  const matchedLocal = filterMatches(cached);
  if (matchedLocal.length > 0) return matchedLocal;

  try {
    const colRef = collection(db, 'orders');
    const snapshot = await getDocs(colRef);
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
    const results = filterMatches(list);

    results.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return timeB - timeA;
    });

    return results;
  } catch (err) {
    console.error('Error fetching orders by phone:', err);
    return [];
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['orderStatus'],
  note?: string,
  paymentStatus?: Order['paymentStatus']
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Order not found');

  const existingData = docSnap.data() as Order;
  const currentTimeline = existingData.timeline || [];
  const nowIso = new Date().toISOString();

  const newTimelineItem = {
    status,
    timestamp: nowIso,
    note: note || `Status updated to ${status}`
  };

  const updatePayload: any = {
    orderStatus: status,
    updatedAt: serverTimestamp(),
    timeline: [...currentTimeline, newTimelineItem]
  };

  // If status is Delivered, record delivery completion timestamp and 10-day retention purge date
  if (status === 'Delivered') {
    if (!existingData.deliveredAt) {
      updatePayload.deliveredAt = nowIso;
      updatePayload.purgeAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  // Preserve paymentStatus unless explicitly passed
  if (paymentStatus) {
    updatePayload.paymentStatus = paymentStatus;
  }

  await updateDoc(docRef, updatePayload);

  // Update local cache immediately
  const currentOrders = getLocalOrdersCache();
  const updatedOrders = currentOrders.map((o) =>
    o.id === orderId
      ? ({
          ...o,
          orderStatus: status,
          paymentStatus: paymentStatus || o.paymentStatus,
          deliveredAt: status === 'Delivered' ? (o.deliveredAt || nowIso) : o.deliveredAt,
          purgeAt: status === 'Delivered' ? (o.purgeAt || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()) : o.purgeAt,
          timeline: [...(o.timeline || []), newTimelineItem]
        } as Order)
      : o
  );
  setLocalOrdersCache(updatedOrders);
}

/**
 * Marks an order as Delivered and archives it for 10-day retention.
 * Preserves the exact paymentStatus and all existing order details.
 */
export async function markOrderAsDelivered(
  orderId: string,
  note = 'Delivery confirmed and moved to Delivered Orders (10-day retention archive).'
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const nowIso = new Date().toISOString();
  const purgeDateIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

  const currentOrders = getLocalOrdersCache();
  const target = currentOrders.find((o) => o.id === orderId);
  const currentTimeline = target?.timeline || [];

  const newTimelineItem = {
    status: 'Delivered' as OrderStatus,
    timestamp: nowIso,
    note
  };

  const payload: any = {
    orderStatus: 'Delivered',
    deliveredAt: nowIso,
    purgeAt: purgeDateIso,
    isWrongDelivery: false,
    updatedAt: serverTimestamp(),
    timeline: [...currentTimeline, newTimelineItem]
  };

  try {
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Firestore update error marking delivered:', err);
  }

  const updatedOrders = currentOrders.map((o) =>
    o.id === orderId
      ? ({
          ...o,
          orderStatus: 'Delivered',
          deliveredAt: nowIso,
          purgeAt: purgeDateIso,
          isWrongDelivery: false,
          timeline: [...(o.timeline || []), newTimelineItem]
        } as Order)
      : o
  );
  setLocalOrdersCache(updatedOrders);
}

/**
 * Checks for any delivered orders that have exceeded the 10-day retention period,
 * and permanently deletes them from Firestore and cache.
 */
export async function purgeExpiredDeliveredOrders(): Promise<number> {
  const current = getLocalOrdersCache();
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expiredIds: string[] = [];

  for (const o of current) {
    if (o.orderStatus === 'Delivered') {
      let deliveryTime = 0;
      if (o.deliveredAt) {
        if (typeof o.deliveredAt.toDate === 'function') {
          deliveryTime = o.deliveredAt.toDate().getTime();
        } else if (o.deliveredAt.seconds) {
          deliveryTime = o.deliveredAt.seconds * 1000;
        } else {
          deliveryTime = new Date(o.deliveredAt).getTime();
        }
      } else if (o.updatedAt) {
        deliveryTime = o.updatedAt.seconds ? o.updatedAt.seconds * 1000 : new Date(o.updatedAt).getTime();
      } else if (o.createdAt) {
        deliveryTime = o.createdAt.seconds ? o.createdAt.seconds * 1000 : new Date(o.createdAt).getTime();
      }

      // If delivered more than 10 days ago, purge permanently
      if (deliveryTime > 0 && now - deliveryTime >= TEN_DAYS_MS) {
        expiredIds.push(o.id);
      }
    }
  }

  if (expiredIds.length > 0) {
    for (const id of expiredIds) {
      try {
        await deleteDoc(doc(db, 'orders', id));
      } catch (err) {
        console.warn('Error purging expired delivered order from Firestore:', err);
      }
    }
    const remaining = current.filter((o) => !expiredIds.includes(o.id));
    setLocalOrdersCache(remaining);
  }

  return expiredIds.length;
}

/**
 * Permanently deletes an order from Firestore and updates local cache.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  try {
    const docRef = doc(db, 'orders', orderId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Error deleting order from Firestore:', err);
  }

  const current = getLocalOrdersCache();
  const next = current.filter((o) => o.id !== orderId);
  setLocalOrdersCache(next);
}

/**
 * Marks an order as wrong/failed delivery and moves it to the 10-day retention archive.
 */
export async function markOrderAsWrongDelivery(
  orderId: string,
  reason = 'Wrong Delivery / Misdelivered'
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const nowIso = new Date().toISOString();

  const newTimelineItem = {
    status: 'Wrong Delivery' as OrderStatus,
    timestamp: nowIso,
    note: `Marked as Wrong Delivery: ${reason}. Moved to 10-day holding archive.`
  };

  const currentOrders = getLocalOrdersCache();
  const target = currentOrders.find((o) => o.id === orderId);
  const currentTimeline = target?.timeline || [];

  const payload: any = {
    orderStatus: 'Wrong Delivery',
    isWrongDelivery: true,
    wrongDeliveryReportedAt: nowIso,
    wrongDeliveryReason: reason,
    updatedAt: serverTimestamp(),
    timeline: [...currentTimeline, newTimelineItem]
  };

  try {
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Firestore update error for wrong delivery:', err);
  }

  const updatedOrders = currentOrders.map((o) =>
    o.id === orderId
      ? ({
          ...o,
          orderStatus: 'Wrong Delivery',
          isWrongDelivery: true,
          wrongDeliveryReportedAt: nowIso,
          wrongDeliveryReason: reason,
          timeline: [...(o.timeline || []), newTimelineItem]
        } as Order)
      : o
  );
  setLocalOrdersCache(updatedOrders);
}

/**
 * Restores a wrong delivery order back to active status (e.g. Pending).
 */
export async function restoreWrongDeliveryOrder(orderId: string): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const nowIso = new Date().toISOString();

  const newTimelineItem = {
    status: 'Pending' as OrderStatus,
    timestamp: nowIso,
    note: 'Restored from Wrong Delivery archive back to active orders.'
  };

  const currentOrders = getLocalOrdersCache();
  const target = currentOrders.find((o) => o.id === orderId);
  const currentTimeline = target?.timeline || [];

  const payload: any = {
    orderStatus: 'Pending',
    isWrongDelivery: false,
    wrongDeliveryReportedAt: null,
    wrongDeliveryReason: null,
    updatedAt: serverTimestamp(),
    timeline: [...currentTimeline, newTimelineItem]
  };

  try {
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Firestore update error restoring wrong delivery:', err);
  }

  const updatedOrders = currentOrders.map((o) =>
    o.id === orderId
      ? ({
          ...o,
          orderStatus: 'Pending',
          isWrongDelivery: false,
          wrongDeliveryReportedAt: undefined,
          wrongDeliveryReason: undefined,
          timeline: [...(o.timeline || []), newTimelineItem]
        } as Order)
      : o
  );
  setLocalOrdersCache(updatedOrders);
}

/**
 * Checks for any wrong delivery orders that have exceeded the 10-day retention period,
 * and permanently deletes them from Firestore and cache.
 */
export async function purgeExpiredWrongDeliveries(): Promise<number> {
  const current = getLocalOrdersCache();
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expiredIds: string[] = [];

  for (const o of current) {
    if (o.isWrongDelivery || o.orderStatus === 'Wrong Delivery') {
      let reportedTime = 0;
      if (o.wrongDeliveryReportedAt) {
        if (typeof o.wrongDeliveryReportedAt.toDate === 'function') {
          reportedTime = o.wrongDeliveryReportedAt.toDate().getTime();
        } else if (o.wrongDeliveryReportedAt.seconds) {
          reportedTime = o.wrongDeliveryReportedAt.seconds * 1000;
        } else {
          reportedTime = new Date(o.wrongDeliveryReportedAt).getTime();
        }
      } else if (o.updatedAt) {
        reportedTime = o.updatedAt.seconds ? o.updatedAt.seconds * 1000 : new Date(o.updatedAt).getTime();
      }

      // If older than 10 days, mark for auto-deletion
      if (reportedTime > 0 && now - reportedTime > TEN_DAYS_MS) {
        expiredIds.push(o.id);
      }
    }
  }

  if (expiredIds.length > 0) {
    for (const id of expiredIds) {
      try {
        await deleteDoc(doc(db, 'orders', id));
      } catch (err) {
        console.warn('Error purging expired wrong delivery order:', err);
      }
    }
    const remaining = current.filter((o) => !expiredIds.includes(o.id));
    setLocalOrdersCache(remaining);
  }

  return expiredIds.length;
}

/* ==================== COUPONS ==================== */

export const DEFAULT_STORE_COUPONS: Coupon[] = [
  {
    id: 'coupon_welcome10',
    code: 'WELCOME10',
    discountType: 'percentage',
    discountAmount: 10,
    minOrderAmount: 1000,
    maxDiscount: 300,
    timesUsed: 0,
    active: true
  },
  {
    id: 'coupon_save100',
    code: 'SAVE100',
    discountType: 'fixed',
    discountAmount: 100,
    minOrderAmount: 1500,
    timesUsed: 0,
    active: true
  },
  {
    id: 'coupon_aesthetx',
    code: 'AESTHETX',
    discountType: 'percentage',
    discountAmount: 15,
    minOrderAmount: 2000,
    maxDiscount: 500,
    timesUsed: 0,
    active: true
  }
];

export async function getCoupons(): Promise<Coupon[]> {
  try {
    const colRef = collection(db, 'coupons');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const fromDb = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon));
      // Merge with default coupons to ensure customers always have offers
      const codeSet = new Set(fromDb.map((c) => c.code.toUpperCase()));
      const combined = [...fromDb];
      DEFAULT_STORE_COUPONS.forEach((def) => {
        if (!codeSet.has(def.code.toUpperCase())) {
          combined.push(def);
        }
      });
      return combined.filter((c) => c.active !== false);
    }
    return DEFAULT_STORE_COUPONS;
  } catch (error) {
    console.warn('Coupon fetch notice (using defaults):', error);
    return DEFAULT_STORE_COUPONS;
  }
}

export async function validateCoupon(code: string, subtotal: number): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discount: number;
  message?: string;
}> {
  try {
    const cleanCode = code.trim().toUpperCase();
    let coupon: Coupon | undefined;

    // 1. Check Firestore
    try {
      const colRef = collection(db, 'coupons');
      const q = query(colRef, where('code', '==', cleanCode), where('active', '==', true), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;
      }
    } catch (e) {
      console.warn('Firestore coupon lookup note:', e);
    }

    // 2. Check defaults if not found in Firestore
    if (!coupon) {
      coupon = DEFAULT_STORE_COUPONS.find((c) => c.code.toUpperCase() === cleanCode && c.active);
    }

    if (!coupon) {
      return { valid: false, discount: 0, message: 'Invalid or expired coupon code.' };
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      return { valid: false, discount: 0, message: 'This coupon has expired.' };
    }

    if (coupon.usageLimit && (coupon.timesUsed || 0) >= coupon.usageLimit) {
      return { valid: false, discount: 0, message: 'Coupon usage limit has been reached.' };
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        discount: 0,
        message: `Minimum order of ৳${coupon.minOrderAmount.toLocaleString()} required for ${coupon.code} (Add ৳${coupon.minOrderAmount - subtotal} more).`
      };
    }

    let calculatedDiscount = 0;
    if (coupon.discountType === 'percentage') {
      calculatedDiscount = Math.round((subtotal * coupon.discountAmount) / 100);
      if (coupon.maxDiscount && calculatedDiscount > coupon.maxDiscount) {
        calculatedDiscount = coupon.maxDiscount;
      }
    } else {
      calculatedDiscount = coupon.discountAmount;
    }

    if (calculatedDiscount > subtotal) {
      calculatedDiscount = subtotal;
    }

    return { valid: true, coupon, discount: calculatedDiscount };
  } catch (error) {
    console.error('Coupon validation error:', error);
    return { valid: false, discount: 0, message: 'Unable to apply coupon. Please try again.' };
  }
}

export async function saveCoupon(data: Partial<Coupon>, id?: string): Promise<string> {
  const colRef = collection(db, 'coupons');
  if (id) {
    await updateDoc(doc(db, 'coupons', id), sanitizeFirestoreData(data));
    return id;
  } else {
    const docRef = await addDoc(colRef, sanitizeFirestoreData({
      ...data,
      timesUsed: 0,
      createdAt: serverTimestamp()
    }));
    return docRef.id;
  }
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, 'coupons', id));
}

/* ==================== DELIVERY ZONES ==================== */

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  try {
    const colRef = collection(db, 'deliveryZones');
    const snapshot = await getDocs(colRef);
    let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryZone));
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return list;
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    return [];
  }
}

export async function saveDeliveryZone(data: Partial<DeliveryZone>, id?: string): Promise<string> {
  const colRef = collection(db, 'deliveryZones');
  if (id) {
    await updateDoc(doc(db, 'deliveryZones', id), sanitizeFirestoreData(data));
    return id;
  } else {
    const docRef = await addDoc(colRef, sanitizeFirestoreData(data));
    return docRef.id;
  }
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  await deleteDoc(doc(db, 'deliveryZones', id));
}

/* ==================== BANNERS ==================== */

const BANNERS_CACHE_KEY = 'aesthetx_banners_v2';
const DELETED_BANNERS_KEY = 'aesthetx_deleted_banners_v2';

export function getDeletedBannerIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_BANNERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read deleted banners cache:', err);
  }
  return [];
}

export function addDeletedBannerId(id: string): void {
  try {
    const list = getDeletedBannerIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_BANNERS_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Could not save deleted banner ID:', err);
  }
}

export function removeDeletedBannerId(id: string): void {
  try {
    const list = getDeletedBannerIds().filter((d) => d !== id);
    localStorage.setItem(DELETED_BANNERS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Could not clear deleted banner ID:', err);
  }
}

export function getLocalBannersCache(): Banner[] {
  const deletedIds = getDeletedBannerIds();
  try {
    const raw = localStorage.getItem(BANNERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((b) => b && b.id && !deletedIds.includes(b.id));
      }
    }
  } catch (err) {
    console.warn('Could not read cached banners:', err);
  }
  return [];
}

export function setLocalBannersCache(list: Banner[]): void {
  const deletedIds = getDeletedBannerIds();
  const cleanList = list.filter((b) => b && b.id && !deletedIds.includes(b.id));
  try {
    localStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify(cleanList));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-banners-updated', { detail: cleanList }));
    }
  } catch (err) {
    console.warn('Could not write banners cache:', err);
  }
}

export async function getBanners(activeOnly = true): Promise<Banner[]> {
  const deletedIds = getDeletedBannerIds();
  let list: Banner[] = [];

  try {
    const colRef = collection(db, 'banners');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as Banner))
        .filter((b) => !deletedIds.includes(b.id));
    }
  } catch (error) {
    console.warn('Firestore banners read note (using local cache):', error);
  }

  // Fallback to local cache if Firestore is empty or errored
  if (list.length === 0) {
    list = getLocalBannersCache().filter((b) => !deletedIds.includes(b.id));
  } else {
    setLocalBannersCache(list);
  }

  if (activeOnly) {
    list = list.filter((b) => b.active !== false);
  }
  list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return list;
}

export async function saveBanner(data: Partial<Banner>, id?: string): Promise<string> {
  const targetId = id || `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  removeDeletedBannerId(targetId);

  const now = { seconds: Math.floor(Date.now() / 1000) };

  // 1. Immediately update local mirror
  const currentList = await getBanners(false);
  const existingIdx = currentList.findIndex((b) => b.id === targetId || (id && b.id === id));

  let updatedList: Banner[];
  if (existingIdx >= 0) {
    const updated = {
      ...currentList[existingIdx],
      ...data,
      id: targetId,
      updatedAt: now
    };
    updatedList = [...currentList];
    updatedList[existingIdx] = updated;
  } else {
    const newBanner: Banner = {
      id: targetId,
      title: data.title || 'Special Promotion',
      subtitle: data.subtitle || '',
      tagline: data.tagline || 'NEW LAUNCH',
      image: data.image || '',
      buttonText: data.buttonText || 'Shop Now',
      buttonLink: data.buttonLink || '/shop',
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? (currentList.length + 1),
      createdAt: now,
      updatedAt: now,
      ...data
    };
    updatedList = [...currentList, newBanner];
  }

  setLocalBannersCache(updatedList);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'banners', targetId);
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...data,
        id: targetId,
        updatedAt: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore banner write notice (saved locally):', err);
  }

  return targetId;
}

export async function deleteBanner(id: string): Promise<void> {
  // 1. Permanently blacklist this ID in local storage so it never resurfaces
  addDeletedBannerId(id);

  // 2. Remove from local cache immediately
  const currentList = getLocalBannersCache();
  const nextList = currentList.filter((b) => b.id !== id);
  setLocalBannersCache(nextList);

  // 3. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'banners', id));
  } catch (err) {
    console.warn('Firestore banner delete notice:', err);
  }

  // 4. Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aesthetx-banners-updated', { detail: nextList }));
  }
}

/* ==================== REVIEWS ==================== */

export async function getProductReviews(productId: string, approvedOnly = true): Promise<Review[]> {
  try {
    const colRef = collection(db, 'reviews');
    const q = query(colRef, where('productId', '==', productId));
    const snapshot = await getDocs(q);
    let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
    if (approvedOnly) {
      list = list.filter((r) => r.approved);
    }
    return list;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

export async function getAllReviewsAdmin(): Promise<Review[]> {
  try {
    const colRef = collection(db, 'reviews');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    return [];
  }
}

export async function submitReview(reviewData: Omit<Review, 'id' | 'createdAt'>): Promise<string> {
  const colRef = collection(db, 'reviews');
  const docRef = await addDoc(colRef, sanitizeFirestoreData({
    ...reviewData,
    approved: false, // Must be approved by admin
    createdAt: serverTimestamp()
  }));
  return docRef.id;
}

export async function updateReviewStatus(id: string, approved: boolean): Promise<void> {
  await updateDoc(doc(db, 'reviews', id), { approved });
}

export async function deleteReview(id: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', id));
}

/* ==================== CUSTOMERS / USERS ==================== */

export async function getCustomers(): Promise<CustomerUser[]> {
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as CustomerUser));
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

export async function saveCustomerProfile(uid: string, data: Partial<CustomerUser>): Promise<void> {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await updateDoc(docRef, sanitizeFirestoreData(data));
  } else {
    await setDoc(docRef, sanitizeFirestoreData({
      ...data,
      totalOrders: 0,
      totalSpent: 0,
      createdAt: serverTimestamp()
    }));
  }
}

/* ==================== SITE SETTINGS ==================== */

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const docRef = doc(db, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as SiteSettings;
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return null;
  }
}

export async function saveSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  const docRef = doc(db, 'settings', 'general');
  await setDoc(docRef, sanitizeFirestoreData(settings), { merge: true });
}

/* ==================== STATIC PAGES ==================== */

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  try {
    const docRef = doc(db, 'pages', slug);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as StaticPage;
  } catch (error) {
    console.error('Error fetching static page:', error);
    return null;
  }
}

export async function saveStaticPage(slug: string, pageData: { title: string; content: string }): Promise<void> {
  const docRef = doc(db, 'pages', slug);
  await setDoc(docRef, {
    slug,
    ...pageData,
    updatedAt: serverTimestamp()
  });
}

/* ==================== AUDIT LOGS ==================== */

export async function logAdminAction(action: string, target: string, details?: string, adminUid?: string, adminEmail?: string): Promise<void> {
  try {
    const colRef = collection(db, 'auditLogs');
    await addDoc(colRef, sanitizeFirestoreData({
      action,
      target,
      details: details || '',
      adminUid: adminUid || 'unknown',
      adminEmail: adminEmail || 'admin',
      timestamp: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Failed to record audit log:', err);
  }
}

export async function getAuditLogs(limitCount = 50): Promise<AuditLog[]> {
  try {
    const colRef = collection(db, 'auditLogs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (err) {
    // If order by timestamp needs an index, fallback to simple fetch
    try {
      const colRef = collection(db, 'auditLogs');
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
    } catch {
      return [];
    }
  }
}

/* ==================== CUSTOMER SUPPORT & AI ASSISTANT ==================== */

const SUPPORT_SETTINGS_DOC = 'config';
const SUPPORT_SETTINGS_COLLECTION = 'support_settings';
const SUPPORT_SETTINGS_LOCAL_KEY = 'aesthetx_support_settings_v1';
const SUPPORT_CONVERSATIONS_LOCAL_KEY = 'aesthetx_support_convs_v1';
const SUPPORT_MESSAGES_LOCAL_KEY = 'aesthetx_support_msgs_v1';
const AI_LOGS_LOCAL_KEY = 'aesthetx_ai_logs_v1';

export const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  aiAssistantEnabled: true, // Enabled for customer inquiries
  aiStatusMode: 'active',
  customerChatEnabled: true,
  humanSupportEnabled: true,
  autoOrderInquiryEnabled: true,
  autoInventoryAlerts: true,
  requireAdminApprovalForActions: true,
  welcomeMessage: 'Hello! Welcome to AESTHETX LIFESTYLE Customer Support. How can we help you today?'
};

export function getLocalSupportSettings(): SupportSettings {
  try {
    const raw = localStorage.getItem(SUPPORT_SETTINGS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const isEnabled = parsed.aiAssistantEnabled !== false;
        const currentMode: AIStatusMode = parsed.aiStatusMode || (isEnabled ? 'active' : 'disabled');
        return {
          ...DEFAULT_SUPPORT_SETTINGS,
          ...parsed,
          aiAssistantEnabled: isEnabled,
          aiStatusMode: currentMode
        };
      }
    }
  } catch (err) {
    console.warn('Could not read local support settings:', err);
  }
  return DEFAULT_SUPPORT_SETTINGS;
}

export function setLocalSupportSettings(settings: SupportSettings): void {
  try {
    localStorage.setItem(SUPPORT_SETTINGS_LOCAL_KEY, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-support-settings-updated', { detail: settings }));
    }
  } catch (err) {
    console.warn('Could not write local support settings:', err);
  }
}

export async function getSupportSettings(): Promise<SupportSettings> {
  const local = getLocalSupportSettings();
  try {
    const docRef = doc(db, SUPPORT_SETTINGS_COLLECTION, SUPPORT_SETTINGS_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SupportSettings;
      const merged: SupportSettings = {
        ...DEFAULT_SUPPORT_SETTINGS,
        ...data,
        aiAssistantEnabled: data.aiAssistantEnabled !== false
      };
      setLocalSupportSettings(merged);
      return merged;
    } else {
      // First time initialization: initialize with active AI
      await setDoc(docRef, sanitizeFirestoreData({
        ...DEFAULT_SUPPORT_SETTINGS,
        updatedAt: serverTimestamp()
      }));
      setLocalSupportSettings(DEFAULT_SUPPORT_SETTINGS);
      return DEFAULT_SUPPORT_SETTINGS;
    }
  } catch (err) {
    console.warn('Firestore support settings note (using local fallback):', err);
    return local;
  }
}

export async function saveSupportSettings(settings: Partial<SupportSettings>): Promise<void> {
  const current = await getSupportSettings();
  const updated: SupportSettings = {
    ...current,
    ...settings,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) }
  };

  setLocalSupportSettings(updated);

  try {
    const docRef = doc(db, SUPPORT_SETTINGS_COLLECTION, SUPPORT_SETTINGS_DOC);
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...updated,
        updatedAt: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore support settings write note:', err);
  }
}

/* --- Support Conversations --- */

export function getLocalSupportConversations(): SupportConversation[] {
  try {
    const raw = localStorage.getItem(SUPPORT_CONVERSATIONS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local support conversations:', err);
  }
  return [];
}

export function setLocalSupportConversations(list: SupportConversation[]): void {
  try {
    localStorage.setItem(SUPPORT_CONVERSATIONS_LOCAL_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-support-convs-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write local support conversations:', err);
  }
}

export async function getAllSupportConversations(): Promise<SupportConversation[]> {
  try {
    const colRef = collection(db, 'support_conversations');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportConversation));
      list.sort((a, b) => {
        const timeA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : (new Date(a.updatedAt || 0).getTime());
        const timeB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : (new Date(b.updatedAt || 0).getTime());
        return timeB - timeA;
      });
      setLocalSupportConversations(list);
      return list;
    }
  } catch (err) {
    console.warn('Firestore fetch conversations note (using local):', err);
  }
  return getLocalSupportConversations();
}

export async function getSupportConversationBySession(sessionId: string): Promise<SupportConversation | null> {
  const localList = getLocalSupportConversations();
  const localMatch = localList.find((c) => c.sessionId === sessionId);

  try {
    const colRef = collection(db, 'support_conversations');
    const q = query(colRef, where('sessionId', '==', sessionId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const conv = { id: docSnap.id, ...docSnap.data() } as SupportConversation;
      
      // Update local cache
      const updated = localList.filter((c) => c.id !== conv.id);
      setLocalSupportConversations([conv, ...updated]);
      return conv;
    }
  } catch (err) {
    console.warn('Firestore conversation query note:', err);
  }

  return localMatch || null;
}

export async function getOrCreateSupportConversation(
  sessionId: string,
  customerData?: { name?: string; phone?: string; email?: string }
): Promise<SupportConversation> {
  const existing = await getSupportConversationBySession(sessionId);
  if (existing) {
    if (customerData?.name || customerData?.phone || customerData?.email) {
      const updates: Partial<SupportConversation> = {};
      if (customerData.name && !existing.customerName) updates.customerName = customerData.name;
      if (customerData.phone && !existing.customerPhone) updates.customerPhone = customerData.phone;
      if (customerData.email && !existing.customerEmail) updates.customerEmail = customerData.email;
      if (Object.keys(updates).length > 0) {
        await updateSupportConversation(existing.id, updates);
        return { ...existing, ...updates };
      }
    }
    return existing;
  }

  const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = { seconds: Math.floor(Date.now() / 1000) };
  const newConv: SupportConversation = {
    id: newId,
    sessionId,
    customerName: customerData?.name || 'Guest Customer',
    customerPhone: customerData?.phone || '',
    customerEmail: customerData?.email || '',
    status: 'open',
    isTakenOverByAdmin: false,
    lastMessage: 'Conversation started',
    lastSender: 'system',
    unreadByAdmin: false,
    unreadByCustomer: false,
    createdAt: now,
    updatedAt: now
  };

  const currentList = getLocalSupportConversations();
  setLocalSupportConversations([newConv, ...currentList]);

  try {
    const docRef = doc(db, 'support_conversations', newId);
    await setDoc(docRef, sanitizeFirestoreData({
      ...newConv,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore conversation create note:', err);
  }

  return newConv;
}

export async function updateSupportConversation(
  conversationId: string,
  updates: Partial<SupportConversation>
): Promise<void> {
  const currentList = getLocalSupportConversations();
  const updatedList = currentList.map((c) =>
    c.id === conversationId ? { ...c, ...updates, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : c
  );
  setLocalSupportConversations(updatedList);

  try {
    const docRef = doc(db, 'support_conversations', conversationId);
    await updateDoc(docRef, sanitizeFirestoreData({
      ...updates,
      updatedAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore conversation update note:', err);
  }
}

/* --- Support Messages --- */

export function getLocalSupportMessages(conversationId?: string): SupportMessage[] {
  try {
    const raw = localStorage.getItem(SUPPORT_MESSAGES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return conversationId ? parsed.filter((m) => m.conversationId === conversationId) : parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read local support messages:', err);
  }
  return [];
}

export function setLocalSupportMessages(list: SupportMessage[]): void {
  try {
    const seen = new Set<string>();
    const deduplicated: SupportMessage[] = [];
    for (const m of list) {
      if (m && m.id && !seen.has(m.id)) {
        seen.add(m.id);
        deduplicated.push(m);
      }
    }
    localStorage.setItem(SUPPORT_MESSAGES_LOCAL_KEY, JSON.stringify(deduplicated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-support-msgs-updated', { detail: deduplicated }));
    }
  } catch (err) {
    console.warn('Could not write local support messages:', err);
  }
}

export async function getSupportMessages(conversationId: string): Promise<SupportMessage[]> {
  const local = getLocalSupportMessages(conversationId);
  try {
    const colRef = collection(db, 'support_messages');
    const q = query(colRef, where('conversationId', '==', conversationId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportMessage));
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime());
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime());
        return timeA - timeB;
      });

      // Deduplicate list
      const seen = new Set<string>();
      const dedupList: SupportMessage[] = [];
      for (const m of list) {
        if (m && m.id && !seen.has(m.id)) {
          seen.add(m.id);
          dedupList.push(m);
        }
      }

      // Merge into local messages
      const allLocal = getLocalSupportMessages();
      const otherMessages = allLocal.filter((m) => m.conversationId !== conversationId);
      setLocalSupportMessages([...otherMessages, ...dedupList]);

      return dedupList;
    }
  } catch (err) {
    console.warn('Firestore fetch messages note (using local):', err);
  }

  const seen = new Set<string>();
  const dedupLocal: SupportMessage[] = [];
  for (const m of local) {
    if (m && m.id && !seen.has(m.id)) {
      seen.add(m.id);
      dedupLocal.push(m);
    }
  }

  dedupLocal.sort((a, b) => {
    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime());
    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime());
    return timeA - timeB;
  });
  return dedupLocal;
}

export async function sendSupportMessage(data: {
  id?: string;
  conversationId: string;
  sessionId: string;
  sender: 'customer' | 'admin' | 'ai' | 'system';
  senderName?: string;
  text: string;
  recommendedProducts?: SupportMessage['recommendedProducts'];
}): Promise<SupportMessage> {
  const newId = data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = { seconds: Math.floor(Date.now() / 1000) };

  const newMsg: SupportMessage = {
    id: newId,
    conversationId: data.conversationId,
    sessionId: data.sessionId,
    sender: data.sender,
    senderName: data.senderName || (data.sender === 'admin' ? 'Support Agent' : data.sender === 'ai' ? 'AI Assistant' : 'Customer'),
    text: data.text,
    recommendedProducts: data.recommendedProducts || undefined,
    createdAt: now
  };

  // 1. Update local messages immediately (filtering any duplicate id or same text/sender in close window)
  const allLocal = getLocalSupportMessages();
  const filtered = allLocal.filter((m) => {
    if (m.id === newId) return false;
    // Deduplicate same sender & text within 15 seconds
    if (m.conversationId === data.conversationId && m.sender === data.sender && m.text.trim() === data.text.trim()) {
      const timeDiff = Math.abs((m.createdAt?.seconds || 0) - now.seconds);
      if (timeDiff < 15) return false;
    }
    return true;
  });
  setLocalSupportMessages([...filtered, newMsg]);

  // 2. Update parent conversation metadata
  const convUpdates: Partial<SupportConversation> = {
    lastMessage: data.text,
    lastSender: data.sender,
    updatedAt: now,
    status: 'open'
  };

  if (data.sender === 'customer') {
    convUpdates.unreadByAdmin = true;
    convUpdates.unreadByCustomer = false;
  } else if (data.sender === 'admin') {
    convUpdates.unreadByAdmin = false;
    convUpdates.unreadByCustomer = true;
  } else if (data.sender === 'ai') {
    convUpdates.unreadByCustomer = true;
  }

  await updateSupportConversation(data.conversationId, convUpdates);

  // 3. Persist to Firestore
  try {
    const docRef = doc(db, 'support_messages', newId);
    await setDoc(docRef, sanitizeFirestoreData({
      ...newMsg,
      createdAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore message write note:', err);
  }

  return newMsg;
}

/* --- AI Activity Logs --- */

export function getLocalAILogs(): AIActivityLog[] {
  try {
    const raw = localStorage.getItem(AI_LOGS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local AI logs:', err);
  }
  return [];
}

export function setLocalAILogs(list: AIActivityLog[]): void {
  try {
    localStorage.setItem(AI_LOGS_LOCAL_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-ai-logs-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write local AI logs:', err);
  }
}

export async function getAIActivityLogs(limitCount = 50): Promise<AIActivityLog[]> {
  try {
    const colRef = collection(db, 'ai_activity_logs');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIActivityLog));
      list.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (new Date(a.timestamp || 0).getTime());
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (new Date(b.timestamp || 0).getTime());
        return timeB - timeA;
      });
      const trimmed = list.slice(0, limitCount);
      setLocalAILogs(trimmed);
      return trimmed;
    }
  } catch (err) {
    console.warn('Firestore fetch AI logs note (using local):', err);
  }
  return getLocalAILogs().slice(0, limitCount);
}

export async function logAIActivity(logData: Omit<AIActivityLog, 'id' | 'timestamp'>): Promise<void> {
  const newId = `ailog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = { seconds: Math.floor(Date.now() / 1000) };

  const item: AIActivityLog = {
    id: newId,
    ...logData,
    timestamp: now
  };

  const current = getLocalAILogs();
  setLocalAILogs([item, ...current].slice(0, 100));

  try {
    const docRef = doc(db, 'ai_activity_logs', newId);
    await setDoc(docRef, sanitizeFirestoreData({
      ...item,
      timestamp: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore AI log write note:', err);
  }
}

/* ==================== AI KNOWLEDGE BASE ==================== */

const AI_KNOWLEDGE_BASE_LOCAL_KEY = 'aesthetx_ai_knowledge_base_v1';
const AI_APPROVALS_LOCAL_KEY = 'aesthetx_ai_approvals_v1';
const AI_NOTIFICATIONS_LOCAL_KEY = 'aesthetx_ai_notifications_v1';
const AI_REPORTS_LOCAL_KEY = 'aesthetx_ai_reports_v1';

export const DEFAULT_AI_KNOWLEDGE_BASE: AIKnowledgeBase = {
  storeOverview: 'AESTHETX LIFESTYLE is a premium streetwear, casual wear, and lifestyle apparel brand based in Dhaka, Bangladesh. Tagline: "Buying clothes is cheaper than therapy."',
  shippingInfo: 'Delivery across Bangladesh. Inside Dhaka: ৳70 - ৳80 (2-3 business days). Outside Dhaka / Sub-districts: ৳120 - ৳150 (3-5 business days). Cash on Delivery (COD) is available nationwide.',
  paymentMethods: 'Cash on Delivery (COD), bKash (Merchant / Personal), Nagad, Rocket, and Visa/Mastercard debit and credit cards.',
  returnPolicy: '7-day hassle-free replacement/exchange for defective, damaged, or wrong sized items. Items must be unwashed, unworn, and have original brand tags attached.',
  faqList: [
    {
      question: 'How can I track my order?',
      answer: 'Track your order anytime on the Track Order page (/track-order) using your Order ID (e.g. #ORD-123456) or your phone number.'
    },
    {
      question: 'How long does delivery take?',
      answer: 'Inside Dhaka delivery takes 2 to 3 working days. Outside Dhaka delivery takes 3 to 5 working days.'
    },
    {
      question: 'Can I inspect the parcel before Cash on Delivery payment?',
      answer: 'Yes, you can check the package in front of the delivery rider while keeping the apparel unworn.'
    },
    {
      question: 'How do I exchange for a different size?',
      answer: 'Contact our live support with your Order ID and the desired size within 7 days. We will dispatch the replacement.'
    }
  ],
  customNotes: 'Always be courteous and friendly. Provide real prices in Bangladeshi Taka (৳). Answer in Bengali if asked in Bengali, or English if asked in English. Ground all answers in real catalog and order data.'
};

export function getLocalAIKnowledgeBase(): AIKnowledgeBase {
  try {
    const raw = localStorage.getItem(AI_KNOWLEDGE_BASE_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_AI_KNOWLEDGE_BASE, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Could not read local AI knowledge base:', err);
  }
  return DEFAULT_AI_KNOWLEDGE_BASE;
}

export function setLocalAIKnowledgeBase(kb: AIKnowledgeBase): void {
  try {
    localStorage.setItem(AI_KNOWLEDGE_BASE_LOCAL_KEY, JSON.stringify(kb));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-ai-kb-updated', { detail: kb }));
    }
  } catch (err) {
    console.warn('Could not write local AI knowledge base:', err);
  }
}

export async function getAIKnowledgeBase(): Promise<AIKnowledgeBase> {
  const local = getLocalAIKnowledgeBase();
  try {
    const docRef = doc(db, 'ai_settings', 'knowledge_base');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AIKnowledgeBase;
      const merged = { ...DEFAULT_AI_KNOWLEDGE_BASE, ...data };
      setLocalAIKnowledgeBase(merged);
      return merged;
    } else {
      await setDoc(docRef, sanitizeFirestoreData({
        ...DEFAULT_AI_KNOWLEDGE_BASE,
        updatedAt: serverTimestamp()
      }));
      return DEFAULT_AI_KNOWLEDGE_BASE;
    }
  } catch (err) {
    console.warn('Firestore fetch knowledge base note (using local):', err);
    return local;
  }
}

export async function saveAIKnowledgeBase(updates: Partial<AIKnowledgeBase>): Promise<void> {
  const current = await getAIKnowledgeBase();
  const updated: AIKnowledgeBase = {
    ...current,
    ...updates,
    updatedAt: { seconds: Math.floor(Date.now() / 1000) }
  };

  setLocalAIKnowledgeBase(updated);

  try {
    const docRef = doc(db, 'ai_settings', 'knowledge_base');
    await setDoc(docRef, sanitizeFirestoreData({
      ...updated,
      updatedAt: serverTimestamp()
    }), { merge: true });
  } catch (err) {
    console.warn('Firestore write knowledge base note:', err);
  }
}

/* ==================== AI APPROVAL ACTIONS ==================== */

export function getLocalAIApprovalActions(): AIApprovalAction[] {
  try {
    const raw = localStorage.getItem(AI_APPROVALS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local AI approvals:', err);
  }
  return [];
}

export function setLocalAIApprovalActions(list: AIApprovalAction[]): void {
  try {
    localStorage.setItem(AI_APPROVALS_LOCAL_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-ai-approvals-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write local AI approvals:', err);
  }
}

export async function getAIApprovalActions(): Promise<AIApprovalAction[]> {
  try {
    const colRef = collection(db, 'ai_approval_actions');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIApprovalAction));
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setLocalAIApprovalActions(list);
      return list;
    }
  } catch (err) {
    console.warn('Firestore fetch AI approvals note (using local):', err);
  }
  return getLocalAIApprovalActions();
}

export async function createAIApprovalAction(
  data: Omit<AIApprovalAction, 'id' | 'createdAt' | 'status'>
): Promise<AIApprovalAction> {
  const newId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = { seconds: Math.floor(Date.now() / 1000) };

  const newAction: AIApprovalAction = {
    id: newId,
    ...data,
    status: 'pending',
    createdAt: now
  };

  const current = getLocalAIApprovalActions();
  setLocalAIApprovalActions([newAction, ...current]);

  try {
    const docRef = doc(db, 'ai_approval_actions', newId);
    await setDoc(docRef, sanitizeFirestoreData({
      ...newAction,
      createdAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore create approval action note:', err);
  }

  // Also trigger a notification for Admin
  await createAINotification({
    type: 'pending_approval',
    title: 'AI Action Requires Approval',
    message: `AI proposed: ${data.actionType.replace(/_/g, ' ')} for ${data.targetReference || data.targetId}. Reason: ${data.reason}`,
    severity: 'high',
    targetTab: 'support',
    targetId: newId
  });

  return newAction;
}

export async function reviewAIApprovalAction(
  actionId: string,
  decision: 'approved' | 'rejected',
  notes: string,
  adminEmail: string
): Promise<boolean> {
  const current = getLocalAIApprovalActions();
  const target = current.find((a) => a.id === actionId);
  if (!target) return false;

  const now = { seconds: Math.floor(Date.now() / 1000) };
  const updatedAction: AIApprovalAction = {
    ...target,
    status: decision,
    adminDecisionNotes: notes,
    reviewedBy: adminEmail,
    reviewedAt: now
  };

  const updatedList = current.map((a) => (a.id === actionId ? updatedAction : a));
  setLocalAIApprovalActions(updatedList);

  try {
    const docRef = doc(db, 'ai_approval_actions', actionId);
    await updateDoc(docRef, sanitizeFirestoreData({
      status: decision,
      adminDecisionNotes: notes,
      reviewedBy: adminEmail,
      reviewedAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore update approval action note:', err);
  }

  // If approved, execute real database changes based on actionType!
  if (decision === 'approved') {
    try {
      if (target.actionType === 'order_cancellation' && target.targetId) {
        await updateOrderStatus(
          target.targetId,
          'Cancelled',
          `Cancelled upon admin approval of AI proposal. Reason: ${target.reason}`
        );
      } else if (target.actionType === 'order_refund' && target.targetId) {
        await updateOrderStatus(
          target.targetId,
          'Refunded',
          `Refund approved: ${target.reason}`,
          'Refunded'
        );
      } else if (target.actionType === 'order_status_override' && target.targetId && target.payload?.orderStatus) {
        await updateOrderStatus(
          target.targetId,
          target.payload.orderStatus,
          target.adminDecisionNotes
        );
      } else if (target.actionType === 'price_change' && target.targetId && target.payload?.newPrice) {
        await saveProduct(
          { price: target.payload.newPrice },
          target.targetId
        );
      }
    } catch (execErr) {
      console.error('Error executing approved AI action:', execErr);
    }
  }

  // Audit log entry
  await logAdminAction(
    `AI_ACTION_${decision.toUpperCase()}`,
    `${target.actionType}:${target.targetReference || target.targetId}`,
    `Admin ${decision} AI proposal (${target.reason}). Notes: ${notes}`,
    adminEmail,
    adminEmail
  );

  return true;
}

/* ==================== AI NOTIFICATIONS ==================== */

export function getLocalAINotifications(): AINotification[] {
  try {
    const raw = localStorage.getItem(AI_NOTIFICATIONS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local AI notifications:', err);
  }
  return [];
}

export function setLocalAINotifications(list: AINotification[]): void {
  try {
    localStorage.setItem(AI_NOTIFICATIONS_LOCAL_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-ai-notifs-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write local AI notifications:', err);
  }
}

export async function createAINotification(
  data: Omit<AINotification, 'id' | 'createdAt' | 'isRead'>
): Promise<AINotification> {
  const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = { seconds: Math.floor(Date.now() / 1000) };

  const notif: AINotification = {
    id: newId,
    ...data,
    isRead: false,
    createdAt: now
  };

  const current = getLocalAINotifications();
  setLocalAINotifications([notif, ...current].slice(0, 50));
  return notif;
}

export async function markAINotificationAsRead(id: string): Promise<void> {
  const current = getLocalAINotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  setLocalAINotifications(updated);
}

export async function markAllAINotificationsAsRead(): Promise<void> {
  const current = getLocalAINotifications();
  const updated = current.map((n) => ({ ...n, isRead: true }));
  setLocalAINotifications(updated);
}

export function scanAndGenerateAINotifications(): AINotification[] {
  const notifications: AINotification[] = [];
  const products = getLocalProductsCache();
  const orders = getLocalOrdersCache();
  const convs = getLocalSupportConversations();
  const approvals = getLocalAIApprovalActions();

  // 1. Low stock alerts (< 5)
  const lowStockProds = products.filter((p) => p.totalStock !== undefined && p.totalStock > 0 && p.totalStock <= 5);
  if (lowStockProds.length > 0) {
    notifications.push({
      id: `lowstock_${lowStockProds.length}`,
      type: 'low_stock',
      title: `${lowStockProds.length} Products Running Low on Stock`,
      message: `Items like "${lowStockProds[0]?.name}" have only ${lowStockProds[0]?.totalStock} units left. Consider restocking soon.`,
      severity: 'medium',
      targetTab: 'inventory',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // 2. Out of stock products
  const outOfStockProds = products.filter((p) => p.totalStock === 0);
  if (outOfStockProds.length > 0) {
    notifications.push({
      id: `outofstock_${outOfStockProds.length}`,
      type: 'low_stock',
      title: `${outOfStockProds.length} Products Completely Out of Stock`,
      message: `Customers cannot buy items like "${outOfStockProds[0]?.name}". Update inventory or mark inactive.`,
      severity: 'high',
      targetTab: 'inventory',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // 3. Unanswered chats
  const unansweredConvs = convs.filter((c) => c.status === 'open' && c.unreadByAdmin);
  if (unansweredConvs.length > 0) {
    notifications.push({
      id: `unanswered_${unansweredConvs.length}`,
      type: 'unanswered_chat',
      title: `${unansweredConvs.length} Unanswered Customer Chat Messages`,
      message: `Customer "${unansweredConvs[0]?.customerName || 'Guest'}" is awaiting response: "${unansweredConvs[0]?.lastMessage.substring(0, 40)}..."`,
      severity: 'high',
      targetTab: 'customer-chat',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // 4. Pending AI approval actions
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  if (pendingApprovals.length > 0) {
    notifications.push({
      id: `pending_${pendingApprovals.length}`,
      type: 'pending_approval',
      title: `${pendingApprovals.length} AI Proposed Actions Awaiting Admin Approval`,
      message: `AI requested permission for ${pendingApprovals[0].actionType.replace(/_/g, ' ')} for ${pendingApprovals[0].targetReference || pendingApprovals[0].targetId}.`,
      severity: 'critical',
      targetTab: 'support',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // 5. Wrong delivery flagged orders
  const wrongOrders = orders.filter((o) => o.isWrongDelivery || o.orderStatus === 'Wrong Delivery');
  if (wrongOrders.length > 0) {
    notifications.push({
      id: `wrong_delivery_${wrongOrders.length}`,
      type: 'wrong_delivery',
      title: `${wrongOrders.length} Wrong Delivery Issues Reported`,
      message: `Customer reported wrong delivery for Order #${wrongOrders[0]?.orderNumber}. Scheduled for resolution or automatic purge.`,
      severity: 'critical',
      targetTab: 'orders',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // 6. Stalled orders (Processing for > 3 days)
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const stalledOrders = orders.filter((o) => {
    if (o.orderStatus !== 'Processing' && o.orderStatus !== 'Pending') return false;
    const timeMs = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : new Date(o.createdAt || 0).getTime();
    return timeMs > 0 && nowMs - timeMs > THREE_DAYS_MS;
  });
  if (stalledOrders.length > 0) {
    notifications.push({
      id: `stalled_${stalledOrders.length}`,
      type: 'stalled_order',
      title: `${stalledOrders.length} Orders Stalled in Processing/Pending`,
      message: `Order #${stalledOrders[0]?.orderNumber} has been waiting fulfillment for more than 3 days.`,
      severity: 'high',
      targetTab: 'orders',
      isRead: false,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    });
  }

  // Merge with existing local notifications
  const existing = getLocalAINotifications();
  const existingMap = new Map(existing.map((n) => [n.id, n]));
  const merged = notifications.map((n) => existingMap.get(n.id) || n);
  setLocalAINotifications(merged);
  return merged;
}

/* ==================== AI DAILY REPORTS ==================== */

export function getLocalAIDailyReports(): AIDailyReport[] {
  try {
    const raw = localStorage.getItem(AI_REPORTS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local AI reports:', err);
  }
  return [];
}

export function setLocalAIDailyReports(list: AIDailyReport[]): void {
  try {
    localStorage.setItem(AI_REPORTS_LOCAL_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aesthetx-ai-reports-updated', { detail: list }));
    }
  } catch (err) {
    console.warn('Could not write local AI reports:', err);
  }
}

export async function saveAIDailyReport(report: AIDailyReport): Promise<void> {
  const current = getLocalAIDailyReports();
  const updated = [report, ...current.filter((r) => r.id !== report.id)].slice(0, 30);
  setLocalAIDailyReports(updated);

  try {
    const docRef = doc(db, 'ai_daily_reports', report.id);
    await setDoc(docRef, sanitizeFirestoreData({
      ...report,
      generatedAt: serverTimestamp()
    }));
  } catch (err) {
    console.warn('Firestore write AI report note:', err);
  }
}

