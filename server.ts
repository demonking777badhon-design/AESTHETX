import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio runtime environment constraint: dev server must run on port 3000
// Nginx reverse proxy listens on 8080 and forwards to port 3000.
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini client initialized with telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

import { paymentRouter } from './server/payments/routes.js';
import { getGatewayState } from './server/payments/gatewayState.js';

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    store: 'AESTHETX LIFESTYLE',
    time: new Date().toISOString()
  });
});

// Automatic bKash & Nagad Payment Verification API Router
app.use('/api/payments', paymentRouter);

/**
 * Server-Side Customer Support AI Endpoint
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. AI Assistant is strictly disabled unless `isAIEnabled === true`.
 *    If disabled, NO Gemini API calls are made under any circumstance.
 * 2. If the conversation is marked `isTakenOverByAdmin === true`,
 *    AI generation is prevented to allow uninterrupted human agent dialogue.
 */
/**
 * Server-Side Customer Support AI Endpoint
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. AI Assistant is strictly disabled unless `isAIEnabled === true` and `aiStatusMode === 'active'`.
 *    If disabled or paused, NO Gemini API calls are made under any circumstance.
 * 2. If the conversation is marked `isTakenOverByAdmin === true`,
 *    AI generation is prevented to allow uninterrupted human agent dialogue.
 * 3. Deep grounding on real catalog, live order status, and Admin Knowledge Base.
 */
/**
 * Detect Language (Bengali vs English)
 * Prioritizes Bengali for Bangladeshi customers, especially for numbers or short phrases.
 */
function detectIsBangla(userMessage: string, conversationHistory: any[] = []): boolean {
  if (!userMessage) return true;
  if (/[\u0980-\u09FF]/.test(userMessage)) return true;
  // If recent conversation has any Bengali, default to Bengali
  if (Array.isArray(conversationHistory)) {
    for (const m of conversationHistory) {
      if (typeof m.text === 'string' && /[\u0980-\u09FF]/.test(m.text)) {
        return true;
      }
    }
  }
  const trimmed = userMessage.trim();
  // Short numerals or size tokens like "56", "42", "M", "XL", "size 40" default to Bengali in Bangladeshi store
  if (/^[\d০-৯\s.,?!'\-a-zA-Z]{1,15}$/.test(trimmed)) {
    return true;
  }
  return !/^[a-zA-Z\s.,?!'-]+$/.test(trimmed);
}

/**
 * Robust Size & Quantity Parser
 * Accurately extracts customer's size selection (shoe numbers, apparel sizes, volume, weight).
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

  // 1. Clothing size check: S, M, L, XL, XXL, 2XL, 3XL, XXXL, XS, Free Size
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

  // 2. Numeric size (Shoe numbers, e.g. 56, 42, 40, 39, etc.)
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

  // 3. Volume (ml, L)
  const volMatch = normalizedText.match(
    /^(?:পরিমাণ|সাইজ)?\s*(\d+(?:\.\d+)?)\s*(ml|l|liter|litres?|মিলি|লিটার)\s*(?:হবে|আছে|লাগবে)?$/i
  );
  if (volMatch) {
    return { type: 'volume', value: `${volMatch[1]} ${volMatch[2]}`, normalizedValue: `${volMatch[1]}${volMatch[2].toLowerCase()}` };
  }

  // 4. Weight (g, kg)
  const weightMatch = normalizedText.match(
    /^(?:ওজন|পরিমাণ)?\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|কেজি|গ্রাম)\s*(?:হবে|আছে|লাগবে)?$/i
  );
  if (weightMatch) {
    return { type: 'weight', value: `${weightMatch[1]} ${weightMatch[2]}`, normalizedValue: `${weightMatch[1]}${weightMatch[2].toLowerCase()}` };
  }

  return null;
}

/**
 * Handle Size / Quantity Selection Instantly
 * Grounded on catalog & conversation history.
 */
function handleSizeOrQuantitySelection(
  userMessage: string,
  conversationHistory: any[] = [],
  catalogContext: any[] = [],
  isBangla = true
): { text: string; matchedProducts: any[] } | null {
  const parsed = parseCustomerSizeOrQuantity(userMessage);
  if (!parsed) return null;

  // 1. Identify active product being discussed
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

  // 2. Extract available options
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
 * Resolve Instant Common Reply (Fast-path < 2ms)
 * For delivery, price, return, payment, showroom location, pleasantries, and follow-ups.
 */
function resolveInstantCommonReply(
  userMessage: string,
  conversationHistory: any[] = [],
  catalogContext: any[] = [],
  orderContext: any[] = [],
  knowledgeBase: any = null,
  isBangla = true
): { text: string; matchedProducts: any[] } | null {
  const rawLower = userMessage.toLowerCase().trim();
  const clean = rawLower.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Order tracking query
  const orderMatch = userMessage.match(/ORD-[\w\d]+/i);
  if (orderMatch && Array.isArray(orderContext) && orderContext.length > 0) {
    const o = orderContext[0];
    const reply = isBangla
      ? `আপনার অর্ডার #${o.orderNumber || o.id} বর্তমানে "${o.orderStatus}" অবস্থায় আছে (মোট বিল: ৳${o.totalAmount})। খুব দ্রুত ডেলিভারি হয়ে যাবে।`
      : `Your Order #${o.orderNumber || o.id} status is "${o.orderStatus}". Total amount: ৳${o.totalAmount}. Our delivery team is dispatching it.`;
    return { text: reply, matchedProducts: [] };
  }

  // 2. Active Product Price inquiry: "কত দাম?", "দাম কত?", "price"
  if (/^(দাম\s*কত|কত\s*দাম|price|price\s*koto|koto\s*dam|দাম\s*কতো|কতো\s*দাম)$/i.test(clean)) {
    let activeProduct: any = null;
    if (Array.isArray(conversationHistory)) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        if (Array.isArray(msg.recommendedProducts) && msg.recommendedProducts.length > 0) {
          activeProduct = msg.recommendedProducts[0];
          break;
        }
      }
    }
    if (activeProduct) {
      const price = activeProduct.salePrice || activeProduct.price;
      const stock = activeProduct.totalStock !== undefined ? `${activeProduct.totalStock} পিস` : 'স্টকে';
      const reply = isBangla
        ? `জি ভাইয়া, এই ${activeProduct.name}-এর দাম পড়বে মাত্র ৳${price} (${stock} এভেইলেবল আছে)। পছন্দ হলে নিচে 'অর্ডার করুন' বাটনে চাপ দিয়ে খুব সহজেই অর্ডার করতে পারেন!`
        : `Sure brother, the price of ${activeProduct.name} is ৳${price}. You can order directly using the button below.`;
      return { text: reply, matchedProducts: [activeProduct] };
    }
  }

  // 3. Delivery / Shipping inquiry
  if (
    /(ডেলিভারি\s*চার্জ|ডেলিভারি\s*কত|কতদিন\s*লাগবে|কবে\s*পাব|শিপিং|কুরিয়ার|পার্সেল\s*কবে|ডেলিভারি\s*ফ্রি|delivery\s*charge|shipping\s*fee|shipping\s*charge|delivery\s*time)/i.test(
      clean
    )
  ) {
    const shippingText = knowledgeBase?.shippingInfo?.trim() || 'ঢাকার ভেতরে ডেলিভারি চার্জ ৳৭০-৮০ (২-৩ দিন) আর ঢাকার বাইরে ৳১২০-১৫০ (৩-৫ দিন)।';
    const reply = isBangla
      ? `${shippingText} ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।`
      : `${shippingText} Cash on Delivery is available.`;
    return { text: reply, matchedProducts: [] };
  }

  // 4. Return & Exchange policy inquiry
  if (
    /(রিটার্ন\s*পলিসি|এক্সচেঞ্জ\s*নিয়ম|বদলানো\s*যাবে|ফেরত\s*দেওয়া\s*যাবে|রিপ্লেসমেন্ট|return\s*policy|exchange\s*policy)/i.test(
      clean
    )
  ) {
    const returnText = knowledgeBase?.returnPolicy?.trim() || 'ডেলিভারির ৭ দিনের মধ্যে সাইজ না মিললে বা কোনো সমস্যা থাকলে সহজে ফ্রি এক্সচেঞ্জ বা রিপ্লেসমেন্ট সুবিধা পাবেন ভাইয়া।';
    const reply = isBangla ? returnText : returnText;
    return { text: reply, matchedProducts: [] };
  }

  // 5. Payment methods inquiry
  if (
    /(ক্যাশ\s*অন\s*ডেলিভারি|বিকাশ|নগদ|পেমেন্ট\s*পদ্ধতি|টাকা\s*কীভাবে|cod\s*আছে|payment\s*method|bkash\s*available|nagad\s*available)/i.test(
      clean
    ) &&
    !/(কিনতে\s*চাই|অর্ডার\s*করব|পণ্য|টি-শার্ট|জুতা|শার্ট|পণ্য\s*দেখান)/i.test(clean)
  ) {
    const gw = getGatewayState();
    const activeChannelsBn: string[] = ['ক্যাশ অন ডেলিভারি (COD)'];
    const activeChannelsEn: string[] = ['Cash on Delivery (COD)'];
    if (gw.bkashEnabled) {
      activeChannelsBn.push('বিকাশ (bKash)');
      activeChannelsEn.push('bKash');
    }
    if (gw.nagadEnabled) {
      activeChannelsBn.push('নগদ (Nagad)');
      activeChannelsEn.push('Nagad');
    }

    const dynamicPaymentReplyBn =
      activeChannelsBn.length === 1
        ? 'আমাদের কাছে বর্তমানে শুধুমাত্র ক্যাশ অন ডেলিভারি (COD) এর মাধ্যমে পেমেন্ট সুবিধা চালু রয়েছে ভাইয়া।'
        : `আমাদের কাছে বর্তমানে ${activeChannelsBn.join(' এবং ')} মাধ্যমে পেমেন্টের সুবিধা রয়েছে ভাইয়া।`;
    const dynamicPaymentReplyEn =
      activeChannelsEn.length === 1
        ? 'Currently only Cash on Delivery (COD) payment is enabled at our store.'
        : `We currently accept ${activeChannelsEn.join(' and ')} for payment.`;

    const paymentText =
      gw.bkashEnabled && gw.nagadEnabled && knowledgeBase?.paymentMethods?.trim()
        ? knowledgeBase.paymentMethods.trim()
        : isBangla
        ? dynamicPaymentReplyBn
        : dynamicPaymentReplyEn;
    return { text: paymentText, matchedProducts: [] };
  }

  // 6. Location / Showroom inquiry
  if (
    /(দোকান\s*কোথায়|শোরুম\s*কোথায়|অফিস\s*কোথায়|ঠিকানা\s*কোথায়|লোকেশন\s*কোথায়|showroom\s*address|shop\s*location)/i.test(
      clean
    )
  ) {
    const storeText = knowledgeBase?.storeOverview?.trim();
    const reply = isBangla
      ? (storeText && storeText.includes('ঢাকা') ? `${storeText}` : `আমাদের মূল কার্যক্রম অনলাইন ভিত্তিক এবং পুরো বাংলাদেশজুড়ে হোম ডেলিভারি দেওয়া হয় ভাইয়া।`)
      : `We are primarily an online brand delivering all over Bangladesh right to your doorstep.`;
    return { text: reply, matchedProducts: [] };
  }

  // 7. Greetings
  if (
    /^(হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s*আছেন|কেমন\s*আসো|ভাল\s*আছেন|ভালো\s*আছেন|hi|hello|hey|salam)$/i.test(
      clean
    )
  ) {
    const reply = isBangla
      ? `আলহামদুলিল্লাহ ভাইয়া, ভালো আছি। স্বাগতম AESTHETX-এ! আপনাকে কীভাবে সাহায্য করতে পারি?`
      : `Hello! Welcome to AESTHETX. How can I assist you today?`;
    return { text: reply, matchedProducts: [] };
  }

  // 8. Thanks
  if (
    /^(ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাঙ্কস|থ্যাংকস|ধন্যবাদ\s*ভাই|thanks|thank\s*you)$/i.test(
      clean
    )
  ) {
    const reply = isBangla
      ? `আপনাকেও অনেক ধন্যবাদ ভাইয়া! যেকোনো প্রয়োজনে আমাদের জানাতে পারেন।`
      : `You are most welcome! Let us know if you need anything else.`;
    return { text: reply, matchedProducts: [] };
  }

  // 9. Short follow-up
  if (/^(আর|আর\s*কিছু|আর\s*নেই|আর\s*নাই|more|anything\s*else)$/i.test(clean)) {
    const reply = isBangla ? `না ভাইয়া, আপাতত এটার আর নেই।` : `No brother, we don't have any more of this at the moment.`;
    return { text: reply, matchedProducts: [] };
  }

  // 10. Specific item demand check for missing category
  const demandReply = extractCustomerDemandAndReply(userMessage, isBangla, catalogContext);
  if (demandReply) {
    return { text: demandReply, matchedProducts: [] };
  }

  return null;
}

/**
 * Precise Intent Detection:
 * Distinguishes genuine product/shopping requests from general conversation.
 */
function hasProductSuggestionIntent(userMessage: string): boolean {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const rawLower = userMessage.toLowerCase().trim();
  const clean = rawLower.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  // If customer is choosing a size or quantity (e.g. "56", "42", "M", "L"), affirmative shopping intent!
  if (parseCustomerSizeOrQuantity(userMessage)) {
    return true;
  }

  // 1. Explicit conversational and general non-product queries (strictly NO product suggestion):
  // Greetings / pleasantries
  if (
    /^(হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s*আছেন|কেমন\s*আসো|ভাল\s*আছেন|ভালো\s*আছেন|hi|hello|hey|salam|good\s*morning|good\s*evening|good\s*afternoon)$/i.test(
      clean
    )
  ) {
    return false;
  }

  // Thanks / acknowledgements / closure
  if (
    /^(ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাঙ্কস|থ্যাংকস|ধন্যবাদ\s*ভাই|thanks|thank\s*you|ok|okay|accha|achha|আচ্ছা|হাঁ|হ্যাঁ|ঠিক\s*আছে|বুঝতে\s*পেরেছি|জ্বী|জি|হুম|হুমম|বাই|bye|allah\s*hafez|আল্লাহ\s*হাফেজ)$/i.test(
      clean
    )
  ) {
    return false;
  }

  // Delaying / thinking
  if (
    /^(একটু\s*ভেবে\s*দেখি|ভেবে\s*জানাচ্ছি|পরে\s*নেব|পরে\s*নেবো|পরে\s*অর্ডার\s*করব|পরে\s*জানাচ্ছি|পরে\s*কথা\s*হবে)$/i.test(
      clean
    )
  ) {
    return false;
  }

  // Delivery / shipping questions
  if (
    /(ডেলিভারি\s*চার্জ|ডেলিভারি\s*কত|কতদিন\s*লাগবে|কবে\s*পাব|শিপিং|কুরিয়ার|পার্সেল\s*কবে|ডেলিভারি\s*ফ্রি|delivery\s*charge|shipping\s*fee|shipping\s*charge|how\s*many\s*days|delivery\s*time)/i.test(
      clean
    )
  ) {
    return false;
  }

  // Payment methods
  if (
    /(ক্যাশ\s*অন\s*ডেলিভারি|বিকাশ|নগদ|পেমেন্ট\s*পদ্ধতি|টাকা\s*কীভাবে|cod\s*আছে|payment\s*method|bkash\s*available|nagad\s*available)/i.test(
      clean
    ) &&
    !/(কিনতে\s*চাই|অর্ডার\s*করব|পণ্য|টি-শার্ট|জুতা|শার্ট|পণ্য\s*দেখান)/i.test(clean)
  ) {
    return false;
  }

  // Location / Showroom / Contact info
  if (
    /(দোকান\s*কোথায়|শোরুম\s*কোথায়|অফিস\s*কোথায়|ঠিকানা\s*কোথায়|লোকেশন\s*কোথায়|phone\s*number|mobile\s*number|হটলাইন|hotline|showroom\s*address|shop\s*location)/i.test(
      clean
    )
  ) {
    return false;
  }

  // Return & Exchange policy questions
  if (
    /(রিটার্ন\s*পলিসি|এক্সচেঞ্জ\s*নিয়ম|বদলানো\s*যাবে|ফেরত\s*দেওয়া\s*যাবে|রিপ্লেসমেন্ট|return\s*policy|exchange\s*policy)/i.test(
      clean
    )
  ) {
    return false;
  }

  // Order status lookup
  if (
    /ORD-[\w\d]+/i.test(clean) ||
    /(আমার\s*অর্ডার|অর্ডার\s*স্ট্যাটাস|ট্র্যাকিং|track\s*order|পার্সেল\s*কোথায়)/i.test(clean)
  ) {
    return false;
  }

  // 2. Affirmative product shopping / suggestion triggers:
  // Product category nouns
  const hasProductKeyword =
    /(t-shirt|t-shert|tshirt|tshert|tee|tees|টি-শার্ট|টি শার্ট|টিশার্ট|গেঞ্জি|shirt|shert|শার্ট|পোলো|polo|পাঞ্জাবি|panjabi|punjabi|হুডি|hoodie|জ্যাকেট|jacket|জুতো|জুতা|স্নিকার্স|লোফার|কেডস|স্যান্ডেল|shoe|shoes|sneaker|sneakers|loafer|ঘড়ি|ঘড়ি|watch|watches|পারফিউম|আতর|perfume|attar|ব্যাগ|bag|প্যান্ট|জিন্স|pant|pants|jeans|জুস|শরবত|পানীয়|পানীয়|juice|drink|drinks|beverage|খাবার|চাল|ডাল|আটা|চিনি|মসলা|মধু|food|grocery|rice|dal|sugar)/i.test(
      clean
    );

  // Intent verbs
  const hasShoppingAction =
    /(দেখান|দেখাও|দেখতে\s*চাই|কিনতে\s*চাই|অর্ডার\s*করব|নিতে\s*চাই|খুঁজছি|আছে\s*কি|আছে\s*নাকি|স্টকে\s*আছে|সাজেশন|সাজেস্ট|সাজেস্ট\s*করুন|কালেকশন|নতুন\s*কি|নতুন\s*কিছু|শো\s*করুন|show|show\s*me|display|recommend|suggest|buy|order|collection)/i.test(
      clean
    );

  if (hasProductKeyword) {
    if (hasShoppingAction || clean.split(/\s+/).length <= 4) {
      return true;
    }
  }

  // General browsing: "কালেকশন দেখান", "প্রোডাক্ট দেখান", "কিছু প্রোডাক্ট দেখান", "নতুন কী আছে"
  if (/(প্রোডাক্ট|কালেকশন|আইটেম|পণ্য)\s*(দেখান|দেখাও|দেখতে\s*চাই|আছে)/i.test(clean)) {
    return true;
  }

  // Asking for other options: "আর কি কোন ... নেই?", "অন্য কিছু দেখান", "আরো দেখান"
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
 * Intelligent Size & Quantity Unit Prompt Generator
 * Generates the correct size/quantity inquiry based on product category & configured options.
 * NEVER asks "M, L, XL" for shoes, drinks, food, or electronics!
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
  const isToyOrCar = /toy|toys|খেলনা|car|cars|গাড়ি|গাড়ি|কার\b|vehicle|truck|jeep|hotwheels|diecast|lego|doll|robot/i.test(
    categoryName
  );

  if (isToyOrCar) {
    const validToyOptions = availableOptions.filter(
      (o) => !/^(XS|S|M|L|XL|XXL|2XL|3XL|38|39|40|41|42|43|44|45)$/i.test(o)
    );
    if (validToyOptions.length > 0) {
      return isBangla
        ? `আপনার কোন মডেল বা কালারটি পছন্দ — ${validToyOptions.slice(0, 5).join(', ')}?`
        : `Which model or color do you prefer — ${validToyOptions.slice(0, 5).join(', ')}?`;
    }
    return isBangla
      ? `পছন্দ হলে সরাসরি নিচের বাটনে চাপ দিয়ে কয়টি পিস লাগবে তা বেছে নিয়ে সহজেই অর্ডার করে নিতে পারেন!`
      : `If you like it, choose the quantity and order directly using the button below!`;
  }

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

  // Fallback defaults per category if no explicit sizes array exists
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
 * Intelligent Catalog Product Matcher
 * Matches only when customer intent calls for product suggestions.
 */
function matchCatalogProducts(
  userMessage: string,
  catalogContext: any[],
  conversationHistory: any[] = []
): any[] {
  if (!Array.isArray(catalogContext) || catalogContext.length === 0) return [];

  // CRITICAL RULE: If customer is NOT asking for product suggestions (e.g., asking about delivery,
  // store address, greetings, or casual talk), NEVER return products!
  if (!hasProductSuggestionIntent(userMessage)) {
    return [];
  }

  const rawLower = userMessage.toLowerCase();
  const cleanQuery = rawLower.replace(/[?!,.:;()_]/g, ' ');

  // Identify already shown products in recent conversation
  const shownProductNames = new Set<string>();
  const shownProductIds = new Set<string>();
  if (Array.isArray(conversationHistory)) {
    conversationHistory.forEach((msg: any) => {
      if (Array.isArray(msg.recommendedProducts)) {
        msg.recommendedProducts.forEach((p: any) => {
          if (p.id) shownProductIds.add(p.id);
          if (p.name) shownProductNames.add(p.name.toLowerCase());
        });
      }
      if (typeof msg.text === 'string') {
        catalogContext.forEach((catItem: any) => {
          if (catItem.name && msg.text.includes(catItem.name)) {
            shownProductIds.add(catItem.id);
            shownProductNames.add(catItem.name.toLowerCase());
          }
        });
      }
    });
  }

  const isAskingForMore =
    /আর\s*(কি|কী)?\s*(কোন|কোনো|কিছু|ডিজাইন|কালার|অপশন)?|অন্য\s*(কোন|কোনো|কিছু|ডিজাইন|কালার)|আরো\s*(কোন|কোনো)?|more|other|another/i.test(
      userMessage
    );

  const isShortFollowUp = /^(আর|আর\s*কিছু|আর\s*নেই|আর\s*নাই|আর\s*কোনোটা|আর\s*কোনটা|more|anything\s*else)$/i.test(
    cleanQuery.trim()
  );

  if (isShortFollowUp) {
    return [];
  }

  const synonymGroups = [
    {
      group: 't-shirt',
      terms: [
        't-shirt', 't-shert', 'tshirt', 'tshert', 't shirt', 't shert',
        'tee', 'tees', 'টি-শার্ট', 'টি শার্ট', 'টিসার্ট', 'টি-সার্ট',
        'টিশার্ট', 'গেঞ্জি'
      ]
    },
    {
      group: 'shirt',
      terms: ['shirt', 'shert', 'শার্ট']
    },
    {
      group: 'polo',
      terms: ['polo', 'পোলো', 'পোলো শার্ট']
    },
    {
      group: 'panjabi',
      terms: ['panjabi', 'punjabi', 'পাঞ্জাবি', 'পাঞ্জাবী']
    },
    {
      group: 'hoodie',
      terms: ['hoodie', 'hoody', 'হুডি']
    },
    {
      group: 'jacket',
      terms: ['jacket', 'জ্যাকেট']
    },
    {
      group: 'shoes',
      terms: ['shoe', 'shoes', 'sneaker', 'sneakers', 'জুতো', 'জুতা', 'স্নিকার্স', 'লোফার', 'loafer', 'কেডস', 'স্যান্ডেল', 'sandals']
    },
    {
      group: 'pants',
      terms: ['pant', 'pants', 'trouser', 'trousers', 'জিন্স', 'jeans', 'প্যান্ট', 'ট্রাউজার']
    },
    {
      group: 'watch',
      terms: ['watch', 'watches', 'ঘড়ি', 'ঘড়ি']
    },
    {
      group: 'bag',
      terms: ['bag', 'backpack', 'ব্যাগ', 'ব্যাকপ্যাক', 'ওয়ালেট', 'wallet']
    },
    {
      group: 'perfume',
      terms: ['perfume', 'attar', 'আতর', 'পারফিউম', 'সুগন্ধি']
    },
    {
      group: 'juice',
      terms: ['juice', 'drink', 'drinks', 'beverage', 'জুস', 'শরবত', 'পানীয়', 'পানীয়', 'চা', 'কফি']
    },
    {
      group: 'grocery',
      terms: ['grocery', 'food', 'চাল', 'ডাল', 'আটা', 'চিনি', 'ময়দা', 'মসলা', 'মধু', 'rice', 'dal', 'flour', 'sugar', 'spice', 'honey']
    }
  ];

  const activeGroups = new Set<string>();
  for (const group of synonymGroups) {
    if (group.terms.some((t) => cleanQuery.includes(t))) {
      activeGroups.add(group.group);
    }
  }

  const generalBrowseTerms = [
    'product', 'পোশাক', 'কাপড়', 'কালেকশন', 'আইটেম', 'কালেকশনগুলো',
    'দেখান', 'দেখাও', 'দেখা', 'দেখতে চাই', 'show', 'show me', 'display', 'view', 'list',
    'কিনতে চাই', 'দাম কত', 'price', 'recommend', 'buy', 'shop', 'stock'
  ];
  const hasSpecificCategory = activeGroups.size > 0;
  const isGeneralBrowse = !hasSpecificCategory && generalBrowseTerms.some((t) => cleanQuery.includes(t));

  const scored = catalogContext.map((item) => {
    let score = 0;
    const nameLower = (item.name || '').toLowerCase();
    const catLower = (item.category || '').toLowerCase();
    const subLower = (item.subcategory || '').toLowerCase();
    const tagsLower = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';

    if (activeGroups.has('t-shirt')) {
      if (
        nameLower.includes('t-shirt') ||
        nameLower.includes('tshirt') ||
        nameLower.includes('tee') ||
        subLower.includes('polo & t-shirts') ||
        subLower.includes("men's fashion")
      ) {
        score += 80;
      }
      if (nameLower.includes('black') && (cleanQuery.includes('black') || cleanQuery.includes('কালো'))) {
        score += 25;
      }
    }
    if (activeGroups.has('shirt') && !activeGroups.has('t-shirt')) {
      if (nameLower.includes('shirt') && !nameLower.includes('t-shirt')) {
        score += 70;
      }
    }
    if (activeGroups.has('polo')) {
      if (nameLower.includes('polo') || subLower.includes('polo')) score += 70;
    }
    if (activeGroups.has('panjabi')) {
      if (nameLower.includes('panjabi') || catLower.includes('panjabi') || subLower.includes('panjabi')) score += 70;
    }
    if (activeGroups.has('hoodie')) {
      if (nameLower.includes('hoodie') || subLower.includes('hoodie')) score += 70;
    }
    if (activeGroups.has('shoes')) {
      if (catLower.includes('shoe') || subLower.includes('shoe') || nameLower.includes('shoe') || nameLower.includes('sneaker')) score += 75;
    }
    if (activeGroups.has('juice')) {
      if (nameLower.includes('juice') || catLower.includes('drink') || catLower.includes('beverage') || catLower.includes('food')) score += 75;
    }
    if (activeGroups.has('grocery')) {
      if (catLower.includes('grocery') || catLower.includes('food') || subLower.includes('grocery')) score += 75;
    }

    const queryTokens = cleanQuery.split(/\s+/).filter((w) => w.length >= 2);
    for (const token of queryTokens) {
      if (['একটি', 'একটা', 'আমাকে', 'দয়া', 'করে', 'দেখান', 'দেখাও', 'আছে', 'কি', 'the', 'for', 'show', 'and', 'with'].includes(token)) {
        continue;
      }
      if (token === 'shert' || token === 't-shert' || token === 'tshert') {
        if (nameLower.includes('shirt') || nameLower.includes('t-shirt')) {
          score += 65;
        }
      }
      if (nameLower.includes(token)) score += 35;
      else if (subLower.includes(token) || catLower.includes(token)) score += 20;
      else if (tagsLower.includes(token)) score += 15;
    }

    if (score === 0 && isGeneralBrowse && (item.totalStock === undefined || item.totalStock > 0)) {
      score += 10;
    }

    const resolvedImage = item.image || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '');

    return {
      item: {
        ...item,
        id: item.id || `prod_${Date.now()}`,
        image: resolvedImage,
        slug: item.slug || item.id,
        price: item.price || item.salePrice || 1200,
        salePrice: item.salePrice || item.price || 1200
      },
      score
    };
  });

  // Strict requirement: When customer asks for T-shirt, show ONLY T-shirts or related tops, never unrelated items
  if (activeGroups.has('t-shirt')) {
    let tshirtOnly = catalogContext.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const sub = (item.subcategory || '').toLowerCase();
      return (
        name.includes('t-shirt') ||
        name.includes('tshirt') ||
        name.includes('t-shert') ||
        name.includes('tee') ||
        name.includes('polo') ||
        sub.includes('polo & t-shirts') ||
        sub.includes('t-shirt')
      );
    });

    if (isAskingForMore && (shownProductIds.size > 0 || shownProductNames.size > 0)) {
      tshirtOnly = tshirtOnly.filter(
        (item) => !shownProductIds.has(item.id) && !shownProductNames.has((item.name || '').toLowerCase())
      );
    }

    if (tshirtOnly.length > 0) {
      return tshirtOnly.slice(0, 3).map((item) => ({
        ...item,
        id: item.id || `prod_${Date.now()}`,
        image: item.image || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : ''),
        slug: item.slug || item.id,
        price: item.price || item.salePrice || 1200,
        salePrice: item.salePrice || item.price || 1200
      }));
    } else if (isAskingForMore) {
      return [];
    }
  }

  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);

  if (matches.length > 0) {
    return matches.slice(0, 4);
  }

  // If customer inquired about a specific category that does not exist in store, return empty!
  if (activeGroups.size > 0) {
    return [];
  }

  if (isGeneralBrowse) {
    return catalogContext.slice(0, 4).map((p) => ({
      ...p,
      id: p.id || `prod_${Date.now()}`,
      image: p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : ''),
      slug: p.slug || p.id,
      price: p.price || p.salePrice || 1200,
      salePrice: p.salePrice || p.price || 1200
    }));
  }

  return [];
}

