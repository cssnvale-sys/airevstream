/**
 * Viral Video Discovery & Scoring
 *
 * Computes viral potential for content based on structural analysis,
 * pacing, emotional hooks, platform fit, and trend alignment.
 * No ML required — uses heuristic analysis of content metadata.
 */

// ─── Types ───

export type ViralTier = 'low' | 'medium' | 'high' | 'viral';

export interface ViralDimensions {
  /** How quickly does the content grab attention? (0-100) */
  hookStrength: number;
  /** Will viewers stay engaged throughout? (0-100) */
  retentionPotential: number;
  /** Is the CTA clear and well-placed? (0-100) */
  ctaClarity: number;
  /** Is it emotionally resonant enough to share? (0-100) */
  sharePotential: number;
  /** Does it match the target platform's preferences? (0-100) */
  platformFit: number;
  /** Does it align with current trends? (0-100) */
  trendAlignment: number;
}

export interface ViralIssue {
  dimension: keyof ViralDimensions;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export interface ViralScoreResult {
  /** Overall viral score (0-100, weighted average) */
  overall: number;
  /** Per-dimension scores */
  dimensions: ViralDimensions;
  /** Classification based on overall score */
  tier: ViralTier;
  /** Estimated share coefficient (0.0-1.0) */
  shareCoefficient: number;
  /** Issues that reduce viral potential */
  issues: ViralIssue[];
}

/** Input data for viral scoring — extracted from content + storyboard */
export interface ViralScoringInput {
  /** Content title */
  title?: string;
  /** Script text or description */
  script?: string;
  /** Content type */
  contentType: string;
  /** Target platform */
  platform?: string;
  /** Total duration in seconds */
  durationSec?: number;
  /** Number of shots */
  shotCount?: number;
  /** Shot durations in seconds */
  shotDurations?: number[];
  /** Quality scores per shot (0-100) */
  qualityScores?: number[];
  /** Trending topics from knowledge base to cross-reference */
  trendingTopics?: string[];
  /** Whether content has a CTA */
  hasCTA?: boolean;
  /** Whether content has background music */
  hasMusic?: boolean;
  /** Whether content uses face/character */
  hasFace?: boolean;
  /** Number of text overlays / captions */
  textOverlayCount?: number;
}

// ─── Constants ───

const DIMENSION_WEIGHTS: Record<keyof ViralDimensions, number> = {
  hookStrength: 0.25,
  retentionPotential: 0.20,
  ctaClarity: 0.10,
  sharePotential: 0.20,
  platformFit: 0.15,
  trendAlignment: 0.10,
};

/** Optimal duration ranges per platform (seconds) */
const PLATFORM_OPTIMAL_DURATION: Record<string, { min: number; max: number; ideal: number }> = {
  tiktok: { min: 15, max: 60, ideal: 30 },
  youtube: { min: 480, max: 1200, ideal: 600 },
  instagram: { min: 15, max: 90, ideal: 30 },
  facebook: { min: 60, max: 180, ideal: 90 },
};

/** Emotional trigger words that boost share potential */
const EMOTIONAL_TRIGGERS = {
  positive: /\b(amazing|incredible|beautiful|breathtaking|inspiring|wholesome|heartwarming|genius|brilliant|legendary)\b/gi,
  curiosity: /\b(secret|hidden|unknown|mystery|revealed|truth|exposed|nobody knows|did you know)\b/gi,
  urgency: /\b(now|today|breaking|urgent|hurry|limited|last chance|don't miss)\b/gi,
  shock: /\b(shocking|unbelievable|insane|mind.?blowing|impossible|never.?seen|jaw.?dropping)\b/gi,
};

/** Hook patterns that grab attention in first 3 seconds */
const HOOK_PATTERNS = [
  /^(what if|imagine|have you ever|did you know|stop scrolling|wait)/i,
  /^(the .+ that|this is why|here'?s? (how|why|what))/i,
  /^\d+ (ways|things|reasons|tips|secrets|mistakes)/i,
  /^(you won'?t believe|nobody told you|the truth about)/i,
];

// ─── Scoring Functions ───

function scoreHookStrength(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 50; // baseline

  const text = input.script ?? input.title ?? '';
  const firstLine = text.split('\n')[0] ?? '';

  // Check for hook pattern in opening
  const hasHookPattern = HOOK_PATTERNS.some(p => p.test(firstLine));
  if (hasHookPattern) score += 25;
  else {
    issues.push({
      dimension: 'hookStrength',
      severity: 'medium',
      message: 'Opening line lacks a strong hook pattern',
      suggestion: 'Start with a question, number, or provocative statement',
    });
  }

  // Short opening shots suggest quick hook
  if (input.shotDurations?.[0] != null) {
    const firstShotDuration = input.shotDurations[0];
    if (firstShotDuration <= 3) score += 15; // quick cuts = strong hook
    else if (firstShotDuration > 5) {
      score -= 10;
      issues.push({
        dimension: 'hookStrength',
        severity: 'low',
        message: 'First shot is longer than 5 seconds',
        suggestion: 'Shorten the opening shot to grab attention faster',
      });
    }
  }

  // Face in thumbnail/first frame boosts hook
  if (input.hasFace) score += 10;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function scoreRetentionPotential(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 50;

  // Shot variety — more cuts = higher retention
  if (input.shotCount != null && input.durationSec != null && input.durationSec > 0) {
    const cutsPerMinute = (input.shotCount / input.durationSec) * 60;
    if (cutsPerMinute >= 10) score += 20; // fast pacing
    else if (cutsPerMinute >= 5) score += 10;
    else if (cutsPerMinute < 3) {
      score -= 10;
      issues.push({
        dimension: 'retentionPotential',
        severity: 'medium',
        message: `Low cut rate (${cutsPerMinute.toFixed(1)}/min) may lose viewers`,
        suggestion: 'Add more visual variety with shorter shots',
      });
    }
  }

  // Duration variance — mix of shot lengths is more engaging
  if (input.shotDurations && input.shotDurations.length > 2) {
    const avg = input.shotDurations.reduce((a, b) => a + b, 0) / input.shotDurations.length;
    const variance = input.shotDurations.reduce((sum, d) => sum + (d - avg) ** 2, 0) / input.shotDurations.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
    if (cv > 0.5) score += 10; // good variety
    else if (cv < 0.2) {
      issues.push({
        dimension: 'retentionPotential',
        severity: 'low',
        message: 'Shot durations are very uniform',
        suggestion: 'Vary shot lengths for better rhythm',
      });
    }
  }

  // Music presence boosts retention
  if (input.hasMusic) score += 10;

  // Quality consistency
  if (input.qualityScores && input.qualityScores.length > 0) {
    const avgQuality = input.qualityScores.reduce((a, b) => a + b, 0) / input.qualityScores.length;
    if (avgQuality >= 85) score += 10;
    else if (avgQuality < 60) {
      score -= 10;
      issues.push({
        dimension: 'retentionPotential',
        severity: 'medium',
        message: `Low average quality score (${avgQuality.toFixed(0)})`,
        suggestion: 'Improve shot quality before publishing',
      });
    }
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function scoreCTAClarity(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 40; // baseline lower since most content lacks clear CTA

  const text = input.script ?? '';

  // Explicit CTA detection
  const ctaPatterns = /\b(subscribe|follow|like|share|comment|link in bio|check out|click|tap|swipe|download)\b/i;
  if (ctaPatterns.test(text)) score += 30;
  else if (input.hasCTA) score += 20;
  else {
    issues.push({
      dimension: 'ctaClarity',
      severity: 'medium',
      message: 'No clear call-to-action detected',
      suggestion: 'Add a subscribe/follow/share CTA near the end',
    });
  }

  // CTA position — should be near the end
  if (text.length > 100) {
    const lastQuarter = text.slice(Math.floor(text.length * 0.75));
    if (ctaPatterns.test(lastQuarter)) score += 15;
  }

  // Text overlays help reinforce CTA
  if (input.textOverlayCount && input.textOverlayCount > 0) score += 15;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function scoreSharePotential(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 40;

  const text = (input.script ?? '') + ' ' + (input.title ?? '');

  // Check emotional triggers
  let emotionalHits = 0;
  for (const [category, pattern] of Object.entries(EMOTIONAL_TRIGGERS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      emotionalHits += matches.length;
      if (category === 'shock' || category === 'curiosity') score += 10;
      else score += 5;
    }
  }

  if (emotionalHits === 0) {
    issues.push({
      dimension: 'sharePotential',
      severity: 'medium',
      message: 'Content lacks emotional trigger words',
      suggestion: 'Add curiosity-inducing or emotionally resonant language',
    });
  }

  // Title quality
  const title = input.title ?? '';
  if (title.length > 5 && title.length <= 60) score += 10;
  if (title.includes('?')) score += 5; // questions drive engagement

  // Face presence increases relatability
  if (input.hasFace) score += 10;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function scorePlatformFit(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 60; // default if no platform specified

  const platform = input.platform?.toLowerCase();
  if (!platform || !PLATFORM_OPTIMAL_DURATION[platform]) {
    return { score, issues };
  }

  const optimal = PLATFORM_OPTIMAL_DURATION[platform];
  const duration = input.durationSec ?? 0;

  if (duration > 0) {
    if (duration >= optimal.min && duration <= optimal.max) {
      score += 20;
      // Bonus for being near ideal
      const distFromIdeal = Math.abs(duration - optimal.ideal) / optimal.ideal;
      if (distFromIdeal < 0.2) score += 15;
    } else {
      score -= 20;
      issues.push({
        dimension: 'platformFit',
        severity: 'high',
        message: `Duration (${duration}s) is outside ${platform}'s optimal range (${optimal.min}-${optimal.max}s)`,
        suggestion: `Adjust content length to ${optimal.ideal}s for best ${platform} performance`,
      });
    }
  }

  // Platform-specific bonuses
  if (platform === 'tiktok' || platform === 'instagram') {
    // Short-form prefers vertical, fast cuts, faces
    if (input.hasFace) score += 5;
    if (input.textOverlayCount && input.textOverlayCount > 0) score += 5;
  }

  if (platform === 'youtube') {
    // Long-form prefers structured content, good retention
    if (input.shotCount && input.shotCount >= 10) score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function scoreTrendAlignment(input: ViralScoringInput): { score: number; issues: ViralIssue[] } {
  const issues: ViralIssue[] = [];
  let score = 30; // low baseline — trends are bonus

  const topics = input.trendingTopics ?? [];
  if (topics.length === 0) {
    return { score, issues };
  }

  const text = ((input.script ?? '') + ' ' + (input.title ?? '')).toLowerCase();

  let matches = 0;
  for (const topic of topics) {
    const words = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const topicMatches = words.filter(w => text.includes(w)).length;
    if (topicMatches > 0) matches++;
  }

  const matchRate = matches / topics.length;
  if (matchRate > 0.3) score += 40;
  else if (matchRate > 0.1) score += 20;
  else if (matchRate > 0) score += 10;

  if (matches === 0 && topics.length > 0) {
    issues.push({
      dimension: 'trendAlignment',
      severity: 'low',
      message: 'Content does not align with any current trending topics',
      suggestion: 'Consider incorporating trending themes or hashtags',
    });
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ─── Main Scoring Function ───

/**
 * Compute the viral potential of content.
 * Returns scores across 6 dimensions plus an overall weighted score.
 */
export function scoreViralPotential(input: ViralScoringInput): ViralScoreResult {
  const hookResult = scoreHookStrength(input);
  const retentionResult = scoreRetentionPotential(input);
  const ctaResult = scoreCTAClarity(input);
  const shareResult = scoreSharePotential(input);
  const platformResult = scorePlatformFit(input);
  const trendResult = scoreTrendAlignment(input);

  const dimensions: ViralDimensions = {
    hookStrength: hookResult.score,
    retentionPotential: retentionResult.score,
    ctaClarity: ctaResult.score,
    sharePotential: shareResult.score,
    platformFit: platformResult.score,
    trendAlignment: trendResult.score,
  };

  const issues = [
    ...hookResult.issues,
    ...retentionResult.issues,
    ...ctaResult.issues,
    ...shareResult.issues,
    ...platformResult.issues,
    ...trendResult.issues,
  ];

  // Weighted average
  let overall = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    overall += dimensions[dim as keyof ViralDimensions] * weight;
  }
  overall = Math.round(overall);

  // Tier classification
  let tier: ViralTier;
  if (overall >= 80) tier = 'viral';
  else if (overall >= 60) tier = 'high';
  else if (overall >= 40) tier = 'medium';
  else tier = 'low';

  // Share coefficient: normalized 0-1 based on share potential + hook + emotion
  const shareCoefficient = Math.round(
    ((dimensions.sharePotential * 0.5 + dimensions.hookStrength * 0.3 + dimensions.retentionPotential * 0.2) / 100) * 100,
  ) / 100;

  return {
    overall,
    dimensions,
    tier,
    shareCoefficient,
    issues,
  };
}

// ─── Trend Discovery ───

export interface TrendMatch {
  topic: string;
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Find which trending topics match the content.
 * Returns matched trends sorted by relevance.
 */
export function matchTrends(
  contentText: string,
  trendingTopics: Array<{ topic: string; relevanceScore: number }>,
): TrendMatch[] {
  const text = contentText.toLowerCase();
  const matches: TrendMatch[] = [];

  for (const trend of trendingTopics) {
    const words = trend.topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedKeywords = words.filter(w => text.includes(w));

    if (matchedKeywords.length > 0) {
      matches.push({
        topic: trend.topic,
        relevanceScore: trend.relevanceScore,
        matchedKeywords,
      });
    }
  }

  return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ─── A/B Test Framework ───

export type ABTestStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface ABTestVariant {
  contentId: string;
  label: string;
  trafficWeight: number; // 0-100, all variants should sum to 100
  impressions: number;
  clicks: number;
  engagementRate: number;
  completionRate: number;
  shareRate: number;
}

export interface ABTestCampaign {
  id: string;
  name: string;
  hypothesis: string;
  status: ABTestStatus;
  variants: ABTestVariant[];
  startedAt?: string;
  endedAt?: string;
  winner?: string;
  significance?: number; // p-value
}

export interface ABTestResult {
  variantId: string;
  impressions: number;
  conversions: number;
  rate: number;
}

/**
 * Simple statistical significance test for A/B results.
 * Uses a two-proportion z-test approximation.
 * Returns the p-value (lower = more significant).
 */
export function calculateSignificance(
  controlResults: ABTestResult,
  testResults: ABTestResult,
): number {
  const n1 = controlResults.impressions;
  const n2 = testResults.impressions;

  if (n1 < 30 || n2 < 30) return 1.0; // not enough data

  const p1 = controlResults.rate;
  const p2 = testResults.rate;
  const pooled = (controlResults.conversions + testResults.conversions) / (n1 + n2);

  if (pooled === 0 || pooled === 1) return 1.0;

  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 1.0;

  const z = Math.abs(p1 - p2) / se;

  // Approximate p-value from z-score using the standard normal CDF
  // Using a rational approximation
  const pValue = 2 * (1 - normalCDF(z));
  return Math.round(pValue * 10000) / 10000;
}

/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Determine the winner of an A/B test.
 * Returns the variant ID with the best performance if statistically significant.
 */
export function determineWinner(
  variants: ABTestVariant[],
  significanceThreshold = 0.05,
): { winnerId: string | null; significance: number; reason: string } {
  if (variants.length < 2) {
    return { winnerId: null, significance: 1, reason: 'Need at least 2 variants' };
  }

  // Sort by engagement rate
  const sorted = [...variants].sort((a, b) => b.engagementRate - a.engagementRate);
  const best = sorted[0];
  const secondBest = sorted[1];

  const sig = calculateSignificance(
    { variantId: secondBest.contentId, impressions: secondBest.impressions, conversions: Math.round(secondBest.engagementRate * secondBest.impressions), rate: secondBest.engagementRate },
    { variantId: best.contentId, impressions: best.impressions, conversions: Math.round(best.engagementRate * best.impressions), rate: best.engagementRate },
  );

  if (sig <= significanceThreshold) {
    return {
      winnerId: best.contentId,
      significance: sig,
      reason: `"${best.label}" wins with ${(best.engagementRate * 100).toFixed(1)}% engagement (p=${sig})`,
    };
  }

  return {
    winnerId: null,
    significance: sig,
    reason: `No significant winner yet (p=${sig}, need p<=${significanceThreshold})`,
  };
}
