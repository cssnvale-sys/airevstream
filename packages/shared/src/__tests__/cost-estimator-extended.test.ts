import { describe, it, expect } from 'vitest';
import {
  estimateShotCost,
  estimateFromResolvedConfig,
  formatCost,
} from '../cost-estimator.js';

describe('estimateShotCost', () => {
  it('should return 0 cost for comfyui (local)', () => {
    const items = estimateShotCost({ duration: 5 }, 'comfyui');
    expect(items.length).toBeGreaterThan(0);
    const totalCost = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    expect(totalCost).toBe(0);
  });

  it('should return non-zero cost for veo', () => {
    const items = estimateShotCost({ duration: 5, outputType: 'video' }, 'veo');
    const totalCost = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('should not include video cost if outputType is not video', () => {
    const items = estimateShotCost({ duration: 5, outputType: 'image' }, 'veo');
    const videoItems = items.filter(i => i.category === 'video');
    expect(videoItems).toHaveLength(0);
  });

  it('should default to comfyui rates for unknown provider', () => {
    const items = estimateShotCost({ duration: 5 }, 'unknown-provider');
    const totalCost = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    expect(totalCost).toBe(0);
  });
});

describe('estimateFromResolvedConfig', () => {
  it('should aggregate costs across multiple shots', () => {
    const shots = [
      { duration: 5, outputType: 'video' },
      { duration: 10, outputType: 'video' },
    ];
    const estimate = estimateFromResolvedConfig(shots, { provider: 'veo' });
    expect(estimate.totalCost).toBeGreaterThan(0);
    expect(estimate.breakdown.length).toBeGreaterThan(0);
  });

  it('should return 0 for comfyui provider', () => {
    const shots = [{ duration: 5 }];
    const estimate = estimateFromResolvedConfig(shots, { provider: 'comfyui' });
    expect(estimate.totalCost).toBe(0);
  });

  it('should add upscale cost for cinema tier with paid provider', () => {
    const shots = [{ duration: 5 }];
    const estimate = estimateFromResolvedConfig(shots, { provider: 'veo', qualityTier: 'cinema' });
    const upscale = estimate.breakdown.find(b => b.category === 'upscale');
    expect(upscale).toBeDefined();
    expect(upscale!.estimatedCost).toBeGreaterThan(0);
  });

  it('should not add upscale for standard tier', () => {
    const shots = [{ duration: 5 }];
    const estimate = estimateFromResolvedConfig(shots, { provider: 'veo', qualityTier: 'standard' });
    const upscale = estimate.breakdown.find(b => b.category === 'upscale');
    expect(upscale).toBeUndefined();
  });

  it('should include TTS cost when ttsCostPerSec is provided', () => {
    const shots = [{ duration: 10 }];
    const estimate = estimateFromResolvedConfig(shots, {
      provider: 'comfyui',
      ttsCostPerSec: 0.01,
    });
    const audio = estimate.breakdown.find(b => b.category === 'audio');
    expect(audio).toBeDefined();
    expect(audio!.estimatedCost).toBeCloseTo(0.1, 5);
  });
});

describe('formatCost', () => {
  it('should return Free for 0', () => {
    expect(formatCost(0)).toBe('Free');
  });

  it('should format small amounts', () => {
    expect(formatCost(0.001)).toBe('< $0.01');
  });

  it('should format normal amounts', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });
});
