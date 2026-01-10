/**
 * Client-Side Rate Limiter
 * Prevents abuse by throttling operations (note events, chat messages, etc.)
 */

/**
 * Rate limiter class
 */
export class RateLimiter {
  /**
   * @param {number} maxRequests - Maximum number of requests
   * @param {number} windowMs - Time window in milliseconds
   */
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Check if a request is allowed
   * 
   * @returns {boolean} True if allowed, false if rate limited
   */
  isAllowed() {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we've exceeded the limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    this.requests.push(now);
    return true;
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   * 
   * @returns {number} Milliseconds until next request allowed, or 0 if allowed now
   */
  getTimeUntilNext() {
    if (this.isAllowed()) {
      return 0;
    }

    const now = Date.now();
    const oldestRequest = this.requests[0];
    const timeSinceOldest = now - oldestRequest;
    return Math.max(0, this.windowMs - timeSinceOldest);
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = [];
  }
}

// Pre-configured rate limiters for different operations

/**
 * Rate limiter for note events
 * Allows 100 notes per second (very high for fast playing)
 */
export const noteEventLimiter = new RateLimiter(100, 1000);

/**
 * Rate limiter for chat messages
 * Allows 10 messages per 10 seconds (1 per second average)
 */
export const chatMessageLimiter = new RateLimiter(10, 10000);

/**
 * Rate limiter for room operations (create, join, claim)
 * Allows 5 operations per 10 seconds
 */
export const roomOperationLimiter = new RateLimiter(5, 10000);

/**
 * Rate limiter for WebRTC signaling
 * Allows 20 signaling messages per second
 */
export const webrtcSignalingLimiter = new RateLimiter(20, 1000);

