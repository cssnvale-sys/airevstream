export default function ChannelDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-bg-tertiary rounded w-48" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-bg-tertiary rounded-full" />
          <div className="space-y-2">
            <div className="h-7 bg-bg-tertiary rounded w-48" />
            <div className="h-4 bg-bg-tertiary rounded w-32" />
          </div>
        </div>
        <div className="h-9 bg-bg-tertiary rounded w-24" />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-bg-tertiary rounded w-20" />
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="h-5 bg-bg-tertiary rounded w-32" />
          <div className="h-10 bg-bg-tertiary rounded w-full" />
          <div className="h-10 bg-bg-tertiary rounded w-full" />
          <div className="h-10 bg-bg-tertiary rounded w-full" />
        </div>
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="h-5 bg-bg-tertiary rounded w-28" />
          <div className="h-10 bg-bg-tertiary rounded w-full" />
          <div className="h-10 bg-bg-tertiary rounded w-full" />
        </div>
      </div>
    </div>
  );
}
