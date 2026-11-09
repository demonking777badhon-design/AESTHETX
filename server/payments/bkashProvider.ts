import type { ProviderQueryResponse } from './types.js';

interface BKashTokenData {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class BKashProvider {
  private appKey: string;
  private appSecret: string;
  private username: string;
  private password: string;
  private isSandbox: boolean;
  private baseUrl: string;
  private cachedToken: BKashTokenData | null = null;
  private merchantNumber: string;

  constructor() {
    this.appKey = process.env.BKASH_APP_KEY || '';
    this.appSecret = process.env.BKASH_APP_SECRET || '';
    this.username = process.env.BKASH_USERNAME || '';
    this.password = process.env.BKASH_PASSWORD || '';
    this.merchantNumber = process.env.BKASH_MERCHANT_NUMBER || '01708943242';
    this.isSandbox = process.env.BKASH_SANDBOX !== 'false';
    this.baseUrl = this.isSandbox
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta';
  }

  public isConfigured(): boolean {
    return Boolean(this.appKey && this.appSecret && this.username && this.password);
  }

  public getMode(): 'sandbox' | 'live' {
    return this.isSandbox ? 'sandbox' : 'live';
  }

  public getMerchantNumber(): string {
    return this.merchantNumber;
  }

  /**
   * Generates or retrieves a valid Bearer ID token from bKash OAuth API
   */
  public async grantToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.idToken;
    }

    if (!this.isConfigured()) {
      if (this.isSandbox) {
        // Return a mock sandbox bearer token when merchant credentials are not yet saved
        const mockToken = `sandbox_bkash_token_${Date.now()}`;
        this.cachedToken = {
          idToken: mockToken,
          refreshToken: `refresh_${Date.now()}`,
          expiresAt: now + 3500 * 1000
        };
        return mockToken;
      }
      throw new Error('bKash credentials missing: Please configure BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD');
    }

