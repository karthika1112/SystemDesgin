export type PaymentStatusResult = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface ChargeParams {
  orderId: string;
  amount: number;
  idempotencyKey: string;
}

export interface PaymentResult {
  success: boolean;
  status: PaymentStatusResult;
  transactionId?: string;
  error?: string;
}

export interface PaymentProvider {
  charge(params: ChargeParams): Promise<PaymentResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  private timeoutCount = 0;

  async charge(params: ChargeParams): Promise<PaymentResult> {
    const mode = process.env.MOCK_PAYMENT_MODE || 'SUCCESS';

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    if (mode === 'TIMEOUT_ONCE_THEN_SUCCESS') {
      if (this.timeoutCount === 0) {
        this.timeoutCount++;
        return { success: false, status: 'TIMEOUT', error: 'Gateway timeout' };
      }
      return { success: true, status: 'SUCCESS', transactionId: `txn_mock_${Date.now()}_${params.orderId}` };
    }

    if (mode === 'TIMEOUT') {
      return { success: false, status: 'TIMEOUT', error: 'Gateway timeout' };
    }

    if (mode === 'FAILURE') {
      return { success: false, status: 'FAILED', error: 'Insufficient funds or card declined' };
    }

    // Default SUCCESS
    return { success: true, status: 'SUCCESS', transactionId: `txn_mock_${Date.now()}_${params.orderId}` };
  }
}

// Instantiate the provider (in a real app, this would be injected via DI)
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
