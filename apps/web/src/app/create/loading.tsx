export default function CreateLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-bg-tertiary rounded" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-8 bg-bg-tertiary rounded-full" />
        ))}
      </div>
      <div className="card p-6 space-y-4">
        <div className="h-6 w-48 bg-bg-tertiary rounded" />
        <div className="h-4 w-72 bg-bg-tertiary rounded" />
        <div className="h-40 w-full bg-bg-tertiary rounded" />
        <div className="flex justify-end gap-2">
          <div className="h-10 w-24 bg-bg-tertiary rounded" />
          <div className="h-10 w-24 bg-bg-tertiary rounded" />
        </div>
      </div>
    </div>
  );
}
