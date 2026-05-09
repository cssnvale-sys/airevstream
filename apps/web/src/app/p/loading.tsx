export default function StorefrontLoading() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary animate-pulse">
      <div className="mx-auto max-w-5xl px-6 pt-4">
        <div className="h-4 w-32 bg-bg-tertiary rounded mb-4" />
      </div>
      <div className="h-56 md:h-72 w-full bg-bg-tertiary" />
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-bg-tertiary" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-bg-tertiary rounded" />
            <div className="h-4 w-24 bg-bg-tertiary rounded" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="h-6 w-32 bg-bg-tertiary rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-bg-tertiary rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
