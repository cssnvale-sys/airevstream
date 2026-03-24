export default function CohortDetailLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 bg-bg-tertiary rounded" />
        <div className="h-8 w-48 bg-bg-tertiary rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-4 w-24 bg-bg-tertiary rounded" />
            <div className="h-8 w-16 bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-bg-tertiary rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-bg-tertiary rounded" />
              <div className="h-3 w-32 bg-bg-tertiary rounded" />
            </div>
            <div className="h-6 w-20 bg-bg-tertiary rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
