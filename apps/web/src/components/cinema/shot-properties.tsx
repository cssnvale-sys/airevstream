'use client';

import { useState } from 'react';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible, FIELD_VISIBILITY } from '@/lib/complexity-fields';

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
const SEED_POLICY_OPTIONS = ['free', 'shot-offset', 'scene-lock', 'series-lock'];

export function ShotProperties({ spec, onChange }: ShotPropertiesProps) {
  const { mode } = useComplexityMode();

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
  const postProcess = (spec.postProcess as Record<string, unknown>) ?? {};
  const vfx = (spec.vfx as Record<string, unknown>) ?? {};
  const audioPlan = (spec.audioPlan as Record<string, unknown>) ?? {};
  const lipSync = (spec.lipSync as Record<string, unknown>) ?? {};

  return (
    <div className="space-y-3">
      {/* Prompt — always visible */}
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
          {isVisible(FIELD_VISIBILITY.camera.movement, mode) && (
            <SelectField
              label="Movement"
              value={(camera.movement as string) ?? 'static'}
              options={CAMERA_MOVEMENTS}
              onChange={(v) => update('camera.movement', v)}
            />
          )}
          {isVisible(FIELD_VISIBILITY.camera.dof, mode) && (
            <SelectField
              label="DOF"
              value={(camera.dof as string) ?? 'medium'}
              options={['shallow', 'medium', 'deep']}
              onChange={(v) => update('camera.dof', v)}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Generation — advanced+ */}
      {isVisible(FIELD_VISIBILITY.generation, mode) && (
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
            {isVisible(FIELD_VISIBILITY.generationFields.sampler, mode) && (
              <SelectField
                label="Sampler"
                value={(generation.sampler as string) ?? 'dpmpp_2m'}
                options={SAMPLER_OPTIONS}
                onChange={(v) => update('generation.sampler', v)}
              />
            )}
            {isVisible(FIELD_VISIBILITY.generationFields.scheduler, mode) && (
              <SelectField
                label="Scheduler"
                value={(generation.scheduler as string) ?? 'karras'}
                options={SCHEDULER_OPTIONS}
                onChange={(v) => update('generation.scheduler', v)}
              />
            )}
            {isVisible(FIELD_VISIBILITY.generationFields.width, mode) && (
              <NumberField
                label="Width"
                value={(generation.width as number) ?? 1024}
                onChange={(v) => update('generation.width', v)}
              />
            )}
            {isVisible(FIELD_VISIBILITY.generationFields.height, mode) && (
              <NumberField
                label="Height"
                value={(generation.height as number) ?? 1024}
                onChange={(v) => update('generation.height', v)}
              />
            )}
          </div>
          <div className="mt-3 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <NumberField
                  label="Seed"
                  value={(spec.seed as number) ?? 0}
                  onChange={(v) => update('seed', v)}
                />
              </div>
              <button
                onClick={() => update('seed', Math.floor(Math.random() * 2147483647))}
                className="px-2.5 py-1.5 text-xs bg-bg-tertiary border border-border rounded-md text-text-secondary hover:text-text-primary hover:bg-border transition-colors"
                title="Re-roll seed"
              >
                Re-roll
              </button>
            </div>
            {isVisible(FIELD_VISIBILITY.generationFields.seedPolicy, mode) && (
              <SelectField
                label="Seed Policy"
                value={(spec.seedPolicy as string) ?? 'free'}
                options={SEED_POLICY_OPTIONS}
                onChange={(v) => update('seedPolicy', v)}
              />
            )}
            {isVisible(FIELD_VISIBILITY.generationFields.seedLock, mode) && (
              <CheckboxField
                label="Lock seed (prevent policy override)"
                checked={(spec.seedLocked as boolean) ?? false}
                onChange={(v) => update('seedLocked', v)}
              />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Color Grade — advanced+ */}
      {isVisible(FIELD_VISIBILITY.colorGrade, mode) && (
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
      )}

      {/* Lighting — advanced+ */}
      {isVisible(FIELD_VISIBILITY.lighting, mode) && (
        <CollapsibleSection title="Lighting">
          <input
            type="text"
            value={(spec.lighting as string) ?? ''}
            onChange={(e) => update('lighting', e.target.value)}
            placeholder="e.g., golden hour, soft diffused, hard dramatic"
            className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
          />
        </CollapsibleSection>
      )}

      {/* Timing */}
      <CollapsibleSection title="Timing">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Duration (sec)"
            value={(spec.duration as number) ?? 5}
            onChange={(v) => update('duration', v)}
          />
          {isVisible(FIELD_VISIBILITY.timing.fps, mode) && (
            <NumberField
              label="FPS"
              value={(spec.fps as number) ?? 24}
              onChange={(v) => update('fps', v)}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Post-Process — complex only */}
      {isVisible(FIELD_VISIBILITY.postProcess, mode) && (
        <CollapsibleSection title="Post-Process">
          <div className="grid grid-cols-2 gap-3">
            <SliderField
              label="Sharpen"
              value={(postProcess.sharpen as number) ?? 0}
              min={0} max={100} step={1}
              onChange={(v) => update('postProcess.sharpen', v)}
            />
            <SliderField
              label="Denoise"
              value={(postProcess.denoise as number) ?? 0}
              min={0} max={100} step={1}
              onChange={(v) => update('postProcess.denoise', v)}
            />
            <SliderField
              label="Vignette"
              value={(postProcess.vignette as number) ?? 0}
              min={0} max={100} step={1}
              onChange={(v) => update('postProcess.vignette', v)}
            />
            <SliderField
              label="Film Grain"
              value={(postProcess.filmGrain as number) ?? 0}
              min={0} max={100} step={1}
              onChange={(v) => update('postProcess.filmGrain', v)}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* VFX — complex only */}
      {isVisible(FIELD_VISIBILITY.vfx, mode) && (
        <CollapsibleSection title="VFX">
          <div className="space-y-2">
            <CheckboxField
              label="Lens flare"
              checked={(vfx.lensFlare as boolean) ?? false}
              onChange={(v) => update('vfx.lensFlare', v)}
            />
            <CheckboxField
              label="Chromatic aberration"
              checked={(vfx.chromaticAberration as boolean) ?? false}
              onChange={(v) => update('vfx.chromaticAberration', v)}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Audio Plan — complex only */}
      {isVisible(FIELD_VISIBILITY.audioPlan, mode) && (
        <CollapsibleSection title="Audio Plan">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Background</label>
              <input
                type="text"
                value={(audioPlan.background as string) ?? ''}
                onChange={(e) => update('audioPlan.background', e.target.value)}
                placeholder="e.g., ambient pad, lo-fi beat"
                className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Midground</label>
              <input
                type="text"
                value={(audioPlan.midground as string) ?? ''}
                onChange={(e) => update('audioPlan.midground', e.target.value)}
                placeholder="e.g., foley, atmosphere"
                className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Foreground</label>
              <input
                type="text"
                value={(audioPlan.foreground as string) ?? ''}
                onChange={(e) => update('audioPlan.foreground', e.target.value)}
                placeholder="e.g., voiceover, narration"
                className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Lip-Sync — advanced+ */}
      {isVisible(FIELD_VISIBILITY.lipSync, mode) && (
        <CollapsibleSection title="Lip-Sync">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={!!lipSync.enabled}
                onChange={(e) => update('lipSync.enabled', e.target.checked)}
                className="rounded border-border bg-bg-tertiary"
              />
              Enable lip-sync
            </label>
            {!!lipSync.enabled && (
              <>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Mode</label>
                  <select
                    value={(lipSync.mode as string) ?? 'subtitle-only'}
                    onChange={(e) => update('lipSync.mode', e.target.value)}
                    className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  >
                    <option value="subtitle-only">Subtitle Only</option>
                    <option value="character-rig">Character Rig</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </div>
                <SliderField
                  label="Smoothing"
                  value={Number(lipSync.smoothing ?? 0.5)}
                  min={0} max={1} step={0.05}
                  onChange={(v) => update('lipSync.smoothing', v)}
                />
                <SliderField
                  label="Exaggeration"
                  value={Number(lipSync.exaggeration ?? 1.0)}
                  min={0.5} max={2.0} step={0.1}
                  onChange={(v) => update('lipSync.exaggeration', v)}
                />
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Character ID</label>
                  <input
                    type="text"
                    value={(lipSync.characterId as string) ?? ''}
                    onChange={(e) => update('lipSync.characterId', e.target.value)}
                    placeholder="Optional character identifier"
                    className="w-full bg-bg-tertiary text-text-primary border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent-blue outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Raw JSON — complex only */}
      {isVisible(FIELD_VISIBILITY.rawJson, mode) && (
        <CollapsibleSection title="Raw JSON">
          <pre className="bg-bg-tertiary text-text-secondary border border-border rounded-md p-3 text-xs overflow-auto max-h-64 font-mono">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
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

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border bg-bg-tertiary text-accent-blue focus:ring-accent-blue"
      />
      <span className="text-sm text-text-primary">{label}</span>
    </label>
  );
}
