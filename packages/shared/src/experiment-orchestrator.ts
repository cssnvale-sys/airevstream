/**
 * Experiment Orchestrator
 *
 * Pure logic functions for managing A/B tests and multivariate experiments.
 * No DB access, no node: imports — safe for barrel export (D082).
 * Workers and API routes handle persistence.
 */

import { calculateSignificance } from './viral-scoring.js';
import type { ViralDimensions, ViralScoreResult } from './viral-scoring.js';

// ─── Channel Context ───

export interface ChannelContext {
  niches?: string[];
  tone?: string;
  targetAudience?: string;
  platform?: string;
}

// ─── Types ───

export interface ExperimentConfig {
  /** Experiment name */
  name: string;
  /** What is being tested */
  hypothesis: string;
  /** Variants to test */
  variants: ExperimentVariant[];
  /** Metric to optimize */
  primaryMetric: 'views' | 'engagement' | 'retention' | 'clickRate' | 'viralScore';
  /** Minimum sample size per variant */
  minSampleSize?: number;
  /** Confidence level required (0-1, default 0.95) */
  confidenceLevel?: number;
}

export interface ExperimentVariant {
  /** Variant identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** What changes in this variant */
  changes: Record<string, unknown>;
  /** Traffic allocation percentage (0-100) */
  trafficPercent: number;
}

export interface ExperimentResult {
  /** Experiment ID */
  experimentId: string;
  /** Current status */
  status: 'running' | 'completed' | 'stopped';
  /** Per-variant results */
  variantResults: Array<{
    variantId: string;
    sampleSize: number;
    metricValue: number;
    confidenceInterval: [number, number];
  }>;
  /** Winner variant ID (null if not yet determined) */
  winnerId: string | null;
  /** Statistical significance achieved */
  significant: boolean;
}

export interface PresetSuggestion {
  presetId: string;
  reason: string;
  dimension: keyof ViralDimensions;
  expectedImprovement: 'minor' | 'moderate' | 'significant';
}

export interface VariantMetrics {
  id: string;
  label: string;
  impressions: number;
  clicks: number;
  engagementRate: number;
  completionRate: number;
  shareRate: number;
}

export interface WinnerDecision {
  winnerId: string | null;
  significance: number;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Validation ───

/**
 * Validate experiment configuration before creation.
 */
export function validateExperimentConfig(config: ExperimentConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Experiment name is required');
  }

  if (!config.hypothesis || config.hypothesis.trim().length === 0) {
    errors.push('Hypothesis is required');
  }

  if (!config.variants || config.variants.length < 2) {
    errors.push('At least 2 variants are required');
  }

  if (config.variants && config.variants.length > 10) {
    errors.push('Maximum 10 variants allowed');
  }

  if (config.variants && config.variants.length >= 2) {
    const totalTraffic = config.variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      errors.push(`Traffic allocation must sum to 100% (currently ${totalTraffic}%)`);
    }

