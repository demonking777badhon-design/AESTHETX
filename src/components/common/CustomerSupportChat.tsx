import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Truck,
  RotateCcw,
  Package,
  PhoneCall,
  Loader2,
  Headphones,
  Shirt,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  getSupportSettings,
  getOrCreateSupportConversation,
  updateSupportConversation,
  getSupportMessages,
  sendSupportMessage,
  logAIActivity,
  getLocalSupportSettings,
  getAllProductsAdmin,
  getLocalProductsCache,
  getAIKnowledgeBase,
  getLocalAIKnowledgeBase,
  getLocalOrdersCache,
  createAIApprovalAction
} from '../../firebase/db';
import { useSettings } from '../../context/SettingsContext';
import { OFFICIAL_STORE_INFO } from '../../firebase/config';
import type { SupportSettings, SupportConversation, SupportMessage, Product } from '../../types';

// Persistent session identification for customer privacy
function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'aesthetx_support_session_id_v1';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Detect Language (Bengali vs English)
 */
function detectIsBangla(userMessage: string, conversationHistory: any[] = []): boolean {
  if (!userMessage) return true;
  if (/[\u0980-\u09FF]/.test(userMessage)) return true;
  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory) {
      if (typeof m.text === 'string' && /[\u0980-\u09FF]/.test(m.text)) {
        return true;
      }
    }
  }
  const trimmed = userMessage.trim();
  if (/^[\d০-৯\s.,?!'\-a-zA-Z]{1,15}$/.test(trimmed)) {
    return true;
  }
  return !/^[a-zA-Z\s.,?!'-]+$/.test(trimmed);
}

/**
 * Robust Size & Quantity Parser
 */
function parseCustomerSizeOrQuantity(text: string): {
  type: 'shoe_size' | 'clothing_size' | 'volume' | 'weight' | 'unknown';
  value: string;
  normalizedValue: string;
} | null {
  if (!text || typeof text !== 'string') return null;
  const rawLower = text.toLowerCase().trim();
  const clean = rawLower.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  const normalizedText = clean.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d);

  // Clothing size check
  const letterMatch = normalizedText.match(
    /^(?:সাইজ|size)?\s*(xs|s|m|l|xl|xxl|2xl|xxxl|3xl|free\s*size|স্মল|মিডিয়াম|মিডিয়াম|লার্জ|এক্সএল|ডাবল\s*এক্সএল)\s*(?:সাইজ|size|হবে|আছে|লাগবে|হবে\s*কি|আছে\s*কি|available)?$/i
  );
  if (letterMatch) {
    let sizeStr = letterMatch[1].toUpperCase();
    if (sizeStr === 'মিডিয়াম' || sizeStr === 'মিডিয়াম') sizeStr = 'M';
    if (sizeStr === 'স্মল') sizeStr = 'S';
    if (sizeStr === 'লার্জ') sizeStr = 'L';
    if (sizeStr === 'এক্সএল') sizeStr = 'XL';
    if (sizeStr === 'ডাবল এক্সএল' || sizeStr === '2XL') sizeStr = 'XXL';
    if (sizeStr === '3XL') sizeStr = 'XXXL';
    return { type: 'clothing_size', value: letterMatch[1], normalizedValue: sizeStr };
  }

  // Numeric shoe size check
  const numMatch = normalizedText.match(
    /^(?:সাইজ|size|নম্বর|no)?\s*(\d{1,3})\s*(?:সাইজ|size|নম্বর|no|হবে|আছে|লাগবে|হবে\s*কি|আছে\s*কি|available)?$/i
  );
  if (numMatch) {
    const val = numMatch[1];
    const n = parseInt(val, 10);
    if (n >= 25 && n <= 65) {
      return { type: 'shoe_size', value: val, normalizedValue: val };
    }
    return { type: 'unknown', value: val, normalizedValue: val };
  }

  // Volume (ml, L)
  const volMatch = normalizedText.match(
    /^(?:পরিমাণ|সাইজ)?\s*(\d+(?:\.\d+)?)\s*(ml|l|liter|litres?|মিলি|লিটার)\s*(?:হবে|আছে|লাগবে)?$/i
  );
  if (volMatch) {
    return { type: 'volume', value: `${volMatch[1]} ${volMatch[2]}`, normalizedValue: `${volMatch[1]}${volMatch[2].toLowerCase()}` };
  }

  // Weight (g, kg)
  const weightMatch = normalizedText.match(
    /^(?:ওজন|পরিমাণ)?\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|কেজি|গ্রাম)\s*(?:হবে|আছে|লাগবে)?$/i
  );
  if (weightMatch) {
    return { type: 'weight', value: `${weightMatch[1]} ${weightMatch[2]}`, normalizedValue: `${weightMatch[1]}${weightMatch[2].toLowerCase()}` };
  }

  return null;
}

/**
 * Handle Size / Quantity Selection in Client
 */
function handleSizeOrQuantitySelection(
  userMessage: string,
  conversationHistory: any[] = [],
  catalogContext: any[] = [],
  isBangla = true
): { text: string; matchedProducts: any[] } | null {
  const parsed = parseCustomerSizeOrQuantity(userMessage);
  if (!parsed) return null;

  let activeProduct: any = null;
  if (Array.isArray(conversationHistory)) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (Array.isArray(msg.recommendedProducts) && msg.recommendedProducts.length > 0) {
        activeProduct = msg.recommendedProducts[0];
        break;
      }
      if (typeof msg.text === 'string') {
        const found = catalogContext.find((p) => p.name && msg.text.includes(p.name));
        if (found) {
          activeProduct = found;
          break;
        }
      }
    }
  }

  if (!activeProduct && Array.isArray(catalogContext) && catalogContext.length > 0) {
    if (parsed.type === 'shoe_size') {
      activeProduct = catalogContext.find((p) => {
        const text = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''}`.toLowerCase();
        return /shoe|shoes|sneaker|জুতো|জুতা/i.test(text);
      });
    } else if (parsed.type === 'clothing_size') {
      activeProduct = catalogContext.find((p) => {
        const text = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''}`.toLowerCase();
        return /t-shirt|tshirt|tee|shirt|পোশাক/i.test(text);
      });
    }
  }

  const availableOptions: string[] = [];
  if (activeProduct) {
    if (Array.isArray(activeProduct.sizes)) {
      activeProduct.sizes.forEach((s: any) => {
        const str = String(s).trim();
        if (str && !availableOptions.includes(str)) availableOptions.push(str);
      });
    }
    if (Array.isArray(activeProduct.customOptionValues)) {
      activeProduct.customOptionValues.forEach((v: any) => {
        const str = String(v).trim();
        if (str && !availableOptions.includes(str)) availableOptions.push(str);
      });
    }
    if (Array.isArray(activeProduct.variants)) {
      activeProduct.variants.forEach((v: any) => {
        const name = (v.size || v.name || '').trim();
        if (name && !availableOptions.includes(name)) availableOptions.push(name);
      });
    }
  }

  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  const normalizedRequested = parsed.normalizedValue.toLowerCase();

  const isAvailable = availableOptions.some((opt) => {
    const optNorm = opt.toLowerCase().replace(/[০-৯]/g, (d) => bnToEnMap[d] || d).trim();
    return optNorm === normalizedRequested;
  });

  const matchedList = activeProduct ? [activeProduct] : [];

  if (isAvailable) {
    const reply = isBangla
      ? `জি ভাইয়া, ${parsed.value} সাইজটি স্টকে এভেইলেবল আছে! নিচে 'অর্ডার করুন' বাটনে চাপ দিয়ে খুব সহজেই ক্যাশ অন ডেলিভারিতে অর্ডার করে নিতে পারেন।`
      : `Yes brother, size ${parsed.value} is available in stock! You can easily place your order using the 'অর্ডার করুন' button below with Cash on Delivery.`;
    return { text: reply, matchedProducts: matchedList };
  }

  // Size is NOT available:
  if (parsed.type === 'shoe_size') {
    if (availableOptions.length > 0) {
      const optionsStr = availableOptions.join(', ');
      const reply = isBangla
        ? `না ভাইয়া, ${parsed.value} সাইজটি আমাদের স্টকে নেই। আমাদের কাছে ${optionsStr} সাইজ এভেইলেবল আছে। আপনি চাইলে এর মধ্য থেকে কোনো সাইজ নিতে পারেন!`
        : `Sorry brother, size ${parsed.value} is not in stock. We have sizes ${optionsStr} available. Would you like one of these?`;
      return { text: reply, matchedProducts: matchedList };
    } else {
      const reply = isBangla
        ? `না ভাইয়া, ${parsed.value} সাইজটি আমাদের স্টকে নেই। আমাদের কাছে সাধারণত ৩৯ থেকে ৪৪ সাইজ পর্যন্ত জুতো থাকে। আপনি চাইলে এর মধ্য থেকে কোনো সাইজ নিতে পারেন!`
        : `Sorry brother, size ${parsed.value} is not in stock. We usually have shoe sizes 39 to 44. Would you like to select from those?`;
      return { text: reply, matchedProducts: matchedList };
    }
  }

  if (parsed.type === 'clothing_size') {
    if (availableOptions.length > 0) {
      const optionsStr = availableOptions.join(', ');
      const reply = isBangla
        ? `না ভাইয়া, ${parsed.value} সাইজটি আমাদের স্টকে নেই। আমাদের কাছে ${optionsStr} সাইজ এভেইলেবল আছে। আপনি চাইলে এর মধ্য থেকে কোনো সাইজ নিতে পারেন!`
        : `Sorry brother, size ${parsed.value} is not in stock. We have ${optionsStr} available.`;
      return { text: reply, matchedProducts: matchedList };
    } else {
      const reply = isBangla
        ? `না ভাইয়া, ${parsed.value} সাইজটি আমাদের স্টকে নেই। আমাদের কাছে M, L ও XL সাইজ এভেইলেবল আছে।`
        : `Sorry brother, size ${parsed.value} is not in stock. M, L, and XL are available.`;
      return { text: reply, matchedProducts: matchedList };
    }
  }

  if (availableOptions.length > 0) {
    const optionsStr = availableOptions.join(', ');
    const reply = isBangla
      ? `না ভাইয়া, ${parsed.value} পরিমাণটি আমাদের স্টকে নেই। আমাদের কাছে ${optionsStr} এভেইলেবল আছে।`
      : `Sorry brother, ${parsed.value} is not available. We have ${optionsStr} in stock.`;
    return { text: reply, matchedProducts: matchedList };
  }

  const reply = isBangla
    ? `না ভাইয়া, ${parsed.value} সাইজ বা অপশনটি আপাতত স্টকে নেই।`
    : `Sorry brother, ${parsed.value} is currently not in stock.`;
  return { text: reply, matchedProducts: matchedList };
}

