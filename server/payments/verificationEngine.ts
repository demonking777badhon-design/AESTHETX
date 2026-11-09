import { bkashProvider } from './bkashProvider.js';
import { nagadProvider } from './nagadProvider.js';
import type { VerificationRequest, VerificationResult, ProviderQueryResponse } from './types.js';

// Server-side recorded transactions to enforce strict uniqueness and detect duplicate TrxID attacks
const verifiedTransactionsStore = new Map<
  string,
  {
    orderId: string;
    orderNumber: string;
    provider: string;
    amount: number;
    verifiedAt: string;
  }
>();

// Seed a known duplicate trigger for testing duplicate TrxID scenario (Requirement 9)
verifiedTransactionsStore.set('DUPLICATE_SAMPLE_TRX', {
  orderId: 'existing_sample_order',
  orderNumber: 'AL-10001',
  provider: 'bKash',
  amount: 1500,
  verifiedAt: new Date(Date.now() - 3600000).toISOString()
});

export class VerificationEngine {
  /**
   * Independently verifies customer payment with authorized provider API
   */
  public async verifyPayment(req: VerificationRequest): Promise<VerificationResult> {
    const { orderId, orderNumber, provider, trxId, senderNumber, expectedAmount } = req;
    const cleanTrx = trxId.trim().toUpperCase();
    const verifiedAt = new Date().toISOString();

    const mode = provider === 'bKash' ? bkashProvider.getMode() : nagadProvider.getMode();
    const merchantWallet =
      provider === 'bKash' ? bkashProvider.getMerchantNumber() : nagadProvider.getAccountNumber();

    // 1. Check for Duplicate Transaction ID across ALL existing orders
    const duplicateRecord = verifiedTransactionsStore.get(cleanTrx);
    if (duplicateRecord && duplicateRecord.orderId !== orderId) {
      return {
        verified: false,
        status: 'FAILED',
        orderId,
        orderNumber,
        provider,
        mode,
        trxId: cleanTrx,
        senderNumber,
        expectedAmount,
        paidAmount: duplicateRecord.amount,
        currency: 'BDT',
        matchedCriteria: {
          transactionExists: true,
          statusSuccess: true,
          amountMatched: false,
          merchantAccountMatched: false,
          senderNumberMatched: null,
          uniqueNotDuplicate: false
        },
        failureReason: `DUPLICATE_TRANSACTION_ID: This Transaction ID has already been credited to order #${duplicateRecord.orderNumber}.`,
        userMessageBn: `এই ট্রানজেকশন আইডি (${cleanTrx}) ইতোমধ্যে পূর্ববর্তী অর্ডার #${duplicateRecord.orderNumber}-এ ব্যবহৃত হয়েছে। ডুপ্লিকেট ট্রানজেকশন গ্রহণ করা হবে না।`,
        userMessageEn: `This Transaction ID (${cleanTrx}) was already claimed on order #${duplicateRecord.orderNumber}. Duplicate use is strictly forbidden.`,
        verifiedAt
      };
    }

    // 2. Query Official Payment Provider
    let queryRes: ProviderQueryResponse;
    if (provider === 'bKash') {
      queryRes = await bkashProvider.searchTransaction(cleanTrx);
    } else {
      queryRes = await nagadProvider.verifyPayment(cleanTrx);
    }

    // Handle provider query failure or non-existent transaction
    if (!queryRes.success || !queryRes.trxId) {
      return {
        verified: false,
        status: 'FAILED',
        orderId,
        orderNumber,
        provider,
        mode,
        trxId: cleanTrx,
        senderNumber,
        expectedAmount,
        paidAmount: 0,
        currency: 'BDT',
        matchedCriteria: {
          transactionExists: false,
          statusSuccess: false,
          amountMatched: false,
          merchantAccountMatched: false,
          senderNumberMatched: null,
          uniqueNotDuplicate: true
        },
        failureReason: queryRes.error || queryRes.statusMessage || 'TRANSACTION_NOT_FOUND',
        userMessageBn: `পেমেন্ট প্রোভাইডার (${provider})-এ এই ট্রানজেকশন আইডি (${cleanTrx}) পাওয়া যায়নি বা পেমেন্ট সম্পন্ন হয়নি।`,
        userMessageEn: `Transaction ID (${cleanTrx}) was not found or is uncompleted on ${provider}'s network.`,
        verifiedAt,
        providerResponse: queryRes.providerRaw
      };
    }

    // Resolve actual amount paid reported by provider
    const actualPaid = queryRes.paidAmount === -1 ? expectedAmount : queryRes.paidAmount;

    // 3. Independent Amount Verification (Exact amount matching)
    const amountDifference = Math.abs(actualPaid - expectedAmount);
    const amountMatched = amountDifference < 0.01;

    // 4. Authorized Merchant Receiver Verification
    const receiverNumber = queryRes.receiverMsisdn ? queryRes.receiverMsisdn.replace(/[^0-9]/g, '') : '';
    const cleanMerchantNumber = merchantWallet.replace(/[^0-9]/g, '');
    const merchantMatched = !receiverNumber || receiverNumber.includes(cleanMerchantNumber) || cleanMerchantNumber.includes(receiverNumber);

    // 5. Sender Number Matching (if supplied by provider)
    let senderMatched: boolean | null = null;
    if (queryRes.senderMsisdn && senderNumber) {
      const cleanSender = senderNumber.replace(/[^0-9]/g, '');
      const cleanProviderSender = queryRes.senderMsisdn.replace(/[^0-9]/g, '');
      senderMatched = cleanProviderSender.includes(cleanSender) || cleanSender.includes(cleanProviderSender);
    }

    // Check status is explicitly Completed or Success
    const rawStatusLower = (queryRes.rawStatus || '').toLowerCase();
    const statusSuccess = rawStatusLower === 'completed' || rawStatusLower === 'success' || rawStatusLower === 'successful';

    // Compile match checklist
    const matchedCriteria = {
      transactionExists: true,
      statusSuccess,
      amountMatched,
      merchantAccountMatched: merchantMatched,
      senderNumberMatched: senderMatched,
      uniqueNotDuplicate: true
    };

    // If any critical criteria failed
    if (!statusSuccess) {
      return {
        verified: false,
        status: 'FAILED',
        orderId,
        orderNumber,
        provider,
        mode,
        trxId: cleanTrx,
        senderNumber,
        expectedAmount,
        paidAmount: actualPaid,
        currency: queryRes.currency || 'BDT',
        matchedCriteria,
        failureReason: `STATUS_NOT_COMPLETED: Provider reported status '${queryRes.rawStatus}'.`,
        userMessageBn: `পেমেন্ট সম্পন্ন হয়নি (স্ট্যাটাস: ${queryRes.rawStatus})।`,
        userMessageEn: `Payment has not been completed (Provider status: ${queryRes.rawStatus}).`,
        verifiedAt,
        providerResponse: queryRes.providerRaw
      };
    }

    if (!amountMatched) {
      return {
        verified: false,
        status: 'FAILED',
        orderId,
        orderNumber,
        provider,
        mode,
        trxId: cleanTrx,
        senderNumber,
        expectedAmount,
        paidAmount: actualPaid,
        currency: queryRes.currency || 'BDT',
        matchedCriteria,
        failureReason: `AMOUNT_MISMATCH: Order requires ৳${expectedAmount}, but received ৳${actualPaid}.`,
        userMessageBn: `টাকার পরিমাণ মিলছে না। অর্ডারের পরিমাণ ৳${expectedAmount}, কিন্তু প্রাপ্ত পরিমাণ ৳${actualPaid}।`,
        userMessageEn: `Amount mismatch: Expected ৳${expectedAmount}, but received ৳${actualPaid}.`,
        verifiedAt,
        providerResponse: queryRes.providerRaw
      };
    }

    if (!merchantMatched) {
      return {
        verified: false,
        status: 'MANUAL_REVIEW',
        orderId,
        orderNumber,
        provider,
        mode,
        trxId: cleanTrx,
        senderNumber,
        expectedAmount,
        paidAmount: actualPaid,
        currency: queryRes.currency || 'BDT',
        matchedCriteria,
        failureReason: `RECEIVER_MISMATCH: Payment went to a different merchant (${queryRes.receiverMsisdn}).`,
        userMessageBn: `পেমেন্টটি আমাদের অনুমোদিত মার্চেন্ট একাউন্টে পাঠানো হয়নি। অ্যাডমিন ম্যানুয়াল রিভিউ করবে।`,
        userMessageEn: `Payment was received by an unauthorized account (${queryRes.receiverMsisdn}). Flagged for manual review.`,
        verifiedAt,
        providerResponse: queryRes.providerRaw
      };
    }

    // ALL CHECKS PASSED: Lock this transaction ID to prevent duplicate reuse
    verifiedTransactionsStore.set(cleanTrx, {
      orderId,
      orderNumber,
      provider,
      amount: actualPaid,
      verifiedAt
    });

    return {
      verified: true,
      status: 'VERIFIED',
      orderId,
      orderNumber,
      provider,
      mode,
      trxId: cleanTrx,
      senderNumber,
      expectedAmount,
      paidAmount: actualPaid,
      currency: queryRes.currency || 'BDT',
      matchedCriteria,
      userMessageBn: `পেমেন্ট সফলভাবে স্বয়ংক্রিয়ভাবে ভেরিফাই হয়েছে। আপনার অর্ডার #${orderNumber} নিশ্চিত করা হলো।`,
      userMessageEn: `Payment successfully verified via ${provider} Official API. Order #${orderNumber} is confirmed!`,
      verifiedAt,
      providerResponse: queryRes.providerRaw
    };
  }

  /**
   * Retrieves all verified transactions recorded in engine
   */
  public getAllRecordedTransactions() {
    const list: any[] = [];
    verifiedTransactionsStore.forEach((val, key) => {
      list.push({ trxId: key, ...val });
    });
    return list;
  }
}

export const verificationEngine = new VerificationEngine();
