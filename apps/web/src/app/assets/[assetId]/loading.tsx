export default function AssetDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-bg-tertiary rounded w-48" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-bg-tertiary rounded w-64" />
          <div className="h-4 bg-bg-tertiary rounded w-40" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-bg-tertiary rounded w-20" />
          <div className="h-9 bg-bg-tertiary rounded w-20" />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video bg-bg-tertiary rounded-lg" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-20 h-20 bg-bg-tertiary rounded" />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="h-5 bg-bg-tertiary rounded w-24" />
            <div className="h-4 bg-bg-tertiary rounded w-full" />
            <div className="h-4 bg-bg-tertiary rounded w-3/4" />
            <div className="h-4 bg-bg-tertiary rounded w-1/2" />
          </div>
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="h-5 bg-bg-tertiary rounded w-32" />
            <div className="h-8 bg-bg-tertiary rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
