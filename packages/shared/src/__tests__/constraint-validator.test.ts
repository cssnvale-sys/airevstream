import { describe, it, expect } from 'vitest';
import {
  validateShotSpec,
  validatePipelineBudget,
  PROVIDER_CONSTRAINTS,
  SAFETY_DEFAULTS,
} from '../constraint-validator.js';
import type { ShotSpec } from '../types.js';

const baseShotSpec: ShotSpec = {
  promptBlocks: ['test prompt'],
};

describe('constraint-validator', () => {
  describe('validateShotSpec', () => {
    it('should return no violations for a valid ComfyUI spec', () => {
      const violations = validateShotSpec(baseShotSpec, 'comfyui');
      expect(violations.filter(v => v.severity === 'error')).toHaveLength(0);
    });

    it('should flag Veo FPS over 24', () => {
      const spec: ShotSpec = { ...baseShotSpec, fps: 30 };
      const violations = validateShotSpec(spec, 'veo');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'fps', severity: 'error' }),
      );
    });

    it('should flag Veo unsupported aspect ratios', () => {
      const spec: ShotSpec = { ...baseShotSpec, aspect: '4:3' };
      const violations = validateShotSpec(spec, 'veo');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'aspect', severity: 'error' }),
      );
    });

    it('should allow Veo 16:9 and 9:16', () => {
      const spec169: ShotSpec = { ...baseShotSpec, aspect: '16:9' };
      const spec916: ShotSpec = { ...baseShotSpec, aspect: '9:16' };
      expect(validateShotSpec(spec169, 'veo').filter(v => v.field === 'aspect')).toHaveLength(0);
      expect(validateShotSpec(spec916, 'veo').filter(v => v.field === 'aspect')).toHaveLength(0);
    });

    it('should flag Sora duration over 60s', () => {
      const spec: ShotSpec = { ...baseShotSpec, duration: 90 };
      const violations = validateShotSpec(spec, 'sora');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'duration', severity: 'error' }),
      );
    });

    it('should flag ComfyUI steps over 150', () => {
      const spec: ShotSpec = { ...baseShotSpec, generation: { steps: 200 } };
      const violations = validateShotSpec(spec, 'comfyui');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'generation.steps', severity: 'error' }),
      );
    });

    it('should flag ComfyUI width over 4096', () => {
      const spec: ShotSpec = { ...baseShotSpec, generation: { width: 8192 } };
      const violations = validateShotSpec(spec, 'comfyui');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'generation.width', severity: 'error' }),
      );
    });

    it('should warn on empty promptBlocks', () => {
      const spec: ShotSpec = { promptBlocks: [] };
      const violations = validateShotSpec(spec, 'comfyui');
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'promptBlocks', severity: 'warning' }),
      );
    });
  });

  describe('validatePipelineBudget', () => {
    it('should return no violations when under budget', () => {
      const violations = validatePipelineBudget(5.0, 100.0);
      expect(violations).toHaveLength(0);
    });

    it('should error when exceeding budget', () => {
      const violations = validatePipelineBudget(150.0, 100.0);
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'budget', severity: 'error' }),
      );
    });

    it('should warn when using over 80% of budget', () => {
      const violations = validatePipelineBudget(85.0, 100.0);
      expect(violations).toContainEqual(
        expect.objectContaining({ field: 'budget', severity: 'warning' }),
      );
    });
  });

  describe('constants', () => {
    it('should have provider constraints for veo, sora, comfyui', () => {
      expect(PROVIDER_CONSTRAINTS).toHaveProperty('veo');
      expect(PROVIDER_CONSTRAINTS).toHaveProperty('sora');
      expect(PROVIDER_CONSTRAINTS).toHaveProperty('comfyui');
    });

    it('should have personGeneration safety default', () => {
      expect(SAFETY_DEFAULTS.personGeneration).toBe('disallow');
    });
  });
});
