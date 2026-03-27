/**
 * Pre-Generation Quality Control
 *
 * Validates all shots before sending them to the generation pipeline.
 * Catches constraint violations and budget overruns early to avoid
 * wasting compute resources.
 */

import type { ShotSpec } from './types.js';
import { validateShotSpec, type ConstraintViolation, type ProviderName } from './constraint-validator.js';
import { estimatePipelineCost, type CostEstimate } from './cost-estimator.js';

// ─── Types ───

export interface PreGenQCResult {
  /** Whether all shots passed validation */
  valid: boolean;
  /** All constraint violations across all shots */
  violations: Array<ConstraintViolation & { shotIndex: number }>;
  /** Estimated total pipeline cost */
  costEstimate?: CostEstimate;
  /** Whether estimated cost fits within budget */
  budgetOk: boolean;
}

// ─── Pre-Generation QC ───

/**
 * Run pre-generation quality control on a batch of shots.
 *
 * Validates each shot against provider constraints, estimates total cost,
 * and checks against remaining budget.
 *
 * @param shots - Array of ShotSpecs to validate
 * @param provider - Target generation provider
 * @param budgetRemaining - Optional remaining budget (if undefined, budget check is skipped)
 * @returns QC result with violations and cost estimate
 */
export function runPreGenQC(
  shots: ShotSpec[],
  provider: ProviderName,
  budgetRemaining?: number,
  qualityTier: 'draft' | 'standard' | 'cinema' = 'standard',
): PreGenQCResult {
  const violations: Array<ConstraintViolation & { shotIndex: number }> = [];

  // Validate each shot
  for (let i = 0; i < shots.length; i++) {
    const shotViolations = validateShotSpec(shots[i], provider);
    for (const v of shotViolations) {
      violations.push({ ...v, shotIndex: i });
    }
  }

  // Estimate cost
  const totalDuration = shots.reduce((sum, s) => sum + (s.duration ?? 5), 0);
  const costEstimate = estimatePipelineCost({
    qualityTier,
    durationSec: totalDuration,
    shotCount: shots.length,
    isLocal: provider === 'comfyui',
  });

  // Check budget
  let budgetOk = true;
  if (budgetRemaining !== undefined && costEstimate.totalCost > budgetRemaining) {
    budgetOk = false;
    violations.push({
      field: 'budget',
      message: `Estimated cost $${costEstimate.totalCost.toFixed(2)} exceeds remaining budget $${budgetRemaining.toFixed(2)}`,
      severity: 'error',
      shotIndex: -1,
    });
  }

  const hasErrors = violations.some(v => v.severity === 'error');

  return {
    valid: !hasErrors,
    violations,
    costEstimate,
    budgetOk,
  };
}
