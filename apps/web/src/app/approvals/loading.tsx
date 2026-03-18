export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-bg-tertiary rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-bg-tertiary rounded" />
          <div className="h-9 w-28 bg-bg-tertiary rounded" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-48 bg-bg-tertiary rounded" />
              <div className="h-6 w-20 bg-bg-tertiary rounded-full" />
            </div>
            <div className="h-16 bg-bg-tertiary rounded" />
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-bg-tertiary rounded" />
              <div className="h-9 w-24 bg-bg-tertiary rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
