"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
