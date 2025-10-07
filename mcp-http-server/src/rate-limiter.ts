/**
 * Simple in-memory rate limiter
 * Based on MCP security best practices
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {}

  /**
   * Check if request is allowed
   * @param key - Unique identifier (session ID + IP)
   * @returns true if allowed, false if rate limit exceeded
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];

    // Filter out old requests outside the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return true;
  }

  /**
   * Get retry-after time in seconds
   * @param key - Unique identifier
   * @returns seconds until rate limit resets
   */
  getRetryAfter(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) return 0;

    const oldestTimestamp = timestamps[0];
    const windowEnd = oldestTimestamp + this.windowMs;
    const now = Date.now();

    return Math.ceil((windowEnd - now) / 1000);
  }

  /**
   * Clean up old entries to prevent memory leak
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);

      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }

  /**
   * Get current request count for a key
   */
  getCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.requests.get(key) || [];

    return timestamps.filter(ts => ts > windowStart).length;
  }
}
