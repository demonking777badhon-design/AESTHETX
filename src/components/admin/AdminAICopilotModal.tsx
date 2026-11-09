import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Boxes,
  FileText,
  Tag,
  Truck,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  Image as ImageIcon,
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Layers,
  Ruler,
  Building2,
  FolderTree,
  Hash,
  Edit3
} from 'lucide-react';
import {
  getLocalOrdersCache,
  getLocalProductsCache,
  getLocalSupportConversations,
  getLocalSupportMessages,
  saveProduct,
  getCategories,
  saveCategory,
  generateCategorySlug
} from '../../firebase/db';
import { Product } from '../../types';

interface AdminAICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  initialTopic?: string | null;
}

interface AddedProductInfo {
  id: string;
  name: string;
  description?: string;
  price: number;
  sizes: string[];
  totalStock: number;
  thumbnail?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  warranty?: string;
  dimensions?: string;
  unit?: string;
}

interface CopilotMessage {
  id: string;
  role: 'admin' | 'ai';
  text: string;
  image?: string;
  addedProduct?: AddedProductInfo;
  timestamp: Date;
}

interface PendingProductDraft {
  name?: string;
  nameFromParentheses?: boolean;
  description?: string;
  price?: number;
  salePrice?: number;
  discountPercent?: number;
  sizes?: string[];
  stock?: number;
  category?: string;
  isNewCategory?: boolean;
  newCategoryName?: string;
  image?: string;
  color?: string;
  fabric?: string;
  // 6 Specific Fields requested by user:
  model?: string;
  warranty?: string;
  unit?: string;
  dimensions?: string;
  brand?: string;
  subcategory?: string;
}

