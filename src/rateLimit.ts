/**
 * Rate limiting infrastructure for network operations.
 * Prevents resource exhaustion and abuse.
 */

/** Rate limiter configuration */
export interface RateLimitConfig {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** Tokens added per second */
  refillRate: number;
}

/** Rate limiter state */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

/** Named rate limiters for different operation types */
const limiters = new Map<string, RateLimitBucket>();

/** Default configurations for different operation types */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // HTTP fetches: 20 per second burst, refill at 5/sec
  http: { maxTokens: 20, refillRate: 5 },
  // Git operations: 5 per minute burst, refill at 1/min
  git: { maxTokens: 5, refillRate: 1 / 60 },
  // File reads: 100 per second burst, refill at 50/sec
  file: { maxTokens: 100, refillRate: 50 },
};

/**
 * Configure a rate limiter.
 */
export function configureRateLimit(name: string, config: RateLimitConfig): void {
  DEFAULT_CONFIGS[name] = config;
}

/**
 * Check if an operation is allowed under rate limiting.
 * Returns true if allowed, false if rate limited.
 *
 * @param limiterName - Name of the rate limiter (e.g., "http", "git")
 * @param tokensRequired - Number of tokens to consume (default: 1)
 */
export function checkRateLimit(limiterName: string, tokensRequired = 1): boolean {
  const config = DEFAULT_CONFIGS[limiterName];
  if (!config) {
    // No config means no limit
    return true;
  }

  const now = Date.now();
  let bucket = limiters.get(limiterName);

  if (!bucket) {
    // Initialize bucket with full tokens
    bucket = { tokens: config.maxTokens, lastRefill: now };
    limiters.set(limiterName, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsedSeconds * config.refillRate;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Check if we have enough tokens
  if (bucket.tokens >= tokensRequired) {
    bucket.tokens -= tokensRequired;
    return true;
  }

  return false;
}

/**
 * Async version that waits for rate limit availability.
 * Throws if waiting would take too long.
 *
 * @param limiterName - Name of the rate limiter
 * @param tokensRequired - Number of tokens needed
 * @param maxWaitMs - Maximum time to wait (default: 30 seconds)
 */
export async function waitForRateLimit(
  limiterName: string,
  tokensRequired = 1,
  maxWaitMs = 30_000
): Promise<void> {
  const startTime = Date.now();

  while (!checkRateLimit(limiterName, tokensRequired)) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitMs) {
      throw new Error(`Rate limit exceeded for ${limiterName}. Try again later.`);
    }

    // Wait a bit before retrying (exponential backoff capped at 1 second)
    const waitTime = Math.min(1000, 100 * Math.pow(2, elapsed / 5000));
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

/**
 * Decorator function to add rate limiting to an async operation.
 */
export function withRateLimit<T>(
  limiterName: string,
  operation: () => Promise<T>,
  tokensRequired = 1
): Promise<T> {
  return waitForRateLimit(limiterName, tokensRequired).then(operation);
}

/**
 * Get remaining tokens for a limiter (for diagnostics).
 */
export function getRemainingTokens(limiterName: string): number {
  const bucket = limiters.get(limiterName);
  if (!bucket) {
    const config = DEFAULT_CONFIGS[limiterName];
    return config?.maxTokens ?? Infinity;
  }
  return Math.floor(bucket.tokens);
}

/**
 * Reset a rate limiter (for testing).
 */
export function _resetRateLimiter(limiterName: string): void {
  limiters.delete(limiterName);
}

/**
 * Reset all rate limiters (for testing).
 */
export function _resetAllRateLimiters(): void {
  limiters.clear();
}
