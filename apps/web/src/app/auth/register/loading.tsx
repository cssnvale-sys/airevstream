export default function RegisterLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="w-full max-w-md animate-pulse">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-bg-tertiary mx-auto mb-4" />
          <div className="h-7 w-40 bg-bg-tertiary rounded mx-auto mb-2" />
          <div className="h-4 w-44 bg-bg-tertiary rounded mx-auto" />
        </div>

        <div className="card space-y-4">
          <div>
            <div className="h-4 w-12 bg-bg-tertiary rounded mb-1" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>

          <div>
            <div className="h-4 w-12 bg-bg-tertiary rounded mb-1" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>

          <div>
            <div className="h-4 w-44 bg-bg-tertiary rounded mb-1" />
            <div className="h-10 w-full bg-bg-tertiary rounded" />
          </div>

          <div className="h-10 w-full bg-bg-tertiary rounded" />

          <div className="h-4 w-52 bg-bg-tertiary rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
