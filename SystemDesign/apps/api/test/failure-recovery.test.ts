import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setOrderConsumerDisabled, orderConsumer } from '../src/modules/order/order.consumer';
import { processReconciliation } from '../src/workers/reconciliation.worker';

// Simulating Database state for the integration test
let dbState = {
  payment: { status: 'PENDING', orderId: 'ord1' },
  order: { status: 'PAYMENT_PENDING', id: 'ord1', items: [{ productId: 'p1', quantity: 1 }] },
  outbox: [] as any[],
  inventory: { available: 10, reserved: 1, sold: 0 }
};

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('../src/plugins/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn() } }));
vi.mock('../src/plugins/rabbitmq', () => ({ getChannel: vi.fn(), QUEUES: { PAYMENT: 'payment.events' } }));

describe('Failure Recovery & Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    dbState = {
      payment: { status: 'SUCCESS', orderId: 'ord1' },
      order: { status: 'PAYMENT_PENDING', id: 'ord1', items: [{ productId: 'p1', quantity: 1 }] },
      outbox: [],
      inventory: { available: 10, reserved: 1, sold: 0 }
    };
  });

  it('Payment Success -> Order Service DOWN for 30s -> Event Processed -> Order Confirmed', async () => {
    // 1. Simulate Order Consumer is DOWN
    setOrderConsumerDisabled(true);

    // 2. Mock incoming message from RabbitMQ
    const mockMessage = {
      properties: { messageId: 'msg-1', headers: { eventType: 'PAYMENT_SUCCEEDED' } },
      content: Buffer.from(JSON.stringify({ orderId: 'ord1' }))
    };

    // 3. Try processing message - should fail because service is "down"
    await expect(orderConsumer.handler(JSON.parse(mockMessage.content.toString()), mockMessage as any)).rejects.toThrow('SIMULATED_ORDER_SERVICE_DOWNTIME');
    
    // Validate order is STILL PENDING because consumer threw error
    expect(dbState.order.status).toBe('PAYMENT_PENDING');
    expect(dbState.inventory.sold).toBe(0);

    // 4. Advance time by 30 seconds
    vi.advanceTimersByTime(30000);

    // 5. Service comes back online
    setOrderConsumerDisabled(false);

    // 6. RabbitMQ DLQ/Retry mechanism delivers it again
    await orderConsumer.handler(JSON.parse(mockMessage.content.toString()), mockMessage as any);

    // 7. Success!
    expect(dbState.order.status).toBe('CONFIRMED');
    expect(dbState.inventory.sold).toBe(1); // Exact inventory consistency
    expect(dbState.inventory.reserved).toBe(0); 
  });

  it('Reconciliation worker fixes stuck payments safely', async () => {
    // Leave order in PAYMENT_PENDING but payment in SUCCESS (simulating message loss)
    expect(dbState.order.status).toBe('PAYMENT_PENDING');

    // Run reconciliation worker manually
    await processReconciliation();

    // Validates that it found the stuck payment and repaired the order safely
    expect(dbState.order.status).toBe('CONFIRMED');
    expect(dbState.inventory.sold).toBe(1);
    
    // Duplicate run (idempotency check)
    await processReconciliation();
    
    // Still 1 sold, no double updates
    expect(dbState.inventory.sold).toBe(1);
  });
});
