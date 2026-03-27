export default function ExperimentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-bg-tertiary rounded w-56" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-bg-tertiary rounded w-64" />
          <div className="h-4 bg-bg-tertiary rounded w-40" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-bg-tertiary rounded w-24" />
          <div className="h-9 bg-bg-tertiary rounded w-24" />
        </div>
      </div>

      {/* Status banner */}
      <div className="h-16 bg-bg-tertiary rounded-lg" />

      {/* Variants comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-bg-tertiary rounded w-24" />
              <div className="h-6 bg-bg-tertiary rounded w-16" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-bg-tertiary rounded w-full" />
              <div className="h-4 bg-bg-tertiary rounded w-3/4" />
              <div className="h-4 bg-bg-tertiary rounded w-1/2" />
            </div>
            <div className="h-24 bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>

      {/* Significance progress */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="h-5 bg-bg-tertiary rounded w-40" />
        <div className="h-3 bg-bg-tertiary rounded w-full" />
        <div className="h-4 bg-bg-tertiary rounded w-48" />
      </div>
    </div>
  );
}
