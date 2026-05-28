import { createClient } from 'redis';

const globalForRedis = globalThis as unknown as {
  redisClient: ReturnType<typeof createClient> | undefined;
};

function getRedisClient() {
  if (globalForRedis.redisClient) {
    return globalForRedis.redisClient;
  }

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redisClient = client;
  }

  return client;
}

export const redis = getRedisClient();

export async function getRedisConnection() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}
