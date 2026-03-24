/**
 * Constraint Validator — validates ShotSpec parameters against provider limits
 * and pipeline budget constraints.
 *
 * Each provider (Veo, Sora, ComfyUI) has specific limits. This module enforces
 * them before generation to fail fast instead of wasting compute.
 */

import type { ShotSpec } from './types.js';
import { SIMPLE_MODE_GUARDRAILS } from './constants.js';

// ─── Types ───

export interface ConstraintViolation {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export type ProviderName = 'comfyui' | 'veo' | 'sora';

interface ProviderLimit {
  maxFps?: number;
  allowedAspects?: string[];
  maxDuration?: number;
  maxSteps?: number;
  maxWidth?: number;
  maxHeight?: number;
  personGenerationDefault?: string;
  supportsFirstFrame?: boolean;
  supportsLastFrame?: boolean;
}

// ─── Provider Constraints ───

export const PROVIDER_CONSTRAINTS: Record<ProviderName, ProviderLimit> = {
  veo: {
    maxFps: 24,
    allowedAspects: ['16:9', '9:16'],
    personGenerationDefault: 'disallow',
    supportsFirstFrame: true,
    supportsLastFrame: true,
  },
  sora: {
    maxDuration: 60,
    allowedAspects: ['16:9', '9:16', '1:1'],
    supportsFirstFrame: true,
    supportsLastFrame: true,
  },
  comfyui: {
    maxSteps: 150,
    maxWidth: 4096,
    maxHeight: 4096,
    supportsFirstFrame: true,
    supportsLastFrame: false,
  },
};

// ─── Safety Defaults ───

export const SAFETY_DEFAULTS = {
  personGeneration: 'disallow',
} as const;

// ─── Validators ───

/**
 * Validate a ShotSpec against provider constraints.
 * Returns an array of violations (empty if valid).
 */
export function validateShotSpec(spec: ShotSpec, provider: ProviderName): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const limits = PROVIDER_CONSTRAINTS[provider];

  if (!limits) {
    violations.push({
      field: 'provider',
      message: `Unknown provider: ${provider}`,
      severity: 'error',
    });
    return violations;
  }

  // FPS check
  if (limits.maxFps && spec.fps && spec.fps > limits.maxFps) {
    violations.push({
      field: 'fps',
      message: `FPS ${spec.fps} exceeds ${provider} maximum of ${limits.maxFps}`,
      severity: 'error',
    });
  }

  // Aspect ratio check
  if (limits.allowedAspects && spec.aspect && !limits.allowedAspects.includes(spec.aspect)) {
    violations.push({
      field: 'aspect',
      message: `Aspect ratio '${spec.aspect}' not supported by ${provider}. Allowed: ${limits.allowedAspects.join(', ')}`,
      severity: 'error',
    });
  }

  // Duration check
  if (limits.maxDuration && spec.duration && spec.duration > limits.maxDuration) {
    violations.push({
      field: 'duration',
      message: `Duration ${spec.duration}s exceeds ${provider} maximum of ${limits.maxDuration}s`,
      severity: 'error',
    });
  }

  // Generation spec checks
  const gen = spec.generation;
  if (gen) {
    if (limits.maxSteps && gen.steps && gen.steps > limits.maxSteps) {
      violations.push({
        field: 'generation.steps',
        message: `Steps ${gen.steps} exceeds ${provider} maximum of ${limits.maxSteps}`,
        severity: 'error',
      });
    }

    if (limits.maxWidth && gen.width && gen.width > limits.maxWidth) {
      violations.push({
        field: 'generation.width',
        message: `Width ${gen.width} exceeds ${provider} maximum of ${limits.maxWidth}`,
        severity: 'error',
      });
    }

    if (limits.maxHeight && gen.height && gen.height > limits.maxHeight) {
      violations.push({
        field: 'generation.height',
        message: `Height ${gen.height} exceeds ${provider} maximum of ${limits.maxHeight}`,
        severity: 'error',
      });
    }
  }

  // Frame anchor checks
  if (spec.firstFrameRef) {
    if (!spec.firstFrameRef.storageKey) {
      violations.push({
        field: 'firstFrameRef.storageKey',
        message: 'firstFrameRef requires a storageKey',
        severity: 'error',
      });
    }
    if (!limits.supportsFirstFrame) {
      violations.push({
        field: 'firstFrameRef',
        message: `Provider ${provider} does not support first frame anchoring`,
        severity: 'warning',
      });
    }
  }

  if (spec.lastFrameRef) {
    if (!spec.lastFrameRef.storageKey) {
      violations.push({
        field: 'lastFrameRef.storageKey',
        message: 'lastFrameRef requires a storageKey',
        severity: 'error',
      });
    }
    if (!limits.supportsLastFrame) {
      violations.push({
        field: 'lastFrameRef',
        message: `Provider ${provider} does not support last frame anchoring`,
        severity: 'warning',
      });
    }
  }

  // Prompt blocks check
  if (!spec.promptBlocks || spec.promptBlocks.length === 0) {
    violations.push({
      field: 'promptBlocks',
      message: 'ShotSpec must have at least one prompt block',
      severity: 'warning',
    });
  }

  return violations;
}

/**
 * Validate simple-mode constraints on a set of shots.
 * Returns violations if shots exceed guardrail limits.
 */
export function validateSimpleModeConstraints(
  shots: Array<{ duration?: number; dialogue?: Array<unknown> }>,
  mode: 'simple' | 'advanced' | 'complex',
): ConstraintViolation[] {
  if (mode !== 'simple') return [];

  const violations: ConstraintViolation[] = [];
  const g = SIMPLE_MODE_GUARDRAILS;

  if (shots.length > g.MAX_SHOTS) {
    violations.push({
      field: 'shots',
      message: `Simple mode allows max ${g.MAX_SHOTS} shots, got ${shots.length}`,
      severity: 'error',
    });
  }

  shots.forEach((shot, i) => {
    if (shot.duration && shot.duration > g.MAX_SHOT_DURATION_SEC) {
      violations.push({
        field: `shots[${i}].duration`,
        message: `Shot ${i + 1} duration ${shot.duration}s exceeds max ${g.MAX_SHOT_DURATION_SEC}s`,
        severity: 'warning',
      });
    }

    if (shot.dialogue && shot.dialogue.length > g.MAX_DIALOGUE_LINES_PER_SHOT) {
      violations.push({
        field: `shots[${i}].dialogue`,
        message: `Shot ${i + 1} has ${shot.dialogue.length} dialogue lines, max ${g.MAX_DIALOGUE_LINES_PER_SHOT}`,
        severity: 'warning',
      });
    }
  });

  return violations;
}

/**
 * Validate pipeline budget constraints.
 * Returns violations if estimated cost exceeds remaining budget.
 */
export function validatePipelineBudget(
  estimatedCost: number,
  budgetRemaining: number,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (estimatedCost > budgetRemaining) {
    violations.push({
      field: 'budget',
      message: `Estimated cost $${estimatedCost.toFixed(2)} exceeds remaining budget $${budgetRemaining.toFixed(2)}`,
      severity: 'error',
    });
  } else if (estimatedCost > budgetRemaining * 0.8) {
    violations.push({
      field: 'budget',
      message: `Estimated cost $${estimatedCost.toFixed(2)} uses over 80% of remaining budget $${budgetRemaining.toFixed(2)}`,
      severity: 'warning',
    });
  }

  return violations;
}
