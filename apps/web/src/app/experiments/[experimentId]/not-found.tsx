import Link from 'next/link';

export default function ExperimentNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl font-bold text-text-tertiary mb-4">404</div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Experiment not found</h1>
        <p className="text-sm text-text-secondary mb-6">
          This experiment may have been deleted or the link is incorrect.
        </p>
        <Link href="/experiments" className="btn-primary inline-flex items-center gap-2">
          Back to Experiments
        </Link>
      </div>
    </div>
  );
}