/**
 * Demand-Aware Response Extractor
 * Identifies the specific item, color, cut, size, or style requested by the customer,
 * and replies stating whether THAT EXACT ITEM or ATTRIBUTE is available or not.
 * Respects real store catalog (if store has shoes or drinks in stock, it won't falsely claim they don't exist).
 */
function extractCustomerDemandAndReply(
  userMessage: string,
  isBangla: boolean,
  catalogContext: any[] = []
): string | null {
  const lowerMsg = userMessage.toLowerCase().trim();
  const cleanMsg = lowerMsg.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  const hasInCatalog = (keywordRegex: RegExp) => {
    return catalogContext.some((item) => {
      const text = `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      return keywordRegex.test(text);
    });
  };

  // 1. SPECIFIC ITEM REQUESTS
  if (/জুতো|জুতা|স্নিকার্স|কেডস|স্যান্ডেল|shoe|shoes|sneaker|sandals/i.test(cleanMsg)) {
    if (hasInCatalog(/shoe|shoes|sneaker|জুতো|জুতা|স্নিকার্স|লোফার/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত আমাদের কোনো জুতো বা স্নিকার্স কালেকশন নেই।`
      : `No brother, we do not have any shoes or sneakers at our store currently.`;
  }
  if (/ঘড়ি|ঘড়ি|হাতঘড়ি|হাতঘড়ি|watch|watches/i.test(cleanMsg)) {
    if (hasInCatalog(/watch|ঘড়ি|ঘড়ি/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো ঘড়ি নেই।`
      : `No brother, we do not have any watches at our store.`;
  }
  if (/পারফিউম|আতর|সুগন্ধি|বডি\s*স্প্রে|perfume|attar|body\s*spray|fragrance/i.test(cleanMsg)) {
    if (hasInCatalog(/perfume|attar|আতর|পারফিউম/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো পারফিউম বা আতর নেই।`
      : `No brother, we do not have any perfumes or attar at our store.`;
  }
  if (/ব্যাগ|ওয়ালেট|মানিব্যাগ|ব্যাকপ্যাক|bag|backpack|wallet/i.test(cleanMsg)) {
    if (hasInCatalog(/bag|backpack|wallet|ব্যাগ/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো ব্যাগ বা ওয়ালেট নেই।`
      : `No brother, we do not have any bags or wallets at our store.`;
  }
  if (/প্যান্ট|জিন্স|ট্রাউজার|গ্যাবার্ডিন|pant|pants|jeans|trouser/i.test(cleanMsg)) {
    if (hasInCatalog(/pant|pants|jeans|trouser|প্যান্ট|জিন্স/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত আমাদের কোনো প্যান্ট বা জিন্স কালেকশন নেই।`
      : `No brother, we do not have any pants or jeans in stock at the moment.`;
  }
  if (/হুডি|জ্যাকেট|সোয়েটার|hoodie|hoodies|jacket|sweater/i.test(cleanMsg)) {
    if (hasInCatalog(/hoodie|jacket|sweater|হুডি|জ্যাকেট/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত আমাদের কোনো হুডি বা জ্যাকেট কালেকশন নেই।`
      : `No brother, we do not have any hoodies or jackets in stock at the moment.`;
  }
  if (/পাঞ্জাবি|পায়জামা|panjabi|punjabi/i.test(cleanMsg)) {
    if (hasInCatalog(/panjabi|punjabi|পাঞ্জাবি/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত আমাদের কোনো পাঞ্জাবি কালেকশন নেই।`
      : `No brother, we do not have any panjabis in stock at the moment.`;
  }
  if (/জুস|শরবত|পানীয়|পানীয়|juice|drink|beverage/i.test(cleanMsg)) {
    if (hasInCatalog(/juice|drink|beverage|শরবত|জুস|পানীয়/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত আমাদের কোনো পানীয় কালেকশন নেই।`
      : `No brother, we do not have any beverages in stock at the moment.`;
  }
  if (/চাল|ডাল|আটা|চিনি|চালডাল|grocery/i.test(cleanMsg)) {
    if (hasInCatalog(/rice|dal|sugar|flour|grocery|চাল|ডাল|চিনি/i)) return null;
    return isBangla
      ? `না ভাইয়া, আপাতত গ্রোসারি খাদ্যদ্রব্য স্টকে নেই।`
      : `No brother, groceries are not available at the moment.`;
  }
  if (/ক্যাপ|টুপি|মাথার\s*টুপি|cap|hat/i.test(cleanMsg)) {
    if (hasInCatalog(/cap|hat|ক্যাপ|টুপি/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো ক্যাপ বা টুপি নেই।`
      : `No brother, we do not have caps or hats.`;
  }
  if (/বেল্ট|belt/i.test(cleanMsg)) {
    if (hasInCatalog(/belt|বেল্ট/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো বেল্ট নেই।`
      : `No brother, we do not have belts.`;
  }
  if (/চশমা|সানগ্লাস|sunglass|glasses/i.test(cleanMsg)) {
    if (hasInCatalog(/sunglass|glasses|চশমা/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে কোনো চশমা বা সানগ্লাস নেই।`
      : `No brother, we do not have sunglasses.`;
  }
  if (/শাড়ি|থ্রি-পিস|মেয়েদের|লেডিস|লেডিজ|saree|kurti|dress/i.test(cleanMsg)) {
    if (hasInCatalog(/saree|kurti|dress|শাড়ি|লেডি/i)) return null;
    return isBangla
      ? `না ভাইয়া, আমাদের এখানে মেয়েদের পোশাক বা শাড়ি নেই।`
      : `No brother, we do not have ladies wear or sarees.`;
  }

  // 2. SPECIFIC ATTRIBUTES / SPECIFICATIONS (কোন জিনিসের বিবরণ যদি না থাকে)
  if (/লাল|red/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত লাল কালারের কোনো টি-শার্ট নেই ভাইয়া। আমাদের ক্লাসিক ব্ল্যাক (কালো) টি-শার্ট এভেইলেবল আছে।`
      : `We do not have red T-shirts at the moment brother. We have classic black available.`;
  }
  if (/সাদা|ধবধবে|white/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত সাদা রঙের কোনো টি-শার্ট নেই ভাইয়া। আমাদের ব্ল্যাক টি-শার্ট এভেইলেবল আছে।`
      : `We do not have white T-shirts at the moment brother. We have black available.`;
  }
  if (/নীল|নেভি|blue|navy/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত নীল বা নেভি কালারের কোনো টি-শার্ট নেই ভাইয়া।`
      : `We do not have blue color T-shirts at the moment brother.`;
  }
  if (/সবুজ|green/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত সবুজ কালারের কোনো টি-শার্ট নেই ভাইয়া।`
      : `We do not have green color T-shirts at the moment brother.`;
  }
  if (/ড্রপ\s*শোল্ডার|ড্রপশোল্ডার|drop\s*shoulder/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত আমাদের ড্রপ শোল্ডার কোনো টি-শার্ট নেই ভাইয়া। রেগুলার ফিটের ক্লাসিক টি-শার্ট রয়েছে।`
      : `We do not have drop shoulder T-shirts at the moment brother. We have regular fit.`;
  }
  if (/ওভারসাইজ|ওভারসাইজড|oversize|oversized/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত আমাদের ওভারসাইজড কোনো টি-শার্ট নেই ভাইয়া।`
      : `We do not have oversized T-shirts at the moment brother.`;
  }
  if (/ফুল\s*হাতা|ফুল\s*স্লিভ|full\s*sleeve|long\s*sleeve/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত আমাদের কোনো ফুল হাতা টি-শার্ট নেই ভাইয়া, শুধু হাফ হাতা রয়েছে।`
      : `We do not have full sleeve T-shirts at the moment brother, only half sleeve.`;
  }
  if (/\bxxl\b|\b2xl\b|ডাবল\s*এক্সএল/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত XXL সাইজটি স্টকে নেই ভাইয়া। আমাদের কাছে M, L ও XL সাইজ এভেইলেবল আছে।`
      : `XXL size is not in stock at the moment brother. M, L and XL are available.`;
  }
  if (/\b3xl\b|\bxxxl\b/i.test(cleanMsg)) {
    return isBangla
      ? `আপাতত 3XL সাইজটি নেই ভাইয়া।`
      : `3XL size is not available at the moment brother.`;
  }

  return null;
}

/**
 * Intelligent In-House Assistant Response Generator
 * Natural, category-accurate Bengali & English replies.
 * Only talks when suggestions are not requested.
 */
function generateIntelligentFallbackReply(
  userMessage: string,
  matchedProducts: any[],
  orderContext: any[],
  knowledgeBase: any,
  conversationHistory: any[] = [],
  catalogContext: any[] = []
): string {
  const isBangla = detectIsBangla(userMessage, conversationHistory);
  const lowerMsg = userMessage.toLowerCase().trim();
  const cleanMsg = lowerMsg.replace(/[?!,.:;()_]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Order tracking query
  const orderMatch = userMessage.match(/ORD-[\w\d]+/i);
  if (orderMatch && Array.isArray(orderContext) && orderContext.length > 0) {
    const o = orderContext[0];
    if (isBangla) {
      return `আপনার অর্ডার #${o.orderNumber || o.id} বর্তমানে "${o.orderStatus}" অবস্থায় আছে (মোট বিল: ৳${o.totalAmount})। খুব দ্রুত ডেলিভারি হয়ে যাবে।`;
    } else {
      return `Your Order #${o.orderNumber || o.id} status is "${o.orderStatus}". Total amount: ৳${o.totalAmount}. Our delivery team is dispatching it.`;
    }
  }

  // 2. Delivery / Shipping inquiry (ONLY talk, no product suggestion)
  if (/(ডেলিভারি|শিপিং|কুরিয়ার|delivery|shipping)/i.test(cleanMsg)) {
    const shippingText = knowledgeBase?.shippingInfo?.trim() || 'ঢাকার ভেতরে ডেলিভারি চার্জ ৳৭০-৮০ (২-৩ দিন) আর ঢাকার বাইরে ৳১২০-১৫০ (৩-৫ দিন)।';
    return isBangla
      ? `${shippingText} ক্যাশ অন ডেলিভারিতে পার্সেল চেক করে নিতে পারবেন ভাইয়া।`
      : `${shippingText} Cash on Delivery available.`;
  }

  // 3. Return / Exchange policy inquiry (ONLY talk, no product suggestion)
  if (/(রিটার্ন|exchange|এক্সচেঞ্জ|বদলানো|ফেরত|return)/i.test(cleanMsg)) {
    const returnText = knowledgeBase?.returnPolicy?.trim() || 'ডেলিভারির ৭ দিনের মধ্যে সাইজ না মিললে বা কোনো সমস্যা থাকলে সহজে ফ্রি এক্সচেঞ্জ বা রিপ্লেসমেন্ট সুবিধা পাবেন ভাইয়া।';
    return returnText;
  }

  // 4. Payment methods inquiry (ONLY talk)
  if (/(ক্যাশ\s*অন\s*ডেলিভারি|বিকাশ|নগদ|পেমেন্ট|payment|bkash|nagad|cod)/i.test(cleanMsg)) {
    const gw = getGatewayState();
    const activeChannelsBn: string[] = ['ক্যাশ অন ডেলিভারি (COD)'];
    const activeChannelsEn: string[] = ['Cash on Delivery (COD)'];
    if (gw.bkashEnabled) {
      activeChannelsBn.push('বিকাশ (bKash)');
      activeChannelsEn.push('bKash');
    }
    if (gw.nagadEnabled) {
      activeChannelsBn.push('নগদ (Nagad)');
      activeChannelsEn.push('Nagad');
    }
    if (gw.bkashEnabled && gw.nagadEnabled && knowledgeBase?.paymentMethods?.trim()) {
      return knowledgeBase.paymentMethods.trim();
    }
    if (isBangla) {
      return activeChannelsBn.length === 1
        ? 'আমাদের কাছে বর্তমানে শুধুমাত্র ক্যাশ অন ডেলিভারি (COD) এর মাধ্যমে পেমেন্ট সুবিধা চালু রয়েছে ভাইয়া।'
        : `আমাদের কাছে বর্তমানে ${activeChannelsBn.join(' এবং ')} মাধ্যমে পেমেন্টের সুবিধা চালু রয়েছে ভাইয়া।`;
    }
    return activeChannelsEn.length === 1
      ? 'Currently only Cash on Delivery (COD) payment is enabled at our store.'
      : `We currently accept ${activeChannelsEn.join(' and ')} for payment.`;
  }

  // 5. Showroom / Location inquiry (ONLY talk)
  if (/(দোকান|শোরুম|অফিস|ঠিকানা|লোকেশন|showroom|address|location)/i.test(cleanMsg)) {
    const storeText = knowledgeBase?.storeOverview?.trim();
    if (storeText && storeText.includes('ঢাকা')) {
      return storeText;
    }
    return isBangla
      ? `আমাদের মূল কার্যক্রম অনলাইন ভিত্তিক এবং পুরো বাংলাদেশজুড়ে হোম ডেলিভারি দেওয়া হয় ভাইয়া।`
      : `We are primarily an online brand delivering all over Bangladesh right to your doorstep.`;
  }

  // 6. Greetings & Casual pleasantries (ONLY talk, no product suggestion)
  if (
    /^(হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s*আছেন|কেমন\s*আসো|ভাল\s*আছেন|hi|hello|hey|salam)/i.test(
      cleanMsg
    )
  ) {
    if (isBangla) {
      return `আলহামদুলিল্লাহ ভাইয়া, ভালো আছি। স্বাগতম AESTHETX-এ! আপনাকে কীভাবে সাহায্য করতে পারি?`;
    } else {
      return `Hello! Welcome to AESTHETX. How can I assist you today?`;
    }
  }

  // 7. Thanks / pleasantries (ONLY talk)
  if (/^(ধন্যবাদ|থ্যাংক\s*ইউ|থ্যাংকস|thanks|thank\s*you)/i.test(cleanMsg)) {
    if (isBangla) {
      return `আপনাকেও অনেক ধন্যবাদ ভাইয়া! যেকোনো প্রয়োজনে আমাদের জানাতে পারেন।`;
    } else {
      return `You are most welcome! Let us know if you need anything else.`;
    }
  }

  // 8. Follow-up short inquiry: "আর?" / "আর কিছু?" / "আর নাই?" / "আর নেই?"
  const isShortFollowUp = /^(আর|আর\s*কিছু|আর\s*নেই|আর\s*নাই|আর\s*কোনোটা|আর\s*কোনটা|more|anything\s*else)$/i.test(
    cleanMsg
  );
  if (isShortFollowUp && matchedProducts.length === 0) {
    return isBangla
      ? `না ভাইয়া, আপাতত এটার আর নেই।`
      : `No brother, we don't have any more of this at the moment.`;
  }

  // 9. Specific demand check (Item or Specification / Attribute)
  const demandReply = extractCustomerDemandAndReply(userMessage, isBangla, catalogContext);
  if (demandReply && matchedProducts.length === 0) {
    return demandReply;
  }

  // 10. Asking for other/more products of a category
  const isAskingForMore =
    /আর\s*(কি|কী)?\s*(কোন|কোনো|কিছু|ডিজাইন|কালার|অপশন)?|অন্য\s*(কোন|কোনো|কিছু|ডিজাইন|কালার)|আরো\s*(কোন|কোনো)?|more|other|another/i.test(
      userMessage
    );

  if (isAskingForMore && matchedProducts.length === 0) {
    return isBangla
      ? `আপাতত আর কোনো এই রকম কালেকশন নেই ভাইয়া। তবে খুব শীঘ্রই আমরা নতুন কালেকশন নিয়ে আসবো!`
      : `We don't have any other items like this at the moment brother. But we will bring a new collection soon!`;
  }

  // 11. When products are matched and user has product suggestion intent:
  if (matchedProducts.length > 0 && hasProductSuggestionIntent(userMessage)) {
    const primary = matchedProducts[0];
    const price = primary.salePrice || primary.price || 1200;
    const stock = primary.totalStock !== undefined ? `${primary.totalStock} পিস` : 'স্টকে';
    let rawDesc = primary.description || primary.shortDescription || '';

    // Physical reality check: never allow clothing descriptions on toys, cars, or hard items
    const isToyOrCar = /toy|toys|খেলনা|car|cars|গাড়ি|গাড়ি|কার\b|vehicle|truck|jeep|hotwheels|diecast|lego|doll|robot/i.test(
      `${primary.category || ''} ${primary.subcategory || ''} ${primary.name || ''}`
    );
    if (isToyOrCar && /আরামদায়ক|ফেব্রিক|সুতি|টি-শার্ট|ফিটিং|পরা|পরিধান|কাপড়/i.test(rawDesc)) {
      rawDesc = 'মজবুত ও টেকসই বডি, নিখুঁত ফিনিশিং ও স্মুথ চাকা সমৃদ্ধ আকর্ষণীয় খেলনা গাড়ি। শিশুদের খেলার জন্য সম্পূর্ণ নিরাপদ ও শৌখিন গিফটের সেরা পছন্দ।';
    }

    const cleanDesc = rawDesc ? rawDesc.replace(/\r?\n|\r/g, ' ').replace(/[।.\s]+$/, '').slice(0, 90).trim() : '';
    const descText = cleanDesc ? `${cleanDesc}। ` : '';

    const intro = isAskingForMore
      ? `জি ভাইয়া, আমাদের আরও কালেকশন আছে! যেমন এই ${primary.name}-টা দেখতে পারেন।`
      : `জি ভাইয়া, আমাদের এই ${primary.name}-টা দেখতে পারেন।`;

    const sizeOrUnitPrompt = getProductSizeOrUnitPrompt(primary, isBangla);

    if (isBangla) {
      return `${intro} ${descText}দাম পড়বে মাত্র ৳${price} (স্টকে ${stock} আছে)।\n\n${sizeOrUnitPrompt} পছন্দ হলে নিচের 'অর্ডার করুন' বাটনে চাপ দিয়ে সহজেই অর্ডার করে নিতে পারেন।`;
    } else {
      return `Sure! You can check out our ${primary.name}. ${descText}Price is only ৳${price} (${stock} in stock).\n\n${sizeOrUnitPrompt} You can order directly using the button below.`;
    }
  }

  // 12. If customer specifically asked for an unavailable product
  const isProductInquiry =
    /আছে|দেখান|দেখাও|খুঁজছি|চাই|কিনতে|প্রোডাক্ট|পোশাক|shoe|shoes|sneaker|watch|perfume|bag|pant|pants|trouser|jeans|hoodie|jacket|dress|শার্ট|জুতো|জুতা|ঘড়ি|ঘড়ি|আতর|পারফিউম|ব্যাগ|প্যান্ট|জিন্স|পাঞ্জাবি|হুডি|জ্যাকেট|item|product|stock/i.test(
      userMessage
    );

  if (isProductInquiry) {
    if (isBangla) {
      return `আপাতত এই আইটেমটি আমাদের কালেকশনে নেই ভাইয়া। তবে খুব শীঘ্রই আমরা নিয়ে আসবো!`;
    } else {
      return `Sorry brother, this item is currently not in our collection. We will bring it soon!`;
    }
  }

  // 13. General conversational reply (NO products attached!)
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    return isBangla
      ? `জি ভাইয়া, বিষয়টি বুঝতে পেরেছি। আপনাকে আর কীভাবে সাহায্য করতে পারি বলুন?`
      : `Got it brother! How else can I assist you today?`;
  }

  if (isBangla) {
    return `স্বাগতম AESTHETX-এ! যেকোনো তথ্য জানতে বা আমাদের কালেকশন দেখতে চাইলে জানাতে পারেন ভাইয়া।`;
  } else {
    return `Welcome to AESTHETX! Let us know if you have any questions or want to explore our collection!`;
  }
}

app.post('/api/support/ai-reply', async (req, res) => {
  try {
    const {
      message: msgBody,
      userMessage,
      conversationHistory = [],
      catalogContext = [],
      orderContext = [],
      knowledgeBase = null,
      isAIEnabled = true,
      aiStatusMode = 'active',
      isTakenOverByAdmin = false
    } = req.body;

    const message = (msgBody || userMessage || '').trim();

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        reason: 'INVALID_INPUT',
        message: 'Query text is required.'
      });
    }

    const isBangla = detectIsBangla(message, conversationHistory);

    // 1. Direct Size or Quantity Selection fast-path (e.g. customer clicks or types "42", "M", "L")
    const sizeReply = handleSizeOrQuantitySelection(
      message,
      conversationHistory,
      catalogContext,
      isBangla
    );
    if (sizeReply) {
      return res.status(200).json({
        success: true,
        text: sizeReply.text,
        reply: sizeReply.text,
        matchedProducts: sizeReply.matchedProducts,
        proposedAction: null
      });
    }

    // 2. Strict Order ID Lookup ONLY if customer explicitly typed just an Order number (e.g., "ORD-123456")
    const pureOrderMatch = message.trim().match(/^ORD-[\w\d]+$/i);
    if (pureOrderMatch && Array.isArray(orderContext) && orderContext.length > 0) {
      const o = orderContext[0];
      const reply = isBangla
        ? `আপনার অর্ডার #${o.orderNumber || o.id} বর্তমানে "${o.orderStatus}" অবস্থায় রয়েছে (মোট বিল: ৳${o.totalAmount})। খুব দ্রুত ডেলিভারি সম্পন্ন হবে ভাইয়া।`
        : `Your Order #${o.orderNumber || o.id} is currently "${o.orderStatus}". Total: ৳${o.totalAmount}. Our delivery team is dispatching it.`;
      return res.status(200).json({
        success: true,
        text: reply,
        reply: reply,
        matchedProducts: [],
        proposedAction: null
      });
    }

    // Secondary catalog fuzzy match (acts as a backup helper)
    const fallbackMatched = matchCatalogProducts(message, catalogContext, conversationHistory);

    // 3. Prepare rich live store context for Gemini
    let catalogSummary = 'No active products found in store catalog.';
    if (Array.isArray(catalogContext) && catalogContext.length > 0) {
      catalogSummary = catalogContext
        .slice(0, 45)
        .map((p: any) => {
          const price = p.salePrice || p.price;
          const stock = p.totalStock !== undefined ? `${p.totalStock} in stock` : 'In stock';
          const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? `Sizes: ${p.sizes.join(', ')}` : '';
          const colors = Array.isArray(p.colors) && p.colors.length > 0 ? `Colors: ${p.colors.map((c: any) => c.name || c).join(', ')}` : '';
          const desc = (p.description || p.shortDescription || '').slice(0, 100);
          return `- ID: "${p.id}" | Name: "${p.name}" | Price: ৳${price} | Category: ${p.category || 'General'} | Stock: ${stock} | ${sizes} ${colors} | Description: "${desc}"`;
        })
        .join('\n');
    }

    let orderSummary = 'No customer order history provided.';
    if (Array.isArray(orderContext) && orderContext.length > 0) {
      orderSummary = orderContext
        .slice(0, 5)
        .map((o: any) => {
          const itemsDesc = Array.isArray(o.items)
            ? o.items.map((i: any) => `${i.productName} (x${i.quantity})`).join(', ')
            : 'Items ordered';
          return `- Order #${o.orderNumber || o.id} | Status: ${o.orderStatus} | Payment: ${o.paymentStatus} (৳${o.totalAmount}) | Delivery Zone: ${o.deliveryZone || 'Standard'}\n  Items: ${itemsDesc}`;
        })
        .join('\n');
    }

    const gwState = getGatewayState();
    const activeGatewayList = [
      'Cash on Delivery (COD)',
      ...(gwState.bkashEnabled ? ['bKash'] : []),
      ...(gwState.nagadEnabled ? ['Nagad'] : [])
    ];
    const kbShipping = knowledgeBase?.shippingInfo || 'Inside Dhaka: ৳70-৳80 (2-3 days). Outside Dhaka: ৳120-৳150 (3-5 days). Cash on Delivery available all over Bangladesh.';
    const kbPayment =
      gwState.bkashEnabled && gwState.nagadEnabled && knowledgeBase?.paymentMethods
        ? knowledgeBase.paymentMethods
        : `Active Payment Methods: ${activeGatewayList.join(', ')}. (bKash is ${gwState.bkashEnabled ? 'ENABLED' : 'DISABLED'}, Nagad is ${gwState.nagadEnabled ? 'ENABLED' : 'DISABLED'}).`;
    const kbReturns = knowledgeBase?.returnPolicy || '7-day replacement/exchange for defective, damaged, or wrong sized items with brand tags intact.';
    const kbStore = knowledgeBase?.storeOverview || 'AESTHETX LIFESTYLE is a premium Bangladeshi apparel and fashion lifestyle brand. Buying clothes is cheaper than therapy.';
    const kbNotes = knowledgeBase?.customNotes || 'Be polite, warm, and helpful. Always understand customer typos and Banglish seamlessly.';

    const systemInstruction = `
You are "AESTHETX AI" — an ultra-intelligent, friendly e-commerce shopping and customer assistant for "AESTHETX LIFESTYLE" (a premier Bangladeshi fashion brand).
You have the full intelligence, emotional empathy, and deep linguistic understanding of ChatGPT and Gemini.

CRITICAL INTELLIGENCE & TYPO RULES (বানান ভুল ও সকল ভাষা বোঝার ক্ষমতা):
1. DEEP TYPO & INTENT RECOGNITION:
   Customers write in diverse formats:
   - Standard Bengali: "আপনাদের কালো টি-শার্ট আছে?", "ডেলিভারি চার্জ কত?"
   - Misspelled Bengali: "টিশাট", "টি শাট", "টিসার্ট", "সার্ট", "গেঞ্জি", "কালো গেঙ্গি", "ডেলিবরি", "জুতা"
   - Banglish / Romanized Bangla: "apnader black t-shert ache?", "dam koto vai?", "koto dine ashbe?", "dhakar baire delevery hobe?", "ami ekta order korte chai kivabe korbo?", "shoe er size 42 hobe naki?", "bhai panjabi ache?", "bkshe tk dewa jabe?", "vai amr order ta kobe pabo?"
   - Severe Banglish typos: "tshrt", "tshert", "kalo", "shada", "delivary", "ordar", "pikup", "dam koto", "shart", "snikers", "jeanz", "hoody", "fotwear"
   - English: "Do you have black tees?", "What is the return policy?", "How to track my order?"
   UNDERSTAND THE CUSTOMER'S ACTUAL INTENT even if almost every word has a typo, misspelled phonetics, or casual slang! Never say you don't understand just because of a typo.

2. CONVERSATIONAL TONE & STYLE:
   - Warm, natural, and helpful (like a friendly store staff, e.g. "জি ভাইয়া/আপু...").
   - Strictly 1 to 2 short sentences. Concise and to the point.
   - Match the customer's language (if they write in Bengali, reply in natural Bengali; if Banglish, reply in natural Bengali or polite Banglish; if English, reply in English).

3. PRODUCT RECOMMENDATIONS:
   - When the customer asks about products (looking for an item, asking for colors, sizes, price, recommendations, or expressing interest in buying):
     • Recommend the matching product from the catalog below with its real name, price (৳), and available sizes/options.
     • At the VERY END of your reply, include the exact product ID tag: [SHOW_PRODUCTS: <productId1>, <productId2>]
     • Example: "জি ভাইয়া, আমাদের ক্লাসিক ব্ল্যাক টি-শার্ট রয়েছে, দাম মাত্র ৳৬৯০। [SHOW_PRODUCTS: prod_xxx]"
   - When the customer is asking general questions (delivery charge, delivery time, showroom address, cash on delivery, bKash/Nagad payment, return/exchange policy, greetings like hi/hello, thanks):
     • Give a direct, accurate answer from the store policies below.
     • DO NOT include any [SHOW_PRODUCTS: ...] tag! Keep the screen clean.

4. MISSING OR OUT-OF-STOCK ITEMS:
   - If the customer asks for an item not in the catalog (e.g. watch, shoes, perfume, panjabi when not present), politely state that we don't currently have it and suggest what we do have (e.g. "আপাতত আমাদের কাছে ঘড়ি নেই ভাইয়া, তবে আমাদের প্রিমিয়াম টি-শার্ট কালেকশন রয়েছে!").

5. SENSITIVE ACTIONS:
   - If the customer wants to cancel an order, request a refund, or complain about a defective delivery, assure them helpfully and append:
     [PROPOSED_ACTION: order_cancellation / order_refund / escalate_complaint, <brief reason>]

6. CATEGORY-SPECIFIC VOCABULARY & DOMAIN TERMINOLOGY (কোন জিনিসের জন্য কোন শব্দ ব্যবহার করবেন):
   - পোশাক / টি-শার্ট / শার্ট / প্যান্ট / পাঞ্জাবি (Apparel & Clothing):
     • সাইজ: S, M, L, XL, XXL (বা ক্যাটালগে উল্লেখিত সাইজ)। ভুলেও জুতার মতো নম্বর (৩৯-৪৪) বা ওজন (কেজি) বলবেন না।
     • যথোপযুক্ত শব্দ: "কাপড় / ফেব্রিক", "১০০% প্রিমিয়াম সুতি / কম্বড কটন", "কালার / রঙ", "ফিটিং (রেগুলার ফিট / ওভারসাইজড / ড্রপ শোল্ডার)", "হাফ হাতা / ফুল হাতা", "সুইং ও স্টিচিং কোয়ালিটি", "পরা / পরিধান করা", "বুকের মাপ / চেস্ট সাইজ"।
     • উদাহরণ: "জি ভাইয়া, এই টি-শার্টের কাপড় ১০০% কম্বড সুতির তৈরি, খুবই আরামদায়ক ও ব্রিদেবল।"
   - জুতো / স্নিকার্স / কেডস / স্যান্ডেল (Footwear):
     • সাইজ: জুতার নম্বর ৩৯, ৪০, ৪১, ৪২, ৪৩, ৪৪ (ইউরো নম্বর)। ভুলেও কখনো জুতার ক্ষেত্রে S, M, L, XL বলবেন না!
     • যথোপযুক্ত শব্দ: "সোল (Sole)", "গ্রিপ", "কমফোর্ট ইনসোল", "ম্যাটেরিয়াল / লেদার / ক্যানভাস", "হাঁটার সুবিধা", "এক জোড়া (Pair)", "পায়ের মাপ"।
   - ঘড়ি / গ্যাজেট / ইলেকট্রনিক্স (Watches & Gadgets):
     • যথোপযুক্ত শব্দ: "ওয়ারেন্টি / গ্যারান্টি", "ব্যাটারি ব্যাকআপ", "ডিসপ্লে", "স্ট্র্যাপ / চেইন", "ডায়াল", "পিস (Piece)"।
   - সুগন্ধি / পারফিউম / আতর (Fragrance):
     • যথোপযুক্ত শব্দ: "ফ্র্যাগ্রেন্স", "সুগন্ধি", "লঞ্জিভিটি / স্থায়ীত্ব", "নোটস (টপ, মিডল, বেস)", "অ্যালকোহল ফ্রি", "বোতল", "ml (মিলিলিটার)"।
   - খাদ্য / মুদি / পানীয় (Food, Drinks & Grocery):
     • যথোপযুক্ত শব্দ: "ওজন (গ্রাম, কেজি)", "পরিমাণ (ml, লিটার)", "টাটকা / ফ্রেশ", "উপাদান", "মেয়াদ", "প্যাকেট / জার"।
   - খেলনা / গাড়ি / টয় কার / ডাইকাস্ট / মডেল ভেহিকল / রোবট / গেম (Toys & Cars):
     • কঠোর নিষেধাজ্ঞা: ভুলেও কখনো গাড়ি বা খেলনাকে "আরামদায়ক" (comfortable), "আরামদায়ক ফিটিং", "ফেব্রিক", "সুতি কাপড়" বা "পরা / পরিধান করা" বলবেন না! গাড়ি কোনো পোশাক নয়, এটি একটি শক্ত ধাতব বা প্লাস্টিকের খেলার জিনিস।
     • সাইজ: খেলনা গাড়িতে কোনো M, L, XL বা জুতার সাইজ থাকে না।
     • যথোপযুক্ত শব্দ: "খেলনা গাড়ি / টয় কার", "মজবুত ও শক্ত বিল্ড কোয়ালিটি", "মেটাল / প্রিমিয়াম প্লাস্টিক বডি", "স্মুথ রোলিং হুইল / চাকা", "বাচ্চাদের খেলাধুলার জন্য নিরাপদ", "গিফট বা কালেকশনের জন্য দারুণ আকর্ষণীয়", "পিস (Piece)"।
     • উদাহরণ: "জি ভাইয়া, এটি একটি আকর্ষণীয় ও মজবুত খেলনা গাড়ি! শক্ত বডি ও স্মুথ চাকা রয়েছে, যা বাচ্চাদের খেলার জন্য এবং শৌখিন উপহারের দারুণ পছন্দ।"
   - প্রমিত ও মিষ্টি কথ্য ভাষা (Polite Colloquial Tone):
     • রোবটের মতো আক্ষরিক অনুবাদের জটিল সাধু ভাষা (যেমন: "আমরা আপনার দৃষ্টি আকর্ষণপূর্বক অবলোকন করিতে অনুরোধ করিতেছি") সম্পূর্ণ বর্জন করবেন।
     • একজন সত্যিকারের বাঙালি সেলস কনসালট্যান্টের মতো আন্তরিক, মিষ্টি ও সাবলীল কথ্য ভাষায় কথা বলুন।

7. PHYSICAL OBJECT REALITY & STRICT TRUTHFULNESS (বাস্তব জিনিস বুঝে কথা বলা):
   - যেকোনো পণ্যের উত্তর দেওয়ার আগে জিনিসটি বাস্তবে কী (খেলনা গাড়ি, জুতো, ঘড়ি, কাপড়, নাকি সুগন্ধি) তা সতর্কভাবে বুঝে উত্তর দিন।
   - কোনো খেলনা, গাড়ি, ঘড়ি, পারফিউম বা জুতোকে কাপড়ের মতো "আরামদায়ক ফিটিং", "সুতি কাপড়" বা "M/L/XL সাইজ" বলবেন না।
   - স্টোরের ক্যাটালগে যদি অতীতে কোনো প্রডাক্টে অসাবধানতাবশত ভুল বিবরণও লেখা থাকে (যেমন কোনো গাড়ির বর্ণনায় যদি ভুল করে আরামদায়ক ফিটিং লেখা থাকে), আপনি সেই ভুল অন্ধের মতো আওড়াবেন না! একজন তীক্ষ্ণ বুদ্ধিমান অ্যাসিস্ট্যান্টের মতো গাড়িকে শক্ত মেটাল/প্লাস্টিকের আকর্ষণীয় খেলার জিনিস হিসেবেই সত্য ও সুন্দরভাবে তুলে ধরুন।

STORE POLICIES & KNOWLEDGE BASE:
- Delivery Rates & Times: ${kbShipping}
- Payment Methods: ${kbPayment}
- Returns & Exchanges: ${kbReturns}
- Store Overview & Address: ${kbStore}
- Custom Staff Guidelines: ${kbNotes}

CUSTOMER ORDERS (if any):
${orderSummary}

STORE PRODUCT CATALOG:
${catalogSummary}
`.trim();

    const contents: any[] = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationHistory.slice(-8).forEach((msg: any) => {
        const text = msg.text || msg.message || '';
        if (!text) return;
        const sender = msg.sender || (msg.role === 'user' ? 'customer' : 'model');
        if (sender === 'customer' || sender === 'user') {
          contents.push({ role: 'user', parts: [{ text }] });
        } else {
          contents.push({ role: 'model', parts: [{ text }] });
        }
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    let replyText = '';
    let recommendedProductIds: string[] = [];
    let detectedAction: any = null;

    // 4. Multi-model Gemini fallback with high-quota gemini-3.1-flash-lite as primary
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout')), 10000)
        );
        const genPromise = ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction
          }
        });
        const resp: any = await Promise.race([genPromise, timeoutPromise]);
        if (resp && resp.text && resp.text.trim()) {
          replyText = resp.text.trim();
          break;
        }
      } catch (mErr: any) {
        console.warn(`Gemini Model ${modelName} notice: ${mErr?.message?.slice(0, 90)}`);
      }
    }

    // 5. Parse intelligent tags from Gemini response
    if (replyText) {
      // Extract [SHOW_PRODUCTS: ...]
      const prodMatch = replyText.match(/\[SHOW_PRODUCTS:\s*([^\]]+)\]/i);
      if (prodMatch) {
        const ids = prodMatch[1]
          .split(',')
          .map((id: string) => id.trim())
          .filter(Boolean);
        recommendedProductIds = ids;
        replyText = replyText.replace(/\[SHOW_PRODUCTS:\s*[^\]]+\]/i, '').trim();
      }

      // Extract [PROPOSED_ACTION: ...]
      const actionMatch = replyText.match(/\[PROPOSED_ACTION:\s*([^,\]]+)(?:,\s*([^\]]+))?\]/i);
      if (actionMatch) {
        detectedAction = {
          actionType: actionMatch[1].trim(),
          reason: actionMatch[2]?.trim() || 'Customer requested in chat',
          queryText: message
        };
        replyText = replyText.replace(/\[PROPOSED_ACTION:\s*[^\]]+\]/i, '').trim();
      }
    }

    // 6. Intelligent fallback if Gemini was unreachable
    if (!replyText) {
      replyText = generateIntelligentFallbackReply(
        message,
        fallbackMatched,
        orderContext,
        knowledgeBase,
        conversationHistory,
        catalogContext
      );
    }

    // 7. Resolve matched products to full objects
    let finalMatchedProducts: any[] = [];
    if (recommendedProductIds.length > 0 && Array.isArray(catalogContext)) {
      finalMatchedProducts = catalogContext.filter((p: any) =>
        recommendedProductIds.some((id) =>
          id === p.id ||
          id.toLowerCase() === (p.slug || '').toLowerCase() ||
          (p.name && id.toLowerCase().includes(p.name.toLowerCase()))
        )
      );
    }

    // If Gemini recommended items or user explicitly asked and fuzzy matcher found them
    if (finalMatchedProducts.length === 0 && fallbackMatched.length > 0 && hasProductSuggestionIntent(message)) {
      finalMatchedProducts = fallbackMatched;
    }

    return res.status(200).json({
      success: true,
      text: replyText,
      reply: replyText,
      matchedProducts: finalMatchedProducts,
      proposedAction: detectedAction
    });
  } catch (error: any) {
    console.error('Customer Support AI Error:', error);
    const safeMatched = matchCatalogProducts(req.body?.message || '', req.body?.catalogContext || []);
    const safeReply = generateIntelligentFallbackReply(
      req.body?.message || '',
      safeMatched,
      req.body?.orderContext || [],
      req.body?.knowledgeBase || null
    );

    return res.status(200).json({
      success: true,
      text: safeReply,
      reply: safeReply,
      matchedProducts: safeMatched,
      proposedAction: null
    });
  }
});

