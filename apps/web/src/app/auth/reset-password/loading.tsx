export default function ResetPasswordLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="w-full max-w-md animate-pulse">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-bg-tertiary mx-auto mb-4" />
          <div className="h-7 w-44 bg-bg-tertiary rounded mx-auto mb-2" />
          <div className="h-4 w-56 bg-bg-tertiary rounded mx-auto" />
        </div>

        <div className="card space-y-4">
          <div>
            <div className="h-4 w-28 bg-bg-tertiary rounded mb-1" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>

          <div>
            <div className="h-4 w-36 bg-bg-tertiary rounded mb-1" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>

          <div className="h-10 w-full bg-bg-tertiary rounded" />
        </div>
      </div>
    </div>
  );
}
