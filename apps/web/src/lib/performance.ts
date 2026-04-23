/**
 * Performance monitoring and optimization utilities
 */

import { useEffect, useRef } from 'react';

// Performance marks for measuring component/page load times
export function markPerformance(label: string, type: 'start' | 'end' = 'start') {
  if (typeof window === 'undefined') return;
  
  const markName = `${label}:${type}`;
  performance.mark(markName);
  
  if (type === 'end') {
    const startMark = `${label}:start`;
    try {
      performance.measure(label, startMark, markName);
      const entries = performance.getEntriesByName(label);
      const lastEntry = entries[entries.length - 1] as PerformanceMeasure;
      console.log(`[Performance] ${label}: ${lastEntry.duration.toFixed(2)}ms`);
    } catch (e) {
      // Start mark might not exist
    }
  }
}

// Hook to measure component render time
export function usePerformanceMark(componentName: string) {
  const hasMarked = useRef(false);
  
  useEffect(() => {
    if (hasMarked.current) return;
    hasMarked.current = true;
    
    const label = `Component:${componentName}`;
    markPerformance(label, 'start');
    
    // Use requestIdleCallback or setTimeout to measure after render
    const measure = () => markPerformance(label, 'end');
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(measure, { timeout: 100 });
    } else {
      setTimeout(measure, 0);
    }
  }, [componentName]);
}

// Prefetch route data
export function prefetchRoute(href: string) {
  if (typeof window === 'undefined') return;
  
  // Use Next.js router prefetch if available
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

// Debounce function for performance
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle function for performance
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Image loading optimization
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Intersection Observer helper for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  });
}

// Check if browser supports native lazy loading
export const supportsNativeLazyLoading = 
  typeof HTMLImageElement !== 'undefined' && 
  'loading' in HTMLImageElement.prototype;
