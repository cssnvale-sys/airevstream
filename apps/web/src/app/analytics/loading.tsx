export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-36 bg-bg-tertiary rounded" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-bg-tertiary rounded" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-4 w-24 bg-bg-tertiary rounded" />
            <div className="h-8 w-32 bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>
      <div className="card p-4 h-72 bg-bg-tertiary rounded" />
    </div>
  );
}