/**
 * Server-Side AI Executive Daily/Weekly Report Generator
 */
app.post('/api/ai/generate-report', async (req, res) => {
  try {
    const { metricsData } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        reason: 'NO_API_KEY',
        message: 'GEMINI_API_KEY is not set on the server.'
      });
    }

    const prompt = `
You are the Chief AI Business Analyst for "AESTHETX LIFESTYLE" e-commerce store.
Analyze the following real store metrics and produce an executive business report in JSON format:

STORE METRICS:
${JSON.stringify(metricsData || {}, null, 2)}

Provide your response in strictly VALID JSON (no markdown wrappers) with keys:
{
  "summary": "2-3 sentences executive summary of performance and health",
  "insights": [
    "3-4 key business insights on orders, revenue, inventory, or support"
  ],
  "recommendations": [
    "3 specific, actionable recommendations for store admin"
  ]
}
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        summary: response.text || 'Performance report generated successfully.',
        insights: ['Orders and operations are active.'],
        recommendations: ['Monitor low-stock items regularly.']
      };
    }

    return res.status(200).json({
      success: true,
      report: parsed
    });
  } catch (err: any) {
    console.error('Report generation error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to generate report'
    });
  }
});

/**
 * Server-Side AI Inventory Health Audit
 */
app.post('/api/ai/audit-inventory', async (req, res) => {
  try {
    const { catalogSummary = [] } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        reason: 'NO_API_KEY',
        message: 'GEMINI_API_KEY is not set on the server.'
      });
    }

    const prompt = `
