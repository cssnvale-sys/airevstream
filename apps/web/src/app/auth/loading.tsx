export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        <span className="text-sm text-text-secondary">Preparing authentication…</span>
      </div>
    </div>
  );
}
