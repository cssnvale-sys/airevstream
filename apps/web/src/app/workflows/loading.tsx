export default function WorkflowsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-bg-tertiary rounded" />
        <div className="h-9 w-24 bg-bg-tertiary rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="h-6 w-6 bg-bg-tertiary rounded" />
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
