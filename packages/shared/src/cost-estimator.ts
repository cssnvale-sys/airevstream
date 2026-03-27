/**
 * Cost Estimator — compute expected costs from pipeline configuration.
 *
 * Provides pre-render cost estimates based on quality tier, resolution,
 * duration, and AI service pricing.
 */

export interface CostEstimate {
  totalCost: number;
  breakdown: CostBreakdownItem[];
}

export interface CostBreakdownItem {
  category: string;
  description: string;
  estimatedCost: number;
  unit: string;
  quantity: number;
}

export interface PipelineConfig {
  qualityTier: 'draft' | 'standard' | 'cinema';
  durationSec: number;
  shotCount: number;
  resolution?: { width: number; height: number };
  fps?: number;
  audioLayers?: number;
  /** Cost per 1000 tokens for text generation */
  textCostPer1kTokens?: number;
  /** Cost per image generation */
  imageCostPerShot?: number;
  /** Cost per second of video generation */
  videoCostPerSec?: number;
  /** Cost per second of TTS audio */
  ttsCostPerSec?: number;
  /** Whether services are local (free) */
  isLocal?: boolean;
}

/** Tier multipliers for resource usage */
const TIER_MULTIPLIERS = {
  draft: { steps: 20, passes: 1, upscale: false },
  standard: { steps: 30, passes: 1, upscale: false },
  cinema: { steps: 40, passes: 2, upscale: true },
} as const;

/**
 * Estimate total pipeline cost for a content creation job.
 */
export function estimatePipelineCost(config: PipelineConfig): CostEstimate {
  if (config.isLocal) {
    return {
      totalCost: 0,
      breakdown: [{ category: 'local', description: 'All local services', estimatedCost: 0, unit: 'job', quantity: 1 }],
    };
  }

  const breakdown: CostBreakdownItem[] = [];
  const tier = TIER_MULTIPLIERS[config.qualityTier];

  // 1. Text generation (script + storyboard)
  const estimatedTokens = 500 + config.shotCount * 200; // script + per-shot descriptions
  const textCost = (estimatedTokens / 1000) * (config.textCostPer1kTokens ?? 0.01);
  breakdown.push({
    category: 'text',
    description: 'Script & storyboard generation',
    estimatedCost: textCost,
    unit: 'tokens',
    quantity: estimatedTokens,
  });

  // 2. Image generation (keyframes)
  const imagePasses = tier.passes * config.shotCount;
  const imageCost = imagePasses * (config.imageCostPerShot ?? 0.04);
  breakdown.push({
    category: 'image',
    description: `Keyframe generation (${tier.steps} steps${tier.upscale ? ' + upscale' : ''})`,
    estimatedCost: imageCost,
    unit: 'images',
    quantity: imagePasses,
  });

  // 3. Video generation (if applicable)
  if (config.videoCostPerSec && config.videoCostPerSec > 0) {
    const videoCost = config.durationSec * config.videoCostPerSec;
    breakdown.push({
      category: 'video',
      description: 'Video generation (AnimateDiff/Veo)',
      estimatedCost: videoCost,
      unit: 'seconds',
      quantity: config.durationSec,
    });
  }

  // 4. TTS audio
  const audioLayers = config.audioLayers ?? 1;
  const ttsCost = config.durationSec * audioLayers * (config.ttsCostPerSec ?? 0);
  if (ttsCost > 0) {
    breakdown.push({
      category: 'audio',
      description: `TTS generation (${audioLayers} layer${audioLayers > 1 ? 's' : ''})`,
      estimatedCost: ttsCost,
      unit: 'seconds',
      quantity: config.durationSec * audioLayers,
    });
  }

  // 5. Upscale pass (cinema only)
  if (tier.upscale) {
    const upscaleCost = config.shotCount * (config.imageCostPerShot ?? 0.04) * 0.5;
    breakdown.push({
      category: 'upscale',
      description: 'Upscale refinement pass',
      estimatedCost: upscaleCost,
      unit: 'images',
      quantity: config.shotCount,
    });
  }

  const totalCost = breakdown.reduce((sum, item) => sum + item.estimatedCost, 0);

  return { totalCost, breakdown };
}

