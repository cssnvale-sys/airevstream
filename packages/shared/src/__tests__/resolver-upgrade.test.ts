import { describe, it, expect } from 'vitest';
import { resolveAndValidate, resolveWithStickyOverrides, generatePresetDiff } from '../presets/resolver.js';
import { ALL_BUILT_IN_PRESETS, MASTER_BUNDLES } from '../presets/built-in.js';
import type { ShotSpec } from '../types.js';

describe('resolveAndValidate', () => {
  it('should return violations when provider=veo and spec has fps=30', () => {
    const base = { fps: 30, promptBlocks: ['test'] } as ShotSpec;
    const bundle = MASTER_BUNDLES[0];
    const result = resolveAndValidate(
      base,
      {
        recipe: bundle,
        allPresets: ALL_BUILT_IN_PRESETS,
        userOverrides: { fps: 30 } as Partial<ShotSpec>,
      },
      'veo',
    );

    const fpsViolation = result.violations.find((v) => v.field === 'fps');
    expect(fpsViolation).toBeDefined();
    expect(fpsViolation!.message).toContain('exceeds');
    expect(fpsViolation!.message).toContain('24');
  });

  it('should return violations when recipe constraints disallow aspect ratio', () => {
    const base = { aspect: '16:9', promptBlocks: ['test'] } as ShotSpec;
    const shortsBundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.shorts.tiktok-hook.v1')!;
    // Shorts constraints allow only 9:16 and 1:1
    const result = resolveAndValidate(
      base,
      {
        recipe: shortsBundle,
        allPresets: ALL_BUILT_IN_PRESETS,
        userOverrides: { aspect: '16:9' } as Partial<ShotSpec>,
      },
    );

    const aspectViolation = result.violations.find((v) => v.field === 'aspect');
    expect(aspectViolation).toBeDefined();
    expect(aspectViolation!.message).toContain('not allowed by recipe');
  });

  it('should return empty violations for valid combo', () => {
    const base = { fps: 24, aspect: '16:9', promptBlocks: ['test'] } as ShotSpec;
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.one-off.explainer.v1')!;
    const result = resolveAndValidate(
      base,
      {
        recipe: bundle,
        allPresets: ALL_BUILT_IN_PRESETS,
      },
      'comfyui',
    );

    const errors = result.violations.filter((v) => v.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

describe('resolveWithStickyOverrides', () => {
  it('should preserve sticky fps when preset tries to override it', () => {
    const base = {} as ShotSpec;
    const stickyFields = new Set(['fps']);
    const currentValues = { fps: 30 };
    // Use a recipe that sets fps=24 via its presets
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.one-off.explainer.v1')!;

    const result = resolveWithStickyOverrides(
      base,
      {
        recipe: bundle,
        allPresets: ALL_BUILT_IN_PRESETS,
      },
      stickyFields,
      currentValues,
    );

    expect((result as unknown as Record<string, unknown>).fps).toBe(30);
  });

  it('should preserve sticky nested field (colorGrade.contrast)', () => {
    const base = {} as ShotSpec;
    const stickyFields = new Set(['colorGrade.contrast']);
    const currentValues = { colorGrade: { contrast: 50 } };
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.cinematic.noir.v1')!;

    const result = resolveWithStickyOverrides(
      base,
      {
        recipe: bundle,
        allPresets: ALL_BUILT_IN_PRESETS,
      },
      stickyFields,
      currentValues,
    );

    const resolved = result as unknown as Record<string, unknown>;
    const colorGrade = resolved.colorGrade as Record<string, unknown>;
    expect(colorGrade.contrast).toBe(50);
  });

  it('should behave like normal resolve with empty stickyFields', () => {
    const base = {} as ShotSpec;
    const stickyFields = new Set<string>();
    const currentValues = {};
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.one-off.explainer.v1')!;

    const result = resolveWithStickyOverrides(
      base,
      {
        recipe: bundle,
        allPresets: ALL_BUILT_IN_PRESETS,
      },
      stickyFields,
      currentValues,
    );

    // Should still resolve — just no sticky overrides applied
    expect(result).toBeDefined();
    expect(Object.keys(result as unknown as Record<string, unknown>).length).toBeGreaterThan(0);
  });
});

describe('generatePresetDiff', () => {
  it('should produce correct before/after entries for top-level changes', () => {
    const before = { fps: 24, aspect: '16:9' };
    const after = { fps: 30, aspect: '16:9' };

    const diff = generatePresetDiff(before, after);

    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('fps');
    expect(diff[0].before).toBe(24);
    expect(diff[0].after).toBe(30);
  });

  it('should produce entries for nested object changes', () => {
    const before = { colorGrade: { contrast: 20, saturation: 10 } };
    const after = { colorGrade: { contrast: 40, saturation: 10 } };

    const diff = generatePresetDiff(before, after);

    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('colorGrade.contrast');
    expect(diff[0].before).toBe(20);
    expect(diff[0].after).toBe(40);
  });

  it('should return empty array when before and after are identical', () => {
    const before = { fps: 24, aspect: '16:9' };
    const after = { fps: 24, aspect: '16:9' };

    const diff = generatePresetDiff(before, after);

    expect(diff).toHaveLength(0);
  });

  it('should handle additions (field present in after but not before)', () => {
    const before = { fps: 24 };
    const after = { fps: 24, aspect: '16:9' };

    const diff = generatePresetDiff(before, after);

    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('aspect');
    expect(diff[0].before).toBeUndefined();
    expect(diff[0].after).toBe('16:9');
  });

  it('should handle removals (field present in before but not after)', () => {
    const before = { fps: 24, aspect: '16:9' };
    const after = { fps: 24 };

    const diff = generatePresetDiff(before, after);

    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('aspect');
    expect(diff[0].before).toBe('16:9');
    expect(diff[0].after).toBeUndefined();
  });

  it('should skip _directives key (internal key starting with _)', () => {
    const before = { fps: 24, _directives: { pacing: 'slow' } };
    const after = { fps: 30, _directives: { pacing: 'fast' } };

    const diff = generatePresetDiff(before, after);

    // Should only contain fps change, not _directives
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('fps');
    expect(diff.find((d) => d.path.startsWith('_directives'))).toBeUndefined();
  });
});
