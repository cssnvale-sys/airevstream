'use client';

export default function StudioError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-4">{error.message}</p>
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
