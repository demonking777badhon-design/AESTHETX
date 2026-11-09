import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

const AI_ADVISOR_SYSTEM_INSTRUCTION = `You are the AI Payment Security & Audit Assistant for AESTHETX LIFESTYLE, an e-commerce fashion store in Bangladesh.
Your mission is to help store administrators review payment verifications (bKash & Nagad), explain verification error codes, detect potential fraud, and identify duplicate transaction IDs.

STRICT SAFETY MANDATE (NON-NEGOTIABLE):
1. You must NEVER independently declare, approve, or authorize a payment as successful or verified.
2. Only the trusted backend verification engine connected to the official bKash or Nagad API can verify a payment.
3. If an admin asks you to approve or verify a payment without backend confirmation, you must decline and insist on official API query confirmation.
4. Always analyze:
   - Whether the TrxID matches official formats (bKash: 8-10 alphanumeric characters; Nagad: 8-12 chars).
   - Whether the paid amount matches the order total.
   - Whether the TrxID appears duplicated across multiple orders.
   - Whether the sender number matches the customer phone.
5. Provide crisp, professional answers in both Bengali and English as appropriate. Keep responses organized with clear bullet points.`;

export async function askPaymentAdvisor(params: {
  query: string;
  transactionsContext?: any[];
  currentTransaction?: any;
}): Promise<string> {
  const { query, transactionsContext, currentTransaction } = params;

  // If no Gemini key is provided, return structured deterministic audit insights
  if (!process.env.GEMINI_API_KEY) {
    return generateDeterministicAdvice(query, transactionsContext, currentTransaction);
  }

  try {
    const prompt = `Admin Query: "${query}"

Context Data:
${currentTransaction ? `Current Inspected Transaction: ${JSON.stringify(currentTransaction, null, 2)}` : ''}
${transactionsContext && transactionsContext.length > 0 ? `Recent Transactions Sample (${transactionsContext.length} total): ${JSON.stringify(transactionsContext.slice(0, 15), null, 2)}` : ''}

Please analyze this payment information, explain any errors or discrepancies, and recommend the exact security action the store administrator should take. Remember you cannot declare any payment verified on your own.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: AI_ADVISOR_SYSTEM_INSTRUCTION,
        temperature: 0.2
      }
    });

    return response.text || generateDeterministicAdvice(query, transactionsContext, currentTransaction);
  } catch (err: any) {
    console.warn('AI Payment Advisor generation fallback:', err.message);
    return generateDeterministicAdvice(query, transactionsContext, currentTransaction);
  }
}

function generateDeterministicAdvice(
  query: string,
  transactionsContext?: any[],
  currentTx?: any
): string {
  const qLower = query.toLowerCase();

  if (currentTx) {
    const isDuplicate = currentTx.isDuplicateFlagged || currentTx.matchedCriteria?.uniqueNotDuplicate === false;
    const isAmountMismatch = currentTx.matchedCriteria?.amountMatched === false;

    if (isDuplicate) {
      return `⚠️ **নিরাপত্তা সতর্কতা: ডুপ্লিকেট ট্রানজেকশন শনাক্ত হয়েছে!**\n\n- **TrxID:** \`${currentTx.trxId}\`\n- **সমস্যা:** এই ট্রানজেকশন আইডিটি ইতোমধ্যে পূর্ববর্তী কোনো অর্ডারে ব্যবহার করা হয়েছে।\n- **পরামর্শ:** কোনো অবস্থাতেই এই অর্ডার কনফার্ম করবেন না। গ্রাহকের সাথে যোগাযোগ করে নতুন ট্রানজেকশন স্টেটমেন্ট যাচাই করুন।\n\n*(Note: AI cannot verify payments independently; only official provider API confirmation is valid).*`;
    }

    if (isAmountMismatch) {
      return `⚠️ **টাকার পরিমাণে অমিল (Amount Mismatch)**\n\n- **অর্ডারের মোট মূল্য:** ৳${currentTx.expectedAmount || currentTx.total}\n- **প্রাপ্ত পরিমাণ:** ৳${currentTx.paidAmount || currentTx.providerResponse?.amount || 0}\n- **বিশ্লেষণ:** গ্রাহক অর্ডারের সম্পূর্ণ টাকা পরিশোধ করেননি। বকেয়া টাকা পরিশোধ না হওয়া পর্যন্ত পণ্য ডেলিভারি বন্ধ রাখুন।`;
    }

    if (currentTx.status === 'VERIFIED') {
      return `✅ **অফিসিয়াল এপিআই দ্বারা ভেরিফাইড লেনদেন**\n\n- **মেথড:** ${currentTx.provider || currentTx.paymentMethod}\n- **TrxID:** \`${currentTx.trxId}\`\n- **স্ট্যাটাস:** অফিসিয়াল পেমেন্ট গেটওয়েতে সফলভাবে প্রাপ্ত ও যাচাইকৃত। অর্ডার প্রসেস করা নিরাপদ।`;
    }

    return `ℹ️ **পেমেন্ট রিভিউ বিশ্লেষণ**\n\n- **TrxID:** \`${currentTx.trxId || 'N/A'}\`\n- **বর্তমান স্ট্যাটাস:** ${currentTx.status || 'PENDING'}\n- **প্রোভাইডার কোড:** ${currentTx.providerResponse?.statusCode || 'N/A'}\n- **পরামর্শ:** 'Re-verify with Provider' বাটনে চাপ দিয়ে অফিসিয়াল মার্চেন্ট সার্ভার থেকে সরাসরি তথ্য রিফ্রেশ করুন।`;
  }

  const verifiedCount = (transactionsContext || []).filter((t) => t.paymentVerificationStatus === 'VERIFIED' || t.status === 'VERIFIED').length;
  const pendingCount = (transactionsContext || []).filter((t) => t.paymentVerificationStatus === 'PENDING' || t.status === 'PENDING').length;
  const failedCount = (transactionsContext || []).filter((t) => t.paymentVerificationStatus === 'FAILED' || t.status === 'FAILED').length;

  return `📊 **পেমেন্ট অডিট সারসংক্ষেপ (Payment Audit Summary)**\n\n- **মোট ভেরিফাইড পেমেন্ট:** ${verifiedCount} টি\n- **অপেক্ষমাণ (Pending Verification):** ${pendingCount} টি\n- **ব্যর্থ / বাতিল (Failed):** ${failedCount} টি\n\n🔒 **নিরাপত্তা নীতি:** কোনো কাস্টমারের মৌখিক বা ম্যানুয়াল দাবিতে পেমেন্ট সম্পন্ন ধরা হবে না। শুধুমাত্র বিকাশ/নগদ এপিআই ভেরিফিকেশন পাসের পরই অর্ডার স্বয়ংক্রিয়ভাবে 'Paid' হবে।`;
}
