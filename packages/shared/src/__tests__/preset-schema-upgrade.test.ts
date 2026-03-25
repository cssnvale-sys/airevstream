import { describe, it, expect } from 'vitest';
import {
  EngineRoutingSchema,
  RecipeConstraintsSchema,
  ContinuityLocksSchema,
  ContinuityLockLevelSchema,
  PresetSchema,
  RecipeSchema,
} from '../presets/schema.js';

describe('EngineRoutingSchema', () => {
  it('should accept valid routing with all engines', () => {
    const result = EngineRoutingSchema.safeParse({
      keyframeEngine: 'comfyui',
      motionEngine: 'veo',
      assemblyEngine: 'remotion',
    });
    expect(result.success).toBe(true);
  });

  it('should accept partial routing (optional fields)', () => {
    const result = EngineRoutingSchema.safeParse({ keyframeEngine: 'sora' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = EngineRoutingSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept all valid keyframe/motion engine values', () => {
    for (const engine of ['comfyui', 'veo', 'sora', 'runway', 'kling']) {
      expect(EngineRoutingSchema.safeParse({ keyframeEngine: engine }).success).toBe(true);
      expect(EngineRoutingSchema.safeParse({ motionEngine: engine }).success).toBe(true);
    }
  });

  it('should accept all valid assembly engine values', () => {
    for (const engine of ['remotion', 'ffmpeg']) {
      expect(EngineRoutingSchema.safeParse({ assemblyEngine: engine }).success).toBe(true);
    }
  });

  it('should reject invalid engine values', () => {
    const result = EngineRoutingSchema.safeParse({ keyframeEngine: 'invalid-engine' });
    expect(result.success).toBe(false);
  });

  it('should reject unknown keys (strict schema)', () => {
    const result = EngineRoutingSchema.safeParse({
      keyframeEngine: 'comfyui',
      unknownKey: 'value',
    });
    expect(result.success).toBe(false);
  });
});

describe('RecipeConstraintsSchema', () => {
  it('should accept valid constraints with all fields', () => {
    const result = RecipeConstraintsSchema.safeParse({
      maxRuntimeSeconds: 300,
      maxCostUsd: 25,
      allowedAspects: ['16:9', '9:16'],
      allowedFps: [24, 30],
    });
    expect(result.success).toBe(true);
  });

  it('should accept partial constraints (optional fields)', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxRuntimeSeconds: 60 });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = RecipeConstraintsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject negative maxRuntimeSeconds', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxRuntimeSeconds: -10 });
    expect(result.success).toBe(false);
  });

  it('should reject zero maxRuntimeSeconds', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxRuntimeSeconds: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative maxCostUsd', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxCostUsd: -5 });
    expect(result.success).toBe(false);
  });

  it('should accept zero maxCostUsd', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxCostUsd: 0 });
    expect(result.success).toBe(true);
  });

  it('should reject non-integer maxRuntimeSeconds', () => {
    const result = RecipeConstraintsSchema.safeParse({ maxRuntimeSeconds: 10.5 });
    expect(result.success).toBe(false);
  });

  it('should reject unknown keys (strict schema)', () => {
    const result = RecipeConstraintsSchema.safeParse({
      maxRuntimeSeconds: 300,
      unknownKey: 'value',
    });
    expect(result.success).toBe(false);
  });
});

describe('ContinuityLocksSchema', () => {
  it('should accept valid continuity locks with all fields', () => {
    const result = ContinuityLocksSchema.safeParse({
      characterLock: 'strong',
      wardrobeLock: 'standard',
      environmentLock: 'off',
    });
    expect(result.success).toBe(true);
  });

  it('should accept partial continuity locks', () => {
    const result = ContinuityLocksSchema.safeParse({ characterLock: 'standard' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = ContinuityLocksSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept all valid lock levels via ContinuityLockLevelSchema', () => {
    for (const level of ['off', 'standard', 'strong']) {
      expect(ContinuityLockLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it('should reject invalid lock level values', () => {
    const result = ContinuityLocksSchema.safeParse({ characterLock: 'weak' });
    expect(result.success).toBe(false);
  });

  it('should reject unknown keys (strict schema)', () => {
    const result = ContinuityLocksSchema.safeParse({
      characterLock: 'off',
      unknownLock: 'standard',
    });
    expect(result.success).toBe(false);
  });
});

describe('PresetSchema version field', () => {
  it('should accept preset without version (optional)', () => {
    const result = PresetSchema.safeParse({
      id: 'visual.test.v1',
      name: 'Test',
      family: 'visual',
      overrides: {},
    });
    expect(result.success).toBe(true);
  });

  it('should accept preset with valid semver version', () => {
    const result = PresetSchema.safeParse({
      id: 'visual.test.v1',
      name: 'Test',
      family: 'visual',
      overrides: {},
      version: '1.0.0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('should accept multi-digit semver version', () => {
    const result = PresetSchema.safeParse({
      id: 'visual.test.v1',
      name: 'Test',
      family: 'visual',
      overrides: {},
      version: '12.34.56',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid version format', () => {
    const result = PresetSchema.safeParse({
      id: 'visual.test.v1',
      name: 'Test',
      family: 'visual',
      overrides: {},
      version: 'v1.0',
    });
    expect(result.success).toBe(false);
  });
});

describe('RecipeSchema with routing and constraints', () => {
  it('should accept recipe without routing or constraints (backward compat)', () => {
    const result = RecipeSchema.safeParse({
      id: 'recipe.test.v1',
      name: 'Test Recipe',
      presetIds: ['visual.film-noir.v1'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept recipe with routing and constraints', () => {
    const result = RecipeSchema.safeParse({
      id: 'recipe.test.v1',
      name: 'Test Recipe',
      presetIds: ['visual.film-noir.v1'],
      routing: {
        keyframeEngine: 'comfyui',
        motionEngine: 'veo',
        assemblyEngine: 'remotion',
      },
      constraints: {
        maxRuntimeSeconds: 300,
        maxCostUsd: 25,
        allowedAspects: ['16:9', '9:16'],
        allowedFps: [24, 30],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject recipe with invalid routing values', () => {
    const result = RecipeSchema.safeParse({
      id: 'recipe.test.v1',
      name: 'Test Recipe',
      presetIds: ['visual.film-noir.v1'],
      routing: { keyframeEngine: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject recipe with invalid constraint values', () => {
    const result = RecipeSchema.safeParse({
      id: 'recipe.test.v1',
      name: 'Test Recipe',
      presetIds: ['visual.film-noir.v1'],
      constraints: { maxRuntimeSeconds: -1 },
    });
    expect(result.success).toBe(false);
  });
});
