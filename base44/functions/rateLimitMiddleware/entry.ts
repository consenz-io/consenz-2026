// Server-side rate limiting middleware for backend functions

class ServerRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  isAllowed(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const key = identifier;

    if (!this.requests.has(key)) {
      this.requests.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return { allowed: true };
    }

    const record = this.requests.get(key);

    // Reset window if expired
    if (now >= record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
      this.requests.set(key, record);
      return { allowed: true };
    }

    // Increment count
    record.count++;
    this.requests.set(key, record);

    if (record.count > maxRequests) {
      const remainingTime = Math.ceil((record.resetAt - now) / 1000);
      return { 
        allowed: false, 
        remainingTime,
        message: `Rate limit exceeded. Try again in ${remainingTime} seconds.`
      };
    }

    return { allowed: true };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now >= record.resetAt) {
        this.requests.delete(key);
      }
    }
  }
}

const rateLimiter = new ServerRateLimiter();

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

export function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  const result = rateLimiter.isAllowed(identifier, maxRequests, windowMs);
  
  if (!result.allowed) {
    return Response.json(
      { error: result.message },
      { status: 429, headers: { 'Retry-After': result.remainingTime.toString() } }
    );
  }
  
  return null;
}

export { rateLimiter };