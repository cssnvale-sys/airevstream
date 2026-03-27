export default function ContentLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-bg-tertiary rounded" />
        <div className="h-9 w-36 bg-bg-tertiary rounded" />
      </div>

      <div className="h-10 w-full bg-bg-tertiary rounded" />

      <div className="card overflow-hidden">
        <div className="divide-y divide-border-primary">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-5 w-5 bg-bg-tertiary rounded" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-bg-tertiary rounded" />
              </div>
              <div className="h-6 w-20 bg-bg-tertiary rounded-full" />
              <div className="h-4 w-24 bg-bg-tertiary rounded" />
              <div className="h-8 w-8 bg-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
