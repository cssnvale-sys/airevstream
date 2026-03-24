import { describe, it, expect } from 'vitest';
import {
  validateAndNormalizeAiPreset,
  generatePresetId,
  FAMILY_OVERRIDE_KEYS,
} from '../presets/ai-generation.js';

describe('generatePresetId', () => {
  it('should generate a slug-based ID', () => {
    const id = generatePresetId('visual', 'Warm Sunset');
    expect(id).toBe('visual.warm-sunset.v1');
  });

  it('should handle special characters', () => {
    const id = generatePresetId('camera', "Bob's Close-Up!!!  ");
    expect(id).toBe('camera.bob-s-close-up.v1');
  });

  it('should truncate long names', () => {
    const longName = 'A'.repeat(100);
    const id = generatePresetId('audio', longName);
    expect(id.length).toBeLessThanOrEqual(50);
    expect(id).toMatch(/^audio\.[a-z]+\.v1$/);
  });

  it('should format as family.slug.v1', () => {
    const id = generatePresetId('edit', 'Jump Cut');
    expect(id).toMatch(/^[a-z]+\.[a-z0-9-]+\.v\d+$/);
  });
});

describe('FAMILY_OVERRIDE_KEYS', () => {
  const allFamilies = [
    'visual', 'camera', 'audio', 'edit', 'output',
    'project', 'character', 'story', 'dialogue', 'continuity',
  ] as const;

  it('should have entries for all 10 families', () => {
    for (const family of allFamilies) {
      expect(FAMILY_OVERRIDE_KEYS[family]).toBeDefined();
      expect(Array.isArray(FAMILY_OVERRIDE_KEYS[family])).toBe(true);
    }
  });

  it('visual should include colorGrade and postProcess', () => {
    expect(FAMILY_OVERRIDE_KEYS.visual).toContain('colorGrade');
    expect(FAMILY_OVERRIDE_KEYS.visual).toContain('postProcess');
  });

  it('character should include characterCount and dialogueMode', () => {
    expect(FAMILY_OVERRIDE_KEYS.character).toContain('characterCount');
    expect(FAMILY_OVERRIDE_KEYS.character).toContain('dialogueMode');
  });

  it('continuity should include seedPolicy', () => {
    expect(FAMILY_OVERRIDE_KEYS.continuity).toContain('seedPolicy');
  });
});

describe('validateAndNormalizeAiPreset', () => {
  const validInput = {
    name: 'Warm Sunset',
    family: 'visual',
    description: 'Warm golden tones',
    tags: ['warm', 'sunset'],
    overrides: {
      colorGrade: { temperature: 30, saturation: 15 },
    },
    tier: null,
  };

  it('should validate a correct preset', () => {
    const result = validateAndNormalizeAiPreset(validInput, 'warm sunset look');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.name).toBe('Warm Sunset');
      expect(result.preset.family).toBe('visual');
      expect(result.preset.builtIn).toBe(false);
      expect(result.preset.id).toBe('visual.warm-sunset.v1');
    }
  });

  it('should force builtIn to false', () => {
    const input = { ...validInput, builtIn: true };
    const result = validateAndNormalizeAiPreset(input, 'test');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.builtIn).toBe(false);
    }
  });

  it('should strip unknown override keys', () => {
    const input = {
      ...validInput,
      overrides: {
        colorGrade: { temperature: 30 },
        invalidKey: 'should be stripped',
        anotherBad: 42,
      },
    };
    const result = validateAndNormalizeAiPreset(input, 'test');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.overrides).toHaveProperty('colorGrade');
      expect(result.preset.overrides).not.toHaveProperty('invalidKey');
      expect(result.preset.overrides).not.toHaveProperty('anotherBad');
    }
  });

  it('should reject invalid family', () => {
    const input = { ...validInput, family: 'nonexistent' };
    const result = validateAndNormalizeAiPreset(input, 'test');
    expect('error' in result).toBe(true);
  });

  it('should reject missing name', () => {
    const { name: _, ...noName } = validInput;
    const result = validateAndNormalizeAiPreset(noName, 'test');
    expect('error' in result).toBe(true);
  });

  it('should generate an ID following the standard format', () => {
    const result = validateAndNormalizeAiPreset(validInput, 'test');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.id).toMatch(/^[a-z]+\.[a-z0-9-]+\.v\d+$/);
    }
  });

  it('should use description param as fallback', () => {
    const input = { ...validInput, description: undefined };
    const result = validateAndNormalizeAiPreset(input, 'my awesome description');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.description).toBe('my awesome description');
    }
  });

  it('should handle null tier', () => {
    const input = { ...validInput, tier: null };
    const result = validateAndNormalizeAiPreset(input, 'test');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.tier).toBeUndefined();
    }
  });

  it('should accept valid tier values', () => {
    const input = { ...validInput, tier: 'advanced' };
    const result = validateAndNormalizeAiPreset(input, 'test');
    expect('preset' in result).toBe(true);
    if ('preset' in result) {
      expect(result.preset.tier).toBe('advanced');
    }
  });
});
