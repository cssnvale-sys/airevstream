'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch } from '@/hooks/use-api';
import { FlaskConical, Sparkles, ChevronDown, ChevronUp, Check, X as XIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/lib/toast';

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

interface PresetSuggestion {
  presetId: string;
  reason: string;
  dimension: string;
  expectedImprovement: 'minor' | 'moderate' | 'significant';
}

interface SuggestionsResponse {
  suggestions: PresetSuggestion[];
  viralScore: number;
  tier: string;
  channelId: string | null;
}

interface SuggestionLogEntry {
  id: string;
  presetId: string;
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

const IMPROVEMENT_COLORS: Record<string, string> = {
  significant: 'bg-accent-green/10 text-accent-green border-accent-green/30',
  moderate: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  minor: 'bg-bg-tertiary text-text-secondary border-border',
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
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [suggestions, setSuggestions] = useState<PresetSuggestion[] | null>(null);
  const [suggestionLogs, setSuggestionLogs] = useState<SuggestionLogEntry[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const score = data?.data;
  if (!score) return null;

  const tierColor = TIER_COLORS[score.tier] ?? 'text-text-secondary';
  const tierBg = TIER_BG[score.tier] ?? '';
  const highIssues = score.issues.filter(i => i.severity === 'high');
  const allIssues = score.issues;
  const visibleIssues = showAllIssues ? allIssues : highIssues;

  // Dimensions scoring below 50 — show suggestion chips
  const weakDims = (Object.entries(score.dimensions) as Array<[keyof ViralDimensions, number]>)
    .filter(([, val]) => val < 50);

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await apiPost<{ success: boolean; data: SuggestionsResponse }>('/content/viral-suggestions', {
        contentId,
      });
      setSuggestions(res.data.suggestions);

      // Log shown suggestions for tracking
      if (res.data.suggestions.length > 0) {
        try {
          const logRes = await apiPost<{ success: boolean; data: { count: number; logs: SuggestionLogEntry[] } }>('/suggestions', {
            contentId,
            channelId: res.data.channelId ?? undefined,
            suggestions: res.data.suggestions.map(s => ({
              presetId: s.presetId,
              dimension: s.dimension,
              reason: s.reason,
              expectedImprovement: s.expectedImprovement,
            })),
            viralScoreBefore: res.data.viralScore,
          });
          setSuggestionLogs(logRes.data.logs);
        } catch (logErr) {
          console.error('Failed to log suggestions:', logErr);
        }
      }
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      toast.error('Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleOutcome = async (presetId: string, outcome: 'accepted' | 'rejected') => {
    const log = suggestionLogs.find(l => l.presetId === presetId);
    if (!log) return;
    try {
      await apiPatch(`/suggestions/${log.id}`, { outcome });
      setOutcomes(prev => ({ ...prev, [presetId]: outcome }));
    } catch (err) {
      console.error('Failed to update suggestion outcome:', err);
      toast.error('Failed to update suggestion');
    }
  };

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

        {/* Weak dimension chips */}
        {weakDims.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {weakDims.map(([dim]) => (
              <span key={dim} className="px-1.5 py-0.5 bg-accent-orange/10 text-accent-orange border border-accent-orange/30 rounded text-[10px]">
                Boost {DIMENSION_LABELS[dim]}
              </span>
            ))}
          </div>
        )}

        {/* Issues */}
        {allIssues.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary font-medium">Issues ({allIssues.length})</span>
              {allIssues.length > highIssues.length && (
                <button
                  onClick={() => setShowAllIssues(v => !v)}
                  className="text-accent-blue hover:text-accent-blue/80 flex items-center gap-0.5"
                >
                  {showAllIssues ? 'High only' : 'Show all'}
                  {showAllIssues ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
            </div>
            {visibleIssues.map((issue, i) => (
              <div key={i} className="text-accent-orange">
                <span className="text-[10px] text-text-tertiary capitalize">[{issue.severity}]</span> {issue.message}
                {issue.suggestion && (
                  <div className="text-text-tertiary mt-0.5">{issue.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preset suggestions */}
        {suggestions === null ? (
          <button
            onClick={handleGetSuggestions}
            disabled={loadingSuggestions}
            className="w-full py-1.5 px-2 rounded border border-border hover:bg-bg-tertiary text-text-secondary flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles size={12} />
            {loadingSuggestions ? 'Loading...' : 'Improve with Presets'}
          </button>
        ) : suggestions.length > 0 ? (
          <div className="space-y-1">
            <span className="text-text-secondary font-medium">Suggested Presets</span>
            {suggestions.slice(0, 4).map((s) => {
              const outcome = outcomes[s.presetId];
              return (
                <div key={s.presetId} className={`px-2 py-1 rounded border ${outcome === 'accepted' ? 'border-accent-green/50 bg-accent-green/5' : outcome === 'rejected' ? 'border-accent-red/50 bg-accent-red/5 opacity-60' : IMPROVEMENT_COLORS[s.expectedImprovement] ?? ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-[11px]">{s.presetId}</div>
                    {!outcome && suggestionLogs.length > 0 && (
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => handleOutcome(s.presetId, 'accepted')}
                          className="p-0.5 rounded hover:bg-accent-green/20 text-text-tertiary hover:text-accent-green transition-colors"
                          title="Accept suggestion"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => handleOutcome(s.presetId, 'rejected')}
                          className="p-0.5 rounded hover:bg-accent-red/20 text-text-tertiary hover:text-accent-red transition-colors"
                          title="Reject suggestion"
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    )}
                    {outcome && (
                      <span className={`text-[10px] capitalize ${outcome === 'accepted' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {outcome}
                      </span>
                    )}
                  </div>
                  <div className="text-text-tertiary">{s.reason}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-text-tertiary text-center py-1">No preset suggestions — all dimensions are strong</div>
        )}

        {/* A/B Test link */}
        <Link
          href={`/experiments?contentId=${contentId}`}
          className="w-full py-1.5 px-2 rounded border border-border hover:bg-bg-tertiary text-text-secondary flex items-center justify-center gap-1.5 transition-colors"
        >
          <FlaskConical size={12} />
          Test a variant
        </Link>
      </div>
    </div>
  );
}
