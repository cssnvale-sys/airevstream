import { Mic } from 'lucide-react';

export default function VoicesLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-4 w-96 bg-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-bg-tertiary rounded animate-pulse" />
      </div>

      {/* Section skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-bg-tertiary rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-bg-tertiary mb-4" />
              <div className="h-5 w-32 bg-bg-tertiary rounded mb-2" />
              <div className="h-4 w-20 bg-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Second section */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-bg-tertiary rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse opacity-75">
              <div className="h-10 w-10 rounded-lg bg-bg-tertiary mb-4" />
              <div className="h-4 w-24 bg-bg-tertiary rounded mb-2" />
              <div className="h-3 w-16 bg-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
