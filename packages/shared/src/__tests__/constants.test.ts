import { describe, it, expect } from 'vitest';
import { CINEMA_PRESETS, QUALITY_THRESHOLDS } from '../constants.js';

describe('Cinema Constants', () => {
  it('should define standard aspect ratios', () => {
    expect(CINEMA_PRESETS.ASPECT_RATIOS['16:9']).toEqual({ width: 1920, height: 1080 });
    expect(CINEMA_PRESETS.ASPECT_RATIOS['9:16']).toEqual({ width: 1080, height: 1920 });
  });

  it('should define lens presets', () => {
    expect(CINEMA_PRESETS.LENS_PRESETS.portrait.lens).toBe('85mm');
    expect(CINEMA_PRESETS.LENS_PRESETS.wide.dof).toBe('deep');
  });

  it('should define camera movements', () => {
    expect(CINEMA_PRESETS.CAMERA_MOVEMENTS).toContain('static');
    expect(CINEMA_PRESETS.CAMERA_MOVEMENTS).toContain('dolly-in');
    expect(CINEMA_PRESETS.CAMERA_MOVEMENTS.length).toBeGreaterThan(10);
  });

  it('should define quality thresholds', () => {
    expect(QUALITY_THRESHOLDS.AUTO_APPROVE).toBe(85);
    expect(QUALITY_THRESHOLDS.REVIEW_REQUIRED).toBe(60);
    expect(QUALITY_THRESHOLDS.AUTO_REJECT).toBe(30);
    expect(QUALITY_THRESHOLDS.AUTO_APPROVE).toBeGreaterThan(QUALITY_THRESHOLDS.REVIEW_REQUIRED);
  });

  it('should define default generation settings', () => {
    expect(CINEMA_PRESETS.DEFAULT_GENERATION.steps).toBe(30);
    expect(CINEMA_PRESETS.DEFAULT_GENERATION.sampler).toBe('dpmpp_2m');
  });
});
