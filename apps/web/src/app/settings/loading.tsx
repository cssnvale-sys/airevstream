export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-bg-tertiary rounded" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-bg-tertiary rounded" />
        ))}
      </div>
      <div className="card p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-bg-tertiary rounded" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>
        ))}
        <div className="h-10 w-24 bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}
