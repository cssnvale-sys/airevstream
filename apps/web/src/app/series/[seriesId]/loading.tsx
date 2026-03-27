export default function SeriesDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-bg-tertiary rounded w-48" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-bg-tertiary rounded w-56" />
          <div className="h-4 bg-bg-tertiary rounded w-36" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-bg-tertiary rounded w-28" />
          <div className="h-9 bg-bg-tertiary rounded w-20" />
        </div>
      </div>

      {/* Series info card */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="h-5 bg-bg-tertiary rounded w-28" />
        <div className="h-4 bg-bg-tertiary rounded w-full" />
        <div className="h-4 bg-bg-tertiary rounded w-2/3" />
      </div>

      {/* Episodes table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-bg-tertiary px-4 py-3">
          <div className="h-5 bg-bg-secondary rounded w-24" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-bg-tertiary rounded" />
              <div className="space-y-1">
                <div className="h-4 bg-bg-tertiary rounded w-40" />
                <div className="h-3 bg-bg-tertiary rounded w-24" />
              </div>
            </div>
            <div className="h-6 bg-bg-tertiary rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