Analyze the following inventory catalog for "AESTHETX LIFESTYLE".
Find products with 0 stock, stock < 5, missing data, or pricing anomalies.

CATALOG SUMMARY:
${JSON.stringify(catalogSummary.slice(0, 40), null, 2)}

Provide your response in VALID JSON:
{
  "criticalAlerts": ["list of items needing urgent restock"],
  "catalogQualityIssues": ["list of items with missing images/descriptions/sizes"],
  "restockRecommendations": ["recommended units or action plan"]
}
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = { criticalAlerts: [], catalogQualityIssues: [], restockRecommendations: [] };
    }

    return res.status(200).json({
      success: true,
      audit: parsed
    });
  } catch (err: any) {
    console.error('Inventory audit error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to audit inventory'
    });
  }
});

/**
 * Smart Inventory & Customer Demand Query Handler
 * Strictly fulfills the 4 core admin rules:
 * 1. "স্টকের অবস্থা কি" -> Gives the complete, full stock list of all products.
 * 2. Mentions a specific item/category (e.g. "টি-শার্ট", "জুতা", "হুডি", "প্যান্ট") -> Gives the full stock list of that category.
 * 3. "কোন স্টক লাগবে" -> Gives the list of products with low/depleted stock (<=5) that need restocking.
 * 4. "নতুন কি আনা লাগবে" -> Gives the high-demand products requested by customers in support/inquiries.
 */
