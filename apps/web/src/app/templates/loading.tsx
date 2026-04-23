export default function TemplatesLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-bg-tertiary rounded animate-pulse" />
        <div className="h-4 w-96 bg-bg-tertiary rounded animate-pulse" />
      </div>

      {/* Featured banner skeleton */}
      <div className="h-48 bg-bg-tertiary rounded-xl animate-pulse" />

      {/* Filters skeleton */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-bg-tertiary rounded animate-pulse" />
        <div className="h-10 w-44 bg-bg-tertiary rounded animate-pulse" />
        <div className="h-10 w-40 bg-bg-tertiary rounded animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="aspect-video bg-bg-tertiary rounded mb-4" />
            <div className="h-5 w-32 bg-bg-tertiary rounded mb-2" />
            <div className="h-4 w-full bg-bg-tertiary rounded mb-2" />
            <div className="h-4 w-20 bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