/**
 * Format a cost value for display.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.01) return '< $0.01';
  return `$${cost.toFixed(2)}`;
}

// ─── Shot-Level Cost Estimation ───

/** Cost rates per provider (approximate, per unit) */
const PROVIDER_RATES: Record<string, { perImage: number; perVideoSec: number; perTtsSec: number }> = {
  comfyui: { perImage: 0, perVideoSec: 0, perTtsSec: 0 }, // Local — free
  veo: { perImage: 0.05, perVideoSec: 0.15, perTtsSec: 0 },
  sora: { perImage: 0.06, perVideoSec: 0.20, perTtsSec: 0 },
  runway: { perImage: 0.05, perVideoSec: 0.10, perTtsSec: 0 },
  kling: { perImage: 0.04, perVideoSec: 0.08, perTtsSec: 0 },
};

/**
 * Estimate cost for a single shot based on its spec and provider.
 */
export function estimateShotCost(
  spec: { duration?: number; outputType?: string; generation?: { width?: number; height?: number } },
  provider: string,
): CostBreakdownItem[] {
  const rates = PROVIDER_RATES[provider] ?? PROVIDER_RATES['comfyui']!;
  const items: CostBreakdownItem[] = [];

  // Image generation
  items.push({
    category: 'image',
    description: `Keyframe generation (${provider})`,
    estimatedCost: rates.perImage,
    unit: 'images',
    quantity: 1,
  });

  // Video generation (if video output)
  const duration = spec.duration ?? 5;
  if (spec.outputType === 'video' || spec.outputType === 'image+video') {
    items.push({
      category: 'video',
      description: `Video generation (${provider})`,
      estimatedCost: duration * rates.perVideoSec,
      unit: 'seconds',
      quantity: duration,
    });
  }

  return items;
}

/**
 * Estimate total cost from an array of shots and a resolved pipeline configuration.
 */
export function estimateFromResolvedConfig(
  shots: Array<{ duration?: number; outputType?: string; generation?: { width?: number; height?: number } }>,
  config: {
    provider?: string;
    qualityTier?: 'draft' | 'standard' | 'cinema';
    ttsCostPerSec?: number;
    audioLayers?: number;
  },
): CostEstimate {
  const provider = config.provider ?? 'comfyui';
  const breakdown: CostBreakdownItem[] = [];

  // Per-shot costs
  for (const shot of shots) {
    const shotItems = estimateShotCost(shot, provider);
    for (const item of shotItems) {
      // Merge into breakdown by category
      const existing = breakdown.find(b => b.category === item.category);
      if (existing) {
        existing.estimatedCost += item.estimatedCost;
        existing.quantity += item.quantity;
      } else {
        breakdown.push({ ...item });
      }
    }
  }

  // TTS cost (aggregate)
  const totalDuration = shots.reduce((sum, s) => sum + (s.duration ?? 5), 0);
  const audioLayers = config.audioLayers ?? 1;
  const ttsCost = totalDuration * audioLayers * (config.ttsCostPerSec ?? 0);
  if (ttsCost > 0) {
    breakdown.push({
      category: 'audio',
      description: `TTS generation (${audioLayers} layer${audioLayers > 1 ? 's' : ''})`,
      estimatedCost: ttsCost,
      unit: 'seconds',
      quantity: totalDuration * audioLayers,
    });
  }

  // Upscale (cinema tier only)
  if (config.qualityTier === 'cinema') {
    const rates = PROVIDER_RATES[provider] ?? PROVIDER_RATES['comfyui']!;
    const upscaleCost = shots.length * rates.perImage * 0.5;
    if (upscaleCost > 0) {
      breakdown.push({
        category: 'upscale',
        description: 'Upscale refinement pass',
        estimatedCost: upscaleCost,
        unit: 'images',
        quantity: shots.length,
      });
    }
  }

  const totalCost = breakdown.reduce((sum, item) => sum + item.estimatedCost, 0);
  return { totalCost, breakdown };
}
