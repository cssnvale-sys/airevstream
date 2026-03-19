export default function StudioLoading() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-bg-tertiary rounded-lg" />
        <div className="h-4 bg-bg-tertiary rounded w-32" />
        <div className="h-3 bg-bg-tertiary rounded w-24" />
      </div>
    </div>
  );
}