// Convert Bengali numerals to English standard digits
function toEnglishDigits(str: string): string {
  if (!str) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

// Compress and resize image file to lightweight DataURL
function compressImageFile(file: File, maxWidth = 900, maxHeight = 900, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(event.target?.result as string);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Intelligent Local Product Description Comprehender
 * Strictly ensures the title is a concise 2-4 word phrase and never the full description sentence,
 * accurately detects category and discounts.
 */
function localComprehendProductText(
  rawText: string,
  draft: PendingProductDraft | null,
  existingCategories: string[] = []
): PendingProductDraft {
  const norm = toEnglishDigits(rawText);

  // Clean conversational stop-phrases and instructions from the text
  let strippedText = rawText
    .replace(/(?:আবার\s*ও|আবারও)?\s*এটা\s*নাম\s*(?:রাখছে|দিয়েছে|দিলো)[^,।\n]*/gi, '')
    .replace(/টাইটেল\s*যা\s*আমি\s*দিছিবিবরণ\s*সহ[^,।\n]*/gi, '')
    .replace(/আর\s*সে\s*পোডাক্ট\s*গুলো\s*কেটাগরিতে\s*রাখছে\s*না[^,।\n]*/gi, '')
    .replace(/সে\s*যেই\s*প্রডাক্ট\s*সেই\s*কেটাগরিতে\s*রাখবে[^,।\n]*/gi, '')
    .replace(/আরপোডাক্ট\s*অনুযায়ি\s*কেটাগরি\s*না\s*থাকলে\s*নিজে\s*কেটাগরিও\s*বানাবে[^,।\n]*/gi, '')
    .replace(/আর\s*যদি\s*নতুন\s*কেটাগরি\s*বানায়\s*সে\s*আমাকে\s*তাও\s*জানাবে[^,।\n]*/gi, '')
    .replace(/(?:এটা|এই\s*(?:প্রোডাক্টটি|পণ্যটি)|প্রোডাক্টটি|পণ্যটি)?\s*ওয়েবসাইটে\s*(?:এড|যোগ)\s*(?:করে\s*দাও|কর|করে|করুন|করো|দাও)/gi, '')
    .replace(/(?:যোগ\s*(?:কর|করে|করুন|করো)|এড\s*(?:কর|করে|করুন|করো)|যুক্ত\s*(?:কর|করে|করুন|করো)|তুলে\s*দাও|তোল|লিস্ট\s*(?:কর|করে|করুন|করো))/gi, '')
    .replace(/(?:হিসেবে|হিসাবে)\s*(?:রাখবে|দিবে|করবে)/gi, '')
    .replace(/[,।\s]{2,}/g, ' ')
    .trim();

  // 1. Discount & Price
  let discountPercent: number | undefined = draft?.discountPercent;
  const discountMatch =
    norm.match(/(\d+)%\s*(?:ছাড়|ছাড়|ডিসকাউন্ট|discount|অফ|off|লেস|less)/i) ||
    norm.match(/(?:ছাড়|ছাড়|ডিসকাউন্ট|discount|অফ|off|লেস|less)[:=\s]*(\d+)%/i) ||
    norm.match(/(?:দাম\s*রাখবে\s*|মূল্য\s*)(\d+)%/i);
  if (discountMatch) {
    const val = parseInt(discountMatch[1], 10);
    if (!/(\d+)%\s*(?:কটন|cotton|সুতি|লিনেন|পলেস্টার|ফেব্রিক)/i.test(rawText) || val < 100) {
      discountPercent = val;
    }
  }

  const priceMatch =
    norm.match(/(?:দাম(?:\s*রাখবে|\s*হবে)?|মূল্য|price|৳)[:=\s]*(\d+)(?![\d\s]*%)/i) ||
    norm.match(/(\d+)\s*(?:টাকা|tk|taka|\/-)(?!\s*%)/i) ||
    norm.match(/(?:টাকা|৳)\s*(\d+)(?![\d\s]*%)/i);
  let price = priceMatch ? parseInt(priceMatch[1], 10) : (draft?.price || undefined);
  let salePrice = price;
  if (price && discountPercent) {
    salePrice = Math.round(price * (1 - discountPercent / 100));
  }

  // 2. Stock
  const stockMatch =
    norm.match(/(?:স্টক|stock|পরিমাণ|মজুত|ইনভেন্টরি)[:=\s]*(\d+)/i) ||
    norm.match(/(\d+)\s*(?:টি|টা|পিস|pcs|pc|units?)(?!\s*(?:টাকা|tk|taka|\/-|%))/i);
  const stock = stockMatch ? parseInt(stockMatch[1], 10) : (draft?.stock || undefined);

  // 3. Category Detection
  let detectedCategory = draft?.category || '';
  if (/shoge|shoe|shoes|স্নিকার্স|জুতা|জুতো|কেডস|loafer|loafers|sneaker|sneakers|boots|sandals|slippers|হিল/i.test(rawText)) {
    detectedCategory = 'Shoes';
  } else if (/টি-শার্ট|টিশার্ট|গেঞ্জি|t-shirt|tshirt|tee/i.test(rawText)) {
    detectedCategory = 'T-Shirts';
  } else if (/পোলো|polo/i.test(rawText)) {
    detectedCategory = 'Shirts';
  } else if (/শার্ট|shirt/i.test(rawText)) {
    detectedCategory = 'Shirts';
  } else if (/হুডি|hoodie|জ্যাকেট|jacket|sweatshirt|সুইটার/i.test(rawText)) {
    detectedCategory = 'Hoodies';
  } else if (/প্যান্ট|জিন্স|pant|pants|jeans|cargo|trouser|jogger/i.test(rawText)) {
    detectedCategory = 'Pants';
  } else if (/পাঞ্জাবি|panjabi|kurta/i.test(rawText)) {
    detectedCategory = 'Panjabi';
  } else if (/আতর|সুগন্ধি|পারফিউম|perfume|fragrance|attar|body\s*spray/i.test(rawText)) {
    detectedCategory = 'Perfume & Fragrance';
  } else if (/ঘড়ি|ঘড়ি|watch|smartwatch/i.test(rawText)) {
    detectedCategory = 'Watches';
  } else if (/ব্যাগ|ওয়ালেট|বেল্ট|bag|wallet|belt/i.test(rawText)) {
    detectedCategory = 'Accessories';
  } else if (/car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|vehicle|truck|jeep|hotwheels|diecast|lego|doll|পুতুল|drone|rc\s*car|remote\s*control/i.test(rawText)) {
    detectedCategory = 'Toys & Games';
  } else if (/খাবার|চাল|ডাল|food|snacks|চকলেট/i.test(rawText)) {
    detectedCategory = 'Food';
  } else if (/পানীয়|জুস|drink|juice/i.test(rawText)) {
    detectedCategory = 'Beverages';
  }

  if (!detectedCategory) {
    detectedCategory = 'Men';
  }

  // Check matching category in existingCategories
  let category = detectedCategory;
  let isNewCategory = false;
  let newCategoryName = '';

  if (Array.isArray(existingCategories) && existingCategories.length > 0) {
    const existingMatch = existingCategories.find(
      (c) => c.toLowerCase().trim() === detectedCategory.toLowerCase().trim()
    );
    if (existingMatch) {
      category = existingMatch;
      isNewCategory = false;
    } else {
      isNewCategory = true;
      newCategoryName = detectedCategory;
      category = detectedCategory;
    }
  } else {
    const standardDefaults = ['T-Shirts', 'Shirts', 'Hoodies', 'Panjabi', 'Pants', 'Men'];
    if (!standardDefaults.includes(detectedCategory)) {
      isNewCategory = true;
      newCategoryName = detectedCategory;
    }
  }

  // 4. Sizes
  let sizes = draft?.sizes || undefined;
  const explicitSizeMatch = rawText.match(/(?:সাইজ|মাপ|size|sizes)[:=\s]*([^।\n]+)/i);
  if (explicitSizeMatch) {
    const sizeSection = explicitSizeMatch[1].split(/(?:স্টক|stock|দাম|মূল্য|price|টাকা|tk|পিস|এড|যোগ|website|ওয়েবসাইট)/i)[0];
    const parsed = sizeSection
      .split(/[,/|&\s]+/)
      .map(s => s.trim().replace(/^[,\-.:]|[,\-.:]$/g, ''))
      .filter(s => s && s.length <= 10 && !/^(দাম|মূল্য|স্টক|পিস|টি|টা|এড|যোগ|ও|এবং|and|website|ওয়েবসাইট)$/i.test(s));
    if (parsed.length > 0) sizes = parsed;
  }
  if (!sizes || sizes.length === 0) {
    if (category === 'Shoes' || /shoge|shoe|sneaker/i.test(rawText)) {
      const shoeSizeMatches = norm.match(/\b(38|39|40|41|42|43|44|45)\b/g);
      sizes = shoeSizeMatches && shoeSizeMatches.length > 0 ? shoeSizeMatches : ['40', '41', '42', '43'];
    } else if (['T-Shirts', 'Shirts', 'Hoodies', 'Panjabi', 'Pants'].includes(category)) {
      const foundSizes: string[] = [];
      const tokens = rawText.split(/[\s,।]+/);
      const validClothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
      for (const token of tokens) {
        const upper = token.toUpperCase().trim();
        if (validClothingSizes.includes(upper) && !foundSizes.includes(upper)) {
          foundSizes.push(upper);
        }
      }
      sizes = foundSizes.length > 0 ? foundSizes : ['M', 'L', 'XL'];
    } else if (category === 'Men') {
      if (/শার্ট|টিশার্ট|t-shirt|shirt|pant|প্যান্ট|পোশাক|কাপড়|fabric/i.test(rawText)) {
        sizes = ['M', 'L', 'XL'];
      } else {
        sizes = [];
      }
    } else if (['Toys & Games', 'Watches', 'Perfume & Fragrance', 'Accessories'].includes(category) || /car|toy|খেলনা|গাড়ি|গাড়ি/i.test(rawText)) {
      sizes = [];
    } else if (['Food', 'Beverages'].includes(category)) {
      const volumeMatch = rawText.match(/(?:500ml|250ml|1L|2L|1kg|2kg|500g|২৫০\s*মিলি|৫০০\s*মিলি|১\s*লিটার|১\s*কেজি|৫০০\s*গ্রাম)/gi);
      sizes = volumeMatch ? volumeMatch : (category === 'Beverages' ? ['500ml', '1L'] : ['500g', '1kg']);
    }
  }

  // 5. Detect Style & Color
  let color = '';
  if (/কালো|ব্ল্যাক|black/i.test(rawText)) color = 'ব্ল্যাক';
  else if (/সাদা|হোয়াইট|white/i.test(rawText)) color = 'হোয়াইট';
  else if (/নেভি\s*ব্লু|navy/i.test(rawText)) color = 'নেভি ব্লু';
  else if (/অলিভ|olive/i.test(rawText)) color = 'অলিভ';
  else if (/মেরুন|maroon/i.test(rawText)) color = 'মেরুন';

  const isCotton = /১০০%\s*কটন|কম্বড\s*কটন|খাঁটি\s*সুতি|কটন|সুতি|cotton/i.test(rawText);

  // 6. PARENTHESES-BASED TITLE EXTRACTION OR INTELLIGENT CONCISE TITLE GENERATION
  let title = draft?.name || '';
  let nameFromParentheses = draft?.nameFromParentheses || false;

  // Priority 1: STRICT Parentheses check (e.g. "(Fogo Shoge)" or "（প্রিমিয়াম ড্রপ শোল্ডার টি-শার্ট）")
  const parenMatch = rawText.match(/(?:\(([^)]+)\)|（([^）]+)）)/);
  if (parenMatch) {
    const inside = (parenMatch[1] || parenMatch[2]).trim();
    if (inside && inside.length > 0) {
      title = inside;
      nameFromParentheses = true;
    }
  }

  // Priority 2: Explicit title with mandatory delimiter : or =
  if (!title) {
    const explicitNameMatch = rawText.match(/(?:^|[,\n।])\s*(?:পণ্যের\s*নাম|প্রোডাক্টের\s*নাম|নাম|টাইটেল|title|name)\s*[:=]\s*([^\n,।]+)/i);
    if (explicitNameMatch) {
      const rawName = explicitNameMatch[1]
        .replace(/(?:রাখবে|হবে|দিবে|সহ|যা|আমি|দিছি|বিবরণ).*/gi, '')
        .trim();
      const words = rawName.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        title = words.slice(0, 4).join(' ');
      }
    }
  }

  // Priority 3: Extract leading brand / item from string
  if (!title) {
    const leadingMatch = rawText.match(/^\s*([A-Za-z0-9\u0980-\u09FF\s'-]{2,25}?)(?=\s+(?:এটার|এর|দাম|মূল্য|price|রাখবে|হবে|দিবে|স্টক|stock|সাইজ|size|কালার|রং|color|বিবরণ|ডেসক্রিপশন|এড|যোগ|লিস্ট|ওয়েবসাইট|ওয়েবসাইট|সহ|যা|আমি))/i);
    if (leadingMatch && leadingMatch[1]) {
      const candidate = leadingMatch[1].trim();
      const cWords = candidate.split(/\s+/).filter(Boolean);
      if (cWords.length >= 1 && cWords.length <= 4) {
        const formatted = cWords
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        if (category === 'Shoes' && !/shoe|shoes|sneaker|জুতা|স্নিকার্স/i.test(formatted)) {
          title = `${formatted} Shoes`;
        } else {
          title = formatted;
        }
      }
    }
  }

  if (!title) {
    if (category === 'Shoes') {
      title = `ক্যাজুয়াল স্নিকার্স ${color ? color + ' ' : ''}জুতা`;
    } else if (category === 'T-Shirts') {
      title = `প্রিমিয়াম ${color ? color + ' ' : ''}কটন টি-শার্ট`;
    } else if (category === 'Shirts') {
      title = `ক্লাসিক ${color ? color + ' ' : ''}পোলো শার্ট`;
    } else if (category === 'Hoodies') {
      title = `প্রিমিয়াম ${color ? color + ' ' : ''}উইন্টার হুডি`;
    } else if (category === 'Panjabi') {
      title = `প্রিমিয়াম এম্ব্রয়ডারি পাঞ্জাবি`;
    } else {
      title = `প্রিমিয়াম ${color ? color + ' ' : ''}${category}`;
    }
  }

  // Only truncate to 5 words if NOT explicitly given inside parentheses
  if (!nameFromParentheses) {
    const titleWords = title.split(/\s+/).filter(Boolean);
    if (titleWords.length > 5) {
      title = titleWords.slice(0, 4).join(' ');
    }
  }

  // 7. SPECIFIC 6 STRUCTURED FIELDS
  // 1) Model No.
  let model: string | undefined = draft?.model;
  const modelMatch = rawText.match(/(?:model(?:\s*no|\s*number)?|মডেল(?:\s*নং|\s*নম্বর)?)[:=\s]+([A-Za-z0-9\-_./]+)/i);
  if (modelMatch) {
    model = modelMatch[1].trim();
  }

  // 2) Warranty Info
  let warranty: string | undefined = draft?.warranty;
  const warrantyMatch =
    rawText.match(/(?:warranty(?:\s*info)?|ওয়ারেন্টি|ওয়ারেন্টি|গ্যারান্টি|guarantee)[:=\s]+([^\n,।|]+)/i) ||
    rawText.match(/(\d+\s*(?:বছর|মাস|দিন|year|years|month|months|days?)\s*(?:সার্ভিস\s*)?(?:ওয়ারেন্টি|ওয়ারেন্টি|গ্যারান্টি|warranty|guarantee))/i) ||
    rawText.match(/(?:no\s*warranty|কোনো\s*ওয়ারেন্টি\s*নেই|ওয়ারেন্টি\s*নেই)/i);
  if (warrantyMatch) {
    warranty = warrantyMatch[1] ? warrantyMatch[1].trim() : 'ওয়ারেন্টি নেই';
  }

  // 3) Unit Type
  let unit: string | undefined = draft?.unit;
  const unitMatch = rawText.match(/(?:unit(?:\s*type)?|ইউনিট(?:\s*টাইপ)?|পরিমাপের\s*একক|একক)[:=\s]+([^\n,।|]+)/i);
  if (unitMatch) {
    unit = unitMatch[1].trim();
  } else if (/জোড়া|জোড়া|pair/i.test(rawText)) {
    unit = 'জোড়া (Pair)';
  } else if (/পিস|piece|pcs/i.test(rawText)) {
    unit = 'পিস (Piece)';
  } else if (/সেট|set/i.test(rawText)) {
    unit = 'সেট (Set)';
  } else if (/বক্স|box/i.test(rawText)) {
    unit = 'বক্স (Box)';
  } else if (/কেজি|kg/i.test(rawText)) {
    unit = 'কেজি (Kg)';
  }
  if (!unit) {
    if (category === 'Shoes') unit = 'জোড়া (Pair)';
    else if (category === 'Food' || category === 'Beverages') unit = 'প্যাকেট / বোতল';
    else unit = 'পিস (Piece)';
  }

  // 4) Dimensions / Size
  let dimensions: string | undefined = draft?.dimensions;
  const dimMatch =
    rawText.match(/(?:dimension(?:s)?|ডাইমেনশন|পরিমাপ|মাপ|সাইজ\s*চার্ট)[:=\s]+([^\n,।|]+)/i) ||
    rawText.match(/(\d+(?:\.\d+)?\s*(?:x|X|বাই|\*)\s*\d+(?:\.\d+)?(?:\s*(?:x|X|বাই|\*)\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|m|inch|ইঞ্চি|সেমি)?)/i);
  if (dimMatch) {
    dimensions = dimMatch[1].trim();
  }

  // 5) Brand / Manufacturer
  let brand: string | undefined = draft?.brand;
  const brandMatch = rawText.match(/(?:brand(?:\s*name)?|manufacturer|ব্র্যান্ড|ব্রান্ড|প্রস্তুতকারক|কোম্পানি)[:=\s]+([A-Za-z0-9\u0980-\u09FF\s'-]{2,30}?)(?=[,\n।|\s]+(?:সাইজ|স্টক|দাম|মডেল|ওয়ারেন্টি)|[,\n।|]|$)/i);
  if (brandMatch) {
    brand = brandMatch[1].trim();
  } else if (/fogo/i.test(rawText)) {
    brand = 'Fogo';
  } else if (/aesthetx/i.test(rawText)) {
    brand = 'AESTHETX';
  } else if (/nike/i.test(rawText)) {
    brand = 'Nike';
  } else if (/adidas/i.test(rawText)) {
    brand = 'Adidas';
  } else if (/apex/i.test(rawText)) {
    brand = 'Apex';
  } else if (/bata/i.test(rawText)) {
    brand = 'Bata';
  }

  // 6) Subcategory (Optional)
  let subcategory: string | undefined = draft?.subcategory;
  const subMatch = rawText.match(/(?:subcategory|sub-category|সাব-?ক্যাটাগরি|সাব-?কেটাগরি|সাবকেটাগরি)[:=\s]+([A-Za-z0-9\u0980-\u09FF\s'-]{2,30}?)(?=[,\n।|]|$)/i);
  if (subMatch) {
    subcategory = subMatch[1].trim();
  } else if (category === 'Shoes') {
    if (/sneaker|স্নিকার্স/i.test(rawText)) subcategory = 'Sneakers';
    else if (/loafer|লোফার/i.test(rawText)) subcategory = 'Loafers';
    else if (/running|স্পোর্টস/i.test(rawText)) subcategory = 'Sports / Running';
  } else if (category === 'T-Shirts') {
    if (/ড্রপ\s*শোল্ডার|drop\s*shoulder/i.test(rawText)) subcategory = 'Drop Shoulder';
    else if (/পোলো|polo/i.test(rawText)) subcategory = 'Polo';
    else if (/crew\s*neck|গোল\s*গলা/i.test(rawText)) subcategory = 'Crew Neck';
  }

  // 8. CATEGORY-AWARE TRUTHFUL BENGALI DESCRIPTION
  let finalDescription = '';
  const isToyOrCar = /car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|vehicle|truck|jeep|hotwheels|diecast|lego|doll|পুতুল|drone/i.test(title + ' ' + rawText) || category === 'Toys & Games';
  const isShoe = /shoe|shoes|sneaker|sneakers|জুতা|জুতো|লোফার|loafer|boots/i.test(title + ' ' + rawText) || category === 'Shoes';
  const isWatch = /watch|ঘড়ি|ঘড়ি|smartwatch/i.test(title + ' ' + rawText) || category === 'Watches';
  const isPerfume = /perfume|আতর|attar|সুগন্ধি|fragrance/i.test(title + ' ' + rawText) || category === 'Perfume & Fragrance';
  const isFoodDrink = /food|juice|drink|চা|কফি|জুস|মধু|honey/i.test(title + ' ' + rawText) || category === 'Food' || category === 'Beverages';

  if (isToyOrCar) {
    finalDescription = `${title} — আকর্ষণীয় ও টেকসই খেলনা গাড়ি। শক্ত বডিতে নিখুঁত ফিনিশিংয়ে তৈরি, যা শিশুদের খেলার জন্য সম্পূর্ণ নিরাপদ ও দীর্ঘস্থায়ী। মসৃণ চাকা ও মজবুত ডিজাইন। উপহার বা কালেকশনের জন্য দারুণ পছন্দ।`;
    if (!unit || unit === 'জোড়া (Pair)') unit = 'পিস (Piece)';
    sizes = [];
  } else if (isShoe) {
    finalDescription = `${title} — প্রিমিয়াম কোয়ালিটি ক্যাজুয়াল স্নিকার্স। উন্নত সোল ও আরামদায়ক ইনসোলসহ দীর্ঘ সময় ব্যবহারের উপযোগী।`;
    if (!unit) unit = 'জোড়া (Pair)';
  } else if (isWatch) {
    finalDescription = `${title} — আধুনিক ডিজাইন ও টেকসই পারফরম্যান্স। আকর্ষণীয় ডায়াল ও প্রিমিয়াম ফিনিশিং।`;
    if (!unit) unit = 'পিস (Piece)';
    sizes = [];
  } else if (isPerfume) {
    finalDescription = `${title} — দীর্ঘস্থায়ী মন মাতানো সুবাস ও প্রিমিয়াম ফ্র্যাগ্রেন্স। অ্যালকোহল মুক্ত ও ফ্রেশ অনুভূতি।`;
    if (!unit) unit = 'বোতল (Bottle)';
    sizes = [];
  } else if (isFoodDrink) {
    finalDescription = `${title} — খাঁটি ও স্বাস্থ্যসম্মত উপাদানে তৈরি ফ্রেশ কোয়ালিটি পণ্য।`;
    sizes = [];
  } else {
    finalDescription = `${title} — প্রিমিয়াম কোয়ালিটি ও আকর্ষণীয় ডিজাইনে তৈরি পণ্য। আরামদায়ক ফিটিং ও টেকসই নিখুঁত ফিনিশিং। দৈনন্দিন ব্যবহার ও ক্যাজুয়াল আউটিংয়ের জন্য সেরা পছন্দ।`;
  }

  return {
    name: title,
    nameFromParentheses,
    description: finalDescription,
    price,
    salePrice,
    discountPercent,
    stock,
    sizes,
    category,
    subcategory,
    brand,
    model,
    warranty,
    unit,
    dimensions,
    isNewCategory,
    newCategoryName: isNewCategory ? newCategoryName : undefined,
    image: draft?.image,
    color: color || draft?.color,
    fabric: isCotton ? '100% Combed Cotton' : draft?.fabric
  };
}

export const AdminAICopilotModal: React.FC<AdminAICopilotModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  initialTopic
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'আসসালামু আলাইকুম এডমিন! 👋 আমি আপনার সাইটের **AI Product Adder (প্রোডাক্ট যোগ করার AI)**।\n\nআপনি আমাকে পণ্যের ছবি এবং বিবরণ দিলে (বিবরণের ভেতর **()** ব্র্যাকেটে পণ্যের নাম দিলে সেটিই সরাসরি টাইটেল হবে) আমি:\n১. আপনার দেওয়া **()** ব্র্যাকেটের নাম বা স্মার্ট টাইটেল সেট করব।\n২. **Model No., Warranty Info, Unit Type, Dimensions / Size, Brand / Manufacturer, Subcategory** পূরণ করব।\n৩. সরাসরি ওয়েবসাইটে প্রোডাক্টটি লাইভ যোগ করে দেব।\n\n*(স্টকের হিসাব ও কাস্টমার ডিমান্ড জানতে ওপরের **Stock & Demand AI** বাটনে ক্লিক করুন।)*',
      timestamp: new Date()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Image upload and pending product draft state
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingProductDraft | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialTopic) {
      setMessages((prev) => [
        ...prev,
        {
          id: `topic_${Date.now()}`,
          role: 'ai',
          text: `🆕 কাস্টমার ডিমান্ড অনুযায়ী নতুন প্রোডাক্ট যোগ করতে চাচ্ছেন: **${initialTopic}**\n\nনিচের ক্যামেরা আইকন থেকে প্রোডাক্টের ছবি দিন এবং **()** ব্র্যাকেটে প্রোডাক্টের নামসহ বিবরণ, দাম ও স্টক লিখে পাঠান — আমি সাথে সাথে ড্রাফট তৈরি করে দেব!`,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, initialTopic]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleProcessImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await compressImageFile(file);
      setAttachedImage(dataUrl);
      setAttachedImageName(file.name);
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImageFile(file);
    }
    e.target.value = '';
  };

  const saveDraftToCatalog = async (draftToSave: PendingProductDraft) => {
    setIsLoading(true);
    try {
      const isCarOrToy = /car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|vehicle|diecast/i.test((draftToSave.name || '') + ' ' + (draftToSave.category || ''));
      const isClothing = ['T-Shirts', 'Shirts', 'Hoodies', 'Panjabi', 'Pants', 'Men', 'Women'].includes(draftToSave.category || '');
      const finalCategory = draftToSave.category || (isCarOrToy ? 'Toys & Games' : 'General');
      const finalSizes =
        draftToSave.sizes && draftToSave.sizes.length > 0
          ? draftToSave.sizes
          : (isClothing && !isCarOrToy ? ['M', 'L', 'XL'] : []);
      const finalPrice = draftToSave.price || 950;
      const finalStock = draftToSave.stock || 10;
      const finalName = draftToSave.name || 'Premium Product';
      const finalImage =
        draftToSave.image ||
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80';
      const defaultDesc = isCarOrToy
        ? `${finalName} — আকর্ষণীয় ও টেকসই খেলনা গাড়ি। শক্ত বডিতে নিখুঁত ফিনিশিংয়ে তৈরি, যা শিশুদের খেলার জন্য সম্পূর্ণ নিরাপদ ও মজবুত।`
        : isClothing
        ? `${finalName} — ১০০% প্রিমিয়াম কোয়ালিটি পণ্য। আকর্ষণীয় ডিজাইন ও আরামদায়ক ফিটিং।`
        : `${finalName} — ১০০% প্রিমিয়াম কোয়ালিটি ও আকর্ষণীয় ডিজাইনে তৈরি পণ্য। নিখুঁত ফিনিশিং ও টেকসই ব্যবহার।`;
      const finalDescription = draftToSave.description || defaultDesc;

      const sku = `AESTH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const slug =
        finalName
          .toLowerCase()
          .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
          .replace(/(^-|-$)/g, '') || `product-${Date.now()}`;

      const variants = finalSizes.map((sz) => ({
        id: `var_${Date.now()}_${sz}`,
        sku: `${sku}-${sz}`,
        size: sz,
        stock: Math.floor(finalStock / finalSizes.length) || 1
      }));

      const newProductData: Partial<Product> = {
        name: finalName,
        slug,
        sku,
        description: finalDescription,
        shortDescription: `${finalName} - প্রিমিয়াম কোয়ালিটি`,
        category: finalCategory,
        categorySlug: finalCategory.toLowerCase().replace(/\s+/g, '-'),
        subcategory: draftToSave.subcategory || undefined,
        brand: draftToSave.brand || undefined,
        model: draftToSave.model || undefined,
        warranty: draftToSave.warranty || undefined,
        dimensions: draftToSave.dimensions || undefined,
        unit: draftToSave.unit || (finalCategory === 'Shoes' ? 'জোড়া (Pair)' : 'পিস (Piece)'),
        price: finalPrice,
        salePrice: draftToSave.salePrice || finalPrice,
        discountPercent: draftToSave.discountPercent,
        totalStock: finalStock,
        sizes: finalSizes,
        colors: [],
        variants,
        images: [finalImage],
        thumbnail: finalImage,
        active: true,
        featured: false,
        newArrival: true,
        bestSeller: false,
        tags: [finalCategory, draftToSave.subcategory, draftToSave.brand, 'New Arrival', 'Admin AI'].filter(Boolean) as string[]
      };

      const createdId = await saveProduct(newProductData);
      setPendingDraft(null);

      const newCatNotice = draftToSave.newCategoryName
        ? `✨ **নতুন ক্যাটাগরি তৈরি করা হয়েছে:** "${draftToSave.newCategoryName}"\n\n`
        : '';

      const confirmationMsg: CopilotMessage = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        text: `✅ **বিবরণ ও স্পেসিফিকেশন অনুযায়ী প্রোডাক্টটি সফলভাবে ওয়েবসাইটে যুক্ত করা হয়েছে!**\n\n${newCatNotice}• 📌 **টাইটেল (Title):** ${finalName}${draftToSave.nameFromParentheses ? ' *(ব্র্যাকেট `()` অনুযায়ী)*' : ''}\n• 🏢 **ব্র্যান্ড (Brand):** ${draftToSave.brand || 'AESTHETX'}\n• 🏷️ **Model No.:** ${draftToSave.model || 'N/A'}\n• 🛡️ **Warranty Info:** ${draftToSave.warranty || 'প্রযোজ্য নয়'}\n• 📦 **Unit Type:** ${draftToSave.unit || (finalCategory === 'Shoes' ? 'জোড়া' : 'পিস')}\n• 📐 **Dimensions / Size:** ${draftToSave.dimensions || finalSizes.join(', ')}\n• 📂 **Subcategory:** ${draftToSave.subcategory || 'General'}\n• 💰 **মূল্য:** ৳${finalPrice.toLocaleString()}${draftToSave.discountPercent ? ` (${draftToSave.discountPercent}% ছাড়ে)` : ''}\n• 📦 **স্টক:** ${finalStock} টি\n• 🏷️ **ক্যাটাগরি:** ${finalCategory}\n\nপণ্যটি এখন স্টোরের লাইভ ক্যাটালগে দৃশ্যমান।`,
        addedProduct: {
          id: createdId,
          name: finalName,
          description: finalDescription,
          price: finalPrice,
          sizes: finalSizes,
          totalStock: finalStock,
          thumbnail: finalImage,
          category: finalCategory,
          subcategory: draftToSave.subcategory,
          brand: draftToSave.brand,
          model: draftToSave.model,
          warranty: draftToSave.warranty,
          dimensions: draftToSave.dimensions,
          unit: draftToSave.unit
        },
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, confirmationMsg]);
    } catch (err) {
      console.error('Error saving product from draft:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendQuery = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputQuery).trim();
    const currentAttachedImage = attachedImage;

    if ((!textToSend && !currentAttachedImage) || isLoading) return;

    setInputQuery('');
    setAttachedImage(null);
    setAttachedImageName(null);

    const userMsg: CopilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'admin',
      text: textToSend || (currentAttachedImage ? 'প্রোডাক্টের ছবি সংযুক্ত করা হয়েছে।' : ''),
      image: currentAttachedImage || undefined,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Check if user is asking an inventory/demand query first
      const isStoreQuery = /(?:স্টকের\s*অবস্থা|সব\s*(?:স্টকের|স্টক)|স্টক\s*লিস্ট|কোন\s*স্টক\s*লাগবে|রিস্টক|কম\s*স্টক|নতুন\s*কি\s*(?:কোনো|কোন)?\s*প্র[োড]ডাক্ট\s*আনা\s*লাগবে|নতুন\s*কি\s*আনা\s*লাগবে|ক্রেতারা\s*কি\s*ডিমান্ড)/i.test(
        textToSend
      );

      // Check if user is confirming to add current draft
      const isConfirmAddDraft =
        Boolean(pendingDraft) &&
        /(?:যোগ\s*(?:করে\s*দাও|কর|করুন|করো|দাও)|এড\s*(?:করে\s*দাও|কর|করুন|করো|দাও)|সব\s*ঠিক\s*আছে|সরাসরি\s*যোগ|লাইভ\s*(?:করে\s*দাও|কর)|যুক্ত\s*(?:করে\s*দাও|কর)|হবে|save|add|yes|confirm|ok|okay)/i.test(
          textToSend
        );

      if (isConfirmAddDraft && pendingDraft) {
        await saveDraftToCatalog(pendingDraft);
        return;
      }

      // Check if user is adding a product, supplying parentheses title, or providing product description/details
      const isAddCommand =
        !isStoreQuery &&
        (Boolean(currentAttachedImage) ||
          Boolean(pendingDraft) ||
          /(?:\(([^)]+)\)|（([^）]+)）)/.test(textToSend) ||
          /(?:model|warranty|unit|dimension|brand|মডেল|ওয়ারেন্টি|ওয়ারেন্টি|ইউনিট|ডাইমেনশন|ব্র্যান্ড|ব্রান্ড|প্রস্তুতকারক|সাব-?ক্যাটাগরি|সাবকেটাগরি)/i.test(textToSend) ||
          /(যোগ\s*(?:কর|করে|করুন|করো)|এড\s*(?:কর|করে|করুন|করো)|যুক্ত\s*(?:কর|করে|করুন|করো)|তুলে\s*দাও|তোল|add\s*product|নতুন\s*প্রোডাক্ট|create\s*product|লিস্ট\s*(?:কর|করে|করুন|করো)|প্রোডাক্ট(টি)?\s*যোগ|পণ্য(টি)?\s*যোগ|বিবরণ|ডেসক্রিপশন|description|fabric|সুতি|কটন|দাম|মূল্য|price|স্টক|stock|সাইজ|size|shoge|shoe|জুতা|স্নিকার্স|টিশার্ট|শার্ট|পোডাক্ট|প্রোডাক্ট)/i.test(
            textToSend
          ));

      if (isAddCommand) {
        // Check for parentheses title in user input
        const parenMatchInInput = textToSend.match(/(?:\(([^)]+)\)|（([^）]+)）)/);
        const extractedParenTitle = parenMatchInInput ? (parenMatchInInput[1] || parenMatchInInput[2]).trim() : '';

        // Load existing store categories
        const storeCategories = await getCategories(false);
        const existingCategoryNames = storeCategories.map((c) => c.name);

        // Step 1: Use Gemini AI to comprehend the product description (with local heuristic fallback)
        let understoodData: any = null;

        try {
          const controller = new AbortController();
          const parseTimeout = setTimeout(() => controller.abort(), 12000);

          const aiParseRes = await fetch('/api/ai/parse-product-from-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              text: textToSend,
              image: currentAttachedImage || pendingDraft?.image || null,
              existingDraft: pendingDraft || {},
              existingCategories: existingCategoryNames
            })
          });
          clearTimeout(parseTimeout);

          if (aiParseRes.ok) {
            const parsedJson = await aiParseRes.json();
            if (parsedJson && parsedJson.data) {
              understoodData = parsedJson.data;
            }
          }
        } catch (apiErr) {
          console.warn('AI description parser network call note:', apiErr);
        }

        // Local fallback if server call wasn't available
        if (!understoodData) {
          understoodData = localComprehendProductText(textToSend, pendingDraft, existingCategoryNames);
        }

        // Detect or auto-create new category if not already present in the store
        let newlyCreatedCategoryName: string | null = null;
        const targetCategoryName = understoodData.newCategoryName || understoodData.category || 'Men';

        if (targetCategoryName && targetCategoryName !== 'Men') {
          const alreadyExists = storeCategories.some(
            (c) => c.name.toLowerCase().trim() === targetCategoryName.toLowerCase().trim()
          );
          if (!alreadyExists) {
            try {
              await saveCategory({
                name: targetCategoryName,
                slug: generateCategorySlug(targetCategoryName),
                description: `Admin AI Co-Pilot auto-created category for ${understoodData.name || 'products'}`,
                active: true
              });
              newlyCreatedCategoryName = targetCategoryName;
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('aesthetx-categories-updated'));
              }
            } catch (catErr) {
              console.warn('Auto category creation error:', catErr);
            }
          }
        }

        // Resolve title with strict priority to parentheses
        const titleFromInput = extractedParenTitle || (parenMatchInInput ? extractedParenTitle : '');
        const finalDraftName = titleFromInput || understoodData.name || pendingDraft?.name;
        const nameFromParentheses = Boolean(titleFromInput || understoodData.nameFromParentheses || pendingDraft?.nameFromParentheses);

        // Merge understood data into draft
        const mergedDraft: PendingProductDraft = {
          image: currentAttachedImage || pendingDraft?.image || undefined,
          name: finalDraftName,
          nameFromParentheses,
          description: understoodData.description || pendingDraft?.description,
          price: understoodData.price !== undefined && understoodData.price !== null ? understoodData.price : pendingDraft?.price,
          salePrice: understoodData.salePrice !== undefined && understoodData.salePrice !== null ? understoodData.salePrice : pendingDraft?.salePrice,
          discountPercent: understoodData.discountPercent !== undefined ? understoodData.discountPercent : pendingDraft?.discountPercent,
          stock: (understoodData.totalStock !== undefined && understoodData.totalStock !== null)
            ? understoodData.totalStock
            : (understoodData.stock !== undefined ? understoodData.stock : pendingDraft?.stock),
          sizes: (understoodData.sizes && understoodData.sizes.length > 0) ? understoodData.sizes : pendingDraft?.sizes,
          category: targetCategoryName,
          subcategory: understoodData.subcategory || pendingDraft?.subcategory,
          brand: understoodData.brand || pendingDraft?.brand,
          model: understoodData.model || pendingDraft?.model,
          warranty: understoodData.warranty || pendingDraft?.warranty,
          dimensions: understoodData.dimensions || pendingDraft?.dimensions,
          unit: understoodData.unit || pendingDraft?.unit,
          isNewCategory: Boolean(newlyCreatedCategoryName),
          newCategoryName: newlyCreatedCategoryName || undefined,
          color: understoodData.color || pendingDraft?.color,
          fabric: understoodData.fabric || pendingDraft?.fabric
        };

        // Enforce strict title length max 5 words ONLY IF NOT provided inside parentheses
        if (mergedDraft.name && !mergedDraft.nameFromParentheses) {
          let words = mergedDraft.name.trim().split(/\s+/).filter(Boolean);
          if (words.length > 5) {
            mergedDraft.name = words.slice(0, 4).join(' ');
          }
        }

        // Determine critical missing fields vs structured 6 fields
        const missingCore: string[] = [];
        if (!mergedDraft.image) {
          missingCore.push('📸 প্রোডাক্টের ছবি (নিচের ক্যামেরা/ছবি আইকনে ক্লিক করে আপলোড করুন)');
        }
        if (!mergedDraft.price || mergedDraft.price <= 0) {
          if (mergedDraft.discountPercent) {
            missingCore.push(`💰 বিক্রয় মূল্য (Price, যেমন: ৯০০ টাকা — আপনার উল্লেখিত ${mergedDraft.discountPercent}% ছাড় হিসেব করা হবে)`);
          } else {
            missingCore.push('💰 বিক্রয় মূল্য (Price, যেমন: ৮৫০ টাকা)');
          }
        }
        if (!mergedDraft.stock || mergedDraft.stock <= 0) {
          missingCore.push('📦 স্টক সংখ্যা (Stock Count, যেমন: ২০ টি)');
        }

        // Six structured fields requested by the user:
        // 1. Model No., 2. Warranty Info, 3. Unit Type, 4. Dimensions / Size, 5. Brand / Manufacturer, 6. Subcategory (Optional)
        const sixFieldsStatus = [
          `• 🏷️ **Model No. (মডেল নম্বর):** ${mergedDraft.model ? `\`${mergedDraft.model}\` ✅` : '⚠️ উল্লেখ করুন (যেমন: `FS-2024` বা `N/A`)' }`,
          `• 🛡️ **Warranty Info (ওয়ারেন্টি তথ্য):** ${mergedDraft.warranty ? `\`${mergedDraft.warranty}\` ✅` : '⚠️ উল্লেখ করুন (যেমন: `৬ মাস`, `১ বছর` বা `ওয়ারেন্টি নেই`)' }`,
          `• 📦 **Unit Type (ইউনিট টাইপ):** ${mergedDraft.unit ? `\`${mergedDraft.unit}\` ✅` : '⚠️ উল্লেখ করুন (যেমন: `জোড়া`, `পিস`, `সেট`)' }`,
          `• 📐 **Dimensions / Size (ডাইমেনশন বা সাইজ):** ${mergedDraft.dimensions || (mergedDraft.sizes && mergedDraft.sizes.length > 0) ? `\`${mergedDraft.dimensions || mergedDraft.sizes?.join(', ')}\` ✅` : '⚠️ উল্লেখ করুন (যেমন: `৪০-৪৩` বা `১০x৮ ইঞ্চি`)' }`,
          `• 🏢 **Brand / Manufacturer (ব্র্যান্ড বা প্রস্তুতকারক):** ${mergedDraft.brand ? `\`${mergedDraft.brand}\` ✅` : '⚠️ উল্লেখ করুন (যেমন: `Fogo`, `AESTHETX`)' }`,
          `• 📂 **Subcategory (সাব-ক্যাটাগরি - ঐচ্ছিক):** ${mergedDraft.subcategory ? `\`${mergedDraft.subcategory}\` ✅` : 'ঐচ্ছিক (যেমন: `Sneakers`, `Drop Shoulder`)' }`
        ];

        // If core info or specifications are pending, ask the admin to provide them or confirm
        setPendingDraft(mergedDraft);

        let newCatHeader = '';
        if (newlyCreatedCategoryName) {
          newCatHeader = `✨ **নতুন ক্যাটাগরি তৈরি করা হয়েছে:** "${newlyCreatedCategoryName}"\nপণ্যটির ধরন অনুযায়ী স্টোরে উপযুক্ত ক্যাটাগরি না থাকায় স্বয়ংক্রিয়ভাবে নতুন **"${newlyCreatedCategoryName}"** ক্যাটাগরি তৈরি করা হয়েছে এবং পণ্যটি এতে অন্তর্ভুক্ত করা হয়েছে।\n\n`;
        }

        const titleDisplay = mergedDraft.nameFromParentheses
          ? `📌 **প্রোডাক্টের নাম (Title):** ${mergedDraft.name} *(ব্র্যাকেটের \`()\` নাম নিখুঁতভাবে গ্রহণ করা হয়েছে)*`
          : `📌 **প্রস্তাবিত টাইটেল:** ${mergedDraft.name}`;

        let promptReply =
          newCatHeader +
          `আমি আপনার দেওয়া বিবরণ বিশ্লেষণ করে ড্রাফট সাজিয়েছি:\n\n` +
          `${titleDisplay}\n` +
          `• 📝 **সংক্ষিপ্ত বিবরণ:** ${mergedDraft.description?.slice(0, 110)}...\n` +
          `• 💰 **মূল্য:** ${mergedDraft.price ? `৳${mergedDraft.price}` : '⚠️ উল্লেখ করুন'}\n` +
          `• 📦 **স্টক:** ${mergedDraft.stock ? `${mergedDraft.stock} টি` : '⚠️ উল্লেখ করুন'}\n` +
          `• 🏷️ **ক্যাটাগরি:** ${mergedDraft.category}\n` +
          `• 🖼️ **ছবি:** ${mergedDraft.image ? 'সংযুক্ত রয়েছে ✅' : '⚠️ ছবি প্রয়োজন'}\n\n` +
          `📋 **৬টি বিশেষ স্পেসিফিকেশন ফিল্ডের অবস্থা:**\n` +
          sixFieldsStatus.join('\n');

        if (missingCore.length > 0) {
          promptReply +=
            `\n\n⚠️ **প্রোডাক্টটি ওয়েবসাইটে লাইভ করার জন্য প্রয়োজনীয় তথ্য:**\n` +
            missingCore.map((f, i) => `${i + 1}. **${f}**`).join('\n');
        }

        promptReply +=
          `\n\n👉 **অনুপস্থিত যেকোনো তথ্য আপনি চ্যাটে সংক্ষেপে লিখে দিন** (যেমন: *"মডেল FS-100, ব্র্যান্ড Fogo, ওয়ারেন্টি ৬ মাস, ইউনিট জোড়া"*), অথবা **নিচের এডিট বক্সে সরাসরি পূরণ করে 'ওয়েবসাইটে যোগ করুন' চাপুন!**`;

        const aiMsg: CopilotMessage = {
          id: `ai_${Date.now()}`,
          role: 'ai',
          text: promptReply,
          timestamp: new Date()
        };

        setMessages((prev) => [...prev, aiMsg]);
        setIsLoading(false);
        return;
      }

      // Collect live store context
      const orders = getLocalOrdersCache();
      const products = getLocalProductsCache();
      const convs = getLocalSupportConversations();
      const supportMsgs = getLocalSupportMessages();
      const categoryNames = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

      const statusCounts = orders.reduce((acc, o) => {
        acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalRev = orders
        .filter((o) => o.paymentStatus === 'Paid' || o.orderStatus === 'Delivered')
        .reduce((sum, o) => sum + (o.total || 0), 0);

      const lowStock = products
        .filter((p) => p.totalStock !== undefined && p.totalStock <= 5)
        .map((p) => ({
          name: p.name,
          stock: p.totalStock,
          price: p.price,
          category: p.category || 'General'
        }));

      const allProductsInventory = products.map((p) => {
        const sizesStr = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes.join(', ') : '';
        const variantsStr =
          Array.isArray(p.variants) && p.variants.length > 0
            ? p.variants.map((v) => `${v.size || v.name || ''}: ${v.stock ?? 0}টি`).filter(Boolean).join(', ')
            : '';
        return {
          id: p.id,
          name: p.name,
          category: p.category || 'General',
          price: p.salePrice || p.price || 0,
          stock: p.totalStock ?? 0,
          sizes: sizesStr,
          variantsSummary: variantsStr,
          isLowStock: (p.totalStock ?? 0) <= 5
        };
      });

      const customerQueries = supportMsgs
        .filter((m) => m.sender === 'customer' && m.text && m.text.trim())
        .map((m) => m.text.trim());
      const convQueries = convs
        .map((c) => c.lastMessage)
        .filter((m) => Boolean(m) && m !== 'Conversation started');
      const customerDemands = Array.from(new Set([...customerQueries, ...convQueries])).slice(0, 30);

      const storeContext = {
        totalOrders: orders.length,
        totalRevenue: totalRev,
        orderStatusCounts: statusCounts,
        lowStockProducts: lowStock,
        topSellingCategories: categoryNames,
        recentCustomerQueries: convs.slice(0, 6).map((c) => c.lastMessage),
        allProductsInventory,
        recentProducts: allProductsInventory.slice(0, 25),
        customerDemands
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('/api/ai/admin-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: textToSend,
          storeContext,
          conversationHistory: messages.slice(-4).map((m) => ({
            role: m.role,
            text: m.text
          }))
        })
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      const aiReplyText =
        data.success && data.text
          ? data.text
          : data.message ||
            'আমি আপনার অনুরোধটি গ্রহণ করেছি। আর কিছু জানতে চান বা কোনো নির্দেশ আছে?';

      const aiMsg: CopilotMessage = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        text: aiReplyText,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Co-pilot error:', err);
      const fallbackMsg: CopilotMessage = {
        id: `err_${Date.now()}`,
        role: 'ai',
        text: 'সার্ভার যোগাযোগে সাময়িক সমস্যা হয়েছে। আপনি কি আবার চেষ্টা করবেন?',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[85vh] max-h-[720px] shadow-2xl flex flex-col border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#162B23] text-white flex items-center justify-between gap-2 shrink-0 border-b border-[#2D5042]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1E3A2F] border border-[#8FA89B]/40 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-[#8FA89B]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white truncate">AI Product Adder</h3>
                <span className="text-[11px] font-bold text-[#8FA89B] whitespace-nowrap">
                  · প্রোডাক্ট যোগ AI
                </span>
              </div>
              <p className="text-[11px] text-[#8FA89B] truncate">
                ছবি, () এর মধ্যে নাম ও বিবরণ দিয়ে সরাসরি সাইটে প্রোডাক্ট যোগ করুন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateTab('stock-demand-ai');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1E3A2F] hover:bg-[#2D5042] text-white border border-[#8FA89B]/40 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="স্টকের হিসাব ও কাস্টমার ডিমান্ড AI-তে যান"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#8FA89B]" />
                <span>Stock & Demand AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-300 hover:text-white hover:bg-[#1E3A2F] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#FAF8F5]">
          {messages.map((m) => {
            const isUser = m.role === 'admin';

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                    isUser ? 'bg-stone-800 text-white' : 'bg-[#1E3A2F] text-emerald-400'
                  }`}
                >
                  {isUser ? 'Admin' : <Sparkles className="w-4 h-4" />}
                </div>

                <div className="space-y-2 max-w-[85%]">
                  {/* Attached user image preview */}
                  {m.image && (
                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-900 shadow-sm">
                      <img
                        src={m.image}
                        alt="Attached by admin"
                        className="max-h-48 w-full object-cover rounded-2xl"
                      />
                    </div>
                  )}

                  {/* Message bubble */}
                  {m.text && (
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-stone-900 text-white rounded-tr-xs'
                          : 'bg-white border border-stone-200 text-stone-900 rounded-tl-xs whitespace-pre-line'
                      }`}
                    >
                      {m.text}
                    </div>
                  )}

                  {/* AI Added Product Preview Card */}
                  {m.addedProduct && (
                    <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 rounded-2xl shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                          <CheckCircle2 className="w-3 h-3" /> লাইভ ওয়েবসাইটে যুক্ত
                        </span>
                        <span className="text-[11px] font-bold text-stone-500">
                          {m.addedProduct.category}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        {m.addedProduct.thumbnail && (
                          <img
                            src={m.addedProduct.thumbnail}
                            alt={m.addedProduct.name}
                            className="w-14 h-14 rounded-xl object-cover border border-emerald-300 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-stone-900 text-xs truncate">
                            {m.addedProduct.name}
                          </h4>
                          <p className="text-emerald-800 font-black text-sm mt-0.5">
                            ৳{m.addedProduct.price.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-600">
                            <span>স্টক: <b>{m.addedProduct.totalStock} টি</b></span>
                            <span>•</span>
                            <span>সাইজ: {m.addedProduct.sizes.join(', ')}</span>
                          </div>
                        </div>
                      </div>

                      {m.addedProduct.description && (
                        <div className="p-2 bg-white/80 rounded-xl border border-emerald-100 text-[11px] text-stone-600 line-clamp-2">
                          {m.addedProduct.description}
                        </div>
                      )}

                      {/* 6 Structured Attributes */}
                      <div className="grid grid-cols-2 gap-1.5 p-2 bg-white/90 rounded-xl border border-emerald-200/70 text-[10px] text-stone-700">
                        <div>🏷️ Model: <b>{m.addedProduct.model || 'N/A'}</b></div>
                        <div>🏢 Brand: <b>{m.addedProduct.brand || 'AESTHETX'}</b></div>
                        <div>🛡️ Warranty: <b>{m.addedProduct.warranty || 'প্রযোজ্য নয়'}</b></div>
                        <div>📦 Unit: <b>{m.addedProduct.unit || 'পিস'}</b></div>
                        {m.addedProduct.dimensions && <div>📐 Size/Dim: <b>{m.addedProduct.dimensions}</b></div>}
                        {m.addedProduct.subcategory && <div>📂 Subcategory: <b>{m.addedProduct.subcategory}</b></div>}
                      </div>

                      {onNavigateTab && (
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateTab('products');
                          }}
                          className="w-full mt-1 py-1.5 px-3 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>প্রোডাক্ট ম্যানেজমেন্টে দেখুন</span>
                          <ArrowRight className="w-3 h-3 ml-auto" />
                        </button>
                      )}
                    </div>
                  )}

                  {!isUser && (
                    <div className="flex items-center gap-2 px-1">
                      <button
                        onClick={() => handleCopy(m.text, m.id)}
                        className="inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-800 font-bold transition-colors cursor-pointer"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Text</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[80%] items-center animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-[#1E3A2F] text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 bg-white border border-stone-200 rounded-2xl rounded-tl-xs text-xs text-stone-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#1E3A2F]" />
                <span>AI বিবরণ বিশ্লেষণ করে তথ্য প্রসেস করছে...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Product-Adding Actions */}
        <div className="p-2.5 bg-stone-100 border-t border-stone-200 shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-stone-400 uppercase shrink-0 pl-1">
            প্রোডাক্ট যোগ:
          </span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-bold text-emerald-800 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
          >
            <ImageIcon className="w-3 h-3 text-emerald-600" />
            <span>ছবি আপলোড করুন</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setInputQuery(
                '(প্রিমিয়াম কটন ড্রপ শোল্ডার টি-শার্ট) ১০০% কম্বড কটন, কালার কালো, সাইজ M, L, XL, দাম ৮৫০ টাকা, স্টক ২৫ টি'
              )
            }
            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-semibold text-stone-700 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
          >
            <FileText className="w-3 h-3 text-emerald-600" />
            <span>নমুনা: টি-শার্ট ড্রাফট</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setInputQuery(
                '(Fogo Casual Sneakers) আরামদায়ক ক্যাজুয়াল স্নিকার্স জুতা, সাইজ ৪০, ৪১, ৪২, ৪৩, দাম ২২০০ টাকা, স্টক ১৫ জোড়া'
              )
            }
            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-semibold text-stone-700 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
          >
            <ShoppingBag className="w-3 h-3 text-amber-600" />
            <span>নমুনা: জুতা ড্রাফট</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('stock-demand-ai');
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-semibold text-[#1E3A2F] whitespace-nowrap cursor-pointer transition-colors shadow-2xs ml-auto"
            >
              <TrendingUp className="w-3 h-3 text-[#1E3A2F]" />
              <span>স্টক ও কাস্টমার ডিমান্ড AI ↗</span>
            </button>
          )}
        </div>

        {/* Input Bar with Attachment Preview */}
        <div className="p-3 sm:p-4 bg-white border-t border-stone-200 shrink-0">
          {/* Interactive Product Draft & 6 Fields Editor Panel */}
          {pendingDraft && (
            <div className="p-3 bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border border-emerald-300/80 rounded-2xl mb-3 shadow-sm space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-black text-xs text-emerald-950 truncate">
                    প্রোডাক্ট ড্রাফট ও স্পেসিফিকেশন
                  </span>
                  {pendingDraft.nameFromParentheses && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shrink-0">
                      ব্র্যাকেটের () নাম
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-emerald-800 rounded-md border border-emerald-200">
                    {pendingDraft.category || 'General'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingDraft(null)}
                    className="p-1 text-stone-400 hover:text-stone-700 hover:bg-emerald-100/80 rounded-lg transition-colors cursor-pointer"
                    title="ড্রাফট বাতিল করুন"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                  <span>📌 প্রোডাক্টের নাম (Title):</span>
                  {pendingDraft.nameFromParentheses && (
                    <span className="text-emerald-700 font-normal text-[9px]">
                      (আপনার দেওয়া ব্র্যাকেটের () টেক্সট)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={pendingDraft.name || ''}
                  onChange={(e) =>
                    setPendingDraft((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  placeholder="প্রোডাক্টের নাম লিখুন..."
                  className="w-full text-xs p-2 rounded-xl border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 font-semibold"
                />
              </div>

              {/* 6 Core Fields Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {/* 1. Model No. */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-emerald-600" />
                    <span>Model No.</span>
                  </label>
                  <input
                    type="text"
                    value={pendingDraft.model || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) => (prev ? { ...prev, model: e.target.value } : null))
                    }
                    placeholder="যেমন: FS-2024"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* 2. Brand / Manufacturer */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    <span>Brand</span>
                  </label>
                  <input
                    type="text"
                    value={pendingDraft.brand || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) => (prev ? { ...prev, brand: e.target.value } : null))
                    }
                    placeholder="যেমন: Fogo / AESTHETX"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* 3. Warranty Info */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Warranty</span>
                  </label>
                  <input
                    type="text"
                    value={pendingDraft.warranty || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) => (prev ? { ...prev, warranty: e.target.value } : null))
                    }
                    placeholder="যেমন: ৬ মাস / কোনো ওয়ারেন্টি নেই"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* 4. Unit Type */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-600" />
                    <span>Unit Type</span>
                  </label>
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={pendingDraft.unit || ''}
                      onChange={(e) =>
                        setPendingDraft((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                      }
                      placeholder="জোড়া / পিস"
                      className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    {['জোড়া', 'পিস', 'সেট', 'বক্স'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() =>
                          setPendingDraft((prev) => (prev ? { ...prev, unit: u } : null))
                        }
                        className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          pendingDraft.unit === u
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-white hover:bg-emerald-100 text-stone-600 border border-emerald-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Dimensions / Size */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-emerald-600" />
                    <span>Dimensions / Size</span>
                  </label>
                  <input
                    type="text"
                    value={pendingDraft.dimensions || (pendingDraft.sizes ? pendingDraft.sizes.join(', ') : '')}
                    onChange={(e) =>
                      setPendingDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              dimensions: e.target.value,
                              sizes: e.target.value.split(/[,/]+/).map((s) => s.trim()).filter(Boolean)
                            }
                          : null
                      )
                    }
                    placeholder="যেমন: ৪০-৪৩ বা মাপ"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* 6. Subcategory (Optional) */}
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600 flex items-center gap-1">
                    <FolderTree className="w-3 h-3 text-emerald-600" />
                    <span>Subcategory (ঐচ্ছিক)</span>
                  </label>
                  <input
                    type="text"
                    value={pendingDraft.subcategory || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) => (prev ? { ...prev, subcategory: e.target.value } : null))
                    }
                    placeholder="যেমন: Sneakers / Polo"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Price and Stock row */}
              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/70">
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600">💰 মূল্য (Price ৳):</label>
                  <input
                    type="number"
                    value={pendingDraft.price || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) =>
                        prev ? { ...prev, price: parseInt(e.target.value, 10) || undefined } : null
                      )
                    }
                    placeholder="যেমন: ৯৫০"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 font-bold"
                  />
                </div>

                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] font-bold text-stone-600">📦 স্টক সংখ্যা:</label>
                  <input
                    type="number"
                    value={pendingDraft.stock || ''}
                    onChange={(e) =>
                      setPendingDraft((prev) =>
                        prev ? { ...prev, stock: parseInt(e.target.value, 10) || undefined } : null
                      )
                    }
                    placeholder="যেমন: ২০"
                    className="w-full text-[11px] p-1.5 rounded-lg border border-emerald-200 bg-white text-stone-900 font-bold"
                  />
                </div>

                <div className="shrink-0 self-end">
                  <button
                    type="button"
                    onClick={() => saveDraftToCatalog(pendingDraft)}
                    disabled={isLoading}
                    className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>সরাসরি ওয়েবসাইটে লাইভ যোগ করুন</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Attached image preview banner */}
          {attachedImage && (
            <div className="flex items-center gap-2.5 p-2 px-3 bg-emerald-50 border border-emerald-200 rounded-2xl mb-2.5 animate-in fade-in duration-150">
              <img
                src={attachedImage}
                alt="Selected preview"
                className="w-9 h-9 rounded-xl object-cover border border-emerald-300 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-900 truncate text-[11px]">
                  {attachedImageName || 'প্রোডাক্টের ছবি সংযুক্ত করা হয়েছে'}
                </p>
                <p className="text-[10px] text-emerald-700">
                  ছবি প্রস্তুত। প্রোডাক্টের বিবরণ, দাম বা সাইজ লিখলেই এআই সুন্দর টাইটেল ও বিবরণ বানিয়ে ওয়েবসাইটে লাইভ যোগ করে দেবে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachedImage(null);
                  setAttachedImageName(null);
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                title="ছবি সরান"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2"
          >
            {/* Image upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl transition-colors cursor-pointer border border-stone-200 shrink-0"
              title="প্রোডাক্টের ছবি আপলোড করুন"
            >
              <ImageIcon className="w-4 h-4 text-stone-700" />
            </button>

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (items) {
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                      const file = items[i].getAsFile();
                      if (file) {
                        handleProcessImageFile(file);
                      }
                    }
                  }
                }
              }}
              placeholder={
                attachedImage
                  ? 'প্রোডাক্টের বিবরণ, দাম ও স্টক লিখুন (AI নিজে সুন্দর টাইটেল ও বিবরণ বানিয়ে যোগ করবে)...'
                  : 'প্রোডাক্টের যেকোনো বিবরণ বা নির্দেশ লিখুন (বা ছবি আপলোড করুন)...'
              }
              className="flex-1 text-xs p-3 rounded-2xl border border-stone-200 bg-[#FAF8F5] focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden text-stone-900 placeholder:text-stone-400"
            />

            <button
              type="submit"
              disabled={isLoading || (!inputQuery.trim() && !attachedImage)}
              className="p-3 bg-[#1E3A2F] hover:bg-[#2D5042] text-white rounded-2xl transition-colors shadow-xs cursor-pointer disabled:opacity-40 shrink-0"
              title="Send to AI Co-Pilot"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
