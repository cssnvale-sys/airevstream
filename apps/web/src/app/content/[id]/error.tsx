'use client';

export default function ContentDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center">
        <p className="text-red-400 mb-3">Something went wrong loading this content.</p>
        <button onClick={reset} className="btn-secondary">Try Again</button>
      </div>
    </div>
  );
}
