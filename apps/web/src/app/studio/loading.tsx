export default function StudioLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-bg-tertiary rounded" />
        <div className="h-9 w-32 bg-bg-tertiary rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-40 bg-bg-tertiary rounded" />
            <div className="h-4 w-3/4 bg-bg-tertiary rounded" />
            <div className="h-3 w-1/2 bg-bg-tertiary rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
              <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
