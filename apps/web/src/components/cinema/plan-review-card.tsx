'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { REVISION_PRESETS } from '@airevstream/shared';
import type { RevisionPreset } from '@airevstream/shared';

interface PlanSummary {
  title: string;
  concept: string;
  sceneCount: number;
  shotCount: number;
  durationSec: number;
  visualStyle: string;
  audioMood: string;
  characterType: string;
  outputFormat: string;
}

interface PlanReviewCardProps {
  plan: PlanSummary;
  onRevise: (overrides: Record<string, unknown>) => void;
  onRegenerate: () => void;
  regenerating?: boolean;
}

export function PlanReviewCard({ plan, onRevise, onRegenerate, regenerating }: PlanReviewCardProps) {
  const [appliedRevisions, setAppliedRevisions] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  const handleRevision = (revision: RevisionPreset) => {
    onRevise(revision.overrides);
    setAppliedRevisions((prev) => {
      const next = new Set(prev);
      if (next.has(revision.id)) {
        next.delete(revision.id);
      } else {
        next.add(revision.id);
      }
      return next;
    });
    setDirty(true);
  };

  const formatDuration = (sec: number): string => {
    if (sec < 60) return `~${sec} seconds`;
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return remaining > 0 ? `~${mins}m ${remaining}s` : `~${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-4">
      {/* Plan summary card */}
      <div className="bg-bg-secondary rounded-lg border border-border p-5">
        <h3 className="text-lg font-semibold text-text-primary mb-1">{plan.title}</h3>
        <p className="text-sm text-text-secondary mb-4">{plan.concept}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-bg-tertiary rounded-md p-3 text-center">
            <div className="text-lg font-bold text-text-primary">{plan.shotCount}</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Shots</div>
          </div>
          <div className="bg-bg-tertiary rounded-md p-3 text-center">
            <div className="text-lg font-bold text-text-primary">{formatDuration(plan.durationSec)}</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Length</div>
          </div>
          <div className="bg-bg-tertiary rounded-md p-3 text-center">
            <div className="text-sm font-semibold text-text-primary truncate">{plan.visualStyle}</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Style</div>
          </div>
          <div className="bg-bg-tertiary rounded-md p-3 text-center">
            <div className="text-sm font-semibold text-text-primary truncate">{plan.characterType}</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Character</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
            {plan.audioMood}
          </span>
          <span className="px-2 py-1 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
            {plan.outputFormat}
          </span>
          <span className="px-2 py-1 rounded bg-accent-green/10 text-accent-green border border-accent-green/20">
            {plan.sceneCount} scene{plan.sceneCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Revision buttons */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Quick adjustments</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REVISION_PRESETS.map((rev) => (
            <button
              key={rev.id}
              onClick={() => handleRevision(rev)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md border text-left text-sm transition-colors',
                appliedRevisions.has(rev.id)
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-border bg-bg-secondary text-text-primary hover:bg-bg-tertiary hover:border-accent-blue/50',
              )}
            >
              <span>{rev.icon}</span>
              <span className="text-xs font-medium">{rev.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Regenerate button (visible when revisions applied) */}
      {dirty && (
        <button
          onClick={() => {
            onRegenerate();
            setDirty(false);
          }}
          disabled={regenerating}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {regenerating ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>✨</span>
          )}
          Update plan
        </button>
      )}
    </div>
  );
}
