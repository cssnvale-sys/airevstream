'use client';

import { cn } from '@/lib/utils';

interface ProjectTypePickerProps {
  onSelect: (type: string, overrides: Record<string, unknown>) => void;
  selectedType?: string;
}

const PROJECT_TYPES = [
  {
    type: 'explainer',
    icon: '🎓',
    name: 'Explainer',
    description: 'Educational or how-to content',
    format: '16:9, 24fps',
    overrides: {
      fps: 24,
      aspect: '16:9' as const,
      audioPlan: { fg: { source: 'tts', volume: 0.9 }, bg: { source: 'generate', volume: 0.2, loop: true } },
    },
  },
  {
    type: 'vlog',
    icon: '📹',
    name: 'Vlog',
    description: 'Casual, personality-driven',
    format: '16:9, 30fps',
    overrides: {
      fps: 30,
      aspect: '16:9' as const,
      camera: { lens: '35mm', framing: 'medium', dof: 'shallow' as const, stabilization: 'gimbal' as const },
    },
  },
  {
    type: 'commercial',
    icon: '🎬',
    name: 'Commercial',
    description: 'Polished brand content',
    format: '16:9, 24fps',
    overrides: {
      fps: 24,
      aspect: '16:9' as const,
      colorGrade: { contrast: 15, saturation: 10, highlights: 5 },
      postProcess: { sharpen: 30 },
    },
  },
];

export function ProjectTypePicker({ onSelect, selectedType }: ProjectTypePickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">Project Type</label>
      <div className="grid grid-cols-3 gap-3">
        {PROJECT_TYPES.map((pt) => (
          <button
            key={pt.type}
            onClick={() => onSelect(pt.type, pt.overrides)}
            className={cn(
              'p-4 rounded-lg border-2 transition-all text-left hover:scale-[1.02]',
              selectedType === pt.type
                ? 'border-accent-blue shadow-lg shadow-accent-blue/20 bg-accent-blue/5'
                : 'border-border hover:border-accent-blue/50 bg-bg-secondary',
            )}
          >
            <div className="text-2xl mb-2">{pt.icon}</div>
            <div className="text-sm font-medium text-text-primary">{pt.name}</div>
            <div className="text-xs text-text-tertiary mt-0.5">{pt.description}</div>
            <div className="text-[10px] text-text-tertiary mt-1.5 bg-bg-tertiary rounded px-1.5 py-0.5 inline-block">
              {pt.format}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
