export default function RepurposeLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-4 w-96 bg-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-bg-tertiary rounded animate-pulse" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg-tertiary" />
              <div>
                <div className="h-6 w-16 bg-bg-tertiary rounded mb-1" />
                <div className="h-3 w-24 bg-bg-tertiary rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          <div className="h-8 w-20 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-8 w-32 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-8 w-24 bg-bg-tertiary rounded animate-pulse" />
        </div>
      </div>

      {/* Upload area skeleton */}
      <div className="border-2 border-dashed border-border rounded-xl p-12 animate-pulse">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-tertiary" />
        <div className="h-6 w-32 mx-auto bg-bg-tertiary rounded mb-2" />
        <div className="h-4 w-64 mx-auto bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}
