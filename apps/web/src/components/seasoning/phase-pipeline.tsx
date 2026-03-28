'use client';

const PHASES = [
  { key: 'pending', label: 'Pending', color: 'bg-text-tertiary' },
  { key: 'signing_up', label: 'Signup', color: 'bg-accent-amber' },
  { key: 'phase_1', label: 'Phase 1', color: 'bg-accent-blue' },
  { key: 'phase_2', label: 'Phase 2', color: 'bg-accent-blue' },
  { key: 'phase_3', label: 'Phase 3', color: 'bg-accent-purple' },
  { key: 'phase_4', label: 'Phase 4', color: 'bg-accent-purple' },
  { key: 'seasoned', label: 'Seasoned', color: 'bg-accent-green' },
  { key: 'graduated', label: 'Graduated', color: 'bg-accent-green' },
];

interface PhasePipelineProps {
  phaseCounts: Record<string, number>;
  total: number;
}

export function PhasePipeline({ phaseCounts, total }: PhasePipelineProps) {
  const needsHuman = phaseCounts['needs_human'] ?? 0;
  const failed = phaseCounts['failed'] ?? 0;
  const paused = phaseCounts['paused'] ?? 0;

  return (
    <div className="space-y-4">
      {/* Phase flow */}
      <div className="flex items-center gap-1">
        {PHASES.map((phase, i) => {
          const count = phaseCounts[phase.key] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={phase.key} className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                {i > 0 && <div className="w-2 h-px bg-border" />}
                <span className="text-caption text-text-secondary truncate" title={phase.label}>{phase.label}</span>
              </div>
              <div className="h-8 bg-bg-tertiary rounded relative overflow-hidden">
                <div
                  className={`h-full ${phase.color} rounded transition-all duration-500`}
                  style={{ width: `${Math.max(count > 0 ? 10 : 0, pct)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-caption font-medium text-white drop-shadow">
                  {count > 0 ? count : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status badges */}
      <div className="flex gap-3 text-caption">
        {needsHuman > 0 && (
          <span className="px-2 py-0.5 rounded bg-accent-amber/20 text-accent-amber">
            {needsHuman} needs human
          </span>
        )}
        {paused > 0 && (
          <span className="px-2 py-0.5 rounded bg-accent-amber/20 text-accent-amber">
            {paused} paused
          </span>
        )}
        {failed > 0 && (
          <span className="px-2 py-0.5 rounded bg-accent-red/20 text-accent-red">
            {failed} failed
          </span>
        )}
      </div>
    </div>
  );
}
