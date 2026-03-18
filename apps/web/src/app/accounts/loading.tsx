export default function AccountsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-bg-tertiary rounded" />
        <div className="h-9 w-32 bg-bg-tertiary rounded" />
      </div>
      <div className="h-10 w-full bg-bg-tertiary rounded" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-bg-tertiary rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-bg-tertiary rounded" />
              <div className="h-3 w-32 bg-bg-tertiary rounded" />
            </div>
            <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
