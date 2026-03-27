'use client';

import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useJobStatus } from '@/hooks/use-job-status';

interface GenerationStatusProps {
  jobId: string | null;
  onComplete?: () => void;
}

export function GenerationStatus({ jobId, onComplete }: GenerationStatusProps) {
  const { status, progress, failedReason, isComplete } = useJobStatus(jobId);
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    if (isComplete && !prevCompleteRef.current && status === 'completed') {
      onComplete?.();
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete, status, onComplete]);

  if (!jobId) return null;

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-accent-green">
        <CheckCircle2 size={16} />
        <span className="text-sm">Generation complete</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-accent-red">
        <AlertCircle size={16} />
        <span className="text-sm truncate max-w-xs" title={failedReason ?? 'Generation failed'}>
          {failedReason ?? 'Generation failed'}
        </span>
      </div>
    );
  }

  // Generating / active state
  return (
    <div className="flex items-center gap-2 text-accent-blue">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">
        Generating{progress > 0 ? ` (${progress}%)` : '...'}
      </span>
    </div>
  );
}
