import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processOutbox } from '../src/workers/outbox.worker';
import { ConsumerBase } from '../src/modules/event/consumer.base';

let mockOutbox = [
  { id: 'event1', aggregateType: 'ORDER', aggregateId: 'ord1', eventType: 'ORDER_CREATED', payload: { foo: 'bar' }, status: 'PENDING' }
];

let publishedMessages: any[] = [];
let nackedMessages: any[] = [];
let ackedMessages: any[] = [];
let mockRedisStore: Record<string, string> = {};

const mockChannel = {
  publish: vi.fn((exchange, routingKey, content, options) => {
    publishedMessages.push({ exchange, routingKey, content, options });
  }),
  consume: vi.fn(async (queue, callback) => {
    // Simulating manual push to consumer via tests
  }),
  ack: vi.fn((msg) => { ackedMessages.push(msg); }),
  nack: vi.fn((msg, allUpTo, requeue) => { nackedMessages.push({ msg, requeue }); }),
};

vi.mock('../src/plugins/rabbitmq', () => ({
  getChannel: () => mockChannel,
  EXCHANGE: 'salestorm.topic',
  connectRabbitMQ: vi.fn()
}));

const prismaMock = vi.hoisted(() => ({

}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prismaMock),
}));

vi.mock('../src/plugins/redis', () => ({
  redis: {
    get: vi.fn(async (key) => mockRedisStore[key] || null),
    setex: vi.fn(async (key, time, val) => { mockRedisStore[key] = val; }),
  }
}));

describe('RabbitMQ Event Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishedMessages = [];
    ackedMessages = [];
    nackedMessages = [];
    mockRedisStore = {};
    mockOutbox = [
      { id: 'event1', aggregateType: 'ORDER', aggregateId: 'ord1', eventType: 'ORDER_CREATED', payload: { foo: 'bar' }, status: 'PENDING' }
    ];
  });

  it('event publishing uses outbox worker and correlationId', async () => {
    await processOutbox();
    
    expect(mockChannel.publish).toHaveBeenCalled();
    const pub = publishedMessages[0];
    expect(pub.routingKey).toBe('order.ORDER_CREATED');
    expect(pub.options.correlationId).toBe('event1'); // Correlation ID requirement!
    expect(pub.options.messageId).toBe('event1');
    expect(mockOutbox[0].status).toBe('PROCESSED');
  });

  it('consumer handles duplicate events idempotently', async () => {
    const handler = vi.fn();
    const consumer = new ConsumerBase('q', handler);
    await consumer.start();
    
    mockRedisStore['processed_msg:dup-id'] = '1';
    
    // Simulate consuming a message that already exists in redis
    const consumeCallback = mockChannel.consume.mock.calls[0][1];
    await consumeCallback({ properties: { messageId: 'dup-id' }, content: Buffer.from('{}') });

    expect(handler).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled(); // Acknowledges to wipe it off the queue safely
  });

  it('consumer retry handles transient failure via header increment', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Transient Error'));
    const consumer = new ConsumerBase('q', handler, 3);
    await consumer.start();
    
    const consumeCallback = mockChannel.consume.mock.calls[0][1];
    await consumeCallback({ properties: { messageId: 'fail1', headers: { 'x-retry-count': 0 } }, fields: { exchange: 'ex', routingKey: 'route' }, content: Buffer.from('{}') });

    expect(handler).toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled(); // Acks original message
    expect(publishedMessages.length).toBe(1); // Republishes
    expect(publishedMessages[0].options.headers['x-retry-count']).toBe(1); // With incremented count!
  });

  it('failed message pushes to DLQ upon exceeding retries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Hard Error'));
    const consumer = new ConsumerBase('q', handler, 3);
    await consumer.start();
    
    const consumeCallback = mockChannel.consume.mock.calls[0][1];
    // Feed it a message that already hit the max retries (3)
    await consumeCallback({ properties: { messageId: 'fail1', headers: { 'x-retry-count': 3 } }, fields: { exchange: 'ex', routingKey: 'route' }, content: Buffer.from('{}') });

    expect(handler).toHaveBeenCalled();
    expect(nackedMessages.length).toBe(1);
    expect(nackedMessages[0].requeue).toBe(false); // Triggers Dead Letter Queue
    expect(publishedMessages.length).toBe(0); // Did not republish again
  });
});
