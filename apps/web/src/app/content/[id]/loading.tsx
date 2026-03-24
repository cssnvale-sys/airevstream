export default function ContentDetailLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 bg-bg-tertiary rounded" />
        <div className="h-8 w-64 bg-bg-tertiary rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 space-y-3">
            <div className="h-5 w-32 bg-bg-tertiary rounded" />
            <div className="h-4 w-full bg-bg-tertiary rounded" />
            <div className="h-4 w-3/4 bg-bg-tertiary rounded" />
            <div className="h-4 w-1/2 bg-bg-tertiary rounded" />
          </div>
          <div className="card p-4 h-48 bg-bg-tertiary rounded" />
        </div>
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="h-5 w-24 bg-bg-tertiary rounded" />
            <div className="h-4 w-full bg-bg-tertiary rounded" />
            <div className="h-4 w-full bg-bg-tertiary rounded" />
            <div className="h-4 w-2/3 bg-bg-tertiary rounded" />
          </div>
          <div className="card p-4 space-y-3">
            <div className="h-5 w-28 bg-bg-tertiary rounded" />
            <div className="h-8 w-full bg-bg-tertiary rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
