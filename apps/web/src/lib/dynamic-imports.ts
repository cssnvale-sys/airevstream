/**
 * Dynamic import utilities for code splitting and lazy loading
 * 
 * This module provides lazy-loaded versions of heavy components
 * to reduce initial bundle size and improve page load performance.
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

// Loading fallback component
const DefaultLoadingFallback = () => <PageLoader variant="default" />;

/**
 * Higher-order component that wraps a dynamically imported component
 * with Suspense and a loading fallback.
 */
export function withLazyLoad<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: React.ReactNode = <DefaultLoadingFallback />
) {
  const LazyComponent = dynamic(importFunc, {
    ssr: false,
    loading: () => <>{fallback}</>,
  });

  return function LazyLoadWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy-loaded heavy components
export const LazyStudioEditor = dynamic(
  () => import('@/components/cinema/bible-editor').then(mod => ({ default: mod.BibleEditor })),
  { 
    ssr: false,
    loading: () => <PageLoader variant="detail" message="Loading studio..." />
  }
);

export const LazyCalendar = dynamic(
  () => import('@/app/calendar/page').then(mod => ({ default: mod.default })),
  {
    loading: () => <PageLoader variant="dashboard" />
  }
);

export const LazyAnalyticsDashboard = dynamic(
  () => import('@/app/analytics/page').then(mod => ({ default: mod.default })),
  {
    loading: () => <PageLoader variant="dashboard" />
  }
);

export const LazyVoiceCloneForm = dynamic(
  () => import('@/app/voices/page').then(mod => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => <PageLoader variant="form" message="Loading voice studio..." />
  }
);

export const LazyAvatarGenerator = dynamic(
  () => import('@/app/avatars/page').then(mod => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => <PageLoader variant="form" message="Loading avatar studio..." />
  }
);

// Route-based code splitting helpers
export const routeLoaders = {
  studio: () => import('@/app/studio/page'),
  calendar: () => import('@/app/calendar/page'),
  analytics: () => import('@/app/analytics/page'),
  accounts: () => import('@/app/accounts/page'),
  settings: () => import('@/app/settings/page'),
};
