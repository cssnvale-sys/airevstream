'use client';

export default function SeasoningError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
      <h2 className="text-h3 text-text-primary mb-2">Something went wrong</h2>
      <p className="text-body text-text-secondary mb-4">{error.message || 'Failed to load seasoning data'}</p>
      <button onClick={reset} className="btn-primary px-4 py-2 rounded-md bg-accent-blue text-white hover:bg-accent-blue/80">
        Try again
      </button>
    </div>
  );
}
