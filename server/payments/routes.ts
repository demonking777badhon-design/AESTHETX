import { Router } from 'express';
import { verificationEngine } from './verificationEngine.js';
import { bkashProvider } from './bkashProvider.js';
import { nagadProvider } from './nagadProvider.js';
import { askPaymentAdvisor } from './aiPaymentAdvisor.js';
import { getGatewayState, setGatewayState } from './gatewayState.js';

export const paymentRouter = Router();

// In-memory rate-limiter map to prevent brute-force TrxID guessing attacks
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_VERIFICATION_ATTEMPTS_PER_MIN = 12;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (record.count >= MAX_VERIFICATION_ATTEMPTS_PER_MIN) {
    return false;
  }
  record.count += 1;
  return true;
}

/**
 * GET /api/payments/gateway-status
 * Returns real-time admin enable/disable status for bKash & Nagad
 */
paymentRouter.get('/gateway-status', (_req, res) => {
  const state = getGatewayState();
  res.json({
    success: true,
    ...state
  });
});

/**
 * POST /api/payments/gateway-status
 * Updates admin enable/disable state for bKash & Nagad on the server
 */
paymentRouter.post('/gateway-status', (req, res) => {
  const { bkashEnabled, nagadEnabled } = req.body || {};
  const nextState = setGatewayState({
    ...(typeof bkashEnabled === 'boolean' ? { bkashEnabled } : {}),
    ...(typeof nagadEnabled === 'boolean' ? { nagadEnabled } : {})
  });
  res.json({
    success: true,
    ...nextState
  });
});

/**
 * GET /api/payments/config-status
 * Safely inspects bKash & Nagad gateway configuration without exposing secret keys
 */
paymentRouter.get('/config-status', (_req, res) => {
  const gwState = getGatewayState();
  res.json({
    success: true,
    updatedAt: gwState.updatedAt,
    bkash: {
      enabled: gwState.bkashEnabled,
      isConfigured: bkashProvider.isConfigured(),
      mode: bkashProvider.getMode(),
      merchantNumber: bkashProvider.getMerchantNumber(),
      docsUrl: 'https://developer.bka.sh'
    },
    nagad: {
      enabled: gwState.nagadEnabled,
      isConfigured: nagadProvider.isConfigured(),
      mode: nagadProvider.getMode(),
      accountNumber: nagadProvider.getAccountNumber(),
      docsUrl: 'https://pgw.mynagad.com'
    }
  });
});

/**
 * POST /api/payments/verify
 * Main automatic verification endpoint invoked during checkout and admin audits
 */
paymentRouter.post('/verify', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'client';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      verified: false,
      status: 'FAILED',
      failureReason: 'RATE_LIMIT_EXCEEDED',
      userMessageBn: 'অতিরিক্ত ভেরিফিকেশন চেষ্টার কারণে সাময়িকভাবে স্থগিত করা হয়েছে। ১ মিনিট পর পুনরায় চেষ্টা করুন।',
      userMessageEn: 'Too many verification attempts. Please wait 1 minute before retrying.'
    });
  }

  const { orderId, orderNumber, provider, trxId, senderNumber, expectedAmount } = req.body;

  if (!orderId || !trxId || !expectedAmount || !provider) {
    return res.status(400).json({
      verified: false,
      status: 'FAILED',
      failureReason: 'MISSING_REQUIRED_FIELDS',
      userMessageBn: 'প্রয়োজনীয় তথ্য অনুপস্থিত (Order ID, TrxID, Provider, Amount)।',
      userMessageEn: 'Missing required parameters: orderId, trxId, provider, or expectedAmount.'
    });
  }

  const normalizedProvider = provider === 'Nagad' ? 'Nagad' : 'bKash';
  const gwState = getGatewayState();

  if (normalizedProvider === 'bKash' && !gwState.bkashEnabled) {
    return res.status(403).json({
      verified: false,
      status: 'FAILED',
      failureReason: 'PAYMENT_METHOD_DISABLED',
      userMessageBn: 'অ্যাডমিন প্যানেল থেকে বিকাশ (bKash) পেমেন্ট বর্তমানে বন্ধ রাখা হয়েছে। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বা অন্য চালু মাধ্যম ব্যবহার করুন।',
      userMessageEn: 'bKash payment is currently disabled by the store administrator. Please use Cash on Delivery or another active payment method.'
    });
  }

  if (normalizedProvider === 'Nagad' && !gwState.nagadEnabled) {
    return res.status(403).json({
      verified: false,
      status: 'FAILED',
      failureReason: 'PAYMENT_METHOD_DISABLED',
      userMessageBn: 'অ্যাডমিন প্যানেল থেকে নগদ (Nagad) পেমেন্ট বর্তমানে বন্ধ রাখা হয়েছে। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বা অন্য চালু মাধ্যম ব্যবহার করুন।',
      userMessageEn: 'Nagad payment is currently disabled by the store administrator. Please use Cash on Delivery or another active payment method.'
    });
  }

  try {
    const result = await verificationEngine.verifyPayment({
      orderId: String(orderId),
      orderNumber: String(orderNumber || orderId),
      provider: normalizedProvider,
      trxId: String(trxId),
      senderNumber: senderNumber ? String(senderNumber) : undefined,
      expectedAmount: Number(expectedAmount)
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Payment verification engine error:', error);
    return res.status(500).json({
      verified: false,
      status: 'FAILED',
      failureReason: error.message || 'INTERNAL_VERIFICATION_ERROR',
      userMessageBn: 'পেমেন্ট প্রোভাইডার সার্ভারের সাথে সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
      userMessageEn: 'Unable to communicate with payment provider. Please try again shortly.'
    });
  }
});

