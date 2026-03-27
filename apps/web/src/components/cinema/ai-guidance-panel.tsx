'use client';

import { useState } from 'react';

export interface GuidanceSuggestion {
  type: 'info' | 'warning' | 'improvement';
  category: string;
  message: string;
  action?: { label: string; patch: Record<string, unknown> };
}

interface AiGuidancePanelProps {
  suggestions: GuidanceSuggestion[];
  onApplyAction?: (patch: Record<string, unknown>) => void;
}

const TYPE_STYLES: Record<string, string> = {
  info: 'border-accent-blue/30 bg-accent-blue/5',
  warning: 'border-accent-amber/30 bg-accent-amber/5',
  improvement: 'border-accent-green/30 bg-accent-green/5',
};

const TYPE_LABELS: Record<string, string> = {
  info: 'Info',
  warning: 'Warning',
  improvement: 'Tip',
};

export function AiGuidancePanel({ suggestions, onApplyAction }: AiGuidancePanelProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visible = suggestions.filter((_, i) => !dismissed.has(i));

  if (visible.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>AI Guidance</span>
        </div>
        <p className="text-xs text-text-tertiary mt-2">No suggestions. Your shot looks good!</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        AI Guidance
        <span className="text-xs bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded">
          {visible.length}
        </span>
      </div>

      {suggestions.map((suggestion, i) => {
        if (dismissed.has(i)) return null;
        return (
          <div
            key={i}
            className={`border rounded-md p-3 ${TYPE_STYLES[suggestion.type] ?? TYPE_STYLES.info}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text-secondary uppercase">
                    {TYPE_LABELS[suggestion.type] ?? suggestion.type}
                  </span>
                  <span className="text-xs text-text-tertiary">{suggestion.category}</span>
                </div>
                <p className="text-sm text-text-primary">{suggestion.message}</p>
              </div>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                className="text-text-tertiary hover:text-text-secondary text-xs"
              >
                Dismiss
              </button>
            </div>
            {suggestion.action && onApplyAction && (
              <button
                onClick={() => onApplyAction(suggestion.action!.patch)}
                className="mt-2 px-3 py-1 bg-accent-blue/20 text-accent-blue rounded text-xs hover:bg-accent-blue/30"
              >
                {suggestion.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