function handleInventoryAndDemandQuery(query: string, storeContext: any = {}): string | null {
  const q = (query || '').toLowerCase().trim();
  const {
    allProductsInventory = [],
    lowStockProducts = [],
    customerDemands = []
  } = storeContext;

  // Catalog items source (strictly real live store inventory)
  const inventoryList: any[] = Array.isArray(allProductsInventory) ? allProductsInventory : [];

  if (inventoryList.length === 0 && (q.includes('স্টক') || q.includes('stock') || q.includes('রিস্টক'))) {
    return `📦 **স্টোরের স্টক স্ট্যাটাস:**\nবর্তমানে স্টোর ক্যাটালগে কোনো প্রোডাক্ট যোগ করা নেই (০ টি প্রোডাক্ট)। প্রথমে "AI Product Adder" ব্যবহার করে প্রোডাক্ট যোগ করুন।`;
  }

  // 1. RULE 3: "কোন স্টক লাগবে" / "কোন প্রোডাক্ট লাগবে" (Low stock needing restock)
  const isRestockCheck =
    q.includes('কোন স্টক লাগবে') ||
    q.includes('কী স্টক লাগবে') ||
    q.includes('কি স্টক লাগবে') ||
    q.includes('কোন কোন স্টক লাগবে') ||
    q.includes('কোনটা স্টক লাগবে') ||
    q.includes('কোন প্রোডাক্ট লাগবে') ||
    q.includes('কী প্রোডাক্ট লাগবে') ||
    q.includes('কি প্রোডাক্ট লাগবে') ||
    q.includes('কোন মাল লাগবে') ||
    q.includes('কোন মাল কম') ||
    q.includes('কোন প্রোডাক্ট কম') ||
    q.includes('কোনটি কম আছে') ||
    q.includes('কোনগুলো কম আছে') ||
    q.includes('কোন প্রোডাক্টের স্টক কম') ||
    q.includes('রিস্টক লাগবে') ||
    q.includes('রিস্টক কোনটা') ||
    q.includes('রিস্টক করতে হবে') ||
    q.includes('স্টক শর্ট আছে') ||
    q.includes('স্টক শেষ হয়ে গেছে') ||
    (q.includes('স্টক লাগবে') && !q.includes('নতুন'));

  if (isRestockCheck) {
    const lowItems = inventoryList.filter((p: any) => (p.stock !== undefined && p.stock <= 5) || p.isLowStock);
    if (lowItems.length > 0) {
      const itemsFormatted = lowItems
        .sort((a: any, b: any) => (a.stock ?? 0) - (b.stock ?? 0))
        .map((p: any, idx: number) => {
          const isOut = (p.stock ?? 0) <= 0;
          const statusText = isOut ? '🔴 **আউট অফ স্টক (০ টি)**' : `⚠️ **${p.stock} টি অবশিষ্ট**`;
          const cat = p.category ? ` (ক্যাটাগরি: ${p.category})` : '';
          const sizes = p.sizes || p.variantsSummary ? ` | সাইজ: ${p.sizes || p.variantsSummary}` : '';
          return `${idx + 1}. **${p.name}**${cat}\n   • বর্তমান স্টক: ${statusText} | মূল্য: ৳${p.price || 0}${sizes}`;
        })
        .join('\n\n');

      return `⚠️ **যে প্রোডাক্টগুলোর স্টক কম এবং রিস্টক করা প্রয়োজন (মোট ${lowItems.length} টি):**\n\n${itemsFormatted}\n\n🎯 **পরামর্শ:** ওপরের প্রোডাক্টগুলোর স্টক শেষ বা প্রায় শেষ হয়ে গেছে। অবিলম্বে নতুন চালান অর্ডার বা রিস্টক করা প্রয়োজন।`;
    } else {
      return `✅ **স্টক স্ট্যাটাস:** বর্তমানে স্টোরের কোনো প্রোডাক্টের স্টক কম নেই। সকল প্রোডাক্টের স্টক পর্যাপ্ত রয়েছে (সবগুলো ৫ ইউনিটের ওপরে)।`;
    }
  }

  // 2. RULE 4: "নতুন কি আনা লাগবে" / "নতুন কি কোন প্রডাক্ট আনা লাগবে" / "ক্রেতারা কি ডিমান্ড করেছে"
  const isNewDemandCheck =
    q.includes('নতুন কি কোন প্রডাক্ট আনা লাগবে') ||
    q.includes('নতুন কি কোন প্রোডাক্ট আনা লাগবে') ||
    q.includes('নতুন কোন প্রডাক্ট আনা লাগবে') ||
    q.includes('নতুন কোনো প্রডাক্ট আনা লাগবে') ||
    q.includes('নতুন কোনো প্রোডাক্ট আনা লাগবে') ||
    q.includes('নতুন কি প্রোডাক্ট আনা লাগবে') ||
    q.includes('নতুন কী কোন প্রডাক্ট আনা লাগবে') ||
    q.includes('নতুন কি আনা লাগবে') ||
    q.includes('নতুন কী আনা লাগবে') ||
    q.includes('নতুন কি আনা') ||
    q.includes('নতুন কী আনা') ||
    q.includes('নতুন কি আনব') ||
    q.includes('নতুন কী আনব') ||
    q.includes('নতুন কোন প্রোডাক্ট') ||
    q.includes('নতুন কী প্রোডাক্ট') ||
    q.includes('নতুন কি প্রোডাক্ট') ||
    q.includes('নতুন কোন পণ্য') ||
    q.includes('নতুন কি তোলা') ||
    q.includes('নতুন কী তোলা') ||
    q.includes('নতুন কালেকশন') ||
    q.includes('ক্রেতারা কি ডিমান্ড') ||
    q.includes('ক্রেতারা কী ডিমান্ড') ||
    q.includes('ক্রেতাদের ডিমান্ড') ||
    q.includes('কাস্টমার ডিমান্ড') ||
    q.includes('কাস্টমাররা কি চায়') ||
    q.includes('কাস্টমাররা কী চায়') ||
    q.includes('গ্রাহকদের চাহিদা') ||
    q.includes('কী আনা উচিত') ||
    q.includes('কি আনা উচিত') ||
    q.includes('ডিমান্ড করেছে');

  if (isNewDemandCheck) {
    // Filter actual product demand inquiries from customers
    const realDemands: string[] = [];
    if (Array.isArray(customerDemands) && customerDemands.length > 0) {
      for (const d of customerDemands) {
        if (typeof d !== 'string') continue;
        const text = d.trim();
        if (!text) continue;
        // Ignore greetings / generic delivery questions
        const isGreetingOrGeneric = /^(hi|hello|hey|হাই|হ্যালো|সালাম|আসসালামু আলাইকুম|order|status|ডেলিভারি|কবে পাব|payment|bkash|নগদ|ঠিকানা|কোথায়)$/i.test(text);
        if (isGreetingOrGeneric) continue;

        // Check if looks like a product demand/inquiry
        const isProductQuery = /টি-শার্ট|টিশার্ট|শার্ট|জুতা|স্নিকার্স|হুডি|প্যান্ট|পাঞ্জাবি|পোলো|ঘড়ি|ব্যাগ|কালার|সাইজ|stock|size|color|t-shirt|shirt|pant|shoe|sneaker|hoodie|polo|watch|bag|perfume|আছে\s*(কি|কী)?|হবে\s*(কি|কী)?|লাগবে|চাই|পাব|পাওয়া যাবে|কবে আসবে/i.test(text);
        if (isProductQuery) {
          realDemands.push(text);
        }
      }
    }

    if (realDemands.length > 0) {
      const uniqueDemands = Array.from(new Set(realDemands)).slice(0, 5);
      const list = uniqueDemands.map((d, i) => `${i + 1}. ${d}`).join('\n');
      return `🛒 **গ্রাহকদের ডিমান্ড অনুযায়ী প্রোডাক্ট তালিকা:**\n\n${list}\n\nগ্রাহকরা সম্প্রতি এই পণ্যগুলোর জন্য অনুসন্ধান ও চাহিদা জানিয়েছেন।`;
    }

    // STRICT USER RULE: If no product is demanded by customers, answer strictly:
    return `আপাতত লাগবে না কোন কিছু।`;
  }

  // 3. RULE 2: Category / Specific Item Mentioned -> List all stock of that category
  const categoryKeywords: { pattern: RegExp; title: string; filterKey: string }[] = [
    { pattern: /টি-শার্ট|টিশার্ট|t-shirt|tshirt|tee|গেঞ্জি/i, title: 'টি-শার্ট (T-Shirts)', filterKey: 't-shirt' },
    { pattern: /জুতা|স্নিকার্স|shoe|shoes|sneaker|sneakers|স্যান্ডেল/i, title: 'জুতা ও স্নিকার্স (Footwear)', filterKey: 'shoe' },
    { pattern: /হুডি|হুদি|hoodie|hoodies|জ্যাকেট|jacket/i, title: 'হুডি ও উইন্টার ওয়্যার', filterKey: 'hoodie' },
    { pattern: /শার্ট|পোলো|shirt|polo/i, title: 'শার্ট ও পোলো (Shirts)', filterKey: 'shirt' },
    { pattern: /প্যান্ট|ট্রাউজার|কার্গো|pant|pants|cargo|trouser/i, title: 'প্যান্ট ও বটমস (Pants)', filterKey: 'pant' },
    { pattern: /পাঞ্জাবি|পাঞ্জাবী|panjabi/i, title: 'পাঞ্জাবি (Panjabi)', filterKey: 'panjabi' },
    { pattern: /পানীয়|পানীয়|জুস|juice|drink|beverage/i, title: 'পানীয় ও জুস', filterKey: 'drink' }
  ];

  for (const cat of categoryKeywords) {
    if (cat.pattern.test(q)) {
      const matched = inventoryList.filter((p: any) => {
        const name = (p.name || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        return (
          cat.pattern.test(name) ||
          cat.pattern.test(category) ||
          name.includes(cat.filterKey) ||
          category.includes(cat.filterKey)
        );
      });

      if (matched.length > 0) {
        const totalUnits = matched.reduce((sum: number, p: any) => sum + (p.stock ?? 0), 0);
        const listText = matched.map((p: any, idx: number) => {
          const sizes = p.sizes || p.variantsSummary ? `\n   - সাইজ/ভ্যারিয়েন্ট: ${p.sizes || p.variantsSummary}` : '';
          const lowBadge = (p.stock ?? 0) <= 5 ? ' ⚠️ (স্টক সীমিত)' : '';
          return `${idx + 1}. **${p.name}**\n   - বর্তমান স্টক: **${p.stock ?? 0} টি**${lowBadge} | মূল্য: ৳${p.price || 0}${sizes}`;
        }).join('\n\n');

        return `👕 **${cat.title} ক্যাটাগরির বর্তমান স্টক তালিকা:**\n\n${listText}\n\n📊 **মোট ${cat.title} স্টক:** ${totalUnits} টি আইটেম`;
      } else {
        return `ℹ️ **${cat.title} স্টক স্ট্যাটাস:**\nবর্তমানে আমাদের স্টোরে এই ক্যাটাগরির কোনো প্রোডাক্ট স্টক পাওয়া যায়নি।`;
      }
    }
  }

  // 4. RULE 1: "স্টকের অবস্থা কি" / "সব স্টকের লিস্ট" -> Full Stock List of ALL products
  const isFullStockCheck =
    q.includes('স্টকের অবস্থা কি') ||
    q.includes('স্টকের অবস্থা কেমন') ||
    q.includes('স্টক কেমন') ||
    q.includes('স্টক কি অবস্থা') ||
    q.includes('পুরো স্টকের লিস্ট') ||
    q.includes('সব স্টকের লিস্ট') ||
    q.includes('সব স্টক') ||
    q.includes('পুরো স্টক') ||
    q.includes('সকল স্টক') ||
    q.includes('ইনভেন্টরি লিস্ট') ||
    q.includes('স্টক তালিকা') ||
    q.includes('সব প্রোডাক্টের স্টক') ||
    q.includes('সকল প্রোডাক্টের স্টক') ||
    q.includes('আমাদের কি কি স্টক আছে') ||
    q.includes('মোট স্টক কত') ||
    (q.includes('স্টক') && (q.includes('লিস্ট') || q.includes('অবস্থা') || q.includes('সব') || q.includes('পুরো')));

  if (isFullStockCheck) {
    const totalItemsCount = inventoryList.length;
    const totalUnitsCount = inventoryList.reduce((sum: number, p: any) => sum + (p.stock ?? 0), 0);
    const lowCount = inventoryList.filter((p: any) => (p.stock ?? 0) <= 5).length;

    const formattedList = inventoryList.map((p: any, idx: number) => {
      const cat = p.category ? ` [${p.category}]` : '';
      const sizes = p.sizes || p.variantsSummary ? ` | সাইজ: ${p.sizes || p.variantsSummary}` : '';
      const lowBadge = (p.stock ?? 0) <= 5 ? ' ⚠️' : '';
      return `${idx + 1}. **${p.name}**${cat}\n   • স্টক: **${p.stock ?? 0} টি**${lowBadge} | মূল্য: ৳${p.price || 0}${sizes}`;
    }).join('\n\n');

    return `📦 **স্টোরের সম্পূর্ণ স্টক তালিকা (মোট ${totalItemsCount} টি প্রোডাক্ট):**\n\n${formattedList}\n\n📊 **ইনভেন্টরি সারাংশ:**\n• সর্বমোট প্রোডাক্ট: ${totalItemsCount} টি\n• সর্বমোট মজুত স্টক: ${totalUnitsCount} টি\n• রিস্টক প্রয়োজন (লো-স্টক): ${lowCount} টি`;
  }

  return null;
}

/**
 * Instant Fast-Path Resolver for Admin AI Co-Pilot
 * Handles smart inventory rules (Rules 1-4) and quick preset buttons with 0ms latency.
 */
function resolveInstantAdminCopilotReply(query: string, storeContext: any = {}): string | null {
  const q = (query || '').trim();
  const {
    totalOrders = 0,
    totalRevenue = 0,
    orderStatusCounts = {},
    recentCustomerQueries = []
  } = storeContext;

  // 1. Check Smart Stock & Demand Queries (Rules 1-4)
  const stockReply = handleInventoryAndDemandQuery(query, storeContext);
  if (stockReply) {
    return stockReply;
  }

  // 2. Exact match for sales/orders summary chip:
  if (
    q === 'আজকের মোট বিক্রয়, অর্ডার সংখ্যা ও ডেলিভারি স্ট্যাটাস বিশ্লেষণ করো' ||
    q === 'আজকের মোট বিক্রয় ও অর্ডার রিপোর্ট'
  ) {
    const delivered = orderStatusCounts['Delivered'] || 0;
    const processing = orderStatusCounts['Processing'] || 0;
    const pending = orderStatusCounts['Pending'] || 0;
    const shipped = orderStatusCounts['Shipped'] || 0;
    const cancelled = orderStatusCounts['Cancelled'] || 0;

    return `📊 **AESTHETX LIFESTYLE — বিক্রয় ও অর্ডার রিপোর্ট:**

• **মোট অর্ডার:** ${totalOrders} টি
• **মোট রেভিনিউ:** ৳${Number(totalRevenue).toLocaleString()}
• **অর্ডার স্ট্যাটাস:**
  - 📦 ডেলিভারি সম্পন্ন: ${delivered} টি
  - 🚚 কুরিয়ারে ট্রানজিটে: ${shipped} টি
  - ⚙️ প্রসেসিং: ${processing} টি
  - ⏳ পেন্ডিং ভেরিফিকেশন: ${pending} টি
  - ❌ বাতিল: ${cancelled} টি`;
  }

  if (q === 'কাস্টমাররা রিসেন্ট সাপোর্ট চ্যাটে কী কী বেশি জিজ্ঞেস করেছে এবং কীভাবে কনভার্সন বাড়ানো যায়?') {
    const recentSample = Array.isArray(recentCustomerQueries) && recentCustomerQueries.length > 0
      ? recentCustomerQueries.slice(0, 5).map((m: any, i: number) => `${i + 1}. "${m}"`).join('\n')
      : '১. সাইজ ও ফিটিং নিশ্চিতকরণ\n২. ডেলিভারি কতদিন লাগবে\n৩. ক্যাশ অন ডেলিভারি সুবিধা';

    return `💬 **কাস্টমারদের সাম্প্রতিক অনুসন্ধানসমূহ:**\n\n${recentSample}`;
  }

  return null;
}

/**
 * Intelligent, direct fallback for Admin AI Copilot (when offline or model unreachable)
 * Direct and obedient — NO generic lecturing or unsolicited preachiness.
 */
function generateAdminCopilotFallback(query: string, storeContext: any = {}): string {
  const q = (query || '').toLowerCase().trim();

  // Check inventory and demand rules first
  const stockReply = handleInventoryAndDemandQuery(query, storeContext);
  if (stockReply) {
    return stockReply;
  }

  const {
    totalOrders = 0,
    totalRevenue = 0,
    orderStatusCounts = {},
    allProductsInventory = []
  } = storeContext;

  // Direct answers strictly focused on the admin's question:
  if (
    q.includes('অর্ডার') ||
    q.includes('বিক্র') ||
    q.includes('সেল') ||
    q.includes('রেভিনিউ') ||
    q.includes('sales') ||
    q.includes('revenue') ||
    q.includes('order')
  ) {
    const delivered = orderStatusCounts['Delivered'] || 0;
    const pending = orderStatusCounts['Pending'] || 0;
    const processing = orderStatusCounts['Processing'] || 0;
    const shipped = orderStatusCounts['Shipped'] || 0;
    return `📊 **বিক্রয় ও অর্ডার তথ্য:**
• মোট অর্ডার: ${totalOrders} টি
• মোট সংগৃহীত রেভিনিউ: ৳${Number(totalRevenue).toLocaleString()}
• ডেলিভারি সম্পন্ন: ${delivered} টি
• ট্রানজিটে (Shipped): ${shipped} টি
• প্রসেসিং: ${processing} টি
• পেন্ডিং: ${pending} টি`;
  }

  if (q.includes('কুপন') || q.includes('অফার') || q.includes('ডিসকাউন্ট') || q.includes('coupon')) {
    return `🏷️ **কুপন কোড আইডিয়া:**
1. **SAVE10** — ১০% ছাড় (মিনিমাম অর্ডার ৳১,৫০০)
2. **FREESHIP** — ফ্রি হোম ডেলিভারি (মিনিমাম অর্ডার ৳২,০০০)
3. **SPECIAL15** — ১৫% বিশেষ ছাড় (বান্ডেল বা প্রিমিয়াম আইটেমে)`;
  }

  if (
    q.includes('বিবরণ') ||
    q.includes('ডেসক্রিপশন') ||
    q.includes('ক্যাপশন') ||
    q.includes('কপি') ||
    q.includes('লিখে দাও')
  ) {
    if (/car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|কার\b|vehicle/i.test(q)) {
      return `📝 **খেলনা গাড়ির বিবরণ ড্রাফট:**
"মজবুত ও টেকসই মেটাল/প্লাস্টিক বডিতে তৈরি চমৎকার খেলনা গাড়ি। মসৃণ চাকা, আকর্ষণীয় ডিজাইন ও শিশুদের খেলার জন্য সম্পূর্ণ নিরাপদ। শৌখিন কালেকশন বা গিফট দেওয়ার জন্য সেরা একটি আইটেম।"`;
    }
    if (/shoe|shoes|জুতা|জুতো|স্নিকার্স/i.test(q)) {
      return `📝 **জুতার বিবরণ ড্রাফট:**
"উন্নত গ্রিপ ও টেকসই সোল সমৃদ্ধ স্টাইলিশ ক্যাজুয়াল স্নিকার্স। দীর্ঘ সময় ব্যবহারে টেকসই ও প্রতিদিনের হাঁটাচলায় স্বাচ্ছন্দ্য নিশ্চিত করবে।"`;
    }
    return `📝 **প্রোডাক্ট বিবরণ ড্রাফট:**
"১০০% প্রিমিয়াম কম্বড কটন ফ্যাব্রিকে তৈরি, অত্যন্ত আরামদায়ক ও স্টাইলিশ। ডেইলি ওয়্যার ও ক্যাজুয়াল আউটিংয়ের জন্য সেরা পছন্দ। কালার ও ফেব্রিক লং-লাস্টিং গ্যারান্টি।"`;
  }

  if (Array.isArray(allProductsInventory) && allProductsInventory.length > 0 && (q.includes('প্রোডাক্ট') || q.includes('লিস্ট'))) {
    const list = allProductsInventory
      .slice(0, 6)
      .map((p: any) => `• ${p.name} (৳${p.price || 0}) - ক্যাটাগরি: ${p.category || 'General'}`)
      .join('\n');
    return `📦 **স্টোর প্রোডাক্ট তালিকা:**\n${list}`;
  }

  return `আপনার নির্দেশ অনুযায়ী: "${query}"\n\nআমি অনুরোধটি গ্রহণ করেছি। নির্দিষ্ট কোনো প্রোডাক্ট, সেলস সংখ্যা বা কপিরাইটিংয়ের তথ্য প্রয়োজন হলে সরাসরি জানান, আমি ঠিক সেটুকুই করে দেব।`;
}

/**
 * Server-Side Admin AI Co-Pilot & Store Manager Endpoint
 * Ultra-responsive, strictly obedient: answers ONLY what the admin asks and does ONLY what instructed.
 */
app.post('/api/ai/admin-copilot', async (req, res) => {
  try {
    const { query, storeContext = {}, conversationHistory = [] } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Admin query is required.'
      });
    }

    // 1. Check instant resolver (Rules 1-4 and quick chips in 0ms!)
    const instantReply = resolveInstantAdminCopilotReply(query, storeContext);
    if (instantReply) {
      return res.status(200).json({
        success: true,
        text: instantReply,
        instant: true
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      const fallback = generateAdminCopilotFallback(query, storeContext);
      return res.status(200).json({
        success: true,
        text: fallback,
        fallback: true
      });
    }

    const {
      totalOrders = 0,
      totalRevenue = 0,
      orderStatusCounts = {},
      lowStockProducts = [],
      topSellingCategories = [],
      recentCustomerQueries = [],
      allProductsInventory = [],
      customerDemands = []
    } = storeContext;

    const productsListSummary = Array.isArray(allProductsInventory) && allProductsInventory.length > 0
      ? allProductsInventory
          .map((p: any) => `- "${p.name}" (৳${p.price || 0}) | Cat: ${p.category || 'General'} | Stock: ${p.stock ?? 0} | Sizes: ${p.sizes || 'N/A'}`)
          .join('\n')
      : 'None provided';

    const customerDemandsSummary = Array.isArray(customerDemands) && customerDemands.length > 0
      ? customerDemands.slice(0, 10).map((d: any) => `- "${d}"`).join('\n')
      : 'None (no specific customer product demands recorded)';

    const systemPrompt = `
You are the dedicated, strictly obedient AI Executive Co-Pilot for the STORE ADMIN of "AESTHETX LIFESTYLE" (a Bangladeshi fashion & streetwear e-commerce brand).

CRITICAL ADMIN CO-PILOT DIRECTIVES:
1. STRICT OBEDIENCE & PRECISE COMPLIANCE (একান্ত আনুগত্য ও সুনির্দিষ্ট উত্তর):
   - The Store Admin is your supervisor.
   - Whatever question the admin asks, answer THAT SPECIFIC QUESTION ONLY.
   - Whatever task the admin commands you to do (e.g. write product description, generate ad copy, create coupon ideas, calculate revenue, draft policies, translate, format text), DO EXACTLY AND ONLY THAT TASK.
   - NEVER give unsolicited generic advice, lectures, or business preaching.
   - If the admin did NOT ask for "tips" or "advice", DO NOT append any tips or lectures! Never pad your response with unwanted text.

2. INVENTORY & CUSTOMER DEMAND CORE RULES (স্টক ও ক্রেতা চাহিদার বিশেষ নিয়মাবলী):
   Rule A. "স্টকের অবস্থা কি" / "সব স্টকের লিস্ট":
      - Provide the COMPLETE, itemized inventory list of ALL store products (Name, Category, Stock count, Price, Sizes).
   Rule B. Category or Item mentioned (e.g., "টি-শার্ট", "জুতা", "হুডি", "প্যান্ট", "শার্ট", "পাঞ্জাবি"):
      - Filter and provide the full stock list for ONLY that specific category or item.
   Rule C. "কোন স্টক লাগবে" / "রিস্টক লাগবে" / "কোন প্রোডাক্ট কম আছে":
      - List ONLY the products that have low stock (<= 5) or are out of stock (0), along with their current count and restock recommendation.
   Rule D. "নতুন কি কোন প্রডাক্ট আনা লাগবে" / "নতুন কি আনা লাগবে" / "ক্রেতারা কি ডিমান্ড করেছে":
      - Check customer inquiries below. If customers demanded specific items, list ONLY those demanded item names.
      - If no customer demanded a new product or customer inquiries has none, you MUST strictly answer: "আপাতত লাগবে না কোন কিছু।" NEVER invent or suggest unsolicited items!

3. ACCURATE NUMBERS & FACTS:
   - When asked about store numbers (sales, orders, stock, categories, products), use the LIVE STORE DATA provided below.

4. LANGUAGE:
   - Always respond in natural, professional Bengali (বাংলা) if the query is in Bengali, or English if asked in English.

5. TONE & FORMAT:
   - Sharp, direct, courteous, and 100% focused on executing the admin's request cleanly.

LIVE STORE DATA:
- Total Orders: ${totalOrders}
- Total Revenue: ৳${Number(totalRevenue).toLocaleString()}
- Order Status Breakdown: ${JSON.stringify(orderStatusCounts)}
- Low Stock Products (<=5): ${JSON.stringify(lowStockProducts)}
- Active Categories: ${JSON.stringify(topSellingCategories)}
- Live Product Inventory:
${productsListSummary}
- Recent Customer Inquiries / Demand In Live Support:
${customerDemandsSummary}
`.trim();

    const contents: any[] = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach((m: any) => {
        contents.push({
          role: m.role === 'admin' || m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        });
      });
    }

    contents.push({ role: 'user', parts: [{ text: query.trim() }] });

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let aiText = '';

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 7000)
        );

        const config: any = {
          systemInstruction: systemPrompt,
          maxOutputTokens: 700
        };
        if (!modelName.startsWith('gemini-3.8')) {
          config.temperature = 0.3;
        }

        const genPromise = ai.models.generateContent({
          model: modelName,
          contents: contents,
          config
        });

        const response: any = await Promise.race([genPromise, timeoutPromise]);
        if (response && response.text) {
          aiText = response.text.trim();
          break;
        }
      } catch (genErr: any) {
        const isQuota = String(genErr?.message || '').includes('429') || String(genErr?.message || '').includes('RESOURCE_EXHAUSTED');
        if (!isQuota) {
          console.warn(`Admin AI Copilot note on ${modelName}:`, genErr?.message?.slice(0, 100));
        }
      }
    }

    if (!aiText) {
      aiText = generateAdminCopilotFallback(query, storeContext);
    }

    return res.status(200).json({
      success: true,
      text: aiText
    });
  } catch (error: any) {
    console.error('Admin Co-Pilot AI Error:', error);
    const fallback = generateAdminCopilotFallback(req.body?.query || '', req.body?.storeContext || {});
    return res.status(200).json({
      success: true,
      text: fallback,
      fallback: true
    });
  }
});

