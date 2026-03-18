export default function AffiliateLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-bg-tertiary rounded" />
        <div className="h-9 w-32 bg-bg-tertiary rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-5 w-40 bg-bg-tertiary rounded" />
            <div className="h-4 w-24 bg-bg-tertiary rounded" />
            <div className="h-3 w-32 bg-bg-tertiary rounded" />
            <div className="h-9 w-full bg-bg-tertiary rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
