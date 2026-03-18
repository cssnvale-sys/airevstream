export default function CalendarLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-bg-tertiary rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-bg-tertiary rounded" />
          <div className="h-9 w-20 bg-bg-tertiary rounded" />
          <div className="h-9 w-20 bg-bg-tertiary rounded" />
        </div>
      </div>
      <div className="card p-4">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`h-${i}`} className="h-6 bg-bg-tertiary rounded mb-2" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
