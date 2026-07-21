/**
 * Rate limiter with in-memory fallback and optional Redis backend.
 *
 * When REDIS_URL is set, uses Redis for distributed rate limiting (required for
 * horizontal scaling behind a load balancer). Otherwise falls back to an
 * in-memory Map (single-instance only).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── In-memory store (single instance) ──────────────────────────────────────
const memStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.resetAt <= now) memStore.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Redis store (multi-instance / horizontal scaling) ──────────────────────
let redisClient: any = null;
let redisAvailable = false;

async function getRedis(): Promise<any> {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const redisModule = await new Function('m', 'return import(m)')('ioredis');
    redisClient = new redisModule.default(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    await redisClient.connect();
    redisAvailable = true;
    console.log('[RateLimit] Redis connected');
    return redisClient;
  } catch (err) {
    console.error('[RateLimit] Redis unavailable, using memory store:', err);
    return null;
  }
}

// ─── Unified interface ──────────────────────────────────────────────────────

export async function checkRateLimitAsync(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const redis = await getRedis();

  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Sliding window counter using sorted sets
      await redis.zremrangebyscore(redisKey, 0, windowStart);
      const count = await redis.zcard(redisKey);

      if (count >= maxAttempts) {
        const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        const retryAfterMs = oldest.length >= 2
          ? Math.max(0, parseInt(oldest[1]) + windowMs - now)
          : windowMs;
        return { allowed: false, retryAfterMs };
      }

      const pipeline = redis.pipeline();
      pipeline.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2)}`);
      pipeline.pexpire(redisKey, windowMs);
      await pipeline.exec();

      return { allowed: true, retryAfterMs: 0 };
    } catch (err) {
      console.error('[RateLimit] Redis error, falling back to memory:', err);
      // Fall through to memory
    }
  }

  // In-memory fallback
  return checkRateLimit(key, maxAttempts, windowMs);
}

/**
 * Synchronous rate limit check (in-memory only). Use checkRateLimitAsync for
 * production with Redis support.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}