/**
 * Deterministic & AI-Powered Store Stock + Customer Demand Analyzer
 * Tracks all inventory levels, category distribution, order velocity, and customer chat demands
 * (separating demand for NEW items not in store vs EXISTING/OUT-OF-STOCK items).
 */
const DEMAND_TOPIC_RULES: { topic: string; pattern: RegExp }[] = [
  { topic: 'টি-শার্ট (T-Shirt)', pattern: /টি-?শার্ট|টিশার্ট|t-?shirt|tshirt|tee|গেঞ্জি|ড্রপ\s*শোল্ডার|drop\s*shoulder/i },
  { topic: 'শার্ট ও পোলো (Shirt / Polo)', pattern: /(?<![অ-হ])শার্ট|পোলো|shirt|polo/i },
  { topic: 'হুডি ও জ্যাকেট (Hoodie / Jacket)', pattern: /হুডি|হুদি|hoodie|জ্যাকেট|jacket|সোয়েটার|sweater|উইন্টার|winter/i },
  { topic: 'পাঞ্জাবি (Panjabi)', pattern: /পাঞ্জাবি|পাঞ্জাবী|panjabi|punjabi/i },
  { topic: 'প্যান্ট ও ট্রাউজার (Pant / Cargo / Jeans)', pattern: /প্যান্ট|পেন্ট|pant|ট্রাউজার|trouser|কার্গো|cargo|জিন্স|jeans|চিনো|chino/i },
  { topic: 'জুতা ও স্নিকার্স (Shoes / Sneakers)', pattern: /জুতা|স্নিকার্স|স্নিকার|shoe|shoes|sneaker|লোফার|loafer|স্যান্ডেল|sandal|বুট|boot/i },
  { topic: 'ঘড়ি ও স্মার্টওয়াচ (Watch / Smartwatch)', pattern: /ঘড়ি|ঘড়ি|ওয়াচ|ওয়াচ|watch|smartwatch/i },
  { topic: 'পারফিউম ও আতর (Perfume / Attar)', pattern: /পারফিউম|সুগন্ধি|আতর|perfume|fragrance|attar|body\s*spray/i },
  { topic: 'মানিব্যাগ ও বেল্ট (Wallet / Belt)', pattern: /মানিব্যাগ|ওয়ালেট|ওয়ালেট|wallet|বেল্ট|belt/i },
  { topic: 'ব্যাগ ও ব্যাকপ্যাক (Bag / Backpack)', pattern: /(?<![অ-হ])ব্যাগ|ব্যাকপ্যাক|bag|backpack|crossbody|tote/i },
  { topic: 'ক্যাপ ও সানগ্লাস (Cap / Sunglasses)', pattern: /ক্যাপ|টুপি|cap|hat|সানগ্লাস|চশমা|sunglass|glasses/i },
  { topic: 'জার্সি ও স্পোর্টসওয়্যার (Jersey / Sportswear)', pattern: /জার্সি|jersey|স্পোর্টস|sports|ট্র্যাকস্যুট|tracksuit/i },
  { topic: 'মহিলাদের কালেকশন (Women Wear / Saree / Three-Piece)', pattern: /থ্রি-?পিস|থ্রিপিস|three\s*piece|শাড়ি|শাড়ি|saree|কুর্তি|kurti|আবায়া|abaya|বোরকা|ওড়না/i },
  { topic: 'ইলেকট্রনিক্স ও গ্যাজেট (Electronics / Earbuds)', pattern: /ইয়ারবাড|earbud|হেডফোন|headphone|চার্জার|charger|পাওয়ার\s*ব্যাংক|power\s*bank|গ্যাজেট|gadget/i }
];

