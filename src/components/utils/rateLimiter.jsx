// Client-side rate limiter to prevent excessive API calls

class RateLimiter {
  constructor() {
    this.limits = new Map();
  }

  // Check if action is allowed
  // Returns { allowed: boolean, remainingTime?: number }
  check(key, maxRequests, windowMs) {
    const now = Date.now();
    const limit = this.limits.get(key) || { count: 0, resetAt: now + windowMs };

    // Reset window if expired
    if (now >= limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + windowMs;
    }

    // Check if under limit
    if (limit.count < maxRequests) {
      limit.count++;
      this.limits.set(key, limit);
      return { allowed: true };
    }

    // Rate limited
    return { 
      allowed: false, 
      remainingTime: Math.ceil((limit.resetAt - now) / 1000) 
    };
  }

  reset(key) {
    this.limits.delete(key);
  }

  clearAll() {
    this.limits.clear();
  }
}

export const rateLimiter = new RateLimiter();

// Presets for common actions
export const RATE_LIMITS = {
  VOTE: { maxRequests: 50, windowMs: 10 * 1000 }, // 50 votes per 10 seconds
  COMMENT: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 comments per minute
  SUGGESTION: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 suggestions per minute
  TRANSLATION: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 translations per minute
};

// Helper function to create a rate-limited action
export function rateLimitedAction(actionFn, limitKey, config) {
  return async (...args) => {
    const result = rateLimiter.check(limitKey, config.maxRequests, config.windowMs);
    
    if (!result.allowed) {
      throw new Error(`נא להמתין ${result.remainingTime} שניות לפני ביצוע פעולה זו שוב`);
    }

    return await actionFn(...args);
  };
}