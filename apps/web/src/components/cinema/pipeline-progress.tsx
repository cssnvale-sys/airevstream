'use client';

import { useApi } from '@/hooks/use-api';
import { PIPELINE_SIMPLE_LABELS } from '@airevstream/shared';

interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  durationMs?: number;
  progress?: number;
  detail?: string;
}

interface PipelineProgressProps {
  contentId: string;
  simplifiedLabels?: boolean;
}

const PIPELINE_STEPS = [
  'Research', 'Script', 'Storyboard', 'Shot Generation',
  'QC Gate', 'Audio Mix', 'Video Render', 'Final Review',
];

const STATUS_ICONS: Record<string, string> = {
  complete: '\u2705',
  running: '\uD83D\uDD04',
  failed: '\u274C',
  pending: '\u23F3',
};

export function PipelineProgress({ contentId, simplifiedLabels }: PipelineProgressProps) {
  // Poll for pipeline status
  const { data } = useApi<{ steps: PipelineStep[] }>(`/content/${contentId}/pipeline-status`, {
    refreshInterval: 3000,
  });

  const defaultSteps: PipelineStep[] = PIPELINE_STEPS.map((name) => ({ name, status: 'pending' }));
  const steps = data?.data?.steps ?? defaultSteps;

  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">Pipeline Progress</h3>
        <span className="text-xs text-text-secondary">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 bg-bg-tertiary rounded-full mb-4 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Pipeline progress"
      >
        <div
          className="h-full bg-accent-blue rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.name} className="flex items-center gap-3 text-sm">
            <span className="w-5 text-center">
              {STATUS_ICONS[step.status] ?? STATUS_ICONS.pending}
            </span>
            <span className={`flex-1 ${step.status === 'running' ? 'text-text-primary' : 'text-text-secondary'}`}>
              {simplifiedLabels ? (PIPELINE_SIMPLE_LABELS[step.name] ?? step.name) : step.name}
            </span>
            {step.status === 'complete' && step.durationMs !== undefined && (
              <span className="text-xs text-text-tertiary">
                {(step.durationMs / 1000).toFixed(1)}s
              </span>
            )}
            {step.status === 'running' && step.progress !== undefined && (
              <span className="text-xs text-accent-blue">{step.progress}%</span>
            )}
            {step.detail && step.status === 'running' && (
              <span className="text-xs text-text-tertiary">{step.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