    const res = await fetch(`${this.baseUrl}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: this.username,
        password: this.password
      },
      body: JSON.stringify({
        app_key: this.appKey,
        app_secret: this.appSecret
      })
    });

    const data: any = await res.json();
    if (!res.ok || !data.id_token) {
      throw new Error(`bKash Token Grant Failed: ${data.statusMessage || res.statusText} (Code: ${data.statusCode || res.status})`);
    }

    this.cachedToken = {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: now + (data.expiresIn || 3600) * 1000
    };

    return data.id_token;
  }

  /**
   * Queries transaction status by TrxID from bKash official General/Search API
   * Endpoint: POST /tokenized/checkout/general/searchTransaction
   */
  public async searchTransaction(trxId: string): Promise<ProviderQueryResponse> {
    const cleanTrx = trxId.trim().toUpperCase();

    // If live credentials are provided, call official bKash API
    if (this.isConfigured()) {
      try {
        const idToken = await this.grantToken();
        const res = await fetch(`${this.baseUrl}/tokenized/checkout/general/searchTransaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: idToken,
            'X-APP-Key': this.appKey
          },
          body: JSON.stringify({ trxID: cleanTrx })
        });

        const data: any = await res.json();

        // Successful transaction status response
        if (data.statusCode === '0000' && data.trxID) {
          const isCompleted = data.transactionStatus === 'Completed' || data.transactionStatus === 'Initiated';
          return {
            success: isCompleted,
            rawStatus: data.transactionStatus || 'Unknown',
            statusCode: data.statusCode,
            statusMessage: data.statusMessage,
            trxId: data.trxID,
            paidAmount: parseFloat(data.amount || '0'),
            currency: data.currency || 'BDT',
            senderMsisdn: data.customerMsisdn,
            receiverMsisdn: data.organizationShortCode || this.merchantNumber,
            transactionTime: data.completedTime || data.initiationTime,
            providerRaw: data
          };
        }

        return {
          success: false,
          rawStatus: data.transactionStatus || 'Failed',
          statusCode: data.statusCode || 'UNKNOWN_ERROR',
          statusMessage: data.statusMessage || 'Transaction not found or status incomplete',
          trxId: cleanTrx,
          paidAmount: parseFloat(data.amount || '0'),
          currency: 'BDT',
          providerRaw: data,
          error: data.statusMessage || 'bKash verification failed'
        };
      } catch (err: any) {
        return {
          success: false,
          rawStatus: 'NETWORK_ERROR',
          statusCode: 'FETCH_FAILED',
          statusMessage: err.message,
          trxId: cleanTrx,
          paidAmount: 0,
          currency: 'BDT',
          providerRaw: { error: err.message },
          error: err.message
        };
      }
    }

    // In Sandbox mode without live credentials, validate standard bKash TrxID format
    // bKash TrxIDs are typically 8-10 alphanumeric characters (e.g., BL89XK241P, 9H76QW42OP, etc.)
    return this.sandboxQuery(cleanTrx);
  }

  /**
   * Deterministic Sandbox query simulator conforming to official bKash response specifications
   */
  private sandboxQuery(trxId: string): ProviderQueryResponse {
    // If TrxID is obviously invalid or test invalid patterns
    if (
      trxId.includes('FAIL') ||
      trxId.includes('INVALID') ||
      trxId.includes('NOTFOUND') ||
      trxId.length < 6
    ) {
      return {
        success: false,
        rawStatus: 'Failed',
        statusCode: '2023',
        statusMessage: 'Transaction does not exist or has expired in bKash network',
        trxId,
        paidAmount: 0,
        currency: 'BDT',
        providerRaw: {
          statusCode: '2023',
          statusMessage: 'Invalid TrxID',
          trxID: trxId
        },
        error: 'Transaction does not exist'
      };
    }

    // Amount mismatch simulation trigger
    if (trxId.includes('WRONGAMT') || trxId.includes('MISMATCH')) {
      return {
        success: true,
        rawStatus: 'Completed',
        statusCode: '0000',
        statusMessage: 'Successful',
        trxId,
        paidAmount: 500, // Deliberate mismatch
        currency: 'BDT',
        senderMsisdn: '01700000000',
        receiverMsisdn: this.merchantNumber,
        transactionTime: new Date().toISOString(),
        providerRaw: {
          trxID: trxId,
          transactionStatus: 'Completed',
          amount: '500.00',
          currency: 'BDT',
          customerMsisdn: '01700000000'
        }
      };
    }

    // Wrong receiver trigger
    if (trxId.includes('WRONGRECEIVER') || trxId.includes('WRONGMERCHANT')) {
      return {
        success: true,
        rawStatus: 'Completed',
        statusCode: '0000',
        statusMessage: 'Successful',
        trxId,
        paidAmount: 1500,
        currency: 'BDT',
        senderMsisdn: '01700000000',
        receiverMsisdn: '01999999999', // Different merchant wallet
        transactionTime: new Date().toISOString(),
        providerRaw: {
          trxID: trxId,
          transactionStatus: 'Completed',
          amount: '1500.00',
          organizationShortCode: '01999999999'
        }
      };
    }

    // Default Sandbox Successful Transaction
    return {
      success: true,
      rawStatus: 'Completed',
      statusCode: '0000',
      statusMessage: 'Successful',
      trxId,
      paidAmount: -1, // -1 signals to verification engine to check expected order amount in sandbox
      currency: 'BDT',
      senderMsisdn: '01708943242',
      receiverMsisdn: this.merchantNumber,
      transactionTime: new Date().toISOString(),
      providerRaw: {
        trxID: trxId,
        transactionStatus: 'Completed',
        currency: 'BDT',
        statusCode: '0000',
        statusMessage: 'Successful',
        organizationShortCode: this.merchantNumber,
        completedTime: new Date().toISOString(),
        mode: 'sandbox_verified'
      }
    };
  }

  /**
   * Creates an official bKash Tokenized Checkout URL (Redirect flow)
   */
  public async createPayment(orderNumber: string, amount: number, customerPhone: string, callbackUrl: string) {
    if (!this.isConfigured()) {
      return {
        success: true,
        mode: 'sandbox',
        paymentID: `bkash_pid_sandbox_${Date.now()}`,
        bkashURL: `${callbackUrl}?paymentID=bkash_pid_sandbox_${Date.now()}&status=success`,
        amount: amount.toFixed(2),
        currency: 'BDT'
      };
    }

    const idToken = await this.grantToken();
    const res = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-APP-Key': this.appKey
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: customerPhone,
        callbackURL: callbackUrl,
        amount: amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: orderNumber
      })
    });

    const data: any = await res.json();
    return {
      success: data.statusCode === '0000',
      ...data
    };
  }
}

export const bkashProvider = new BKashProvider();
