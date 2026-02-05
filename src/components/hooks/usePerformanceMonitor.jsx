import { useEffect, useRef } from 'react';

// Hook to monitor component render performance
export function usePerformanceMonitor(componentName) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    // Log slow renders (>16ms = below 60fps)
    if (timeSinceLastRender > 16 && renderCount.current > 1) {
      console.warn(`[PERF] ${componentName} slow render: ${timeSinceLastRender}ms`);
    }

    // Log excessive renders
    if (renderCount.current > 20) {
      console.warn(`[PERF] ${componentName} rendered ${renderCount.current} times`);
    }

    lastRenderTime.current = now;
  });

  return {
    renderCount: renderCount.current,
  };
}

// Measure async operation performance
export function measureAsync(name, fn) {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      if (duration > 1000) {
        console.warn(`[PERF] ${name} took ${duration.toFixed(0)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[PERF] ${name} failed after ${duration.toFixed(0)}ms:`, error);
      throw error;
    }
  };
}