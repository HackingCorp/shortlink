import { getRedisConnection } from '@/lib/redis';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check rate limit for a given key using Redis.
 * Uses a sliding window counter with TTL expiry.
 *
 * @param key - Unique identifier (e.g., IP address or user ID)
 * @param maxAttempts - Maximum allowed attempts in the window
 * @param windowMs - Time window in milliseconds
 * @returns Whether the request is allowed, remaining attempts, and reset time
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const redis = await getRedisConnection();
    const redisKey = `rate_limit:${key}`;

    const current = await redis.get(redisKey);
    const attempts = current ? parseInt(current, 10) : 0;

    if (attempts >= maxAttempts) {
      const ttl = await redis.ttl(redisKey);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
      };
    }

    const newCount = await redis.incr(redisKey);

    // Set expiry only on first attempt (when count goes from 0 to 1)
    if (newCount === 1) {
      await redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }

    return {
      allowed: true,
      remaining: maxAttempts - newCount,
      resetAt: new Date(Date.now() + windowMs),
    };
  } catch (error) {
    // If Redis is unavailable, allow the request but log the error
    console.error('[RateLimit] Redis error, allowing request:', error);
    return {
      allowed: true,
      remaining: maxAttempts,
      resetAt: new Date(Date.now() + windowMs),
    };
  }
}

// Login rate limiting constants
export const LOGIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
} as const;

/**
 * Check login rate limit for an IP address.
 * Limits to 5 attempts per 15 minutes per IP.
 */
export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(
    `login:ip:${ip}`,
    LOGIN_RATE_LIMIT.maxAttempts,
    LOGIN_RATE_LIMIT.windowMs
  );
}