/**
 * POST /api/payments/bkash/create
 * Creates an official bKash Tokenized Checkout URL
 */
paymentRouter.post('/bkash/create', async (req, res) => {
  if (!getGatewayState().bkashEnabled) {
    return res.status(403).json({
      success: false,
      error: 'bKash payment gateway is currently disabled by store administrator.'
    });
  }
  const { orderNumber, amount, customerPhone, callbackUrl } = req.body;
  try {
    const result = await bkashProvider.createPayment(
      orderNumber || `AL-${Date.now()}`,
      parseFloat(amount || '0'),
      customerPhone || '01700000000',
      callbackUrl || 'https://aesthetx.lifestyle/order-confirmation'
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/bkash/query
 * Official bKash Search Transaction endpoint
 */
paymentRouter.post('/bkash/query', async (req, res) => {
  if (!getGatewayState().bkashEnabled) {
    return res.status(403).json({
      success: false,
      error: 'bKash payment gateway is currently disabled by store administrator.'
    });
  }
  const { trxId } = req.body;
  if (!trxId) return res.status(400).json({ error: 'trxId is required' });
  const result = await bkashProvider.searchTransaction(String(trxId));
  res.json(result);
});

/**
 * POST /api/payments/nagad/verify
 * Official Nagad verify payment endpoint
 */
paymentRouter.post('/nagad/verify', async (req, res) => {
  if (!getGatewayState().nagadEnabled) {
    return res.status(403).json({
      success: false,
      error: 'Nagad payment gateway is currently disabled by store administrator.'
    });
  }
  const { trxId } = req.body;
  if (!trxId) return res.status(400).json({ error: 'trxId is required' });
  const result = await nagadProvider.verifyPayment(String(trxId));
  res.json(result);
});

/**
 * POST /api/payments/test-scenario
 * Test runner for Requirement 9:
 * Tests successful, failed, pending, incorrect amount, incorrect receiver, invalid TrxID, duplicate TrxID and API failure scenarios.
 */
paymentRouter.post('/test-scenario', async (req, res) => {
  const { scenario, provider = 'bKash', expectedAmount = 1500 } = req.body;
  const mockOrderId = `test_ord_${Date.now()}`;
  const mockOrderNum = `TEST-AL-${Math.floor(1000 + Math.random() * 9000)}`;

  let testTrxId = '';
  switch (scenario) {
    case 'success':
      testTrxId = provider === 'bKash' ? `BK${Date.now().toString(36).toUpperCase()}8X` : `NG${Date.now().toString(36).toUpperCase()}9Y`;
      break;
    case 'incorrect_amount':
      testTrxId = `WRONGAMT_${Date.now()}`;
      break;
    case 'invalid_trx_id':
      testTrxId = `INVALID_${Date.now()}`;
      break;
    case 'duplicate_trx_id':
      // Uses the pre-seeded duplicate transaction ID
      testTrxId = 'DUPLICATE_SAMPLE_TRX';
      break;
    case 'incorrect_receiver':
      testTrxId = `WRONGRECEIVER_${Date.now()}`;
      break;
    case 'api_failure':
      testTrxId = `FAIL_NETWORK_${Date.now()}`;
      break;
    case 'pending':
      testTrxId = `PENDING_${Date.now()}`;
      break;
    default:
      testTrxId = `TEST_${Date.now()}`;
  }

  const result = await verificationEngine.verifyPayment({
    orderId: mockOrderId,
    orderNumber: mockOrderNum,
    provider: provider === 'Nagad' ? 'Nagad' : 'bKash',
    trxId: testTrxId,
    senderNumber: '01708943242',
    expectedAmount: Number(expectedAmount)
  });

  res.json({
    scenarioTested: scenario,
    testTrxId,
    verificationDecision: result
  });
});

/**
 * POST /api/payments/ai-assistant
 * Server-Side AI Payment Security & Audit Assistant (Requirement 5)
 */
paymentRouter.post('/ai-assistant', async (req, res) => {
  const { query, transactionsContext, currentTransaction } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query prompt is required' });
  }

  try {
    const advice = await askPaymentAdvisor({
      query: String(query),
      transactionsContext: Array.isArray(transactionsContext) ? transactionsContext : undefined,
      currentTransaction
    });

    res.json({
      success: true,
      advice,
      guardrailNotice:
        'AI analyzes payment verification data and security patterns, but CANNOT independently authorize or approve payments without backend provider API validation.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Webhooks for bKash & Nagad IPN (Instant Payment Notification)
 */
paymentRouter.post('/webhook/bkash', (req, res) => {
  console.log('Received inbound bKash IPN webhook:', req.body);
  // Acknowledge bKash webhook
  res.status(200).json({ status: 'ACCEPTED' });
});

paymentRouter.post('/webhook/nagad', (req, res) => {
  console.log('Received inbound Nagad IPN webhook:', req.body);
  // Acknowledge Nagad webhook
  res.status(200).json({ status: 'ACCEPTED' });
});
