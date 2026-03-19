'use client';

import { useState } from 'react';

interface ShotPropertiesProps {
  spec: Record<string, unknown>;
  onChange: (spec: Record<string, unknown>) => Promise<void>;
}

const CAMERA_MOVEMENTS = [
  'static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down',
  'dolly-in', 'dolly-out', 'crane-up', 'crane-down',
  'zoom-in', 'zoom-out', 'orbit-left', 'orbit-right',
];

const LENS_OPTIONS = ['24mm', '35mm', '50mm', '85mm', '135mm', 'anamorphic 50mm'];
const FRAMING_OPTIONS = ['extreme-close-up', 'close-up', 'medium', 'wide', 'extreme-wide'];
const SAMPLER_OPTIONS = ['euler_ancestral', 'dpmpp_2m', 'dpmpp_sde', 'dpm_2', 'uni_pc'];
const SCHEDULER_OPTIONS = ['normal', 'karras', 'exponential', 'sgm_uniform'];

export function ShotProperties({ spec, onChange }: ShotPropertiesProps) {
  const update = (path: string, value: unknown) => {
    const updated = { ...spec };
    // Support nested paths like 'camera.lens'
    const parts = path.split('.');
    if (parts.length === 1) {
      updated[path] = value;
    } else {
      const parent = { ...((updated[parts[0]] as Record<string, unknown>) ?? {}) };
      parent[parts[1]] = value;
      updated[parts[0]] = parent;
    }
    onChange(updated);
  };

  const camera = (spec.camera as Record<string, unknown>) ?? {};
  const generation = (spec.generation as Record<string, unknown>) ?? {};
  const promptBlocks = (spec.promptBlocks as string[]) ?? [];

  return (
    <div className="space-y-3">
      {/* Prompt */}
      <CollapsibleSection title="Prompt" defaultOpen>
        <textarea
          value={promptBlocks.join('\n')}
          onChange={(e) => update('promptBlocks', e.target.value.split('\n').filter(Boolean))}
          placeholder="Shot prompt blocks (one per line)"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md p-3 text-sm resize-y min-h-[80px] focus:ring-1 focus:ring-accent-blue outline-none"
        />
        <div className="text-xs text-text-tertiary mt-1">
          {promptBlocks.join(', ').length} tokens (approx)
        </div>
      </CollapsibleSection>

      {/* Camera */}
      <CollapsibleSection title="Camera" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Lens"
            value={(camera.lens as string) ?? ''}
            options={LENS_OPTIONS}
            onChange={(v) => update('camera.lens', v)}
          />
          <SelectField
            label="Framing"
            value={(camera.framing as string) ?? ''}
            options={FRAMING_OPTIONS}
            onChange={(v) => update('camera.framing', v)}
          />
          <SelectField
            label="Movement"
            value={(camera.movement as string) ?? 'static'}
            options={CAMERA_MOVEMENTS}
            onChange={(v) => update('camera.movement', v)}
          />
          <SelectField
            label="DOF"
            value={(camera.dof as string) ?? 'medium'}
            options={['shallow', 'medium', 'deep']}
            onChange={(v) => update('camera.dof', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Generation */}
      <CollapsibleSection title="Generation">
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Steps"
            value={(generation.steps as number) ?? 30}
            min={10} max={60} step={1}
            onChange={(v) => update('generation.steps', v)}
          />
          <SliderField
            label="CFG Scale"
            value={(generation.cfg as number) ?? 7}
            min={1} max={20} step={0.5}
            onChange={(v) => update('generation.cfg', v)}
          />
          <SelectField
            label="Sampler"
            value={(generation.sampler as string) ?? 'dpmpp_2m'}
            options={SAMPLER_OPTIONS}
            onChange={(v) => update('generation.sampler', v)}
          />
          <SelectField
            label="Scheduler"
            value={(generation.scheduler as string) ?? 'karras'}
            options={SCHEDULER_OPTIONS}
            onChange={(v) => update('generation.scheduler', v)}
          />
          <NumberField
            label="Width"
            value={(generation.width as number) ?? 1024}
            onChange={(v) => update('generation.width', v)}
          />
          <NumberField
            label="Height"
            value={(generation.height as number) ?? 1024}
            onChange={(v) => update('generation.height', v)}
          />
        </div>
        <div className="mt-3">
          <NumberField
            label="Seed"
            value={(spec.seed as number) ?? 0}
            onChange={(v) => update('seed', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Color */}
      <CollapsibleSection title="Color Grade">
        <div className="grid grid-cols-2 gap-3">
          {(['temperature', 'contrast', 'saturation', 'tint'] as const).map((prop) => {
            const colorGrade = (spec.colorGrade as Record<string, unknown>) ?? {};
            return (
              <SliderField
                key={prop}
                label={prop.charAt(0).toUpperCase() + prop.slice(1)}
                value={(colorGrade[prop] as number) ?? 0}
                min={-100} max={100} step={1}
                onChange={(v) => update(`colorGrade.${prop}`, v)}
              />
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Lighting */}
      <CollapsibleSection title="Lighting">
        <input
          type="text"
          value={(spec.lighting as string) ?? ''}
          onChange={(e) => update('lighting', e.target.value)}
          placeholder="e.g., golden hour, soft diffused, hard dramatic"
          className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
        />
      </CollapsibleSection>

      {/* Duration */}
      <CollapsibleSection title="Timing">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Duration (sec)"
            value={(spec.duration as number) ?? 5}
            onChange={(v) => update('duration', v)}
          />
          <NumberField
            label="FPS"
            value={(spec.fps as number) ?? 24}
            onChange={(v) => update('fps', v)}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── Field Components ───

function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-tertiary hover:bg-border text-sm font-medium text-text-primary transition-colors"
      >
        {title}
        <span className="text-text-tertiary">{open ? '\u2212' : '+'}</span>
      </button>
      {open && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
      >
        <option value="">&mdash;</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">
        {label}: <span className="text-text-primary">{value}</span>
      </label>
      <input
        type="range"
        value={value}
        min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-blue"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
      />
    </div>
  );
}
