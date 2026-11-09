export type PaymentProviderName = 'bKash' | 'Nagad';

export type PaymentVerificationState = 'PENDING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW';

export interface VerificationRequest {
  orderId: string;
  orderNumber: string;
  provider: PaymentProviderName;
  trxId: string;
  senderNumber?: string;
  expectedAmount: number;
  merchantWallet?: string;
  customerName?: string;
}

export interface ProviderQueryResponse {
  success: boolean;
  rawStatus: string;
  statusCode?: string;
  statusMessage?: string;
  trxId: string;
  paidAmount: number;
  currency: string;
  senderMsisdn?: string;
  receiverMsisdn?: string;
  transactionTime?: string;
  providerRaw: any;
  error?: string;
}

export interface VerificationResult {
  verified: boolean;
  status: PaymentVerificationState;
  orderId: string;
  orderNumber: string;
  provider: PaymentProviderName;
  mode: 'sandbox' | 'live';
  trxId: string;
  senderNumber?: string;
  expectedAmount: number;
  paidAmount: number;
  currency: string;
  matchedCriteria: {
    transactionExists: boolean;
    statusSuccess: boolean;
    amountMatched: boolean;
    merchantAccountMatched: boolean;
    senderNumberMatched: boolean | null; // null if provider doesn't disclose
    uniqueNotDuplicate: boolean;
  };
  failureReason?: string;
  userMessageBn: string;
  userMessageEn: string;
  verifiedAt: string;
  providerResponse?: any;
}
