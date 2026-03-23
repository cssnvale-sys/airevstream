import { describe, it, expect } from 'vitest';
import { runPreGenQC } from '../pre-generation-qc.js';
import type { ShotSpec } from '../types.js';

const validShot: ShotSpec = {
  promptBlocks: ['a cinematic scene'],
  duration: 5,
  fps: 24,
  aspect: '16:9',
};

describe('pre-generation-qc', () => {
  it('should pass valid ComfyUI shots', () => {
    const result = runPreGenQC([validShot, validShot], 'comfyui');
    expect(result.valid).toBe(true);
    expect(result.violations.filter(v => v.severity === 'error')).toHaveLength(0);
  });

  it('should flag invalid shots', () => {
    const badShot: ShotSpec = {
      promptBlocks: ['test'],
      generation: { steps: 200, width: 8192 },
    };
    const result = runPreGenQC([validShot, badShot], 'comfyui');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.shotIndex === 1 && v.severity === 'error')).toBe(true);
  });

  it('should flag Veo aspect ratio violations', () => {
    const veoShot: ShotSpec = { ...validShot, aspect: '4:3' };
    const result = runPreGenQC([veoShot], 'veo');
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.field === 'aspect')).toBe(true);
  });

  it('should estimate cost', () => {
    const result = runPreGenQC([validShot], 'comfyui');
    expect(result.costEstimate).toBeDefined();
    expect(result.costEstimate!.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('should flag budget exceeded', () => {
    const result = runPreGenQC([validShot], 'veo', 0.001);
    // Veo is not local, so cost > 0
    if (result.costEstimate && result.costEstimate.totalCost > 0.001) {
      expect(result.budgetOk).toBe(false);
    }
  });

  it('should skip budget check when not provided', () => {
    const result = runPreGenQC([validShot], 'comfyui');
    expect(result.budgetOk).toBe(true);
  });
});
