import { describe, it, expect } from 'vitest';
import { isVisible, FIELD_VISIBILITY, STORAGE_KEY, DEFAULT_MODE } from '../lib/complexity-fields';
import type { ComplexityMode } from '../lib/complexity-fields';

describe('complexity-fields', () => {
  describe('isVisible', () => {
    it('simple mode shows only simple fields', () => {
      expect(isVisible('simple', 'simple')).toBe(true);
      expect(isVisible('advanced', 'simple')).toBe(false);
      expect(isVisible('complex', 'simple')).toBe(false);
    });

    it('advanced mode shows simple + advanced fields', () => {
      expect(isVisible('simple', 'advanced')).toBe(true);
      expect(isVisible('advanced', 'advanced')).toBe(true);
      expect(isVisible('complex', 'advanced')).toBe(false);
    });

    it('complex mode shows all fields', () => {
      expect(isVisible('simple', 'complex')).toBe(true);
      expect(isVisible('advanced', 'complex')).toBe(true);
      expect(isVisible('complex', 'complex')).toBe(true);
    });
  });

  describe('FIELD_VISIBILITY', () => {
    it('should be a non-empty object', () => {
      expect(typeof FIELD_VISIBILITY).toBe('object');
      expect(Object.keys(FIELD_VISIBILITY).length).toBeGreaterThan(0);
    });

    it('all leaf values should be valid ComplexityMode', () => {
      const validModes = new Set(['simple', 'advanced', 'complex']);
      function checkLeaves(obj: Record<string, unknown>, path: string) {
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = `${path}.${key}`;
          if (typeof value === 'string') {
            expect(validModes.has(value), `Invalid mode "${value}" at ${fullPath}`).toBe(true);
          } else if (typeof value === 'object' && value !== null) {
            checkLeaves(value as Record<string, unknown>, fullPath);
          }
        }
      }
      checkLeaves(FIELD_VISIBILITY as Record<string, unknown>, 'FIELD_VISIBILITY');
    });
  });

  describe('constants', () => {
    it('STORAGE_KEY should be a non-empty string', () => {
      expect(typeof STORAGE_KEY).toBe('string');
      expect(STORAGE_KEY.length).toBeGreaterThan(0);
    });

    it('DEFAULT_MODE should be a valid ComplexityMode', () => {
      expect(['simple', 'advanced', 'complex']).toContain(DEFAULT_MODE);
    });
  });
});
