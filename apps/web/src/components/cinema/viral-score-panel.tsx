'use client';

import { useApi } from '@/hooks/use-api';

interface ViralScorePanelProps {
  contentId: string;
}

interface ViralDimensions {
  hookStrength: number;
  retentionPotential: number;
  ctaClarity: number;
  sharePotential: number;
  platformFit: number;
  trendAlignment: number;
}

interface ViralIssue {
  dimension: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

interface ViralScoreData {
  contentId: string;
  overall: number;
  tier: 'low' | 'medium' | 'high' | 'viral';
  dimensions: ViralDimensions;
  issues: ViralIssue[];
  shareCoefficient: number;
}

const TIER_COLORS: Record<string, string> = {
  viral: 'text-accent-green',
  high: 'text-accent-blue',
  medium: 'text-accent-orange',
  low: 'text-accent-red',
};

const TIER_BG: Record<string, string> = {
  viral: 'bg-accent-green/10 border-accent-green/30',
  high: 'bg-accent-blue/10 border-accent-blue/30',
  medium: 'bg-accent-orange/10 border-accent-orange/30',
  low: 'bg-accent-red/10 border-accent-red/30',
};

const DIMENSION_LABELS: Record<keyof ViralDimensions, string> = {
  hookStrength: 'Hook',
  retentionPotential: 'Retention',
  ctaClarity: 'CTA',
  sharePotential: 'Shareability',
  platformFit: 'Platform Fit',
  trendAlignment: 'Trending',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'bg-accent-green' : score >= 50 ? 'bg-accent-blue' : score >= 30 ? 'bg-accent-orange' : 'bg-accent-red';

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary w-20 text-right truncate">{label}</span>
      <div className="flex-1 bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-text-tertiary w-6 text-right">{score}</span>
    </div>
  );
}

export function ViralScorePanel({ contentId }: ViralScorePanelProps) {
  const { data } = useApi<ViralScoreData>(`/content/viral-score?contentId=${contentId}`);

  const score = data?.data;
  if (!score) return null;

  const tierColor = TIER_COLORS[score.tier] ?? 'text-text-secondary';
  const tierBg = TIER_BG[score.tier] ?? '';
  const highIssues = score.issues.filter(i => i.severity === 'high');

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-bg-tertiary text-sm font-medium text-text-primary flex items-center justify-between">
        <span>Viral Potential</span>
        <span className={`text-lg font-bold ${tierColor}`}>{score.overall}</span>
      </div>

      <div className="p-3 space-y-3 text-xs">
        {/* Tier badge */}
        <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${tierBg}`}>
          <span className={`font-medium capitalize ${tierColor}`}>{score.tier}</span>
          <span className="text-text-tertiary">
            Share coeff: {(score.shareCoefficient * 100).toFixed(0)}%
          </span>
        </div>

        {/* Dimension bars */}
        <div className="space-y-1.5">
          {(Object.entries(score.dimensions) as Array<[keyof ViralDimensions, number]>).map(([dim, val]) => (
            <ScoreBar key={dim} label={DIMENSION_LABELS[dim]} score={val} />
          ))}
        </div>

        {/* High-priority issues */}
        {highIssues.length > 0 && (
          <div className="space-y-1">
            <div className="text-text-secondary font-medium">Issues</div>
            {highIssues.map((issue, i) => (
              <div key={i} className="text-accent-orange">
                {issue.message}
                {issue.suggestion && (
                  <div className="text-text-tertiary mt-0.5">{issue.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
