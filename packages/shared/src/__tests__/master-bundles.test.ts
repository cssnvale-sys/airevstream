import { describe, it, expect } from 'vitest';
import {
  MASTER_BUNDLES,
  ALL_BUILT_IN_PRESETS,
  BUILT_IN_RECIPES,
  LEGACY_RECIPES,
  STORY_PRESETS,
  resolvePresetsWithDirectives,
  buildDirectivesContext,
} from '../index.js';
import type { ShotSpec, RecipeCategory } from '../index.js';

describe('master bundles', () => {
  it('should have 15 master bundle recipes', () => {
    expect(MASTER_BUNDLES).toHaveLength(15);
  });

  it('should have 18 total built-in recipes (3 legacy + 15 bundles)', () => {
    expect(BUILT_IN_RECIPES).toHaveLength(18);
    expect(LEGACY_RECIPES).toHaveLength(3);
  });

  it('every master bundle should reference only valid preset IDs', () => {
    const allIds = new Set(ALL_BUILT_IN_PRESETS.map((p) => p.id));
    for (const bundle of MASTER_BUNDLES) {
      for (const presetId of bundle.presetIds) {
        expect(allIds.has(presetId)).toBe(true);
      }
    }
  });

  it('every master bundle should have category, mood, and directives', () => {
    for (const bundle of MASTER_BUNDLES) {
      expect(bundle.category).toBeDefined();
      expect(bundle.mood).toBeDefined();
      expect(bundle.mood!.length).toBeGreaterThan(0);
      expect(bundle.directives).toBeDefined();
    }
  });

  it('all 4 categories should have at least 3 bundles', () => {
    const categories: RecipeCategory[] = ['one-off', 'series', 'shorts', 'cinematic'];
    for (const cat of categories) {
      const count = MASTER_BUNDLES.filter((b) => b.category === cat).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('every bundle should have unique IDs', () => {
    const ids = MASTER_BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every bundle should have unique mood within its category', () => {
    const seen = new Map<string, Set<string>>();
    for (const b of MASTER_BUNDLES) {
      const cat = b.category!;
      if (!seen.has(cat)) seen.set(cat, new Set());
      expect(seen.get(cat)!.has(b.mood!)).toBe(false);
      seen.get(cat)!.add(b.mood!);
    }
  });

  it('recipe constraints should have valid structure', () => {
    for (const bundle of MASTER_BUNDLES) {
      if (bundle.constraints) {
        if (bundle.constraints.allowedAspects) {
          expect(bundle.constraints.allowedAspects.length).toBeGreaterThan(0);
        }
        if (bundle.constraints.allowedFps) {
          expect(bundle.constraints.allowedFps.length).toBeGreaterThan(0);
          for (const fps of bundle.constraints.allowedFps) {
            expect(fps).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('legacy recipes should have category and directives', () => {
    for (const recipe of LEGACY_RECIPES) {
      expect(recipe.category).toBeDefined();
      expect(recipe.directives).toBeDefined();
    }
  });
});

describe('story preset overrides', () => {
  it('story presets should have non-empty overrides with _directives', () => {
    for (const preset of STORY_PRESETS) {
      expect(Object.keys(preset.overrides).length).toBeGreaterThan(0);
      expect(preset.overrides._directives).toBeDefined();
    }
  });
});

describe('resolvePresetsWithDirectives', () => {
  it('should return non-empty ShotSpec and extracted directives', () => {
    const bundle = MASTER_BUNDLES[0]; // one-off.explainer
    const base = {} as ShotSpec;
    const result = resolvePresetsWithDirectives(base, {
      recipe: bundle,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: bundle.directives,
    });

    expect(result.shotSpec).toBeDefined();
    expect(Object.keys(result.shotSpec).length).toBeGreaterThan(0);
    expect(result.directives).toBeDefined();
    expect(result.directives.targetShotCount).toBeDefined();
  });

  it('should strip _directives from resolved ShotSpec', () => {
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.one-off.explainer.v1')!;
    const base = {} as ShotSpec;
    const result = resolvePresetsWithDirectives(base, {
      recipe: bundle,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: bundle.directives,
    });

    const spec = result.shotSpec as unknown as Record<string, unknown>;
    expect(spec._directives).toBeUndefined();
  });

  it('recipe directives should override preset-embedded directives', () => {
    const bundle = MASTER_BUNDLES.find((b) => b.id === 'recipe.one-off.explainer.v1')!;
    const base = {} as ShotSpec;
    const result = resolvePresetsWithDirectives(base, {
      recipe: bundle,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: { ...bundle.directives, targetShotCount: 99 },
    });

    expect(result.directives.targetShotCount).toBe(99);
  });

  it('should return ranges from preset stack', () => {
    const bundle = MASTER_BUNDLES.find((b) =>
      b.presetIds.includes('visual.film-noir.v1'),
    )!;
    const base = {} as ShotSpec;
    const result = resolvePresetsWithDirectives(base, {
      recipe: bundle,
      allPresets: ALL_BUILT_IN_PRESETS,
      recipeDirectives: bundle.directives,
    });

    expect(result.ranges['colorGrade.saturation']).toBeDefined();
  });
});

describe('buildDirectivesContext', () => {
  it('should produce correct text for all directive fields', () => {
    const text = buildDirectivesContext({
      targetShotCount: 6,
      avgShotLengthSec: 5,
      pacing: 'moderate',
      dialogueDensity: 'moderate',
      lensPackage: 'standard-mix',
      narrativeStructure: 'hicc',
      seedPolicy: 'scene-lock',
    });

    expect(text).toContain('Target shot count: 6');
    expect(text).toContain('Average shot length: 5s');
    expect(text).toContain('Pacing: moderate');
    expect(text).toContain('Dialogue density: moderate');
    expect(text).toContain('Lens package: standard-mix');
    expect(text).toContain('Narrative structure: hicc');
    expect(text).toContain('Seed policy: scene-lock');
    expect(text).toContain('PRODUCTION DIRECTIVES');
  });

  it('should return empty string for empty directives', () => {
    expect(buildDirectivesContext({})).toBe('');
  });

  it('should handle partial directives', () => {
    const text = buildDirectivesContext({ pacing: 'fast' });
    expect(text).toContain('Pacing: fast');
    expect(text).not.toContain('Target shot count');
  });
});