/**
 * Precise Intent Detection on Client Side:
 * Returns true ONLY when customer genuinely asks for products/collections or shopping suggestions.
 * Returns false on greetings, delivery charges, showroom location, payment questions, and casual pleasantries.
 */
function hasProductSuggestionIntent(userMessage: string): boolean {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const rawLower = userMessage.toLowerCase().trim();
  const clean = rawLower.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  // If customer is specifying a size or quantity, it is affirmative shopping intent!
  if (parseCustomerSizeOrQuantity(userMessage)) {
    return true;
  }

  // 1. Explicit conversational and general non-product queries (strictly NO product suggestion):
  if (
    /^(হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s*আছেন|কেমন\s*আসো|ভাল\s*আছেন|ভালো\s*আছেন|hi|hello|hey|salam|good\s*morning|good\s*evening|good\s*afternoon)$/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /^(ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাঙ্কস|থ্যাংকস|ধন্যবাদ\s*ভাই|thanks|thank\s*you|ok|okay|accha|achha|আচ্ছা|হাঁ|হ্যাঁ|ঠিক\s*আছে|বুঝতে\s*পেরেছি|জ্বী|জি|হুম|হুমম|বাই|bye|allah\s*hafez|আল্লাহ\s*হাফেজ)$/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /^(একটু\s*ভেবে\s*দেখি|ভেবে\s*জানাচ্ছি|পরে\s*নেব|পরে\s*নেবো|পরে\s*অর্ডার\s*করব|পরে\s*জানাচ্ছি|পরে\s*কথা\s*হবে)$/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /(ডেলিভারি\s*চার্জ|ডেলিভারি\s*কত|কতদিন\s*লাগবে|কবে\s*পাব|শিপিং|কুরিয়ার|পার্সেল\s*কবে|ডেলিভারি\s*ফ্রি|delivery\s*charge|shipping\s*fee|shipping\s*charge|how\s*many\s*days|delivery\s*time)/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /(ক্যাশ\s*অন\s*ডেলিভারি|বিকাশ|নগদ|পেমেন্ট\s*পদ্ধতি|টাকা\s*কীভাবে|cod\s*আছে|payment\s*method|bkash\s*available|nagad\s*available)/i.test(
      clean
    ) &&
    !/(কিনতে\s*চাই|অর্ডার\s*করব|পণ্য|টি-শার্ট|জুতা|শার্ট|পণ্য\s*দেখান)/i.test(clean)
  ) {
    return false;
  }

  if (
    /(দোকান\s*কোথায়|শোরুম\s*কোথায়|অফিস\s*কোথায়|ঠিকানা\s*কোথায়|লোকেশন\s*কোথায়|ফোন\s*নাম্বার|মোবাইল\s*নাম্বার|হটলাইন|hotline|showroom\s*address|shop\s*location)/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /(রিটার্ন\s*পলিসি|এক্সচেঞ্জ\s*নিয়ম|বদলানো\s*যাবে|ফেরত\s*দেওয়া\s*যাবে|রিপ্লেসমেন্ট|return\s*policy|exchange\s*policy)/i.test(
      clean
    )
  ) {
    return false;
  }

  if (
    /ORD-[\w\d]+/i.test(clean) ||
    /(আমার\s*অর্ডার|অর্ডার\s*স্ট্যাটাস|ট্র্যাকিং|track\s*order|পার্সেল\s*কোথায়)/i.test(clean)
  ) {
    return false;
  }

  // 2. Affirmative product shopping / suggestion triggers:
  const hasProductKeyword =
    /(t-shirt|t-shert|tshirt|tshert|tee|tees|টি-শার্ট|টি শার্ট|টিশার্ট|গেঞ্জি|shirt|shert|শার্ট|পোলো|polo|পাঞ্জাবি|panjabi|punjabi|হুডি|hoodie|জ্যাকেট|jacket|জুতো|জুতা|স্নিকার্স|লোফার|কেডস|স্যান্ডেল|shoe|shoes|sneaker|sneakers|loafer|ঘড়ি|ঘড়ি|watch|watches|পারফিউম|আতর|perfume|attar|ব্যাগ|bag|প্যান্ট|জিন্স|pant|pants|jeans|জুস|শরবত|পানীয়|পানীয়|juice|drink|drinks|beverage|খাবার|চাল|ডাল|আটা|চিনি|মসলা|মধু|food|grocery|rice|dal|sugar)/i.test(
      clean
    );

  const hasShoppingAction =
    /(দেখান|দেখাও|দেখতে\s*চাই|কিনতে\s*চাই|অর্ডার\s*করব|নিতে\s*চাই|খুঁজছি|আছে\s*কি|আছে\s*নাকি|স্টকে\s*আছে|সাজেশন|সাজেস্ট|সাজেস্ট\s*করুন|কালেকশন|নতুন\s*কি|নতুন\s*কিছু|শো\s*করুন|show|show\s*me|display|recommend|suggest|buy|order|collection)/i.test(
      clean
    );

  if (hasProductKeyword) {
    if (hasShoppingAction || clean.split(/\s+/).length <= 4) {
      return true;
    }
  }

  if (/(প্রোডাক্ট|কালেকশন|আইটেম|পণ্য)\s*(দেখান|দেখাও|দেখতে\s*চাই|আছে)/i.test(clean)) {
    return true;
  }

  if (
    /আর\s*(কি|কী)?\s*(কোন|কোনো|কিছু|ডিজাইন|কালার|অপশন)?|অন্য\s*(কোন|কোনো|কিছু|ডিজাইন|কালার)|আরো\s*(কোন|কোনো|কিছু)?/i.test(
      clean
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Category-aware Size & Quantity prompt helper
 * Never asks M, L, XL for shoes, drinks, food, or electronics!
 */
function getProductSizeOrUnitPrompt(product: any, isBangla = true): string {
  if (!product) return '';

  const availableOptions: string[] = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    product.sizes.forEach((s: any) => {
      const str = String(s).trim();
      if (str && !availableOptions.includes(str)) availableOptions.push(str);
    });
  }
  if (Array.isArray(product.customOptionValues) && product.customOptionValues.length > 0) {
    product.customOptionValues.forEach((v: any) => {
      const str = String(v).trim();
      if (str && !availableOptions.includes(str)) availableOptions.push(str);
    });
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    product.variants.forEach((v: any) => {
      const name = (v.size || v.name || '').trim();
      if (name && !availableOptions.includes(name)) availableOptions.push(name);
    });
  }

  const categoryName = `${product.category || ''} ${product.subcategory || ''} ${product.name || ''}`.toLowerCase();
  const isFootwear = /shoe|shoes|sneaker|sneakers|loafer|boot|sandal|জুতো|জুতা|স্নিকার্স|কেডস/i.test(
    categoryName
  );
  const isBeverage = /drink|beverage|juice|water|milk|oil|শরবত|জুস|পানীয়|পানি|তরল/i.test(
    categoryName
  );
  const isFoodOrWeight = /grocery|food|চাল|ডাল|আটা|চিনি|মসলা|মধু|rice|flour|sugar|spice|honey|meat|fish|grain/i.test(
    categoryName
  );
  const isPackOrPiece = /pack|box|piece|প্যাকেট|বক্স|পিস|ডজন/i.test(categoryName);
  const isElectronics = /electronic|gadget|mobile|laptop|camera|headphone|টেক|ইলেকট্রনিক/i.test(
    categoryName
  );
  const isApparel = /cloth|fashion|t-shirt|shirt|polo|panjabi|hoodie|pant|trouser|পোশাক|শার্ট|গেঞ্জি|পাঞ্জাবি/i.test(
    categoryName
  );

  if (availableOptions.length > 0) {
    const optionsStr = availableOptions.slice(0, 6).join(', ');
    if (isFootwear) {
      return isBangla
        ? `আপনার জুতার কোন সাইজটা লাগবে — ${optionsStr}?`
        : `Which shoe size do you need — ${optionsStr}?`;
    }
    if (isBeverage) {
      return isBangla
        ? `আপনার কতটুকু পরিমাণ লাগবে — ${optionsStr}?`
        : `What volume/quantity do you need — ${optionsStr}?`;
    }
    if (isFoodOrWeight) {
      return isBangla
        ? `আপনার কতটুকু ওজন বা পরিমাণ লাগবে — ${optionsStr}?`
        : `What weight/quantity do you need — ${optionsStr}?`;
    }
    if (isPackOrPiece) {
      return isBangla
        ? `আপনার কোন প্যাক বা সাইজ লাগবে — ${optionsStr}?`
        : `Which pack or quantity do you need — ${optionsStr}?`;
    }
    if (isElectronics) {
      return isBangla
        ? `আপনার কোন ভ্যারিয়েন্ট বা অপশন লাগবে — ${optionsStr}?`
        : `Which option/storage do you need — ${optionsStr}?`;
    }
    return isBangla
      ? `আপনার কোন সাইজটা লাগবে — ${optionsStr}?`
      : `Which size do you need — ${optionsStr}?`;
  }

  if (isFootwear) {
    return isBangla
      ? `আপনার জুতার কোন সাইজ নম্বর লাগবে (যেমন: ৩৯, ৪০, ৪১, ৪২, ৪৩)?`
      : `Which shoe size do you need (e.g. 40, 41, 42, 43)?`;
  }
  if (isBeverage) {
    return isBangla
      ? `আপনার কতটুকু লাগবে (যেমন: ২৫০ মিলি, ৫০০ মিলি, ১ লিটার)?`
      : `What volume do you need (e.g. 250 ml, 500 ml, 1 L)?`;
  }
  if (isFoodOrWeight) {
    return isBangla
      ? `আপনার কতটুকু লাগবে (যেমন: ৫০০ গ্রাম, ১ কেজি, ২ কেজি)?`
      : `What quantity do you need (e.g. 500 g, 1 kg, 2 kg)?`;
  }
  if (isApparel) {
    return isBangla
      ? `আপনার কোন সাইজটা লাগবে — M, L নাকি XL?`
      : `Which size do you need — M, L, or XL?`;
  }

  return isBangla
    ? `পছন্দ হলে সরাসরি নিচের বাটনে চাপ দিয়ে অর্ডার করতে পারেন।`
    : `If you like it, you can order directly using the button below.`;
}

/**
 * Demand-Aware Response Extractor for Client Fallback
 */
function extractClientCustomerDemandAndReply(
  userMessage: string,
  catalogContext: Product[] = []
): string | null {
  const lowerMsg = userMessage.toLowerCase().trim();
  const cleanMsg = lowerMsg.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  const hasInCatalog = (keywordRegex: RegExp) => {
    return catalogContext.some((item) => {
      const text = `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      return keywordRegex.test(text);
    });
  };

  // 1. SPECIFIC ITEM REQUESTS (কোন জিনিস যদি চায় আর সেটা না থাকে)
  if (/জুতো|জুতা|স্নিকার্স|কেডস|স্যান্ডেল|shoe|shoes|sneaker|sandals/i.test(cleanMsg)) {
    if (hasInCatalog(/shoe|shoes|sneaker|জুতো|জুতা|স্নিকার্স|লোফার/i)) return null;
    return `না ভাইয়া, আপাতত আমাদের কোনো জুতো বা স্নিকার্স কালেকশন নেই।`;
  }
  if (/ঘড়ি|ঘড়ি|হাতঘড়ি|হাতঘড়ি|watch|watches/i.test(cleanMsg)) {
    if (hasInCatalog(/watch|ঘড়ি|ঘড়ি/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো ঘড়ি নেই।`;
  }
  if (/পারফিউম|আতর|সুগন্ধি|বডি\s*স্প্রে|perfume|attar|body\s*spray|fragrance/i.test(cleanMsg)) {
    if (hasInCatalog(/perfume|attar|আতর|পারফিউম/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো পারফিউম বা আতর নেই।`;
  }
  if (/ব্যাগ|ওয়ালেট|মানিব্যাগ|ব্যাকপ্যাক|bag|backpack|wallet/i.test(cleanMsg)) {
    if (hasInCatalog(/bag|backpack|wallet|ব্যাগ/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো ব্যাগ বা ওয়ালেট নেই।`;
  }
  if (/প্যান্ট|জিন্স|ট্রাউজার|গ্যাবার্ডিন|pant|pants|jeans|trouser/i.test(cleanMsg)) {
    if (hasInCatalog(/pant|pants|jeans|trouser|প্যান্ট|জিন্স/i)) return null;
    return `না ভাইয়া, আপাতত আমাদের কোনো প্যান্ট বা জিন্স কালেকশন নেই।`;
  }
  if (/হুডি|জ্যাকেট|সোয়েটার|hoodie|hoodies|jacket|sweater/i.test(cleanMsg)) {
    if (hasInCatalog(/hoodie|jacket|sweater|হুডি|জ্যাকেট/i)) return null;
    return `না ভাইয়া, আপাতত আমাদের কোনো হুডি বা জ্যাকেট কালেকশন নেই।`;
  }
  if (/পাঞ্জাবি|পায়জামা|panjabi|punjabi/i.test(cleanMsg)) {
    if (hasInCatalog(/panjabi|punjabi|পাঞ্জাবি/i)) return null;
    return `না ভাইয়া, আপাতত আমাদের কোনো পাঞ্জাবি কালেকশন নেই।`;
  }
  if (/জুস|শরবত|পানীয়|পানীয়|juice|drink|beverage/i.test(cleanMsg)) {
    if (hasInCatalog(/juice|drink|beverage|শরবত|জুস|পানীয়/i)) return null;
    return `না ভাইয়া, আপাতত আমাদের কোনো পানীয় কালেকশন নেই।`;
  }
  if (/চাল|ডাল|আটা|চিনি|চালডাল|grocery/i.test(cleanMsg)) {
    if (hasInCatalog(/rice|dal|sugar|flour|grocery|চাল|ডাল|চিনি/i)) return null;
    return `না ভাইয়া, আপাতত গ্রোসারি খাদ্যদ্রব্য স্টকে নেই।`;
  }
  if (/ক্যাপ|টুপি|মাথার\s*টুপি|cap|hat/i.test(cleanMsg)) {
    if (hasInCatalog(/cap|hat|ক্যাপ|টুপি/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো ক্যাপ বা টুপি নেই।`;
  }
  if (/বেল্ট|belt/i.test(cleanMsg)) {
    if (hasInCatalog(/belt|বেল্ট/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো বেল্ট নেই।`;
  }
  if (/চশমা|সানগ্লাস|sunglass|glasses/i.test(cleanMsg)) {
    if (hasInCatalog(/sunglass|glasses|চশমা/i)) return null;
    return `না ভাইয়া, আমাদের এখানে কোনো চশমা বা সানগ্লাস নেই।`;
  }
  if (/শাড়ি|থ্রি-পিস|মেয়েদের|লেডিস|লেডিজ|saree|kurti|dress/i.test(cleanMsg)) {
    if (hasInCatalog(/saree|kurti|dress|শাড়ি|লেডি/i)) return null;
    return `না ভাইয়া, আমাদের এখানে মেয়েদের পোশাক বা শাড়ি নেই।`;
  }

  // 2. SPECIFIC ATTRIBUTES / SPECIFICATIONS (কোন জিনিসের বিবরণ যদি না থাকে)
  if (/লাল|red/i.test(cleanMsg)) {
    return `আপাতত লাল কালারের কোনো টি-শার্ট নেই ভাইয়া। আমাদের ক্লাসিক ব্ল্যাক (কালো) টি-শার্ট এভেইলেবল আছে।`;
  }
  if (/সাদা|ধবধবে|white/i.test(cleanMsg)) {
    return `আপাতত সাদা রঙের কোনো টি-শার্ট নেই ভাইয়া। আমাদের ব্ল্যাক টি-শার্ট এভেইলেবল আছে।`;
  }
  if (/নীল|নেভি|blue|navy/i.test(cleanMsg)) {
    return `আপাতত নীল বা নেভি কালারের কোনো টি-শার্ট নেই ভাইয়া।`;
  }
  if (/সবুজ|green/i.test(cleanMsg)) {
    return `আপাতত সবুজ কালারের কোনো টি-শার্ট নেই ভাইয়া।`;
  }

  // Check Cuts & Styles
  if (/ড্রপ\s*শোল্ডার|ড্রপশোল্ডার|drop\s*shoulder/i.test(cleanMsg)) {
    return `আপাতত আমাদের ড্রপ শোল্ডার কোনো টি-শার্ট নেই ভাইয়া। রেগুলার ফিটের ক্লাসিক টি-শার্ট রয়েছে।`;
  }
  if (/ফুল\s*হাতা|ফুল\s*স্লিভ|full\s*sleeve|long\s*sleeve/i.test(cleanMsg)) {
    return `আপাতত আমাদের কোনো ফুল হাতা টি-শার্ট নেই ভাইয়া, শুধু হাফ হাতা রয়েছে।`;
  }

  // Check Sizes
  if (/\bxxl\b|\b2xl\b|ডাবল\s*এক্সএল/i.test(cleanMsg)) {
    return `আপাতত XXL সাইজটি স্টকে নেই ভাইয়া। আমাদের কাছে M, L ও XL সাইজ এভেইলেবল আছে।`;
  }
  if (/\b3xl\b|\bxxxl\b/i.test(cleanMsg)) {
    return `আপাতত 3XL সাইজটি নেই ভাইয়া।`;
  }

  return null;
}

interface CustomerSupportChatProps {
  onNavigate?: (path: string) => void;
}

// Ensure unique, deduplicated messages sorted chronologically (eliminating duplicate optimistic vs polled messages)
function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const map = new Map<string, SupportMessage>();
  const seenContent = new Set<string>();

  const all = [...current, ...incoming].filter(Boolean);
  const result: SupportMessage[] = [];

  for (const m of all) {
    if (!m || !m.text) continue;
    if (map.has(m.id)) continue;
    map.set(m.id, m);

    // Dedup identical sender + text within close timeframe (~20s window)
    const timeSec = m.createdAt?.seconds 
      ? m.createdAt.seconds 
      : Math.floor(new Date(m.createdAt || 0).getTime() / 1000);
    const timeBucket = Math.floor(timeSec / 20);
    const contentKey = `${m.sender}:${m.text.trim()}:${timeBucket}`;

    if (seenContent.has(contentKey)) {
      continue;
    }
    seenContent.add(contentKey);
    result.push(m);
  }

  return result.sort((a, b) => {
    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
    return timeA - timeB;
  });
}

export const CustomerSupportChat: React.FC<CustomerSupportChatProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [sessionId] = useState<string>(getOrCreateSessionId);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [settings, setSettings] = useState<SupportSettings>(getLocalSupportSettings);
  const [unreadCount, setUnreadCount] = useState(0);
  const [productsCache, setProductsCache] = useState<Product[]>(() => getLocalProductsCache());

  const addMessageSafely = (newMsg: SupportMessage) => {
    setMessages((prev) => mergeMessages(prev, [newMsg]));
  };

  let siteSettings: any = null;
  try {
    const settingsCtx = useSettings();
    siteSettings = settingsCtx.settings;
  } catch {
    // fallback if used outside provider
  }
  const brandLogo = siteSettings?.logoUrl || OFFICIAL_STORE_INFO.logoUrl;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleProductNavigate = (targetIdOrSlug: string) => {
    setIsOpen(false);
    const targetPath = `/product/${targetIdOrSlug}`;
    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      window.location.pathname = targetPath;
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load initial settings and products
  useEffect(() => {
    let isMounted = true;
    getSupportSettings().then((s) => {
      if (isMounted) setSettings(s);
    });

    getAllProductsAdmin().then((prods) => {
      if (isMounted) setProductsCache(prods);
    });

    // Listen for support settings update events
    const handleSettingsUpdate = (e: any) => {
      if (e.detail) setSettings(e.detail);
    };
    window.addEventListener('aesthetx-support-settings-updated', handleSettingsUpdate);

    // Listen for real-time product updates from Admin panel (prices, stock, sizes, etc.)
    const handleProductsUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        if (isMounted) setProductsCache(e.detail);
      } else {
        const fresh = getLocalProductsCache();
        if (isMounted && fresh.length > 0) setProductsCache(fresh);
      }
    };
    window.addEventListener('aesthetx-products-updated', handleProductsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('aesthetx-support-settings-updated', handleSettingsUpdate);
      window.removeEventListener('aesthetx-products-updated', handleProductsUpdate);
    };
  }, []);

  // Initialize or fetch conversation for this session
  useEffect(() => {
    let isMounted = true;
    const initConversation = async () => {
      try {
        const conv = await getOrCreateSupportConversation(sessionId);
        if (isMounted) {
          setConversation(conv);
          const msgs = await getSupportMessages(conv.id);
          setMessages(mergeMessages([], msgs));
        }
      } catch (err) {
        console.warn('Could not init support conversation:', err);
      }
    };

    initConversation();
  }, [sessionId]);

  // Periodic polling for fresh messages and settings (every 4 seconds when open or closed)
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (!conversation) return;

      try {
        const updatedMsgs = await getSupportMessages(conversation.id);
        setMessages((prev) => {
          const merged = mergeMessages(prev, updatedMsgs);
          if (merged.length > prev.length) {
            // Count new unread replies from admin/ai if chat is closed
            if (!isOpen) {
              const diff = merged.length - prev.length;
              setUnreadCount((c) => c + diff);
            }
            return merged;
          }
          return prev;
        });

        // Also refresh settings periodically
        const currentSettings = await getSupportSettings();
        setSettings(currentSettings);
      } catch (err) {
        // Safe silent ignore for polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [conversation, isOpen]);

  // Scroll whenever messages change and window is open
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  const deliverAssistantResponse = (text: string, recProducts?: any[]) => {
    const aiMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const aiMsg: SupportMessage = {
      id: aiMsgId,
      conversationId: conversation!.id,
      sessionId,
      sender: 'ai',
      senderName: 'AESTHETX AI Assistant',
      text,
      recommendedProducts: recProducts && recProducts.length > 0 ? recProducts : undefined,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    };
    addMessageSafely(aiMsg);
    setIsAiTyping(false);
    setIsSending(false);

    // Persist in background without delaying the user UI (passing exact ID)
    sendSupportMessage({
      id: aiMsgId,
      conversationId: conversation!.id,
      sessionId,
      sender: 'ai',
      senderName: 'AESTHETX AI Assistant',
      text,
      recommendedProducts: recProducts && recProducts.length > 0 ? recProducts : undefined
    }).catch((e) => console.warn('Background AI message send notice:', e));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || !conversation || isSending) return;

    // 1. Instant optimistic update: Show customer message immediately (0ms latency!)
    const customerMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const customerMsg: SupportMessage = {
      id: customerMsgId,
      conversationId: conversation.id,
      sessionId,
      sender: 'customer',
      senderName: 'You',
      text: textToSend,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    };

    addMessageSafely(customerMsg);
    setInputText('');
    setIsSending(true);
    setIsAiTyping(true);

    // Persist customer message in background (passing exact matching ID)
    sendSupportMessage({
      id: customerMsgId,
      conversationId: conversation.id,
      sessionId,
      sender: 'customer',
      senderName: 'You',
      text: textToSend
    }).catch((err) => console.warn('Background message save note:', err));

    // Never block customer inquiry with representative notice; reactivate automated AI assistant
    if (conversation.isTakenOverByAdmin) {
      updateSupportConversation(conversation.id, { isTakenOverByAdmin: false }).catch(() => {});
      setConversation((prev) => (prev ? { ...prev, isTakenOverByAdmin: false } : null));
    }

    try {
      // 2. Real-time freshest catalog & Knowledge Base directly from cache (0ms instant!)
      const latestCatalog = getLocalProductsCache();
      const activeCatalog = (latestCatalog.length > 0 ? latestCatalog : productsCache)
        .filter((p) => p.active !== false);

      const kb = getLocalAIKnowledgeBase();

      // Contextual order lookup
      const allOrders = getLocalOrdersCache();
      const orderNumMatch = textToSend.match(/ORD-[\w\d]+/i);
      const phoneMatch = textToSend.match(/01[3-9]\d{8}/);
      let matchedOrders = allOrders.slice(0, 3);
      if (orderNumMatch) {
        const target = orderNumMatch[0].toUpperCase();
        const found = allOrders.filter(
          (o) => (o.orderNumber && o.orderNumber.toUpperCase().includes(target)) || (o.id && o.id.toUpperCase().includes(target))
        );
        if (found.length > 0) matchedOrders = found;
      } else if (phoneMatch) {
        const p = phoneMatch[0];
        const found = allOrders.filter((o) => o.customerPhone && o.customerPhone.includes(p));
        if (found.length > 0) matchedOrders = found;
      }

      // Invoke server-side AI route
      try {
        const payload = {
          message: textToSend,
          conversationHistory: messages.slice(-8),
          catalogContext: activeCatalog.slice(0, 50).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug || p.id,
            image: (p as any).image || p.thumbnail || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : ''),
            images: p.images || [],
            category: p.category || '',
            subcategory: p.subcategory || '',
            description: p.description || p.shortDescription || '',
            shortDescription: p.shortDescription || '',
            price: p.price || 0,
            salePrice: p.salePrice || p.price || 0,
            totalStock: p.totalStock !== undefined ? p.totalStock : 10,
            sizes: p.sizes || [],
            colors: p.colors || [],
            tags: p.tags || [],
            specifications: p.specifications || []
          })),
          orderContext: matchedOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderStatus: o.orderStatus,
            paymentStatus: o.paymentStatus,
            totalAmount: o.total,
            deliveryZone: o.shippingAddress?.district,
            items: o.items,
            createdAt: o.createdAt
          })),
          knowledgeBase: kb,
          isAIEnabled: true,
          aiStatusMode: 'active',
          isTakenOverByAdmin: false
        };

        const res = await fetch('/api/support/ai-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success && data.text) {
          // Enrich matched products with full image and slug from client catalog
          let finalProducts = Array.isArray(data.matchedProducts) ? [...data.matchedProducts] : [];
          finalProducts = finalProducts.map((mp: any) => {
            const local = activeCatalog.find(
              (p) => p.id === mp.id || p.name?.toLowerCase() === mp.name?.toLowerCase()
            );
            return {
              ...mp,
              id: mp.id || local?.id || `prod_${Date.now()}`,
              slug: mp.slug || local?.slug || local?.id || 'product',
              image: mp.image || (local as any)?.image || local?.thumbnail || (Array.isArray(local?.images) && local.images.length > 0 ? local.images[0] : ''),
              salePrice: mp.salePrice || local?.salePrice || mp.price || local?.price || 1200,
              price: mp.price || local?.price || mp.salePrice || 1200
            };
          });

          // Deliver Gemini's intelligent response and products directly without client-side regex wiping
          deliverAssistantResponse(data.text, finalProducts);

          // Log AI interaction in background
          logAIActivity({
            conversationId: conversation.id,
            query: textToSend,
            response: data.text,
            status: 'success'
          }).catch(() => {});

          // If AI detected a sensitive proposal, stage for admin approval in background!
          if (data.proposedAction) {
            createAIApprovalAction({
              actionType: data.proposedAction.actionType,
              targetId: conversation.id,
              targetReference: matchedOrders[0]?.orderNumber ? `Order #${matchedOrders[0].orderNumber}` : conversation.customerName || `Customer #${conversation.id.slice(-5)}`,
              requestedBy: 'ai_assistant',
              customerSessionId: sessionId,
              customerName: conversation.customerName || 'Customer',
              reason: data.proposedAction.reason,
              payload: {
                queryText: textToSend,
                orderId: matchedOrders[0]?.id || null,
                conversationId: conversation.id
              }
            }).catch(() => {});
          }
        } else {
          // Fallback response generator if server response was empty
          const lowerQ = textToSend.toLowerCase();
          const cleanQ = lowerQ.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();
          const isBangla = detectIsBangla(textToSend, messages);
          const hasIntent = hasProductSuggestionIntent(textToSend);

          // Fast-Path: Size or quantity selection (e.g. "56", "42", "M", "L")
          const sizeReply = handleSizeOrQuantitySelection(textToSend, messages, activeCatalog, isBangla);
          if (sizeReply) {
            deliverAssistantResponse(sizeReply.text, sizeReply.matchedProducts);
            return;
          }

          // 1. Logistics and conversational queries (respecting dynamic Knowledge Base)
          if (/(ডেলিভারি|শিপিং|কুরিয়ার|delivery|shipping)/i.test(cleanQ)) {
            const reply = kb?.shippingInfo?.trim()
              ? `${kb.shippingInfo} ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।`
              : 'ঢাকার ভেতরে ডেলিভারি চার্জ ৳৭০-৮০ (২-৩ দিন) আর ঢাকার বাইরে ৳১২০-১৫০ (৩-৫ দিন)। ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।';
            deliverAssistantResponse(reply);
            return;
          }

          if (/(রিটার্ন|exchange|এক্সচেঞ্জ|বদলানো|ফেরত|return)/i.test(cleanQ)) {
            const reply = kb?.returnPolicy?.trim() || 'ডেলিভারির ৭ দিনের মধ্যে সাইজ না মিললে বা কোনো সমস্যা থাকলে সহজে ফ্রি এক্সচেঞ্জ বা রিপ্লেসমেন্ট সুবিধা পাবেন ভাইয়া।';
            deliverAssistantResponse(reply);
            return;
          }

          if (/(ক্যাশ\s*অন\s*ডেলিভারি|বিকাশ|নগদ|পেমেন্ট|payment|bkash|nagad|cod)/i.test(cleanQ)) {
            const bkashOn = siteSettings?.bkashEnabled !== false;
            const nagadOn = siteSettings?.nagadEnabled !== false;
            const activeChannels: string[] = ['ক্যাশ অন ডেলিভারি (COD)'];
            if (bkashOn) activeChannels.push('বিকাশ (bKash)');
            if (nagadOn) activeChannels.push('নগদ (Nagad)');
            const livePaymentSummary =
              activeChannels.length === 1
                ? 'আমাদের কাছে বর্তমানে শুধুমাত্র ক্যাশ অন ডেলিভারি (COD) এর মাধ্যমে পেমেন্ট সুবিধা চালু রয়েছে ভাইয়া।'
                : `আমাদের কাছে বর্তমানে ${activeChannels.join(' এবং ')} মাধ্যমে পেমেন্ট সুবিধা চালু রয়েছে ভাইয়া।`;
            const reply =
              bkashOn && nagadOn && kb?.paymentMethods?.trim()
                ? kb.paymentMethods.trim()
                : livePaymentSummary;
            deliverAssistantResponse(reply);
            return;
          }

          if (/(দোকান|শোরুম|অফিস|ঠিকানা|লোকেশন|showroom|address|location)/i.test(cleanQ)) {
            const storeText = kb?.storeOverview?.trim();
            const reply = (storeText && storeText.includes('ঢাকা'))
              ? storeText
              : 'আমাদের মূল কার্যক্রম অনলাইন ভিত্তিক এবং পুরো বাংলাদেশজুড়ে হোম ডেলিভারি দেওয়া হয় ভাইয়া।';
            deliverAssistantResponse(reply);
            return;
          }

          if (/^(হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s*আছেন|কেমন\s*আসো|ভাল\s*আছেন|hi|hello|hey|salam)/i.test(cleanQ)) {
            const reply = 'আলহামদুলিল্লাহ ভাইয়া, ভালো আছি। স্বাগতম AESTHETX-এ! আপনাকে কীভাবে সাহায্য করতে পারি?';
            deliverAssistantResponse(reply);
            return;
          }

          if (/^(ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাঙ্কস|thanks|thank\s*you)/i.test(cleanQ)) {
            const reply = 'আপনাকেও অনেক ধন্যবাদ ভাইয়া! যেকোনো প্রয়োজনে আমাদের জানাতে পারেন।';
            deliverAssistantResponse(reply);
            return;
          }

          const isShortFollowUp = /^(আর|আর\s*কিছু|আর\s*নেই|আর\s*নাই|more|anything\s*else)$/i.test(cleanQ);
          const isAskingForMore =
            /আর\s*(কি|কী)?\s*(কোন|কোনো|কিছু|ডিজাইন|কালার|অপশন)?|অন্য\s*(কোন|কোনো|কিছু|ডিজাইন|কালার)|আরো\s*(কোন|কোনো)?/i.test(
              lowerQ
            );
          const clientDemandReply = extractClientCustomerDemandAndReply(textToSend, activeCatalog);

          let fallbackText = messages.length > 0
            ? 'জি ভাইয়া, বিষয়টি বুঝতে পেরেছি। আপনাকে আর কীভাবে সাহায্য করতে পারি বলুন?'
            : 'স্বাগতম AESTHETX-এ! যেকোনো তথ্য জানতে বা কালেকশন দেখতে চাইলে জানাতে পারেন ভাইয়া।';
          let localSuggested: any[] = [];

          if (isShortFollowUp) {
            fallbackText = 'না ভাইয়া, আপাতত এটার আর নেই।';
          } else if (clientDemandReply) {
            fallbackText = clientDemandReply;
          } else if (isAskingForMore) {
            fallbackText = 'আপাতত আর কোনো এই রকম কালেকশন নেই ভাইয়া। তবে খুব শীঘ্রই আমরা নতুন কালেকশন নিয়ে আসবো!';
          } else if (hasIntent) {
            // Find matched item in catalog
            const matchedItem = activeCatalog.find((p) => {
              const nameLower = (p.name || '').toLowerCase();
              const catLower = (p.category || '').toLowerCase();
              if (lowerQ.includes('জুতা') || lowerQ.includes('shoe') || lowerQ.includes('sneaker')) {
                return nameLower.includes('shoe') || nameLower.includes('sneaker') || catLower.includes('shoe');
              }
              if (lowerQ.includes('জুস') || lowerQ.includes('juice') || lowerQ.includes('drink')) {
                return nameLower.includes('juice') || nameLower.includes('drink') || catLower.includes('drink');
              }
              if (lowerQ.includes('চাল') || lowerQ.includes('ডাল') || lowerQ.includes('grocery')) {
                return catLower.includes('grocery') || nameLower.includes('rice') || nameLower.includes('dal');
              }
              return (
                nameLower.includes('t-shirt') ||
                nameLower.includes('tshirt') ||
                nameLower.includes('tee') ||
                nameLower.includes('shirt')
              );
            }) || activeCatalog[0];

            if (matchedItem) {
              const rawDesc = matchedItem.description || matchedItem.shortDescription || '';
              const cleanDesc = rawDesc ? rawDesc.replace(/\r?\n|\r/g, ' ').replace(/[।.\s]+$/, '').slice(0, 90).trim() : '';
              const descPart = cleanDesc ? `${cleanDesc}। ` : '';
              const unitPrompt = getProductSizeOrUnitPrompt(matchedItem, true);
              const price = matchedItem.salePrice || matchedItem.price || 1200;
              const stock = matchedItem.totalStock !== undefined ? `${matchedItem.totalStock} পিস` : 'স্টকে';

              fallbackText = `জি ভাইয়া, আমাদের এই ${matchedItem.name}-টা দেখতে পারেন। ${descPart}দাম পড়বে মাত্র ৳${price} (স্টকে ${stock} আছে)।\n\n${unitPrompt} পছন্দ হলে নিচের 'অর্ডার করুন' বাটনে চাপ দিয়ে সহজেই অর্ডার করে নিতে পারেন।`;
              localSuggested = [{
                id: matchedItem.id,
                name: matchedItem.name,
                slug: matchedItem.slug || matchedItem.id,
                image: (matchedItem as any).image || matchedItem.thumbnail || (Array.isArray(matchedItem.images) && matchedItem.images.length > 0 ? matchedItem.images[0] : ''),
                price: matchedItem.price,
                salePrice: matchedItem.salePrice || matchedItem.price,
                totalStock: matchedItem.totalStock
              }];
            }
          }

          deliverAssistantResponse(fallbackText, localSuggested);

          logAIActivity({
            conversationId: conversation.id,
            query: textToSend,
            response: fallbackText,
            status: 'success'
          }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('AI call error, generating local fallback:', err);
        const lowerQ = textToSend.toLowerCase();
        const cleanQ = lowerQ.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();
        const isBangla = detectIsBangla(textToSend, messages);
        const hasIntent = hasProductSuggestionIntent(textToSend);

        // Fast-Path: Size or quantity selection
        const sizeReply = handleSizeOrQuantitySelection(textToSend, messages, activeCatalog, isBangla);
        if (sizeReply) {
          deliverAssistantResponse(sizeReply.text, sizeReply.matchedProducts);
          return;
        }

        if (/(ডেলিভারি|শিপিং|কুরিয়ার|delivery|shipping)/i.test(cleanQ)) {
          const reply = kb?.shippingInfo?.trim()
            ? `${kb.shippingInfo} ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।`
            : 'ঢাকার ভেতরে ডেলিভারি চার্জ ৳৭০-৮০ (২-৩ দিন) আর ঢাকার বাইরে ৳১২০-১৫০ (৩-৫ দিন)। ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।';
          deliverAssistantResponse(reply);
          return;
        }

        if (/^(হাই|হ্যালো|সালাম|কেমন\s*আছেন|hi|hello)/i.test(cleanQ)) {
          const reply = 'আলহামদুলিল্লাহ ভাইয়া, ভালো আছি। স্বাগতম AESTHETX-এ! আপনাকে কীভাবে সাহায্য করতে পারি?';
          deliverAssistantResponse(reply);
          return;
        }

        const isShortFollowUp = /^(আর|আর\s*কিছু|আর\s*নেই|আর\s*নাই|more|anything\s*else)$/i.test(cleanQ);
        const isAskingForMore =
          /আর\s*(কি|কী)?\s*(কোন|কোনো|কিছু|ডিজাইন|কালার|অপশন)?|অন্য\s*(কোন|কোনো|কিছু|ডিজাইন|কালার)|আরো\s*(কোন|কোনো)?/i.test(
            lowerQ
          );
        const clientDemandReply = extractClientCustomerDemandAndReply(textToSend, activeCatalog);

        let fallbackText = messages.length > 0
          ? 'জি ভাইয়া, বিষয়টি বুঝতে পেরেছি। আপনাকে আর কীভাবে সাহায্য করতে পারি বলুন?'
          : 'স্বাগতম AESTHETX-এ! যেকোনো তথ্য জানতে বা কালেকশন দেখতে চাইলে জানাতে পারেন ভাইয়া।';
        let localSuggested: any[] = [];

        if (isShortFollowUp) {
          fallbackText = 'না ভাইয়া, আপাতত এটার আর নেই।';
        } else if (clientDemandReply) {
          fallbackText = clientDemandReply;
        } else if (isAskingForMore) {
          fallbackText = 'আপাতত আর কোনো এই রকম কালেকশন নেই ভাইয়া। তবে খুব শীঘ্রই আমরা নতুন কালেকশন নিয়ে আসবো!';
        } else if (hasIntent) {
          const matchedItem = activeCatalog.find((p) => {
            const nameLower = (p.name || '').toLowerCase();
            const catLower = (p.category || '').toLowerCase();
            if (lowerQ.includes('জুতা') || lowerQ.includes('shoe') || lowerQ.includes('sneaker')) {
              return nameLower.includes('shoe') || nameLower.includes('sneaker') || catLower.includes('shoe');
            }
            if (lowerQ.includes('জুস') || lowerQ.includes('juice') || lowerQ.includes('drink')) {
              return nameLower.includes('juice') || nameLower.includes('drink') || catLower.includes('drink');
            }
            return (
              nameLower.includes('t-shirt') ||
              nameLower.includes('tshirt') ||
              nameLower.includes('tee') ||
              nameLower.includes('shirt')
            );
          }) || activeCatalog[0];

          if (matchedItem) {
            const rawDesc = matchedItem.description || matchedItem.shortDescription || '';
            const cleanDesc = rawDesc ? rawDesc.replace(/\r?\n|\r/g, ' ').replace(/[।.\s]+$/, '').slice(0, 90).trim() : '';
            const descPart = cleanDesc ? `${cleanDesc}। ` : '';
            const unitPrompt = getProductSizeOrUnitPrompt(matchedItem, true);
            const price = matchedItem.salePrice || matchedItem.price || 1200;
            const stock = matchedItem.totalStock !== undefined ? `${matchedItem.totalStock} পিস` : 'স্টকে';

            fallbackText = `জি ভাইয়া, আমাদের এই ${matchedItem.name}-টা দেখতে পারেন। ${descPart}দাম পড়বে মাত্র ৳${price} (স্টকে ${stock} আছে)।\n\n${unitPrompt} পছন্দ হলে নিচের 'অর্ডার করুন' বাটনে চাপ দিয়ে সহজেই অর্ডার করে নিতে পারেন।`;
            localSuggested = [{
              id: matchedItem.id,
              name: matchedItem.name,
              slug: matchedItem.slug || matchedItem.id,
              image: (matchedItem as any).image || matchedItem.thumbnail || (Array.isArray(matchedItem.images) && matchedItem.images.length > 0 ? matchedItem.images[0] : ''),
              price: matchedItem.price,
              salePrice: matchedItem.salePrice || matchedItem.price,
              totalStock: matchedItem.totalStock
            }];
          }
        }

        deliverAssistantResponse(fallbackText, localSuggested);
      } finally {
        setIsAiTyping(false);
      }
    } catch (err) {
      console.error('Error sending support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    try {
      const date = createdAt.seconds
        ? new Date(createdAt.seconds * 1000)
        : new Date(createdAt);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Floating Chat Launch Button */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3.5 bg-[#162B23] hover:bg-[#1E3A2F] text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-2 border-[#8FA89B]/40"
            aria-label="Open Customer Support Chat"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5 text-[#8FA89B] group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            </div>

            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold block leading-none">Support Chat</span>
              <span className="text-[10px] text-[#8FA89B] block font-medium">We're here to help</span>
            </div>

            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 px-2 py-0.5 bg-red-600 text-white font-black text-[10px] rounded-full shadow-md animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Support Chat Modal (Default Full Screen with Toggle) */}
      {isOpen && (
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 w-full h-full bg-[#FAF8F5] flex flex-col overflow-hidden animate-in fade-in duration-200'
              : 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[600px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200'
          }
        >
          {/* Header Bar */}
          <div className="bg-[#162B23] text-white px-4 py-3 sm:px-6 flex items-center justify-between border-b border-[#2D5042] shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-[#8FA89B]/30 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                <img
                  src={brandLogo}
                  alt="AESTHETX"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#162B23]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-bold tracking-tight">AESTHETX Support</h3>
                  {settings.aiAssistantEnabled ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[9px] font-black rounded-md uppercase">
                      <Sparkles className="w-2.5 h-2.5" /> AI Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-stone-800 text-stone-300 border border-stone-600/40 text-[9px] font-semibold rounded-md">
                      Human Team
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8FA89B]">Official Customer Help Desk</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-[#1E3A2F] rounded-lg transition-colors cursor-pointer"
                title={isFullscreen ? 'Minimize Window' : 'Maximize Window'}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-[#1E3A2F] rounded-lg transition-colors cursor-pointer"
                title="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Centered Content Column for Full-Screen Mode */}
          <div className={`w-full ${isFullscreen ? 'max-w-4xl mx-auto flex-1 flex flex-col min-h-0 bg-white shadow-sm border-x border-stone-200/50' : 'flex-1 flex flex-col min-h-0'}`}>

          {/* Status Indicator Bar */}
          <div className="px-4 py-2 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between text-[11px] text-stone-600 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium">
                {settings.aiAssistantEnabled
                  ? 'AI Concierge & Stylist Team Active'
                  : 'Live Concierge Active (AI Disabled)'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">ID: {sessionId.slice(-6).toUpperCase()}</span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/60">
            {/* Welcoming Message */}
            <div className="flex gap-2.5 max-w-[88%]">
              <div className="w-7 h-7 rounded-full bg-white border border-stone-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={brandLogo}
                  alt="AESTHETX"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs border border-stone-200 text-stone-800 text-xs leading-relaxed">
                  <p className="font-semibold text-[#162B23] mb-1">Welcome to AESTHETX LIFESTYLE 👋</p>
                  <p>
                    {settings.welcomeMessage ||
                      'Have questions about our collections, sizing, availability, or nationwide delivery? Ask us anything — our team is here to assist you.'}
                  </p>
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block ml-1 font-mono">Official Support</span>
              </div>
            </div>

            {/* AI Disabled Notification Banner */}
            {!settings.aiAssistantEnabled && (
              <div className="p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-normal flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-950">Direct Concierge Inbox Active:</span>
                  Your inquiry has been routed to our executive support team. We will respond promptly.
                </div>
              </div>
            )}

            {/* Render Conversation Messages */}
            {messages.map((msg, msgIndex) => {
              const isCustomer = msg.sender === 'customer';
              const isAI = msg.sender === 'ai';
              const isSystem = msg.sender === 'system';

              if (isSystem) {
                return (
                  <div key={`${msg.id || 'sys'}-${msgIndex}`} className="flex justify-center my-2">
                    <div className="max-w-[92%] px-3 py-1.5 bg-stone-200/80 text-stone-700 text-[11px] rounded-lg text-center leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`${msg.id || 'msg'}-${msgIndex}`}
                  className={`flex gap-2.5 max-w-[88%] ${isCustomer ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs overflow-hidden ${
                      isCustomer
                        ? 'bg-[#C85A32] text-white'
                        : 'bg-white border border-stone-200'
                    }`}
                  >
                    {isCustomer ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <img
                        src={brandLogo}
                        alt="AESTHETX"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        isCustomer
                          ? 'bg-[#162B23] text-white rounded-tr-xs'
                          : isAI
                          ? 'bg-emerald-50/80 text-emerald-950 border border-emerald-200/70 rounded-tl-xs'
                          : 'bg-white text-stone-800 border border-stone-200 rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span
                          className={`text-[10px] font-bold ${
                            isCustomer
                              ? 'text-[#8FA89B]'
                              : isAI
                              ? 'text-emerald-800 flex items-center gap-1'
                              : 'text-[#C85A32]'
                          }`}
                        >
                          {isCustomer ? 'You' : isAI ? 'AESTHETX AI' : 'Support Executive'}
                        </span>
                        <span
                          className={`text-[9px] ${
                            isCustomer ? 'text-stone-400' : 'text-stone-500'
                          } font-mono`}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-line select-text">{msg.text}</p>
                    </div>

                    {/* Interactive Recommended Products Cards */}
                    {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                      <div className="mt-2 space-y-1.5 w-full max-w-xs">
                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                          Curated Recommendations:
                        </span>
                        <div className="space-y-1.5">
                          {msg.recommendedProducts.map((p, pIdx) => (
                            <div
                              key={`${p.id || p.slug || 'p'}-${pIdx}`}
                              className="bg-white border border-stone-200 hover:border-[#1E3A2F] rounded-xl p-2 shadow-2xs flex items-center justify-between gap-2 transition-all"
                            >
                              <div
                                onClick={() => handleProductNavigate(p.slug || p.id)}
                                className="flex items-center gap-2 truncate cursor-pointer hover:opacity-90 flex-1"
                              >
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-10 h-10 object-cover rounded-lg border border-stone-100 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                                    <Shirt className="w-4 h-4 text-stone-400" />
                                  </div>
                                )}
                                <div className="truncate">
                                  <span className="text-xs font-bold text-stone-900 block truncate" title={p.name}>
                                    {p.name}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-[#1E3A2F]">
                                      ৳{p.salePrice || p.price}
                                    </span>
                                    {p.salePrice && p.price > p.salePrice && (
                                      <span className="text-[10px] text-stone-400 line-through">
                                        ৳{p.price}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleProductNavigate(p.slug || p.id)}
                                className="px-2.5 py-1.5 bg-[#1E3A2F] hover:bg-[#2D5042] text-white text-[11px] font-bold rounded-lg shrink-0 transition-colors shadow-2xs cursor-pointer active:scale-95"
                              >
                                View Piece
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 3-dot Typing Indicator */}
            {isAiTyping && (
              <div className="flex gap-2 items-center my-1">
                <div className="w-7 h-7 rounded-full bg-white border border-stone-200 overflow-hidden flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                  <img
                    src={brandLogo}
                    alt="AESTHETX"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="bg-white border border-stone-200 px-3.5 py-2.5 rounded-2xl rounded-tl-xs flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="p-2 bg-stone-100/90 border-t border-stone-200 shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <button
              onClick={() => handleQuickQuestion('Show me trending shirts and poloss')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-400/80 text-emerald-900 font-semibold rounded-full text-[11px] whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-emerald-700" />
              <span>Trending Collection</span>
            </button>

            <button
              onClick={() => handleQuickQuestion('Show top bestselling garments and their prices')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-full text-[11px] whitespace-nowrap transition-colors cursor-pointer"
            >
              <Shirt className="w-3 h-3 text-[#1E3A2F]" />
              <span>Bestsellers & Pricing</span>
            </button>

            <button
              onClick={() => handleQuickQuestion('How does Cash on Delivery and bKash / Nagad verification work?')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-full text-[11px] whitespace-nowrap transition-colors cursor-pointer"
            >
              <Package className="w-3 h-3 text-emerald-700" />
              <span>Payment & Orders</span>
            </button>

            <button
              onClick={() => handleQuickQuestion('What are the delivery charges and shipping times across Bangladesh?')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-full text-[11px] whitespace-nowrap transition-colors cursor-pointer"
            >
              <Truck className="w-3 h-3 text-[#C85A32]" />
              <span>Shipping & Delivery</span>
            </button>

            <button
              onClick={() => handleQuickQuestion('What is your exchange and return policy?')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-full text-[11px] whitespace-nowrap transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-purple-700" />
              <span>Return Policy</span>
            </button>
          </div>

          {/* Footer Input Area */}
          <div className="p-3 bg-white border-t border-stone-200 shrink-0">
            {settings.customerChatEnabled === false ? (
              <div className="p-3 bg-stone-100 rounded-xl text-center text-xs text-stone-600">
                <p className="font-semibold text-stone-800">Live Concierge is temporarily offline.</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  For immediate assistance, please call: <span className="font-bold text-[#162B23]">01708943242</span>
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="আপনার প্রশ্ন এখানে লিখুন..."
                  disabled={isSending}
                  className="flex-1 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-100/80 focus:bg-white border border-stone-200 focus:border-[#162B23] focus:ring-1 focus:ring-[#162B23] rounded-xl text-xs outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-2.5 bg-[#162B23] hover:bg-[#1E3A2F] disabled:bg-stone-300 text-white rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            )}

            <div className="mt-2 flex items-center justify-between text-[10px] text-stone-500 px-1">
              <span>Secure Session • Privacy Protected</span>
              <span className="flex items-center gap-1 font-mono">
                <PhoneCall className="w-2.5 h-2.5 text-[#C85A32]" /> 01708943242
              </span>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
};
