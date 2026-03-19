'use client';

import { useApi, apiPost } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';

interface QualityBreakdown {
  contentId: string;
  overallScore: number;
  breakdown: {
    hookStrength: number;
    lengthScore: number;
    ctaScore: number;
    readability: number;
    engagement: number;
  };
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-accent-green';
  if (score >= 40) return 'bg-accent-amber';
  return 'bg-accent-red';
}

function scoreLabelColor(score: number): string {
  if (score >= 70) return 'text-accent-green';
  if (score >= 40) return 'text-accent-amber';
  return 'text-accent-red';
}

const LABELS: Record<string, string> = {
  hookStrength: 'Hook Strength',
  lengthScore: 'Length Score',
  ctaScore: 'CTA Score',
  readability: 'Readability',
  engagement: 'Engagement',
};

export function QualityBreakdown({ contentId }: { contentId: string }) {
  const { data, isLoading, mutate } = useApi<QualityBreakdown>(`/content/${contentId}/quality-score`);
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await apiPost(`/content/${contentId}/quality-score`);
      mutate();
      toast.success('Quality score recalculated');
    } catch {
      toast.error('Failed to recalculate quality score');
    } finally {
      setRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-bg-tertiary rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 bg-bg-tertiary rounded" />
        ))}
      </div>
    );
  }

  const quality = data?.data;
  if (!quality) {
    return (
      <div className="text-center py-6">
        <p className="text-text-secondary text-sm mb-2">No quality score available</p>
        <button onClick={handleRecalculate} disabled={recalculating} className="btn-secondary btn-sm flex items-center gap-1 mx-auto">
          {recalculating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Calculate
        </button>
      </div>
    );
  }

  const overall = Math.round(quality.overallScore);

  return (
    <div className="space-y-4">
      {/* Overall score circle */}
      <div className="flex items-center gap-4">
        <div className={cn('w-16 h-16 rounded-full flex items-center justify-center border-4', overall >= 70 ? 'border-accent-green' : overall >= 40 ? 'border-accent-amber' : 'border-accent-red')}>
          <span className={cn('text-xl font-bold', scoreLabelColor(overall))}>{overall}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Overall Quality</p>
          <p className="text-xs text-text-secondary">{overall >= 70 ? 'Good' : overall >= 40 ? 'Needs improvement' : 'Low quality'}</p>
        </div>
        <button onClick={handleRecalculate} disabled={recalculating} className="btn-secondary btn-sm flex items-center gap-1 ml-auto" title="Recalculate">
          {recalculating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2.5">
        {quality.breakdown && Object.entries(quality.breakdown).map(([key, value]) => {
          const score = Math.round(Number(value));
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-secondary">{LABELS[key] ?? key}</span>
                <span className={scoreLabelColor(score)}>{score}</span>
              </div>
              <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', scoreColor(score))} style={{ width: `${Math.min(score, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
