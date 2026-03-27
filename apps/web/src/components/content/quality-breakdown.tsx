'use client';

import { useApi, apiPost } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { toast } from '@/lib/toast';
import { QUALITY_THRESHOLDS } from '@airevstream/shared';

interface QualityBreakdownData {
  contentId: string;
  // GET returns qualityScore; POST returns overallScore + breakdown
  qualityScore?: number | null;
  overallScore?: number;
  breakdown?: {
    hookStrength: number;
    lengthScore: number;
    ctaScore: number;
    readability: number;
    engagement: number;
  };
}

function scoreColor(score: number): string {
  if (score >= QUALITY_THRESHOLDS.AUTO_APPROVE) return 'bg-accent-green';
  if (score >= QUALITY_THRESHOLDS.REVIEW_REQUIRED) return 'bg-accent-amber';
  return 'bg-accent-red';
}

function scoreLabelColor(score: number): string {
  if (score >= QUALITY_THRESHOLDS.AUTO_APPROVE) return 'text-accent-green';
  if (score >= QUALITY_THRESHOLDS.REVIEW_REQUIRED) return 'text-accent-amber';
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
  const { data, isLoading, mutate } = useApi<QualityBreakdownData>(`/content/${contentId}/quality-score`);
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await apiPost(`/content/${contentId}/quality-score`);
      mutate();
      toast.success('Quality score recalculated');
    } catch (err) {
      console.error('Failed to recalculate quality score:', err);
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
  // GET returns qualityScore (number|null); POST returns overallScore + breakdown
  const rawScore = quality?.overallScore ?? (quality?.qualityScore != null ? Number(quality.qualityScore) : null);
  if (!quality || rawScore == null) {
    return (
      <div className="text-center py-6">
        <p className="text-text-secondary text-sm mb-2">No quality score available</p>
        <LoadingButton onClick={handleRecalculate} loading={recalculating} loadingText="Calculate" className="btn-secondary btn-sm flex items-center gap-1 mx-auto">
          <RefreshCw size={14} />
          Calculate
        </LoadingButton>
      </div>
    );
  }

  const overall = Math.round(rawScore);

  return (
    <div className="space-y-4">
      {/* Overall score circle */}
      <div className="flex items-center gap-4">
        <div className={cn('w-16 h-16 rounded-full flex items-center justify-center border-4', overall >= QUALITY_THRESHOLDS.AUTO_APPROVE ? 'border-accent-green' : overall >= QUALITY_THRESHOLDS.REVIEW_REQUIRED ? 'border-accent-amber' : 'border-accent-red')}>
          <span className={cn('text-xl font-bold', scoreLabelColor(overall))}>{overall}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Overall Quality</p>
          <p className="text-xs text-text-secondary">{overall >= QUALITY_THRESHOLDS.AUTO_APPROVE ? 'Excellent' : overall >= QUALITY_THRESHOLDS.REVIEW_REQUIRED ? 'Needs review' : overall >= QUALITY_THRESHOLDS.AUTO_REJECT ? 'Low quality' : 'Rejected'}</p>
        </div>
        <LoadingButton onClick={handleRecalculate} loading={recalculating} loadingText="" className="btn-secondary btn-sm flex items-center gap-1 ml-auto" title="Recalculate">
          <RefreshCw size={14} />
        </LoadingButton>
      </div>

      {/* Breakdown bars — only available after POST (recalculate) */}
      {!quality.breakdown && (
        <p className="text-xs text-text-secondary">
          Click recalculate to see the full breakdown.
        </p>
      )}
      <div className="space-y-2.5">
        {quality.breakdown && Object.entries(quality.breakdown).map(([key, value]) => {
          const score = Math.round(Number(value));
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-secondary">{LABELS[key] ?? key}</span>
                <span className={scoreLabelColor(score)}>{score}</span>
              </div>
              <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`${LABELS[key] ?? key} score`}>
                <div className={cn('h-full rounded-full transition-all', scoreColor(score))} style={{ width: `${Math.min(score, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
