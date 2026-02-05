// Performance optimization utilities

// Debounce function to limit frequent calls
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function to ensure minimum time between calls
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Batch multiple async operations with delay
export async function batchOperations(operations, batchSize = 10, delayMs = 100) {
  const results = [];
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Add delay between batches to prevent overwhelming the server
    if (i + batchSize < operations.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

// Retry failed operations with exponential backoff
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`[RETRY] Attempt ${i + 1} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Check if browser supports performance API
export function isPerformanceSupported() {
  return typeof window !== 'undefined' && window.performance && window.performance.mark;
}

// Mark performance checkpoints
export function markPerformance(name) {
  if (isPerformanceSupported()) {
    performance.mark(name);
  }
}

// Measure performance between two marks
export function measurePerformance(name, startMark, endMark) {
  if (isPerformanceSupported()) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];
      console.log(`[PERF] ${name}: ${measure.duration.toFixed(2)}ms`);
      return measure.duration;
    } catch (e) {
      console.warn('[PERF] Could not measure:', e);
    }
  }
  return null;
}