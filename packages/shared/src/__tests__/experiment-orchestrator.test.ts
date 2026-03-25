import { describe, it, expect } from 'vitest';
import {
  validateExperimentConfig,
  allocateTraffic,
  shouldDeclareWinner,
  suggestPresetVariant,
  suggestPresetVariantForChannel,
  computeSuggestionBoost,
} from '../experiment-orchestrator.js';
import type { ExperimentConfig, VariantMetrics, ChannelContext } from '../experiment-orchestrator.js';
import type { ViralScoreResult } from '../viral-scoring.js';

// ─── validateExperimentConfig ───

describe('validateExperimentConfig', () => {
  const validConfig: ExperimentConfig = {
    name: 'Test hook styles',
    hypothesis: 'Question hooks perform better than statement hooks',
    variants: [
      { id: 'a', label: 'Control', changes: {}, trafficPercent: 50 },
      { id: 'b', label: 'Question Hook', changes: { hookStyle: 'question' }, trafficPercent: 50 },
    ],
    primaryMetric: 'engagement',
    confidenceLevel: 0.95,
    minSampleSize: 100,
  };

  it('accepts valid config', () => {
    const result = validateExperimentConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing name', () => {
    const result = validateExperimentConfig({ ...validConfig, name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Experiment name is required');
  });

  it('rejects missing hypothesis', () => {
    const result = validateExperimentConfig({ ...validConfig, hypothesis: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Hypothesis is required');
  });

  it('rejects fewer than 2 variants', () => {
    const result = validateExperimentConfig({
      ...validConfig,
      variants: [{ id: 'a', label: 'Only', changes: {}, trafficPercent: 100 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least 2 variants are required');
  });

  it('rejects traffic not summing to 100', () => {
    const result = validateExperimentConfig({
      ...validConfig,
      variants: [
        { id: 'a', label: 'A', changes: {}, trafficPercent: 60 },
        { id: 'b', label: 'B', changes: {}, trafficPercent: 60 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sum to 100%'))).toBe(true);
  });

  it('rejects duplicate variant labels', () => {
    const result = validateExperimentConfig({
      ...validConfig,
      variants: [
        { id: 'a', label: 'Same', changes: {}, trafficPercent: 50 },
        { id: 'b', label: 'Same', changes: {}, trafficPercent: 50 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Variant labels must be unique');
  });

  it('rejects invalid primary metric', () => {
    const result = validateExperimentConfig({
      ...validConfig,
      primaryMetric: 'invalid' as ExperimentConfig['primaryMetric'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid primary metric'))).toBe(true);
  });

  it('rejects confidence level out of range', () => {
    const result = validateExperimentConfig({ ...validConfig, confidenceLevel: 0.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Confidence level'))).toBe(true);
  });

  it('accepts viralScore as primary metric', () => {
    const result = validateExperimentConfig({ ...validConfig, primaryMetric: 'viralScore' });
    expect(result.valid).toBe(true);
  });
});

// ─── allocateTraffic ───

describe('allocateTraffic', () => {
  it('splits 2 variants evenly', () => {
    expect(allocateTraffic(2)).toEqual([50, 50]);
  });

  it('splits 3 variants with remainder', () => {
    const alloc = allocateTraffic(3);
    expect(alloc).toEqual([34, 33, 33]);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('splits 4 variants evenly', () => {
    const alloc = allocateTraffic(4);
    expect(alloc).toEqual([25, 25, 25, 25]);
  });

  it('handles 7 variants with remainder', () => {
    const alloc = allocateTraffic(7);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(100);
    expect(alloc.length).toBe(7);
  });

  it('returns [100] for single variant', () => {
    expect(allocateTraffic(1)).toEqual([100]);
  });

  it('throws for more than 10 variants', () => {
    expect(() => allocateTraffic(11)).toThrow('Maximum 10 variants');
  });
});

// ─── shouldDeclareWinner ───

describe('shouldDeclareWinner', () => {
  it('returns no winner with insufficient samples', () => {
    const variants: VariantMetrics[] = [
      { id: 'a', label: 'A', impressions: 10, clicks: 2, engagementRate: 0.2, completionRate: 0.5, shareRate: 0.01 },
      { id: 'b', label: 'B', impressions: 10, clicks: 5, engagementRate: 0.5, completionRate: 0.6, shareRate: 0.02 },
    ];
    const result = shouldDeclareWinner(variants, 0.95, 100);
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('Insufficient data');
  });

  it('declares winner with significant difference and enough samples', () => {
    const variants: VariantMetrics[] = [
      { id: 'a', label: 'Control', impressions: 5000, clicks: 100, engagementRate: 0.02, completionRate: 0.5, shareRate: 0.01 },
      { id: 'b', label: 'Test', impressions: 5000, clicks: 250, engagementRate: 0.05, completionRate: 0.6, shareRate: 0.02 },
    ];
    const result = shouldDeclareWinner(variants, 0.95, 100);
    expect(result.winnerId).toBe('b');
    expect(result.significance).toBeLessThan(0.05);
    expect(result.reason).toContain('wins');
  });

  it('returns no winner with similar rates', () => {
    const variants: VariantMetrics[] = [
      { id: 'a', label: 'A', impressions: 100, clicks: 10, engagementRate: 0.10, completionRate: 0.5, shareRate: 0.01 },
      { id: 'b', label: 'B', impressions: 100, clicks: 11, engagementRate: 0.11, completionRate: 0.5, shareRate: 0.01 },
    ];
    const result = shouldDeclareWinner(variants, 0.95, 100);
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('No significant winner');
  });

  it('rejects fewer than 2 variants', () => {
    const result = shouldDeclareWinner(
      [{ id: 'a', label: 'A', impressions: 1000, clicks: 100, engagementRate: 0.1, completionRate: 0.5, shareRate: 0.01 }],
      0.95,
      100,
    );
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('Need at least 2 variants');
  });
});

// ─── suggestPresetVariant ───

describe('suggestPresetVariant', () => {
  it('suggests presets for weak dimensions', () => {
    const viralScore: ViralScoreResult = {
      overall: 40,
      tier: 'medium',
      shareCoefficient: 0.3,
      dimensions: {
        hookStrength: 30,
        retentionPotential: 70,
        ctaClarity: 25,
        sharePotential: 80,
        platformFit: 90,
        trendAlignment: 60,
      },
      issues: [],
    };

    const suggestions = suggestPresetVariant(viralScore);
    expect(suggestions.length).toBeGreaterThan(0);

    // Should suggest for hookStrength and ctaClarity (both < 50)
    const dims = new Set(suggestions.map(s => s.dimension));
    expect(dims.has('hookStrength')).toBe(true);
    expect(dims.has('ctaClarity')).toBe(true);
    // Should NOT suggest for retentionPotential (70 >= 50)
    expect(dims.has('retentionPotential')).toBe(false);
  });

  it('returns empty array when all dimensions are strong', () => {
    const viralScore: ViralScoreResult = {
      overall: 85,
      tier: 'viral',
      shareCoefficient: 0.8,
      dimensions: {
        hookStrength: 90,
        retentionPotential: 85,
        ctaClarity: 75,
        sharePotential: 80,
        platformFit: 95,
        trendAlignment: 70,
      },
      issues: [],
    };

    const suggestions = suggestPresetVariant(viralScore);
    expect(suggestions).toHaveLength(0);
  });

  it('excludes current presets from suggestions', () => {
    const viralScore: ViralScoreResult = {
      overall: 30,
      tier: 'low',
      shareCoefficient: 0.2,
      dimensions: {
        hookStrength: 20,
        retentionPotential: 30,
        ctaClarity: 40,
        sharePotential: 45,
        platformFit: 30,
        trendAlignment: 20,
      },
      issues: [],
    };

    const allSuggestions = suggestPresetVariant(viralScore);
    const withExclusion = suggestPresetVariant(viralScore, [allSuggestions[0].presetId]);

    expect(withExclusion.length).toBeLessThan(allSuggestions.length);
    expect(withExclusion.every(s => s.presetId !== allSuggestions[0].presetId)).toBe(true);
  });

  it('sorts by expected improvement (significant first)', () => {
    const viralScore: ViralScoreResult = {
      overall: 25,
      tier: 'low',
      shareCoefficient: 0.1,
      dimensions: {
        hookStrength: 20,
        retentionPotential: 20,
        ctaClarity: 20,
        sharePotential: 20,
        platformFit: 20,
        trendAlignment: 20,
      },
      issues: [],
    };

    const suggestions = suggestPresetVariant(viralScore);
    for (let i = 1; i < suggestions.length; i++) {
      const order: Record<string, number> = { significant: 0, moderate: 1, minor: 2 };
      expect(order[suggestions[i - 1].expectedImprovement]).toBeLessThanOrEqual(
        order[suggestions[i].expectedImprovement],
      );
    }
  });

  it('has required fields on each suggestion', () => {
    const viralScore: ViralScoreResult = {
      overall: 30,
      tier: 'low',
      shareCoefficient: 0.2,
      dimensions: {
        hookStrength: 20,
        retentionPotential: 70,
        ctaClarity: 25,
        sharePotential: 80,
        platformFit: 90,
        trendAlignment: 30,
      },
      issues: [],
    };

    const suggestions = suggestPresetVariant(viralScore);
    for (const s of suggestions) {
      expect(s.presetId).toBeTruthy();
      expect(s.reason).toBeTruthy();
      expect(s.dimension).toBeTruthy();
      expect(['minor', 'moderate', 'significant']).toContain(s.expectedImprovement);
    }
  });
});

// ─── suggestPresetVariantForChannel ───

describe('suggestPresetVariantForChannel', () => {
  const weakScore: ViralScoreResult = {
    overall: 30,
    tier: 'low',
    shareCoefficient: 0.2,
    dimensions: {
      hookStrength: 20,
      retentionPotential: 30,
      ctaClarity: 25,
      sharePotential: 40,
      platformFit: 30,
      trendAlignment: 20,
    },
    issues: [],
  };

  it('returns same results as base when no channel context', () => {
    const base = suggestPresetVariant(weakScore);
    const channelAware = suggestPresetVariantForChannel(weakScore);
    expect(channelAware).toEqual(base);
  });

  it('returns same results when channel has no matching context', () => {
    const base = suggestPresetVariant(weakScore);
    const channelAware = suggestPresetVariantForChannel(weakScore, undefined, {});
    expect(channelAware).toEqual(base);
  });

  it('boosts niche-relevant presets within same tier', () => {
    const channel: ChannelContext = { niches: ['comedy'] };
    const suggestions = suggestPresetVariantForChannel(weakScore, undefined, channel);
    expect(suggestions.length).toBeGreaterThan(0);

    // Within the same improvement tier, comedy-relevant presets should appear earlier
    const comedyPresets = new Set(['audio.energetic-beat.v1', 'edit.fast-cuts.v1']);
    const firstTier = suggestions[0].expectedImprovement;
    const sameTier = suggestions.filter(s => s.expectedImprovement === firstTier);
    if (sameTier.length > 1) {
      const boostedIdx = sameTier.findIndex(s => comedyPresets.has(s.presetId));
      const unboostedIdx = sameTier.findIndex(s => !comedyPresets.has(s.presetId));
      if (boostedIdx >= 0 && unboostedIdx >= 0) {
        expect(boostedIdx).toBeLessThan(unboostedIdx);
      }
    }
  });

  it('boosts platform-relevant presets', () => {
    const channel: ChannelContext = { platform: 'tiktok' };
    const suggestions = suggestPresetVariantForChannel(weakScore, undefined, channel);
    expect(suggestions.length).toBeGreaterThan(0);

    // TikTok-relevant presets should be present
    const tiktokPresets = new Set(['output.reels-portrait.v1', 'edit.fast-cuts.v1']);
    const hasTiktokPreset = suggestions.some(s => tiktokPresets.has(s.presetId));
    expect(hasTiktokPreset).toBe(true);
  });

  it('boosts tone-relevant presets', () => {
    const channel: ChannelContext = { tone: 'cinematic' };
    const suggestions = suggestPresetVariantForChannel(weakScore, undefined, channel);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('combines niche + platform + tone boosts', () => {
    const channel: ChannelContext = { niches: ['educational'], platform: 'youtube', tone: 'professional' };
    const suggestions = suggestPresetVariantForChannel(weakScore, undefined, channel);
    expect(suggestions.length).toBeGreaterThan(0);

    // end-card is boosted by educational niche, youtube platform, AND professional tone
    const endCardIdx = suggestions.findIndex(s => s.presetId === 'edit.end-card.v1');
    expect(endCardIdx).toBeGreaterThanOrEqual(0);
  });

  it('still excludes current presets', () => {
    const channel: ChannelContext = { niches: ['comedy'] };
    const all = suggestPresetVariantForChannel(weakScore, undefined, channel);
    const excluded = suggestPresetVariantForChannel(weakScore, [all[0].presetId], channel);
    expect(excluded.length).toBeLessThan(all.length);
    expect(excluded.every(s => s.presetId !== all[0].presetId)).toBe(true);
  });

  it('returns empty for strong scores regardless of channel', () => {
    const strong: ViralScoreResult = {
      overall: 90,
      tier: 'viral',
      shareCoefficient: 0.9,
      dimensions: {
        hookStrength: 90,
        retentionPotential: 85,
        ctaClarity: 80,
        sharePotential: 85,
        platformFit: 95,
        trendAlignment: 80,
      },
      issues: [],
    };
    const channel: ChannelContext = { niches: ['comedy'], platform: 'tiktok' };
    const suggestions = suggestPresetVariantForChannel(strong, undefined, channel);
    expect(suggestions).toHaveLength(0);
  });
});

// ─── computeSuggestionBoost ───

describe('computeSuggestionBoost', () => {
  it('returns 0.5 for zero acceptance and improvement', () => {
    const boost = computeSuggestionBoost('test.v1', 0, 0);
    expect(boost).toBe(0.5);
  });

  it('returns higher boost for high acceptance rate', () => {
    const low = computeSuggestionBoost('test.v1', 0.2, 0);
    const high = computeSuggestionBoost('test.v1', 0.8, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('returns higher boost for high improvement', () => {
    const low = computeSuggestionBoost('test.v1', 0.5, 10);
    const high = computeSuggestionBoost('test.v1', 0.5, 80);
    expect(high).toBeGreaterThan(low);
  });

  it('clamps to minimum 0.5', () => {
    const boost = computeSuggestionBoost('test.v1', -1, -50);
    expect(boost).toBe(0.5);
  });

  it('clamps to maximum 2.0', () => {
    const boost = computeSuggestionBoost('test.v1', 1.0, 500);
    expect(boost).toBe(2.0);
  });

  it('combines acceptance and improvement', () => {
    const boost = computeSuggestionBoost('test.v1', 0.5, 50);
    expect(boost).toBeGreaterThan(0.5);
    expect(boost).toBeLessThanOrEqual(2.0);
  });
});