function analyzeStoreStockAndDemand(
  rawInventory: any[] = [],
  rawOrders: any[] = [],
  rawInquiries: any[] = []
) {
  const inventory = (Array.isArray(rawInventory) ? rawInventory : []).map((p: any) => ({
    id: String(p.id || ''),
    name: String(p.name || 'Unnamed Product'),
    category: String(p.category || 'General'),
    subcategory: p.subcategory ? String(p.subcategory) : '',
    brand: p.brand ? String(p.brand) : '',
    price: Number(p.salePrice || p.price || 0),
    stock: Number(p.totalStock ?? p.stock ?? 0),
    sizes: Array.isArray(p.sizes) ? p.sizes.join(', ') : String(p.sizes || ''),
    colors: Array.isArray(p.colors) ? p.colors.join(', ') : String(p.colors || ''),
    variantsSummary: String(p.variantsSummary || ''),
    active: p.active !== false
  }));

  const totalProducts = inventory.length;
  const activeProducts = inventory.filter((p) => p.active).length;
  const totalUnits = inventory.reduce((sum, p) => sum + p.stock, 0);
  const outOfStockItems = inventory.filter((p) => p.stock <= 0);
  const lowStockItems = inventory
    .filter((p) => p.stock > 0 && p.stock <= 5)
    .sort((a, b) => a.stock - b.stock);
  const healthyStockItems = inventory.filter((p) => p.stock > 5);

  // Category-by-category stock summary
  const catMap = new Map<
    string,
    { category: string; itemCount: number; totalUnits: number; outOfStockCount: number; lowStockCount: number }
  >();
  for (const item of inventory) {
    const cat = item.category || 'General';
    const curr = catMap.get(cat) || {
      category: cat,
      itemCount: 0,
      totalUnits: 0,
      outOfStockCount: 0,
      lowStockCount: 0
    };
    curr.itemCount += 1;
    curr.totalUnits += item.stock;
    if (item.stock <= 0) curr.outOfStockCount += 1;
    else if (item.stock <= 5) curr.lowStockCount += 1;
    catMap.set(cat, curr);
  }
  const categoryBreakdown = Array.from(catMap.values()).sort((a, b) => b.totalUnits - a.totalUnits);

  // Order velocity aggregation
  const orderProductMap = new Map<string, { name: string; totalQty: number; orderCount: number; currentStock: number | null }>();
  if (Array.isArray(rawOrders)) {
    for (const o of rawOrders) {
      if (o?.orderStatus === 'Cancelled') continue;
      const items = Array.isArray(o?.items) ? o.items : [];
      for (const it of items) {
        const pName = String(it?.productName || it?.name || '').trim();
        if (!pName) continue;
        const qty = Number(it?.quantity || 1);
        const key = pName.toLowerCase();
        const matchedInv = inventory.find((p) => p.name.toLowerCase() === key || p.id === it?.productId);
        const curr = orderProductMap.get(key) || {
          name: pName,
          totalQty: 0,
          orderCount: 0,
          currentStock: matchedInv ? matchedInv.stock : null
        };
        curr.totalQty += qty;
        curr.orderCount += 1;
        if (matchedInv) curr.currentStock = matchedInv.stock;
        orderProductMap.set(key, curr);
      }
    }
  }
  const topOrderedProducts = Array.from(orderProductMap.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 10);

  // Customer Inquiry & Demand Classification
  const newProductDemands: {
    topic: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[] = [];

  const outOfStockDemands: {
    productName: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[] = [];

  const existingProductDemands: {
    matchedProduct: string;
    requestedVariant: string;
    quote: string;
    customerName: string;
    timestamp: string;
  }[] = [];

  const otherCustomerRequests: {
    quote: string;
    customerName: string;
    timestamp: string;
  }[] = [];

  const greetingOnlyRegex = /^(hi|hello|hey|assalamu\s*alaikum|salam|হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|ওয়ালাইকুম\s*আসসালাম|ok|okay|thanks|thank\s*you|ধন্যবাদ|জ্বি|জি|হ্যাঁ|না|ঠিক\s*আছে|ভালো|nice|good|Conversation started)[!.,\s]*$/i;
  const productIntentRegex = /টি-?শার্ট|টিশার্ট|শার্ট|পোলো|হুডি|জ্যাকেট|পাঞ্জাবি|প্যান্ট|জুতা|স্নিকার্স|ঘড়ি|ঘড়ি|পারফিউম|আতর|ব্যাগ|মানিব্যাগ|বেল্ট|ক্যাপ|সানগ্লাস|জার্সি|থ্রিপিস|শাড়ি|আবায়া|ইয়ারবাড|t-?shirt|shirt|polo|hoodie|jacket|panjabi|pant|shoe|sneaker|watch|perfume|bag|wallet|belt|cap|sunglass|jersey|saree|abaya|earbud|আছে\s*(কি|কী)?|পাবো?\s*(কি|কী)?|পাওয়া\s*যাবে|হবে\s*(কি|কী)?|লাগবে|চাই|দরকার|আনবেন|কবে\s*আসবে|দাম\s*কত|সাইজ|কালার|stock|available|price|size|color|want|need|looking\s*for|do\s*you\s*have/i;

  const seenQuotes = new Set<string>();
  const normalizedInquiries = Array.isArray(rawInquiries) ? rawInquiries : [];

  for (const entry of normalizedInquiries) {
    const rawText = typeof entry === 'string' ? entry : String(entry?.text || '');
    const text = rawText.trim();
    if (!text || text.length < 2 || greetingOnlyRegex.test(text)) continue;

    const dedupKey = text.toLowerCase();
    if (seenQuotes.has(dedupKey)) continue;
    seenQuotes.add(dedupKey);

    const customerName = typeof entry === 'object' && entry?.customerName ? String(entry.customerName) : 'Customer';
    const timestamp = typeof entry === 'object' && entry?.timestamp ? String(entry.timestamp) : '';

    // Check matched topic rule
    const matchedTopicRule = DEMAND_TOPIC_RULES.find((r) => r.pattern.test(text));
    const hasProductIntent = Boolean(matchedTopicRule) || productIntentRegex.test(text);

    if (!hasProductIntent) {
      if (text.length >= 8) {
        otherCustomerRequests.push({ quote: text, customerName, timestamp });
      }
      continue;
    }

    // Match against store inventory
    const cleanTokens = text
      .toLowerCase()
      .replace(/[^\w\s\u0980-\u09FF-]/g, ' ')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !/^(আছে|কি|কী|পাব|পাবো|পাওয়া|যাবে|হবে|লাগবে|চাই|দরকার|আনবেন|কবে|আসবে|দাম|কত|আপনাদের|কাছে|কোনো|কোন|নতুন|প্লিজ|ভাই|ভাইয়া|স্যার|for|you|have|any|the|and|with|price|stock|available|size|color)$/i.test(
            w
          )
      );

    const matchedProducts = inventory.filter((p) => {
      const targetStr = `${p.name} ${p.category} ${p.subcategory} ${p.brand}`.toLowerCase();
      // If a specific topic rule matched, check if this product belongs to that topic
      if (matchedTopicRule) {
        if (matchedTopicRule.pattern.test(targetStr)) return true;
        // Also check direct product name token match (at least 1 distinctive product word)
        const nameTokens = p.name
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length >= 4);
        return nameTokens.some((nt) => cleanTokens.includes(nt));
      }
      // Otherwise require meaningful token overlap
      return cleanTokens.some((tok) => targetStr.includes(tok));
    });

    const sizeMatches = text.match(/\b(XS|XXL|2XL|3XL|XL|S|M|L|38|39|40|41|42|43|44|45|28|30|32|34|36)\b/gi);
    const colorMatch = text.match(/(কালো|ব্ল্যাক|black|সাদা|হোয়াইট|white|নেভি|navy|অলিভ|olive|মেরুন|maroon|লাল|red|নীল|blue|গ্রে|grey)/i);
    const variantNotes = [
      sizeMatches ? `সাইজ: ${Array.from(new Set(sizeMatches.map((s) => s.toUpperCase()))).join(', ')}` : '',
      colorMatch ? `কালার: ${colorMatch[1]}` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    if (matchedProducts.length === 0) {
      // Customer asked for a product/category that does NOT exist in store!
      const topicLabel = matchedTopicRule
        ? matchedTopicRule.topic
        : cleanTokens.slice(0, 3).join(' ') || 'নতুন পণ্য';
      newProductDemands.push({
        topic: topicLabel,
        quote: text,
        customerName,
        timestamp
      });
    } else {
      const inStockMatches = matchedProducts.filter((p) => p.stock > 0);
      if (inStockMatches.length === 0) {
        outOfStockDemands.push({
          productName: matchedProducts[0].name,
          quote: text,
          customerName,
          timestamp
        });
      } else {
        existingProductDemands.push({
          matchedProduct: inStockMatches[0].name,
          requestedVariant: variantNotes,
          quote: text,
          customerName,
          timestamp
        });
      }
    }
  }

  return {
    inventory,
    totalProducts,
    activeProducts,
    totalUnits,
    outOfStockItems,
    lowStockItems,
    healthyStockItems,
    categoryBreakdown,
    topOrderedProducts,
    newProductDemands,
    outOfStockDemands,
    existingProductDemands,
    otherCustomerRequests,
    totalAnalyzedInquiries: seenQuotes.size
  };
}

function formatStockAndDemandFallbackReply(query: string, analytics: ReturnType<typeof analyzeStoreStockAndDemand>): string {
  const q = (query || '').toLowerCase().trim();
  const isEnglish = /^[a-zA-Z0-9\s?.,!'-]+$/.test(q);

  const isAskingNewDemand =
    q.includes('নতুন') ||
    q.includes('ডিমান্ড') ||
    q.includes('চাহিদা') ||
    q.includes('কাস্টমার') ||
    q.includes('ক্রেতা') ||
    q.includes('demand') ||
    q.includes('new product') ||
    q.includes('new item') ||
    q.includes('customer');

  const isAskingRestock =
    q.includes('কম') ||
    q.includes('শেষ') ||
    q.includes('রিস্টক') ||
    q.includes('শর্ট') ||
    q.includes('লাগবে') ||
    q.includes('low') ||
    q.includes('out of stock') ||
    q.includes('restock');

  const isAskingCategory =
    q.includes('ক্যাটাগরি') ||
    q.includes('category') ||
    q.includes('ধরন');

  // 1. Customer Demand & New Item Demand Focus
  if (isAskingNewDemand) {
    const sections: string[] = [];

    if (analytics.newProductDemands.length > 0) {
      const newItemsText = analytics.newProductDemands
        .slice(0, 10)
        .map(
          (d, i) =>
            `${i + 1}. **${d.topic}**\n   • কাস্টমারের মেসেজ: "${d.quote}" (${d.customerName})`
        )
        .join('\n');
      sections.push(
        `🆕 **নতুন পণ্যের ডিমান্ড (যেগুলো বর্তমানে স্টোরে নেই — মোট ${analytics.newProductDemands.length} টি অনুরোধ):**\n${newItemsText}`
      );
    } else {
      sections.push(
        `🆕 **নতুন পণ্যের ডিমান্ড:**\nলাইভ কাস্টমার চ্যাটে এখনো এমন কোনো নতুন ক্যাটাগরির পণ্যের অনুরোধ পাওয়া যায়নি যা ক্যাটালগে নেই।`
      );
    }

    if (analytics.outOfStockDemands.length > 0) {
      const oosText = analytics.outOfStockDemands
        .slice(0, 8)
        .map((d, i) => `${i + 1}. **${d.productName}** (বর্তমানে স্টক ০) — কাস্টমার জিজ্ঞাসা: "${d.quote}"`)
        .join('\n');
      sections.push(`🔴 **আউট অফ স্টক প্রোডাক্টে কাস্টমারের চাহিদা:**\n${oosText}`);
    }

    if (analytics.existingProductDemands.length > 0) {
      const exText = analytics.existingProductDemands
        .slice(0, 8)
        .map(
          (d, i) =>
            `${i + 1}. **${d.matchedProduct}**${d.requestedVariant ? ` (${d.requestedVariant})` : ''} — "${d.quote}"`
        )
        .join('\n');
      sections.push(`🛍️ **চলমান প্রোডাক্ট ও সাইজ/কালার ডিমান্ড:**\n${exText}`);
    }

    if (analytics.topOrderedProducts.length > 0) {
      const ordText = analytics.topOrderedProducts
        .slice(0, 5)
        .map(
          (o, i) =>
            `${i + 1}. **${o.name}** — মোট অর্ডার: ${o.totalQty} টি${
              o.currentStock !== null ? ` (বর্তমান স্টক: ${o.currentStock} টি)` : ''
            }`
        )
        .join('\n');
      sections.push(`📈 **অর্ডার হিস্ট্রি অনুযায়ী সবচেয়ে চাহিদাসম্পন্ন পণ্য:**\n${ordText}`);
    }

    if (
      analytics.newProductDemands.length === 0 &&
      analytics.outOfStockDemands.length === 0 &&
      analytics.existingProductDemands.length === 0 &&
      analytics.topOrderedProducts.length === 0
    ) {
      return isEnglish
        ? 'No specific customer chat demands or order trends have been recorded yet. As soon as customers message in live support or place orders, all demand insights will appear here.'
        : 'এখনো লাইভ সাপোর্ট চ্যাট বা অর্ডারে কোনো সুনির্দিষ্ট কাস্টমার ডিমান্ড রেকর্ড হয়নি। কাস্টমাররা লাইভ চ্যাটে কোনো পণ্যের খোঁজ করলে সাথে সাথেই এখানে বিস্তারিত দেখাবে।';
    }

    return sections.join('\n\n');
  }

  // 2. Restock / Low-stock / Out-of-stock Focus (when not asking for full report)
  const isAskingFullOverview =
    q.includes('সব') ||
    q.includes('পুরো') ||
    q.includes('সকল') ||
    q.includes('খবরা') ||
    q.includes('খবর');

  if (isAskingRestock && !isAskingFullOverview) {
    const combinedUrgent = [...analytics.outOfStockItems, ...analytics.lowStockItems];
    if (combinedUrgent.length === 0) {
      return `✅ **স্টক স্ট্যাটাস চমৎকার!**\nসবগুলো প্রোডাক্টের (${analytics.totalProducts} টি) পর্যাপ্ত স্টক রয়েছে (কোনোটিই ৫ ইউনিটের নিচে বা ০ নয়)। মোট মজুত: **${analytics.totalUnits} টি**।`;
    }

    const lines = combinedUrgent.map((p, i) => {
      const badge = p.stock <= 0 ? '🔴 আউট অফ স্টক (০ টি)' : `⚠️ লো স্টক (${p.stock} টি বাকি)`;
      return `${i + 1}. **${p.name}** [${p.category}]\n   • অবস্থা: ${badge} | মূল্য: ৳${p.price.toLocaleString()}${
        p.sizes ? ` | সাইজ: ${p.sizes}` : ''
      }`;
    });

    return `⚠️ **জরুরি রিস্টক তালিকা (মোট ${combinedUrgent.length} টি প্রোডাক্ট):**\n\n${lines.join('\n\n')}`;
  }

  // 3. Category Breakdown Focus
  if (isAskingCategory) {
    if (analytics.categoryBreakdown.length === 0) {
      return 'বর্তমানে স্টোরে কোনো ক্যাটাগরি বা প্রোডাক্ট পাওয়া যায়নি।';
    }
    const catLines = analytics.categoryBreakdown.map(
      (c, i) =>
        `${i + 1}. **${c.category}** — ${c.itemCount} টি প্রোডাক্ট | মোট স্টক: **${c.totalUnits} টি**${
          c.outOfStockCount + c.lowStockCount > 0
            ? ` (সতর্কতা: ${c.outOfStockCount} টি শেষ, ${c.lowStockCount} টি কম)`
            : ' ✅'
        }`
    );
    return `📂 **ক্যাটাগরি অনুযায়ী স্টকের হিসাব:**\n\n${catLines.join('\n')}\n\n📊 **সর্বমোট স্টক:** ${analytics.totalUnits} টি ইউনিট (${analytics.totalProducts} টি প্রোডাক্ট)`;
  }

  // 4. Default Comprehensive Stock & Demand Executive Overview
  const stockListLines =
    analytics.inventory.length > 0
      ? analytics.inventory.slice(0, 25).map((p, i) => {
          const status = p.stock <= 0 ? '🔴 শেষ (০)' : p.stock <= 5 ? `⚠️ কম (${p.stock})` : `✅ ${p.stock} টি`;
          return `${i + 1}. **${p.name}** (${p.category}) — স্টক: **${status}** | ৳${p.price.toLocaleString()}`;
        })
      : ['কোনো প্রোডাক্ট এখনো যোগ করা হয়নি।'];

  const demandSummaryLine =
    analytics.newProductDemands.length > 0
      ? `🆕 **নতুন পণ্যের ডিমান্ড (${analytics.newProductDemands.length} টি):** ${analytics.newProductDemands
          .slice(0, 4)
          .map((d) => d.topic)
          .join(', ')}`
      : '🆕 **নতুন পণ্যের ডিমান্ড:** এখনো স্টোরের বাইরের নতুন কোনো পণ্যের চাহিদা পাওয়া যায়নি।';

  return `📊 **স্টোরের সম্পূর্ণ স্টক ও কাস্টমার ডিমান্ড রিপোর্ট:**

• **মোট প্রোডাক্ট:** ${analytics.totalProducts} টি (সক্রিয়: ${analytics.activeProducts} টি)
• **সর্বমোট মজুত স্টক:** ${analytics.totalUnits} টি ইউনিট
• **আউট অফ স্টক (০ টি):** ${analytics.outOfStockItems.length} টি
• **লো স্টক (১–৫ টি):** ${analytics.lowStockItems.length} টি

${demandSummaryLine}

📦 **প্রোডাক্ট অনুযায়ী স্টকের অবস্থা:**
${stockListLines.join('\n')}`;
}

/**
 * Dedicated Admin Stock & Customer Demand Intelligence Endpoint
 */
app.post('/api/ai/stock-demand-assistant', async (req, res) => {
  try {
    const {
      query = '',
      inventory = [],
      orders = [],
      customerInquiries = [],
      conversationHistory = []
    } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query is required.'
      });
    }

    const analytics = analyzeStoreStockAndDemand(inventory, orders, customerInquiries);

    if (!process.env.GEMINI_API_KEY) {
      const text = formatStockAndDemandFallbackReply(query, analytics);
      return res.status(200).json({
        success: true,
        text,
        analytics,
        via: 'deterministic'
      });
    }

    const inventoryContextText =
      analytics.inventory.length > 0
        ? analytics.inventory
            .slice(0, 60)
            .map(
              (p) =>
                `- ${p.name} | Cat: ${p.category}${p.subcategory ? `/${p.subcategory}` : ''} | Stock: ${p.stock} | Price: ৳${p.price} | Sizes: ${p.sizes || 'N/A'}`
            )
            .join('\n')
        : 'Store catalog currently has 0 products.';

    const categoryContextText =
      analytics.categoryBreakdown.length > 0
        ? analytics.categoryBreakdown
            .map((c) => `- ${c.category}: ${c.itemCount} products, ${c.totalUnits} total units (${c.outOfStockCount} out of stock, ${c.lowStockCount} low stock)`)
            .join('\n')
        : 'No categories yet.';

    const newDemandContextText =
      analytics.newProductDemands.length > 0
        ? analytics.newProductDemands
            .slice(0, 20)
            .map((d) => `- Topic: ${d.topic} | Customer (${d.customerName}) asked: "${d.quote}"`)
            .join('\n')
        : 'None detected in customer chat messages yet.';

    const outOfStockDemandText =
      analytics.outOfStockDemands.length > 0
        ? analytics.outOfStockDemands
            .slice(0, 15)
            .map((d) => `- Product: ${d.productName} (0 stock) | Customer (${d.customerName}) asked: "${d.quote}"`)
            .join('\n')
        : 'None.';

    const existingDemandText =
      analytics.existingProductDemands.length > 0
        ? analytics.existingProductDemands
            .slice(0, 20)
            .map((d) => `- Product: ${d.matchedProduct}${d.requestedVariant ? ` (${d.requestedVariant})` : ''} | Customer (${d.customerName}) asked: "${d.quote}"`)
            .join('\n')
        : 'None.';

    const topOrdersText =
      analytics.topOrderedProducts.length > 0
        ? analytics.topOrderedProducts
            .map((o) => `- ${o.name}: ${o.totalQty} units ordered across ${o.orderCount} orders (Current Stock: ${o.currentStock ?? 'Unknown'})`)
            .join('\n')
        : 'No order items recorded yet.';

    const systemInstruction = `
You are the dedicated **Stock & Customer Demand AI Analyst** ("স্টক ও কাস্টমার ডিমান্ড এআই") for the store admin of "AESTHETX LIFESTYLE".
Note: Product creation/adding is handled by a separate AI ("AI Product Adder"). Your sole mission is giving the admin complete, accurate intelligence on:
1) Live Stock & Inventory status (total units, product-by-product stock, out-of-stock items = 0, low-stock items <= 5, category-wise stock).
2) Customer Demand & Market Requests from live customer support chats & order history — specifically distinguishing:
   - **New Item Demands (নতুন জিনিসের ডিমান্ড):** Items/categories customers asked for that do NOT exist in the store catalog yet.
   - **Out-of-Stock Demands:** Items in the catalog with 0 stock that customers are asking for.
   - **Existing Product / Size / Color Demands:** Specific sizes, colors, or existing items customers are requesting, plus top-ordered products.

STRICT GROUNDING RULES:
- Use ONLY the real store data below. NEVER invent fake products, fake stock counts, or fake customer quotes.
- If the admin asks in Bengali, respond in clear, natural, well-structured Bengali (বাংলা). If the admin asks in English, respond in clear English.
- Be specific, helpful, and direct: cite exact product names, exact stock numbers, exact category totals, and exact customer quotes when answering.
- If there are no new out-of-catalog demands yet, clearly inform the admin (and mention any low-stock/out-of-stock or existing chat demands that do exist).

LIVE STORE METRICS:
- Total Products: ${analytics.totalProducts} (Active: ${analytics.activeProducts})
- Total Stock Units: ${analytics.totalUnits}
- Out of Stock Count (0 units): ${analytics.outOfStockItems.length}
- Low Stock Count (1-5 units): ${analytics.lowStockItems.length}

CATEGORY BREAKDOWN:
${categoryContextText}

FULL PRODUCT INVENTORY:
${inventoryContextText}

CUSTOMER DEMANDS FOR NEW ITEMS (NOT IN STORE CATALOG):
${newDemandContextText}

CUSTOMER DEMANDS FOR OUT-OF-STOCK ITEMS:
${outOfStockDemandText}

CUSTOMER DEMANDS FOR EXISTING PRODUCTS / SIZES / COLORS:
${existingDemandText}

TOP ORDERED PRODUCTS:
${topOrdersText}
`.trim();

    const contents: any[] = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach((m: any) => {
        contents.push({
          role: m.role === 'admin' || m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.text || '') }]
        });
      });
    }
    contents.push({ role: 'user', parts: [{ text: query.trim() }] });

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let aiText = '';
    let usedVia = 'gemini';

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 8000)
        );

        const config: any = {
          systemInstruction,
          maxOutputTokens: 900
        };
        if (!modelName.startsWith('gemini-3.8')) {
          config.temperature = 0.25;
        }

        const genPromise = ai.models.generateContent({
          model: modelName,
          contents,
          config
        });

        const response: any = await Promise.race([genPromise, timeoutPromise]);
        if (response && response.text) {
          aiText = response.text.trim();
          break;
        }
      } catch (genErr: any) {
        // Quota or model error caught gracefully - fallback will immediately provide accurate deterministic stock & demand report
        const isQuota = String(genErr?.message || '').includes('429') || String(genErr?.message || '').includes('RESOURCE_EXHAUSTED');
        if (!isQuota) {
          console.warn(`Stock & Demand AI note (${modelName}):`, genErr?.message?.slice(0, 100));
        }
      }
    }

    if (!aiText) {
      aiText = formatStockAndDemandFallbackReply(query, analytics);
      usedVia = 'deterministic';
    }

    return res.status(200).json({
      success: true,
      text: aiText,
      analytics,
      via: usedVia
    });
  } catch (error: any) {
    console.error('Stock & Demand AI Error:', error);
    const analytics = analyzeStoreStockAndDemand(
      req.body?.inventory || [],
      req.body?.orders || [],
      req.body?.customerInquiries || []
    );
    const text = formatStockAndDemandFallbackReply(req.body?.query || '', analytics);
    return res.status(200).json({
      success: true,
      text,
      analytics,
      via: 'fallback'
    });
  }
});

/**
 * Robust Product Description Comprehender (Fallback / Fast-path)
 * Intelligently understands the product description to generate a concise 2-4 word title,
 * rich description, category matching/auto-creation flag, and discount calculations.
 */
