/**
 * Page loading states with content-aware skeletons
 */

import { cn } from '@/lib/utils';

interface PageLoaderProps {
  /** Type of page being loaded */
  type?: 'default' | 'list' | 'detail' | 'form' | 'dashboard' | 'cards';
  /** Optional message to display */
  message?: string;
  /** Full screen height */
  fullHeight?: boolean;
  className?: string;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={cn("bg-bg-tertiary rounded animate-pulse", className)} />
  );
}

function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <SkeletonLine className="h-8 w-8 rounded-lg" />
      <SkeletonLine className="h-5 w-3/4" />
      <SkeletonLine className="h-4 w-1/2" />
    </div>
  );
}

export function PageLoader({ 
  type = 'default', 
  message = 'Loading...',
  fullHeight = true,
  className 
}: PageLoaderProps) {
  const containerClass = cn(
    fullHeight && "min-h-[60vh] flex items-center justify-center",
    "w-full",
    className
  );

  // Dashboard skeleton
  if (type === 'dashboard') {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <SkeletonLine className="h-4 w-20 mb-2" />
              <SkeletonLine className="h-8 w-16" />
            </div>
          ))}
        </div>
        {/* Content sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SkeletonLine className="h-6 w-32" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex gap-4">
                <SkeletonLine className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="h-5 w-3/4" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <SkeletonLine className="h-6 w-24" />
            {[1, 2].map((i) => (
              <div key={i} className="card">
                <SkeletonLine className="h-4 w-full mb-2" />
                <SkeletonLine className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List skeleton
  if (type === 'list') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <SkeletonLine className="h-8 w-48" />
          <SkeletonLine className="h-10 w-32" />
        </div>
        <div className="card">
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-border-secondary last:border-0">
                <SkeletonLine className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="h-5 w-1/3" />
                  <SkeletonLine className="h-4 w-1/4" />
                </div>
                <SkeletonLine className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Cards skeleton
  if (type === 'cards') {
    return (
      <div className="space-y-4 animate-pulse">
        <SkeletonLine className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Detail skeleton
  if (type === 'detail') {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-start gap-4">
          <SkeletonLine className="h-16 w-16 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-8 w-1/2" />
            <SkeletonLine className="h-4 w-1/3" />
          </div>
        </div>
        <div className="card space-y-4">
          <SkeletonLine className="h-6 w-32" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
          <SkeletonLine className="h-4 w-4/6" />
        </div>
      </div>
    );
  }

  // Form skeleton
  if (type === 'form') {
    return (
      <div className="space-y-6 animate-pulse max-w-2xl">
        <SkeletonLine className="h-8 w-48" />
        <div className="card space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine className="h-4 w-24" />
              <SkeletonLine className="h-10 w-full" />
            </div>
          ))}
          <SkeletonLine className="h-10 w-32 mt-4" />
        </div>
      </div>
    );
  }

  // Default centered loader
  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto mb-4">
          <div className="absolute inset-0 border-2 border-bg-tertiary rounded-full" />
          <div className="absolute inset-0 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-text-secondary text-sm">{message}</p>
      </div>
    </div>
  );
}

/**
 * Button loading spinner
 */
export function ButtonLoader({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <span>Loading...</span>
    </span>
  );
}

/**
 * Skeleton text lines for content placeholders
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-border-secondary mb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-3 border-b border-border-secondary last:border-0">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonLine key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
