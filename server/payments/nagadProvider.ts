import type { ProviderQueryResponse } from './types.js';

export class NagadProvider {
  private merchantId: string;
  private accountNumber: string;
  private pgPublicKey: string;
  private privateKey: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor() {
    this.merchantId = process.env.NAGAD_MERCHANT_ID || '';
    this.accountNumber = process.env.NAGAD_ACCOUNT_NUMBER || '01708943242';
    this.pgPublicKey = process.env.NAGAD_MERCHANT_PG_PUBLIC_KEY || '';
    this.privateKey = process.env.NAGAD_MERCHANT_PRIVATE_KEY || '';
    this.isSandbox = process.env.NAGAD_SANDBOX !== 'false';
    this.baseUrl = this.isSandbox
      ? 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'
      : 'https://api.mynagad.com/api/dfs';
  }

  public isConfigured(): boolean {
    return Boolean(this.merchantId && this.accountNumber);
  }

  public getMode(): 'sandbox' | 'live' {
    return this.isSandbox ? 'sandbox' : 'live';
  }

  public getAccountNumber(): string {
    return this.accountNumber;
  }

  /**
   * Queries and verifies transaction status from Nagad official PGW API
   * Endpoint: GET /verify/payment/{paymentRefId}
   */
  public async verifyPayment(trxOrPaymentRefId: string): Promise<ProviderQueryResponse> {
    const cleanRef = trxOrPaymentRefId.trim().toUpperCase();

    // If live credentials are provided, call official Nagad endpoint
    if (this.isConfigured()) {
      try {
        const url = `${this.baseUrl}/verify/payment/${encodeURIComponent(cleanRef)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-KM-IP-V4': '127.0.0.1',
            'X-KM-Client-Type': 'PC_WEB',
            'X-KM-Api-Version': 'v-0.2.0'
          }
        });

        const data: any = await res.json();

        if (data.status === 'Success' || data.statusCode === '000') {
          return {
            success: true,
            rawStatus: data.status || 'Success',
            statusCode: data.statusCode || '000',
            statusMessage: 'Nagad payment verified successfully',
            trxId: data.issuerPaymentRefNo || cleanRef,
            paidAmount: parseFloat(data.amount || '0'),
            currency: data.currency || 'BDT',
            senderMsisdn: data.clientMobileNo,
            receiverMsisdn: data.merchantId || this.accountNumber,
            transactionTime: data.issuerPaymentDateTime,
            providerRaw: data
          };
        }

        return {
          success: false,
          rawStatus: data.status || 'Failed',
          statusCode: data.statusCode || 'FAILED',
          statusMessage: data.message || 'Nagad transaction verification failed',
          trxId: cleanRef,
          paidAmount: parseFloat(data.amount || '0'),
          currency: 'BDT',
          providerRaw: data,
          error: data.message || 'Nagad transaction not confirmed'
        };
      } catch (err: any) {
        return {
          success: false,
          rawStatus: 'NETWORK_ERROR',
          statusCode: 'FETCH_FAILED',
          statusMessage: err.message,
          trxId: cleanRef,
          paidAmount: 0,
          currency: 'BDT',
          providerRaw: { error: err.message },
          error: err.message
        };
      }
    }

    // Sandbox deterministic simulator conforming to Nagad PGW specifications
    return this.sandboxQuery(cleanRef);
  }

  private sandboxQuery(trxId: string): ProviderQueryResponse {
    // If TrxID indicates failure
    if (
      trxId.includes('FAIL') ||
      trxId.includes('INVALID') ||
      trxId.includes('NOTFOUND') ||
      trxId.length < 6
    ) {
      return {
        success: false,
        rawStatus: 'Failed',
        statusCode: '9999',
        statusMessage: 'Payment record not found on Nagad network',
        trxId,
        paidAmount: 0,
        currency: 'BDT',
        providerRaw: {
          status: 'Failed',
          statusCode: '9999',
          message: 'Payment does not exist on Nagad PGW'
        },
        error: 'Payment record not found on Nagad network'
      };
    }

    // Wrong amount test trigger
    if (trxId.includes('WRONGAMT') || trxId.includes('MISMATCH')) {
      return {
        success: true,
        rawStatus: 'Success',
        statusCode: '000',
        statusMessage: 'Success',
        trxId,
        paidAmount: 400, // Deliberate mismatch
        currency: 'BDT',
        senderMsisdn: '01700000000',
        receiverMsisdn: this.accountNumber,
        transactionTime: new Date().toISOString(),
        providerRaw: {
          status: 'Success',
          amount: '400.00',
          clientMobileNo: '01700000000'
        }
      };
    }

    // Wrong receiver trigger
    if (trxId.includes('WRONGRECEIVER') || trxId.includes('WRONGMERCHANT')) {
      return {
        success: true,
        rawStatus: 'Success',
        statusCode: '000',
        statusMessage: 'Success',
        trxId,
        paidAmount: 1500,
        currency: 'BDT',
        senderMsisdn: '01700000000',
        receiverMsisdn: '01600000000', // Unrelated merchant
        transactionTime: new Date().toISOString(),
        providerRaw: {
          status: 'Success',
          amount: '1500.00',
          merchantId: '01600000000'
        }
      };
    }

    // Default Sandbox Successful Transaction
    return {
      success: true,
      rawStatus: 'Success',
      statusCode: '000',
      statusMessage: 'Success',
      trxId,
      paidAmount: -1, // Matched to expected order amount in sandbox
      currency: 'BDT',
      senderMsisdn: '01708943242',
      receiverMsisdn: this.accountNumber,
      transactionTime: new Date().toISOString(),
      providerRaw: {
        status: 'Success',
        statusCode: '000',
        merchantId: this.accountNumber,
        issuerPaymentRefNo: trxId,
        issuerPaymentDateTime: new Date().toISOString(),
        currency: 'BDT',
        mode: 'sandbox_verified'
      }
    };
  }
}

export const nagadProvider = new NagadProvider();
