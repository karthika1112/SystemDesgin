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

// STRATEGY PATTERN & ADAPTER PATTERN
export interface PaymentStrategy {
  charge(params: ChargeParams): Promise<PaymentResult>;
}

export class StripeAdapter implements PaymentStrategy {
  async charge(params: ChargeParams): Promise<PaymentResult> {
    // In reality, this adapts the specific Stripe API SDK payload to our generic interface
    return { success: true, status: 'SUCCESS', transactionId: `stripe_txn_${Date.now()}` };
  }
}

export class MockAdapter implements PaymentStrategy {
  async charge(params: ChargeParams): Promise<PaymentResult> {
    const mode = process.env.MOCK_PAYMENT_MODE || 'SUCCESS';
    await new Promise(resolve => setTimeout(resolve, 50));

    if (mode === 'TIMEOUT') return { success: false, status: 'TIMEOUT', error: 'Gateway timeout' };
    if (mode === 'FAILURE') return { success: false, status: 'FAILED', error: 'Card declined' };
    return { success: true, status: 'SUCCESS', transactionId: `mock_txn_${Date.now()}` };
  }
}

// FACTORY PATTERN
export class PaymentFactory {
  static getProvider(providerName: string = 'mock'): PaymentStrategy {
    switch (providerName.toLowerCase()) {
      case 'stripe':
        return new StripeAdapter();
      case 'mock':
      default:
        return new MockAdapter();
    }
  }
}