    const labels = config.variants.map(v => v.label);
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size !== labels.length) {
      errors.push('Variant labels must be unique');
    }

    for (const v of config.variants) {
      if (v.trafficPercent < 1 || v.trafficPercent > 99) {
        errors.push(`Variant "${v.label}" traffic must be between 1-99%`);
      }
    }
  }

  const validMetrics = ['views', 'engagement', 'retention', 'clickRate', 'viralScore'];
  if (!validMetrics.includes(config.primaryMetric)) {
    errors.push(`Invalid primary metric: ${config.primaryMetric}`);
  }

  if (config.confidenceLevel != null && (config.confidenceLevel < 0.8 || config.confidenceLevel > 0.99)) {
    errors.push('Confidence level must be between 0.80 and 0.99');
  }

  if (config.minSampleSize != null && (config.minSampleSize < 10 || config.minSampleSize > 100000)) {
    errors.push('Minimum sample size must be between 10 and 100,000');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Traffic Allocation ───

/**
 * Evenly allocate traffic across N variants, handling rounding.
 * Returns array of percentages summing to exactly 100.
 */
export function allocateTraffic(variantCount: number): number[] {
  if (variantCount < 2) return [100];
  if (variantCount > 10) throw new Error('Maximum 10 variants');

  const base = Math.floor(100 / variantCount);
  const remainder = 100 - base * variantCount;
  const allocation = Array(variantCount).fill(base) as number[];

  // Distribute remainder across first N variants
  for (let i = 0; i < remainder; i++) {
    allocation[i]++;
  }

  return allocation;
}

// ─── Winner Determination ───

/** Map primaryMetric to the VariantMetrics field used for comparison */
function getMetricRate(v: VariantMetrics, primaryMetric: string): number {
  switch (primaryMetric) {
    case 'engagement': return v.engagementRate;
    case 'retention': return v.completionRate;
    case 'clickRate': return v.impressions > 0 ? v.clicks / v.impressions : 0;
    case 'viralScore': return v.engagementRate; // viralScore is int, use engagement as proxy
    case 'views': return v.impressions > 0 ? v.clicks / v.impressions : 0;
    default: return v.engagementRate;
  }
}

/** Human-readable label for the metric */
function getMetricLabel(primaryMetric: string): string {
  switch (primaryMetric) {
    case 'engagement': return 'engagement';
    case 'retention': return 'completion';
    case 'clickRate': return 'click rate';
    case 'viralScore': return 'engagement';
    case 'views': return 'click rate';
    default: return 'engagement';
  }
}

/**
 * Evaluate whether an experiment has a statistically significant winner.
 * Reuses calculateSignificance from viral-scoring.ts.
 * Uses the primaryMetric to determine which rate to compare.
 */
export function shouldDeclareWinner(
  variantResults: VariantMetrics[],
  confidenceLevel: number,
  minSampleSize: number,
  primaryMetric: string = 'engagement',
): WinnerDecision {
  if (variantResults.length < 2) {
    return { winnerId: null, significance: 1, reason: 'Need at least 2 variants' };
  }

  // Check if all variants have enough samples
  const insufficientSamples = variantResults.filter(v => v.impressions < minSampleSize);
  if (insufficientSamples.length > 0) {
    const minImpressions = Math.min(...variantResults.map(v => v.impressions));
    return {
      winnerId: null,
      significance: 1,
      reason: `Insufficient data — need ${minSampleSize} impressions per variant (lowest: ${minImpressions})`,
    };
  }

  // Sort by the primary metric rate (descending)
  const sorted = [...variantResults].sort((a, b) =>
    getMetricRate(b, primaryMetric) - getMetricRate(a, primaryMetric),
  );
  const best = sorted[0];
  const secondBest = sorted[1];
  const bestRate = getMetricRate(best, primaryMetric);
  const secondBestRate = getMetricRate(secondBest, primaryMetric);

  const significanceThreshold = 1 - confidenceLevel; // e.g., 0.95 → 0.05

  const pValue = calculateSignificance(
    {
      variantId: secondBest.id,
      impressions: secondBest.impressions,
      conversions: Math.round(secondBestRate * secondBest.impressions),
      rate: secondBestRate,
    },
    {
      variantId: best.id,
      impressions: best.impressions,
      conversions: Math.round(bestRate * best.impressions),
      rate: bestRate,
    },
  );

  const metricLabel = getMetricLabel(primaryMetric);

  if (pValue <= significanceThreshold) {
    return {
      winnerId: best.id,
      significance: pValue,
      reason: `"${best.label}" wins with ${(bestRate * 100).toFixed(1)}% ${metricLabel} (p=${pValue})`,
    };
  }

  return {
    winnerId: null,
    significance: pValue,
    reason: `No significant winner yet (p=${pValue}, need p<=${significanceThreshold.toFixed(2)})`,
  };
}

// ─── Preset Suggestions ───

/**
 * Dimension-to-preset mapping. Maps weak viral dimensions to preset recommendations.
 * Deterministic — no LLM calls (like D084 revision presets).
 */
const DIMENSION_PRESET_MAP: Record<keyof ViralDimensions, Array<{ presetId: string; reason: string; improvement: PresetSuggestion['expectedImprovement'] }>> = {
  hookStrength: [
    { presetId: 'edit.fast-cuts.v1', reason: 'Fast cuts create urgency in the opening', improvement: 'significant' },
    { presetId: 'camera.dolly-in.v1', reason: 'Dolly-in draws viewer into the scene', improvement: 'moderate' },
  ],
  retentionPotential: [
    { presetId: 'edit.dynamic-pacing.v1', reason: 'Dynamic pacing prevents viewer drop-off', improvement: 'significant' },
    { presetId: 'audio.cinematic-full.v1', reason: 'Full audio mix maintains engagement', improvement: 'moderate' },
    { presetId: 'camera.steadicam.v1', reason: 'Smooth movement keeps viewers watching', improvement: 'minor' },
  ],
  ctaClarity: [
    { presetId: 'edit.end-card.v1', reason: 'End card with clear CTA placement', improvement: 'significant' },
    { presetId: 'visual.bright-cartoon.v1', reason: 'Bright visuals draw attention to CTA', improvement: 'minor' },
  ],
  sharePotential: [
    { presetId: 'visual.wes-anderson.v1', reason: 'Distinctive visual style makes content memorable', improvement: 'moderate' },
    { presetId: 'audio.energetic-beat.v1', reason: 'Energetic music boosts emotional response', improvement: 'moderate' },
  ],
  platformFit: [
    { presetId: 'output.reels-portrait.v1', reason: 'Vertical format optimized for short-form platforms', improvement: 'significant' },
    { presetId: 'output.youtube-landscape.v1', reason: 'Landscape format optimized for YouTube', improvement: 'significant' },
  ],
  trendAlignment: [
    { presetId: 'visual.cyberpunk.v1', reason: 'Trending visual aesthetic', improvement: 'minor' },
    { presetId: 'edit.fast-cuts.v1', reason: 'Fast-paced editing matches current trend patterns', improvement: 'minor' },
  ],
};

/** Threshold below which a dimension is considered "weak" */
const WEAK_DIMENSION_THRESHOLD = 50;

/**
 * Given a viral score result, suggest presets that could improve weak dimensions.
 * Returns suggestions sorted by expected improvement (significant first).
 */
export function suggestPresetVariant(
  viralScore: ViralScoreResult,
  currentPresets?: string[],
): PresetSuggestion[] {
  const suggestions: PresetSuggestion[] = [];
  const current = new Set(currentPresets ?? []);

  for (const [dim, score] of Object.entries(viralScore.dimensions) as Array<[keyof ViralDimensions, number]>) {
    if (score >= WEAK_DIMENSION_THRESHOLD) continue;

    const candidates = DIMENSION_PRESET_MAP[dim] ?? [];
    for (const candidate of candidates) {
      // Skip presets already in use
      if (current.has(candidate.presetId)) continue;

      // Avoid duplicate preset suggestions
      if (suggestions.some(s => s.presetId === candidate.presetId)) continue;

      suggestions.push({
        presetId: candidate.presetId,
        reason: candidate.reason,
        dimension: dim,
        expectedImprovement: candidate.improvement,
      });
    }
  }

  // Sort: significant > moderate > minor
  const order: Record<string, number> = { significant: 0, moderate: 1, minor: 2 };
  return suggestions.sort((a, b) => (order[a.expectedImprovement] ?? 3) - (order[b.expectedImprovement] ?? 3));
}

// ─── Channel-Aware Preset Suggestions ───

/** Niche → preset IDs that perform well for that niche */
const NICHE_PRESET_BOOST: Record<string, string[]> = {
  educational: ['edit.end-card.v1', 'camera.steadicam.v1'],
  comedy: ['audio.energetic-beat.v1', 'edit.fast-cuts.v1'],
  cinematic: ['visual.wes-anderson.v1', 'camera.dolly-in.v1'],
  gaming: ['edit.fast-cuts.v1', 'audio.energetic-beat.v1'],
  tech: ['edit.end-card.v1', 'edit.dynamic-pacing.v1'],
  lifestyle: ['visual.bright-cartoon.v1', 'camera.steadicam.v1'],
  music: ['audio.cinematic-full.v1', 'audio.energetic-beat.v1'],
  fitness: ['edit.fast-cuts.v1', 'camera.steadicam.v1'],
  beauty: ['visual.bright-cartoon.v1', 'camera.dolly-in.v1'],
  news: ['edit.dynamic-pacing.v1', 'edit.end-card.v1'],
};

/** Platform → preset IDs optimized for that platform */
const PLATFORM_PRESET_BOOST: Record<string, string[]> = {
  tiktok: ['output.reels-portrait.v1', 'edit.fast-cuts.v1'],
  instagram: ['output.reels-portrait.v1', 'visual.bright-cartoon.v1'],
  youtube: ['output.youtube-landscape.v1', 'edit.end-card.v1'],
  facebook: ['output.youtube-landscape.v1', 'edit.dynamic-pacing.v1'],
};

/** Tone → preset IDs that match the tone */
const TONE_PRESET_BOOST: Record<string, string[]> = {
  cinematic: ['visual.wes-anderson.v1', 'camera.dolly-in.v1'],
  dramatic: ['audio.cinematic-full.v1', 'edit.dynamic-pacing.v1'],
  comedic: ['edit.fast-cuts.v1', 'audio.energetic-beat.v1'],
  professional: ['camera.steadicam.v1', 'edit.end-card.v1'],
  casual: ['visual.bright-cartoon.v1', 'edit.fast-cuts.v1'],
  educational: ['edit.end-card.v1', 'camera.steadicam.v1'],
};

/**
 * Channel-aware version of suggestPresetVariant.
 * Calls the base function then re-ranks based on channel niche/tone/platform boosting.
 * Falls back to base behavior when no channel context provided.
 */
export function suggestPresetVariantForChannel(
  viralScore: ViralScoreResult,
  currentPresets?: string[],
  channel?: ChannelContext,
): PresetSuggestion[] {
  const baseSuggestions = suggestPresetVariant(viralScore, currentPresets);
  if (!channel || baseSuggestions.length === 0) return baseSuggestions;

  // Build a set of "boosted" preset IDs from channel context
  const boosted = new Set<string>();

  // Niche boosts
  if (channel.niches) {
    for (const niche of channel.niches) {
      const presets = NICHE_PRESET_BOOST[niche.toLowerCase()];
      if (presets) presets.forEach(p => boosted.add(p));
    }
  }

  // Platform boosts
  if (channel.platform) {
    const presets = PLATFORM_PRESET_BOOST[channel.platform.toLowerCase()];
    if (presets) presets.forEach(p => boosted.add(p));
  }

  // Tone boosts
  if (channel.tone) {
    const presets = TONE_PRESET_BOOST[channel.tone.toLowerCase()];
    if (presets) presets.forEach(p => boosted.add(p));
  }

  if (boosted.size === 0) return baseSuggestions;

  // Re-rank: boosted presets come first within each improvement tier
  const order: Record<string, number> = { significant: 0, moderate: 1, minor: 2 };
  return [...baseSuggestions].sort((a, b) => {
    const tierDiff = (order[a.expectedImprovement] ?? 3) - (order[b.expectedImprovement] ?? 3);
    if (tierDiff !== 0) return tierDiff;
    // Within same tier, boost channel-relevant presets
    const aBoost = boosted.has(a.presetId) ? 0 : 1;
    const bBoost = boosted.has(b.presetId) ? 0 : 1;
    return aBoost - bBoost;
  });
}

/**
 * Compute a suggestion boost multiplier based on historical performance.
 * Returns a value between 0.5 and 2.0 for re-ranking.
 * Higher acceptance rate and improvement → higher boost.
 */
export function computeSuggestionBoost(
  _presetId: string,
  historicalAcceptanceRate: number,
  historicalAvgImprovement: number,
): number {
  // Acceptance rate contributes 0-1.0 boost
  const acceptanceBoost = Math.max(0, Math.min(1, historicalAcceptanceRate));
  // Improvement contributes 0-0.5 boost (improvement is typically 0-100 points)
  const improvementBoost = Math.max(0, Math.min(0.5, historicalAvgImprovement / 200));
  // Base multiplier 0.5, max 2.0
  return Math.max(0.5, Math.min(2.0, 0.5 + acceptanceBoost + improvementBoost));
}
