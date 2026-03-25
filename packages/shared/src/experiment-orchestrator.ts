/**
 * Experiment Orchestrator
 *
 * Pure logic functions for managing A/B tests and multivariate experiments.
 * No DB access, no node: imports — safe for barrel export (D082).
 * Workers and API routes handle persistence.
 */

import { calculateSignificance } from './viral-scoring.js';
import type { ViralDimensions, ViralScoreResult } from './viral-scoring.js';

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

/**
 * Evaluate whether an experiment has a statistically significant winner.
 * Reuses calculateSignificance from viral-scoring.ts.
 */
export function shouldDeclareWinner(
  variantResults: VariantMetrics[],
  confidenceLevel: number,
  minSampleSize: number,
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

  // Sort by engagement rate (descending)
  const sorted = [...variantResults].sort((a, b) => b.engagementRate - a.engagementRate);
  const best = sorted[0];
  const secondBest = sorted[1];

  const significanceThreshold = 1 - confidenceLevel; // e.g., 0.95 → 0.05

  const pValue = calculateSignificance(
    {
      variantId: secondBest.id,
      impressions: secondBest.impressions,
      conversions: Math.round(secondBest.engagementRate * secondBest.impressions),
      rate: secondBest.engagementRate,
    },
    {
      variantId: best.id,
      impressions: best.impressions,
      conversions: Math.round(best.engagementRate * best.impressions),
      rate: best.engagementRate,
    },
  );

  if (pValue <= significanceThreshold) {
    return {
      winnerId: best.id,
      significance: pValue,
      reason: `"${best.label}" wins with ${(best.engagementRate * 100).toFixed(1)}% engagement (p=${pValue})`,
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
