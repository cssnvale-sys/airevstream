import { describe, it, expect } from 'vitest';
import {
  COMPOSITION_REGISTRY,
  getCompositionForProduction,
  getCompositionById,
  validateCompositionProps,
} from '../composition-registry.js';

describe('composition-registry', () => {
  it('should have 4 registered compositions', () => {
    expect(COMPOSITION_REGISTRY).toHaveLength(4);
  });

  it('should have valid metadata on all entries', () => {
    for (const c of COMPOSITION_REGISTRY) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.defaultWidth).toBeGreaterThan(0);
      expect(c.defaultHeight).toBeGreaterThan(0);
      expect(c.defaultFps).toBeGreaterThan(0);
      expect(c.supportedCodecs.length).toBeGreaterThan(0);
      expect(c.requiredProps.length).toBeGreaterThan(0);
    }
  });

  it('should cover all production types', () => {
    const types = COMPOSITION_REGISTRY.map(c => c.productionType);
    expect(types).toContain('short');
    expect(types).toContain('long');
    expect(types).toContain('cinema');
    expect(types).toContain('thumbnail');
  });

  describe('getCompositionForProduction', () => {
    it('should find short composition', () => {
      const comp = getCompositionForProduction('short');
      expect(comp).toBeDefined();
      expect(comp!.id).toBe('ShortFormVideo');
      expect(comp!.aspectRatio).toBe('9:16');
    });

    it('should find long composition', () => {
      const comp = getCompositionForProduction('long');
      expect(comp).toBeDefined();
      expect(comp!.id).toBe('LongFormVideo');
    });

    it('should find cinema composition', () => {
      const comp = getCompositionForProduction('cinema');
      expect(comp).toBeDefined();
      expect(comp!.id).toBe('CinemaVideo');
      expect(comp!.defaultFps).toBe(24);
    });

    it('should find thumbnail composition', () => {
      const comp = getCompositionForProduction('thumbnail');
      expect(comp).toBeDefined();
      expect(comp!.isStill).toBe(true);
    });

    it('should return undefined for unknown production type', () => {
      const comp = getCompositionForProduction('unknown');
      expect(comp).toBeUndefined();
    });

    it('should prefer matching aspect ratio when provided', () => {
      const comp = getCompositionForProduction('short', '9:16');
      expect(comp).toBeDefined();
      expect(comp!.aspectRatio).toBe('9:16');
    });
  });

  describe('getCompositionById', () => {
    it('should find ShortFormVideo', () => {
      const comp = getCompositionById('ShortFormVideo');
      expect(comp).toBeDefined();
      expect(comp!.productionType).toBe('short');
    });

    it('should find CinemaVideo', () => {
      const comp = getCompositionById('CinemaVideo');
      expect(comp).toBeDefined();
      expect(comp!.productionType).toBe('cinema');
    });

    it('should return undefined for unknown id', () => {
      const comp = getCompositionById('NonExistent');
      expect(comp).toBeUndefined();
    });
  });

  describe('validateCompositionProps', () => {
    it('should return empty array for valid props', () => {
      const violations = validateCompositionProps('ShortFormVideo', {
        title: 'Test',
        shots: [{ id: '1', src: 'url' }],
        beatTimings: [{ startFrame: 0, endFrame: 90 }],
      });
      expect(violations).toHaveLength(0);
    });

    it('should report missing required props', () => {
      const violations = validateCompositionProps('CinemaVideo', {
        title: 'Test',
        // missing: shots, fps, width, height
      });
      expect(violations.length).toBe(4);
      const fields = violations.map(v => v.field);
      expect(fields).toContain('shots');
      expect(fields).toContain('fps');
      expect(fields).toContain('width');
      expect(fields).toContain('height');
    });

    it('should report error for unknown composition id', () => {
      const violations = validateCompositionProps('NonExistent', { title: 'Test' });
      expect(violations).toHaveLength(1);
      expect(violations[0].field).toBe('compositionId');
    });

    it('should treat null values as missing', () => {
      const violations = validateCompositionProps('ThumbnailRenderer', {
        title: null,
      });
      expect(violations.length).toBe(1);
      expect(violations[0].field).toBe('title');
    });
  });
});
