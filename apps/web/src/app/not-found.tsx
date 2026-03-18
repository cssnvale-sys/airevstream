import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-text-tertiary mb-4">404</div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Page not found</h1>
        <p className="text-sm text-text-secondary mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