function smartComprehendProductText(rawText: string, existingDraft: any = {}, existingCategories: string[] = []): any {
  const norm = rawText.replace(/[০-৯]/g, (d) => String(['০','১','২','৩','৪','৫','৬','৭','৮','৯'].indexOf(d)));

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

  // 1. Discount Percentage & Price
  let discountPercent: number | null = null;
  const discountMatch =
    norm.match(/(\d+)%\s*(?:ছাড়|ছাড়|ডিসকাউন্ট|discount|অফ|off|লেস|less)/i) ||
    norm.match(/(?:ছাড়|ছাড়|ডিসকাউন্ট|discount|অফ|off|লেস|less)[:=\s]*(\d+)%/i) ||
    norm.match(/(?:দাম\s*রাখবে\s*|মূল্য\s*)(\d+)%/i);
  if (discountMatch) {
    const val = parseInt(discountMatch[1], 10);
    // Disregard if it's 100% cotton / fabric
    if (!/(\d+)%\s*(?:কটন|cotton|সুতি|লিনেন|পলেস্টার|ফেব্রিক)/i.test(rawText) || val < 100) {
      discountPercent = val;
    }
  }

  const priceMatch =
    norm.match(/(?:দাম(?:\s*রাখবে|\s*হবে)?|মূল্য|price|৳)[:=\s]*(\d+)(?![\d\s]*%)/i) ||
    norm.match(/(\d+)\s*(?:টাকা|tk|taka|\/-)(?!\s*%)/i) ||
    norm.match(/(?:টাকা|৳)\s*(\d+)(?![\d\s]*%)/i);
  let price = priceMatch ? parseInt(priceMatch[1], 10) : (existingDraft?.price || null);
  let salePrice = price;
  if (price && discountPercent) {
    salePrice = Math.round(price * (1 - discountPercent / 100));
  }

  // 2. Stock
  const stockMatch =
    norm.match(/(?:স্টক|stock|পরিমাণ|মজুত|ইনভেন্টরি)[:=\s]*(\d+)/i) ||
    norm.match(/(\d+)\s*(?:টি|টা|পিস|pcs|pc|units?)(?!\s*(?:টাকা|tk|taka|\/-|%))/i);
  const totalStock = stockMatch ? parseInt(stockMatch[1], 10) : (existingDraft?.stock || null);

  // 3. Category Detection
  let detectedCategory = existingDraft?.category || '';
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
  } else if (/খাবার|চাল|ডাল|food|snacks|চকলেট/i.test(rawText)) {
    detectedCategory = 'Food';
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

  // Check against existing store categories
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
    // If no existingCategories provided, check against standard default categories
    const standardDefaults = ['T-Shirts', 'Shirts', 'Hoodies', 'Panjabi', 'Pants', 'Men'];
    if (!standardDefaults.includes(detectedCategory)) {
      isNewCategory = true;
      newCategoryName = detectedCategory;
    }
  }

  // 4. Sizes
  let sizes = existingDraft?.sizes || null;
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

  // 5. Detect Style, Color, & Fabric attributes
  let color = '';
  if (/কালো|ব্ল্যাক|black/i.test(rawText)) color = 'ব্ল্যাক';
  else if (/সাদা|হোয়াইট|white/i.test(rawText)) color = 'হোয়াইট';
  else if (/নেভি\s*ব্লু|navy/i.test(rawText)) color = 'নেভি ব্লু';
  else if (/অলিভ|olive/i.test(rawText)) color = 'অলিভ';
  else if (/মেরুন|maroon/i.test(rawText)) color = 'মেরুন';

  let isCotton = /১০০%\s*কটন|কম্বড\s*কটন|খাঁটি\s*সুতি|কটন|সুতি|cotton/i.test(rawText);

  // 6. PARENTHESES-BASED TITLE EXTRACTION OR INTELLIGENT CONCISE TITLE GENERATION
  let title = '';

  // Priority 1: STRICT Parentheses check (e.g. "(Fogo Shoge)" or "（প্রিমিয়াম ড্রপ শোল্ডার টি-শার্ট）")
  const parenMatch = rawText.match(/(?:\(([^)]+)\)|（([^）]+)）)/);
  if (parenMatch) {
    const inside = (parenMatch[1] || parenMatch[2]).trim();
    if (inside && inside.length > 0) {
      title = inside;
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

  // Priority 3: Extract leading product brand / item from the raw string
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

  // Fallback to high-quality thematic product title
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
      title = `প্রিমিয়াম ${color ? color + ' ' : ''}${category} কালেকশন`;
    }
  }

  // Strictly enforce max 5 words on title ONLY IF NOT explicitly given in parentheses
  if (!parenMatch) {
    const titleWords = title.split(/\s+/).filter(Boolean);
    if (titleWords.length > 5) {
      title = titleWords.slice(0, 4).join(' ');
    }
  }

  // 7. SPECIFIC STRUCTURED FIELDS (Model No., Warranty, Unit Type, Dimensions, Brand, Subcategory)
  // Model No.
  let model: string | null = existingDraft?.model || null;
  const modelMatch = rawText.match(/(?:model(?:\s*no|\s*number)?|মডেল(?:\s*নং|\s*নম্বর)?)[:=\s]+([A-Za-z0-9\-_./]+)/i);
  if (modelMatch) {
    model = modelMatch[1].trim();
  }

  // Warranty Info
  let warranty: string | null = existingDraft?.warranty || null;
  const warrantyMatch =
    rawText.match(/(?:warranty(?:\s*info)?|ওয়ারেন্টি|ওয়ারেন্টি|গ্যারান্টি|guarantee)[:=\s]+([^\n,।|]+)/i) ||
    rawText.match(/(\d+\s*(?:বছর|মাস|দিন|year|years|month|months|days?)\s*(?:সার্ভিস\s*)?(?:ওয়ারেন্টি|ওয়ারেন্টি|গ্যারান্টি|warranty|guarantee))/i) ||
    rawText.match(/(?:no\s*warranty|কোনো\s*ওয়ারেন্টি\s*নেই|ওয়ারেন্টি\s*নেই)/i);
  if (warrantyMatch) {
    warranty = warrantyMatch[1] ? warrantyMatch[1].trim() : 'ওয়ারেন্টি নেই';
  }

  // Unit Type
  let unit: string | null = existingDraft?.unit || null;
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
  } else if (/প্যাকেট|pack/i.test(rawText)) {
    unit = 'প্যাকেট (Pack)';
  } else if (/কেজি|kg/i.test(rawText)) {
    unit = 'কেজি (Kg)';
  }
  if (!unit) {
    if (category === 'Shoes') unit = 'জোড়া (Pair)';
    else if (category === 'Food' || category === 'Beverages') unit = 'প্যাকেট / বোতল';
    else unit = 'পিস (Piece)';
  }

  // Dimensions / Size
  let dimensions: string | null = existingDraft?.dimensions || null;
  const dimMatch =
    rawText.match(/(?:dimension(?:s)?|ডাইমেনশন|পরিমাপ|মাপ|সাইজ\s*চার্ট)[:=\s]+([^\n,।|]+)/i) ||
    rawText.match(/(\d+(?:\.\d+)?\s*(?:x|X|বাই|\*)\s*\d+(?:\.\d+)?(?:\s*(?:x|X|বাই|\*)\s*\d+(?:\.\d+)?)?\s*(?:cm|mm|m|inch|ইঞ্চি|সেমি)?)/i);
  if (dimMatch) {
    dimensions = dimMatch[1].trim();
  }

  // Brand / Manufacturer
  let brand: string | null = existingDraft?.brand || null;
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

  // Subcategory (Optional)
  let subcategory: string | null = existingDraft?.subcategory || null;
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

  // 8. CLEAN & CONTEXT-ACCURATE BENGALI PRODUCT DESCRIPTION
  let finalDescription = '';
  const isToyOrCar = category === 'Toys & Games' || /car|cars|toy|toys|খেলনা|গাড়ি|গাড়ি|কার\b|vehicle|truck|jeep|diecast|hotwheels|lego|robot|drone/i.test(rawText + ' ' + title);

  if (isToyOrCar) {
    finalDescription = `${title} — আকর্ষণীয় ডিজাইন ও নিখুঁত ফিনিশিংয়ের দুর্দান্ত খেলনা গাড়ি। শক্ত ও টেকসই মেটাল/প্লাস্টিক বডি, স্মুথ ঘূর্ণনশীল চাকা এবং চমৎকার বিল্ড কোয়ালিটি। শিশুদের খেলাধুলার জন্য সম্পূর্ণ নিরাপদ এবং শৌখিন কালেকশন বা গিফট দেওয়ার জন্য সেরা পছন্দ। ডেলিভারির সময় পণ্য দেখে নেওয়ার সুযোগ রয়েছে।`;
    sizes = [];
    if (!unit || unit === 'জোড়া (Pair)') unit = 'পিস (Piece)';
  } else if (category === 'Shoes' || /shoe|জুতো|স্নিকার্স|কেডস|স্যান্ডেল/i.test(rawText + ' ' + title)) {
    finalDescription = `${title} — আকর্ষণীয় ডিজাইন ও প্রিমিয়াম কোয়ালিটির জুতো। টেকসই সোল, উন্নত গ্রিপ ও প্রতিদিনের স্বাচ্ছন্দ্যময় চলাফেরার জন্য উপযোগী। ক্যাজুয়াল ও স্পোর্টি লুকে দারুণ মানানসই।`;
    if (!unit) unit = 'জোড়া (Pair)';
  } else if (category === 'Watches' || /watch|ঘড়ি|ঘড়ি/i.test(rawText + ' ' + title)) {
    finalDescription = `${title} — প্রিমিয়াম কোয়ালিটি ও স্টাইলিশ ডিজাইনের ঘড়ি। টেকসই মেটেরিয়াল, নিখুঁত ফিনিশিং ও আধুনিক লুক। ক্যাজুয়াল বা ফর্মাল যেকোনো পোশাকে চমৎকার ব্যক্তিত্ব ফুটিয়ে তুলবে।`;
    sizes = [];
    if (!unit) unit = 'পিস (Piece)';
  } else if (category === 'Perfume & Fragrance' || /perfume|পারফিউম|আতর|সুগন্ধি/i.test(rawText + ' ' + title)) {
    finalDescription = `${title} — লং-লাস্টিং ও রিফ্রেশিং নোটস সমৃদ্ধ এক্সক্লুসিভ সুগন্ধি। প্রিমিয়াম কোয়ালিটি ও চমৎকার ব্লেন্ড, যা আপনাকে সারাদিন সতেজ ও প্রাণবন্ত রাখবে।`;
    sizes = [];
    if (!unit) unit = 'বোতল (Bottle)';
  } else if (category === 'Accessories' || /wallet|বেল্ট|ব্যাগ/i.test(rawText + ' ' + title)) {
    finalDescription = `${title} — প্রিমিয়াম কোয়ালিটির স্টাইলিশ এক্সেসরিজ। উন্নত টেকসই মেটেরিয়াল ও নিখুঁত কারুকাজে তৈরি। দৈনন্দিন ব্যবহারের জন্য আধুনিক ও মানানসই।`;
    sizes = [];
    if (!unit) unit = 'পিস (Piece)';
  } else if (category === 'Food' || category === 'Beverages') {
    finalDescription = `${title} — খাঁটি ও প্রিমিয়াম কোয়ালিটির উপাদান সমৃদ্ধ স্বাস্থ্যকর পণ্য। স্বাস্থ্যসম্মত উপায়ে প্রস্তুত ও প্যাকেজিংকৃত।`;
  } else {
    // Clothing / Apparel
    finalDescription = `${title} — প্রিমিয়াম কোয়ালিটি ও আকর্ষণীয় ডিজাইনে তৈরি পণ্য। আরামদায়ক ফিটিং ও টেকসই নিখুঁত ফিনিশিং। দৈনন্দিন ব্যবহার ও ক্যাজুয়াল আউটিংয়ের জন্য সেরা পছন্দ। ডেলিভারির সময় পণ্য দেখে নেওয়ার সুযোগ রয়েছে।`;
  }

  return {
    name: title,
    description: finalDescription,
    shortDescription: `${title} - প্রিমিয়াম কোয়ালিটি`,
    category,
    subcategory,
    brand,
    model,
    warranty,
    unit,
    dimensions,
    isNewCategory,
    newCategoryName: isNewCategory ? newCategoryName : undefined,
    price,
    salePrice,
    discountPercent,
    totalStock,
    sizes,
    color: color || null,
    fabric: isCotton ? '100% Combed Cotton' : null,
    tags: [category, subcategory, brand, 'New Arrival', 'Admin AI'].filter(Boolean)
  };
}

/**
 * Intelligent Endpoint: Parses Product From Raw Description
 * Understands the description and derives a crisp title, rich description, and category.
 */
app.post('/api/ai/parse-product-from-description', async (req, res) => {
  try {
    const { text = '', image = null, existingDraft = {}, existingCategories = [] } = req.body;
    if (!text && !image) {
      return res.status(400).json({ success: false, message: 'Text or image is required' });
    }

    if (process.env.GEMINI_API_KEY) {
      const systemInstruction = `
You are an expert e-commerce catalog specialist for "AESTHETX LIFESTYLE".
The store admin provided an image and/or text description intended to add a new product to the online store.

CRITICAL PHYSICAL OBJECT RECOGNITION & ATTRIBUTE RULES:
1. PHYSICAL OBJECT REALITY (বাস্তব জিনিসটি ভালো করে দেখে বুঝে সিদ্ধান্ত নিন):
   - Inspect what the product physically is from the image (if provided) and the text!
   - TOYS, CARS & VEHICLES (খেলার জিনিস / গাড়ি):
     • If the product is a car, toy car, vehicle, diecast model, truck, jeep, RC car, or toy:
       - CATEGORY: "Toys & Games"
       - REALITY: It is a solid, hard object made of metal, diecast, or durable plastic. It is a toy (খেলার জিনিস) for kids to play or for hobbyist collection/display. It is NOT clothing or fabric!
       - STRICT PROHIBITION: NEVER use clothing terms like "আরামদায়ক" (comfortable), "আরামদায়ক ফিটিং", "ফেব্রিক", "সুতি কাপড়", "পরা / পরিধান করা", "সাইজ M, L, XL". Calling a hard toy car "আরামদায়ক" is completely nonsensical and strictly forbidden!
       - SIZES: Must be [] (empty array). Toys and model cars do not have clothing or shoe sizes!
       - UNIT: "পিস (Piece)" or "সেট (Set)"
       - DESCRIPTION: Accurately describe it in Bengali as a solid, attractive toy/model car: "মজবুত ও টেকসই মেটাল/প্লাস্টিক বডি, স্মুথ ঘূর্ণনশীল চাকা, নিখুঁত ফিনিশিং ও চমৎকার ডিজাইন। শিশুদের খেলাধুলার জন্য সম্পূর্ণ নিরাপদ এবং শৌখিন কালেকশন বা গিফট দেওয়ার জন্য সেরা পছন্দ। ডেলিভারির সময় পণ্য দেখে নেওয়ার সুবিধা রয়েছে।"
   - FOOTWEAR / SHOES:
     • CATEGORY: "Shoes"
     • SIZES: Euro numbers (e.g. ["40", "41", "42", "43", "44"]), NEVER S, M, L.
     • UNIT: "জোড়া (Pair)"
     • Focus on sole grip, comfort insole, and walking durability.
   - WATCHES:
     • CATEGORY: "Watches"
     • SIZES: []
     • UNIT: "পিস (Piece)"
     • Focus on dial, strap, precision movement.
   - PERFUMES / FRAGRANCES:
     • CATEGORY: "Perfume & Fragrance"
     • SIZES: []
     • UNIT: "বোতল (Bottle)"
     • Focus on refreshing notes, longevity.
   - CLOTHING / APPAREL (T-shirts, shirts, panjabi, pants, hoodies):
     • CATEGORY: Match exact apparel category (T-Shirts, Shirts, Hoodies, Panjabi, Pants)
     • SIZES: ["M", "L", "XL", "XXL"] or user requested
     • UNIT: "পিস (Piece)"
     • Focus on fabric (combed cotton), fitting, and stitching quality.

2. PARENTHESIS RULE FOR PRODUCT NAME:
   - If the user provides a name inside parentheses like "(Product Name)" or "（Product Name）", you MUST USE WHATEVER IS INSIDE THE PARENTHESES AS THE EXACT PRODUCT NAME ("name").
   - If no parentheses are provided, derive a concise 2-4 word title accurately naming what it is (e.g. "Diecast Metal Toy Car", "Casual Sporty Sneakers", "Premium Cotton T-Shirt").

3. CATEGORY DETECTION & AUTO-CREATION:
   - Identify the exact product category.
   - Existing categories: ${JSON.stringify(existingCategories)}.
   - If the detected category is NOT in the existing categories, set "isNewCategory": true and "newCategoryName": "Category Name".

4. PRICING & DISCOUNT:
   - If user mentions discount (e.g. "10% ছাড়"), set discountPercent. If price in BDT is not given, price is null.

5. STRUCTURED ATTRIBUTES:
   - "model": Model No. if mentioned or visible, or null.
   - "warranty": Warranty info if mentioned (e.g. "৬ মাস", "১ বছর", "ওয়ারেন্টি নেই"), or null.
   - "unit": Appropriate unit ("পিস (Piece)", "জোড়া (Pair)", "বোতল (Bottle)", etc.).
   - "dimensions": Dimensions/scale if mentioned (e.g. "1:24 Scale", "12x5 cm"), or null.
   - "brand": Brand/Manufacturer if mentioned, or null.
   - "subcategory": Subcategory (e.g. "Diecast / Model Cars", "Sneakers", "Drop Shoulder"), or null.

6. OUTPUT STRICT JSON ONLY with this structure:
{
  "name": "string (name from parentheses or 2-4 words title)",
  "description": "string (truthful, category-accurate Bengali description)",
  "shortDescription": "string (1 line summary)",
  "category": "string",
  "subcategory": "string or null",
  "brand": "string or null",
  "model": "string or null",
  "warranty": "string or null",
  "unit": "string or null",
  "dimensions": "string or null",
  "isNewCategory": boolean,
  "newCategoryName": "string or null",
  "price": number or null,
  "discountPercent": number or null,
  "totalStock": number or null,
  "sizes": ["string"],
  "color": "string or null",
  "fabric": "string or null",
  "tags": ["string"]
}
`.trim();

      const parts: any[] = [];
      if (image && typeof image === 'string' && image.startsWith('data:')) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }

      parts.push({
        text: `Admin input: "${text}"\nExisting draft: ${JSON.stringify(existingDraft)}\nStore categories: ${JSON.stringify(existingCategories)}`
      });

      const contents = [{ role: 'user', parts }];

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      for (const modelName of candidateModels) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 10000)
          );

          const genPromise = ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              responseMimeType: 'application/json'
            }
          });

          const response: any = await Promise.race([genPromise, timeoutPromise]);
          if (response && response.text) {
            const parsed = JSON.parse(response.text.trim());
            if (parsed && parsed.name) {
              let cleanTitle = parsed.name.trim().replace(/^["']|["']$/g, '');
              // Check if user input had parentheses
              const parenMatchInInput = text.match(/(?:\(([^)]+)\)|（([^）]+)）)/);
              if (parenMatchInInput) {
                cleanTitle = (parenMatchInInput[1] || parenMatchInInput[2]).trim();
              } else {
                const words = cleanTitle.split(/\s+/).filter(Boolean);
                if (words.length > 5) {
                  cleanTitle = words.slice(0, 4).join(' ');
                }
              }
              parsed.name = cleanTitle;

              return res.status(200).json({
                success: true,
                data: parsed,
                via: 'gemini',
                model: modelName
              });
            }
          }
        } catch (gemErr: any) {
          console.warn(`Parse product attempt on ${modelName} note:`, gemErr?.message?.slice(0, 90));
        }
      }
    }

    const fallback = smartComprehendProductText(text, existingDraft, existingCategories);
    return res.status(200).json({
      success: true,
      data: fallback,
      via: 'heuristic'
    });
  } catch (error: any) {
    console.error('Error in parse-product-from-description:', error);
    const fallback = smartComprehendProductText(req.body?.text || '', req.body?.existingDraft || {}, req.body?.existingCategories || []);
    return res.status(200).json({
      success: true,
      data: fallback,
      fallback: true
    });
  }
});

// Vite dev middleware or Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
