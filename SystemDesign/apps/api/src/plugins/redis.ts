import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl);

export const CACHE_KEYS = {
  PRODUCTS: 'cache:products',
  PRODUCT: (id: string) => `cache:product:${id}`,
};
