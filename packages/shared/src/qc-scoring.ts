/**
 * Quality Control Scoring Module
 *
 * Evaluates generated content quality across multiple dimensions.
 * Scores are 0-100, mapped to quality thresholds for auto-approve/reject.
 */

// ─── Score Types ───

export interface QCScoreResult {
  /** Overall quality score (0-100) */
  overall: number;
  /** Individual dimension scores */
  dimensions: QCDimensions;
  /** Human-readable issues found */
  issues: QCIssue[];
  /** Recommendation based on thresholds */
  recommendation: 'approve' | 'review' | 'reject' | 'regenerate';
}

export interface QCDimensions {
  /** Technical quality: resolution, artifact detection */
  technical: number;
  /** Prompt adherence: how well the output matches the specification */
  promptAdherence: number;
  /** Consistency: similarity with previous shots in the sequence */
  consistency: number;
  /** Composition: framing, rule of thirds, visual balance */
  composition: number;
  /** Color quality: dynamic range, color distribution */
  colorQuality: number;
}

export interface QCIssue {
  dimension: keyof QCDimensions;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface QCShotContext {
  /** The image buffer to evaluate */
  imageBuffer: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Expected width from generation spec */
  expectedWidth?: number;
  /** Expected height from generation spec */
  expectedHeight?: number;
  /** Previous shot's image buffer (for consistency scoring) */
  previousShotBuffer?: Buffer;
  /** Prompt used for generation */
  prompt?: string;
}

// ─── Scoring Functions ───

/**
 * Score a generated shot across all quality dimensions.
 */
export function scoreShot(context: QCShotContext): QCScoreResult {
  const dimensions: QCDimensions = {
    technical: scoreTechnical(context),
    promptAdherence: scorePromptAdherence(context),
    consistency: scoreConsistency(context),
    composition: scoreComposition(context),
    colorQuality: scoreColorQuality(context),
  };

  const issues = collectIssues(dimensions, context);

  // Weighted average for overall score
  const weights = {
    technical: 0.25,
    promptAdherence: 0.25,
    consistency: 0.20,
    composition: 0.15,
    colorQuality: 0.15,
  };

  const overall = Math.round(
    dimensions.technical * weights.technical +
    dimensions.promptAdherence * weights.promptAdherence +
    dimensions.consistency * weights.consistency +
    dimensions.composition * weights.composition +
    dimensions.colorQuality * weights.colorQuality,
  );

  const recommendation = getRecommendation(overall);

  return { overall, dimensions, issues, recommendation };
}

/**
 * Quick score check — returns just the overall score without detailed analysis.
 */
export function quickScore(imageBuffer: Buffer, width: number, height: number): number {
  const result = scoreShot({ imageBuffer, width, height });
  return result.overall;
}

/**
 * Get the recommendation string for a given score.
 */
export function getRecommendation(score: number): QCScoreResult['recommendation'] {
  if (score >= 85) return 'approve';
  if (score >= 60) return 'review';
  if (score >= 30) return 'reject';
  return 'regenerate';
}

// ─── Dimension Scorers ───

/**
 * Technical quality: resolution check, data validity, basic artifact detection.
 */
function scoreTechnical(context: QCShotContext): number {
  let score = 100;
  const { imageBuffer, width, height, expectedWidth, expectedHeight } = context;

  // Check minimum viable image size
  if (imageBuffer.length < 1000) {
    return 10; // Almost certainly corrupt or placeholder
  }

  // Resolution check
  if (expectedWidth && expectedHeight) {
    if (width !== expectedWidth || height !== expectedHeight) {
      score -= 20; // Wrong resolution
    }
  }

  // Minimum resolution gate
  if (width < 256 || height < 256) {
    score -= 40;
  } else if (width < 512 || height < 512) {
    score -= 15;
  }

  // Check for very small file sizes relative to dimensions (possible corruption)
  const expectedMinBytes = width * height * 0.1; // Very rough minimum
  if (imageBuffer.length < expectedMinBytes) {
    score -= 25;
  }

  // Entropy check — detect blank/solid color images
  const entropy = calculateBufferEntropy(imageBuffer);
  if (entropy < 1.0) {
    score -= 50; // Very low entropy = likely solid color
  } else if (entropy < 3.0) {
    score -= 20; // Low entropy = very uniform
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Prompt adherence: basic check that the output is not empty/corrupt.
 * Full CLIP-based scoring would require an external model.
 */
function scorePromptAdherence(context: QCShotContext): number {
  // Without a CLIP model, we can only do basic validation
  let score = 75; // Base score — assume reasonable adherence

  if (!context.prompt) {
    return score; // No prompt to check against
  }

  // Check if image has reasonable complexity for a prompted generation
  const entropy = calculateBufferEntropy(context.imageBuffer);

  if (entropy > 6.0) {
    score += 15; // High entropy suggests complex, detailed output
  } else if (entropy > 4.0) {
    score += 5;
  } else if (entropy < 2.0) {
    score -= 25; // Very low entropy suggests failed generation
  }

  // Longer, more detailed prompts expect more complex outputs
  const promptComplexity = context.prompt.split(/[,.]/).length;
  if (promptComplexity > 5 && entropy < 3.0) {
    score -= 15; // Complex prompt but simple output
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Consistency: compare with previous shot for visual similarity.
 * Uses basic byte-level statistical comparison.
 */
function scoreConsistency(context: QCShotContext): number {
  if (!context.previousShotBuffer) {
    return 80; // No reference — assume acceptable consistency
  }

  // Compare entropy levels between shots
  const currentEntropy = calculateBufferEntropy(context.imageBuffer);
  const previousEntropy = calculateBufferEntropy(context.previousShotBuffer);
  const entropyDiff = Math.abs(currentEntropy - previousEntropy);

  let score = 90;

  // Large entropy difference suggests visual inconsistency
  if (entropyDiff > 3.0) {
    score -= 30;
  } else if (entropyDiff > 2.0) {
    score -= 15;
  } else if (entropyDiff > 1.0) {
    score -= 5;
  }

  // Compare average byte values (rough brightness comparison)
  const currentAvg = calculateAverageByteValue(context.imageBuffer);
  const previousAvg = calculateAverageByteValue(context.previousShotBuffer);
  const brightnessDiff = Math.abs(currentAvg - previousAvg);

  if (brightnessDiff > 80) {
    score -= 20; // Major brightness shift
  } else if (brightnessDiff > 40) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Composition: basic aspect ratio and balance checks.
 */
function scoreComposition(context: QCShotContext): number {
  let score = 80; // Base score

  const { width, height } = context;
  const ratio = width / height;

  // Check for standard aspect ratios
  const standardRatios = [16 / 9, 9 / 16, 4 / 3, 2.39, 1];
  const closestRatio = standardRatios.reduce((best, r) =>
    Math.abs(r - ratio) < Math.abs(best - ratio) ? r : best,
  );

  if (Math.abs(closestRatio - ratio) < 0.02) {
    score += 10; // Matches a standard ratio
  }

  // Square images (1:1) get a small bonus for social media
  if (Math.abs(ratio - 1) < 0.01) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Color quality: check for reasonable dynamic range and distribution.
 */
function scoreColorQuality(context: QCShotContext): number {
  const { imageBuffer } = context;
  let score = 80;

  // Check byte value distribution
  const histogram = new Uint32Array(256);
  const sampleSize = Math.min(imageBuffer.length, 10000);
  const step = Math.max(1, Math.floor(imageBuffer.length / sampleSize));

  for (let i = 0; i < imageBuffer.length; i += step) {
    histogram[imageBuffer[i]!]++;
  }

  // Calculate how many bins are used (dynamic range)
  let usedBins = 0;
  let maxBinValue = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i]! > 0) usedBins++;
    maxBinValue = Math.max(maxBinValue, histogram[i]!);
  }

  // Very narrow dynamic range
  if (usedBins < 20) {
    score -= 30;
  } else if (usedBins < 50) {
    score -= 15;
  } else if (usedBins > 200) {
    score += 10; // Good dynamic range
  }

  // Check for dominant single value (clipping)
  const totalSamples = Math.ceil(imageBuffer.length / step);
  if (maxBinValue > totalSamples * 0.5) {
    score -= 20; // More than 50% of pixels at one value
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Utility Functions ───

/**
 * Calculate Shannon entropy of a buffer (bits per byte).
 * Range: 0 (completely uniform) to 8 (completely random).
 */
function calculateBufferEntropy(buffer: Buffer): number {
  if (buffer.length === 0) return 0;

  const freq = new Uint32Array(256);
  const sampleSize = Math.min(buffer.length, 50000);
  const step = Math.max(1, Math.floor(buffer.length / sampleSize));
  let count = 0;

  for (let i = 0; i < buffer.length; i += step) {
    freq[buffer[i]!]++;
    count++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i]! > 0) {
      const p = freq[i]! / count;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Calculate average byte value (rough proxy for brightness).
 */
function calculateAverageByteValue(buffer: Buffer): number {
  if (buffer.length === 0) return 128;

  const sampleSize = Math.min(buffer.length, 10000);
  const step = Math.max(1, Math.floor(buffer.length / sampleSize));
  let sum = 0;
  let count = 0;

  for (let i = 0; i < buffer.length; i += step) {
    sum += buffer[i]!;
    count++;
  }

  return sum / count;
}

/**
 * Collect human-readable issues from dimension scores.
 */
function collectIssues(dimensions: QCDimensions, context: QCShotContext): QCIssue[] {
  const issues: QCIssue[] = [];

  if (dimensions.technical < 50) {
    issues.push({
      dimension: 'technical',
      severity: 'error',
      message: 'Image appears to have significant technical issues (possible corruption or artifacts)',
    });
  } else if (dimensions.technical < 70) {
    issues.push({
      dimension: 'technical',
      severity: 'warning',
      message: 'Image has minor technical issues (resolution or quality)',
    });
  }

  if (dimensions.promptAdherence < 50) {
    issues.push({
      dimension: 'promptAdherence',
      severity: 'error',
      message: 'Generated image may not match the prompt specification',
    });
  }

  if (dimensions.consistency < 60) {
    issues.push({
      dimension: 'consistency',
      severity: 'warning',
      message: 'Visual style differs significantly from the previous shot',
    });
  }

  if (dimensions.colorQuality < 50) {
    issues.push({
      dimension: 'colorQuality',
      severity: 'warning',
      message: 'Color distribution is unusual (possible clipping or very narrow range)',
    });
  }

  if (context.width < 512 || context.height < 512) {
    issues.push({
      dimension: 'technical',
      severity: 'info',
      message: `Low resolution output: ${context.width}x${context.height}`,
    });
  }

  return issues;
}
