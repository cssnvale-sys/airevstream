/**
 * Identity Drift Detection Module
 *
 * Detects visual identity drift and temporal flicker across shots.
 * Uses statistical fingerprinting (color histograms, spatial frequency,
 * quadrant analysis) as a lightweight proxy for face/character embedding.
 *
 * Can be upgraded to use ML embeddings (face-api.js, CLIP) when available.
 */

// ─── Types ───

export interface ImageFingerprint {
  /** Normalized color histogram (256 bins) */
  colorHistogram: Float64Array;
  /** Average brightness per quadrant [TL, TR, BL, BR] */
  quadrantBrightness: [number, number, number, number];
  /** Entropy of each quadrant */
  quadrantEntropy: [number, number, number, number];
  /** High-frequency energy (edge density proxy) */
  highFreqEnergy: number;
  /** Average brightness overall */
  avgBrightness: number;
  /** Standard deviation of brightness */
  stdBrightness: number;
}

export interface DriftResult {
  /** Overall identity drift score (0 = identical, 100 = completely different) */
  driftScore: number;
  /** Individual dimension deltas */
  details: {
    histogramDistance: number;
    brightnessShift: number;
    structuralDrift: number;
    entropyDrift: number;
  };
  /** Whether drift exceeds acceptable threshold */
  drifted: boolean;
  /** Human-readable summary */
  message: string;
}

export interface FlickerResult {
  /** Flicker intensity (0-100, higher = worse) */
  flickerScore: number;
  /** Whether flicker exceeds threshold */
  flickering: boolean;
  /** Number of rapid transitions detected */
  transitionCount: number;
  message: string;
}

// ─── Thresholds ───

/** Identity drift threshold — above this triggers a warning */
export const DRIFT_THRESHOLD = 35;
/** Identity drift threshold — above this triggers regeneration */
export const DRIFT_CRITICAL = 60;
/** Flicker threshold — above this triggers a warning */
export const FLICKER_THRESHOLD = 40;

// ─── Fingerprint Extraction ───

/**
 * Extract a statistical fingerprint from an image buffer.
 * Works on raw encoded image data (PNG/JPEG bytes).
 */
export function extractFingerprint(imageBuffer: Buffer): ImageFingerprint {
  const len = imageBuffer.length;
  if (len === 0) {
    return emptyFingerprint();
  }

  // Build full histogram
  const histogram = new Float64Array(256);
  for (let i = 0; i < len; i++) {
    histogram[imageBuffer[i]!]++;
  }
  // Normalize
  for (let i = 0; i < 256; i++) {
    histogram[i]! /= len;
  }

  // Split buffer into quadrants for spatial analysis
  const half = Math.floor(len / 2);
  const quarter = Math.floor(len / 4);
  const q1 = imageBuffer.subarray(0, quarter);
  const q2 = imageBuffer.subarray(quarter, half);
  const q3 = imageBuffer.subarray(half, half + quarter);
  const q4 = imageBuffer.subarray(half + quarter);

  const quadrantBrightness: [number, number, number, number] = [
    averageValue(q1),
    averageValue(q2),
    averageValue(q3),
    averageValue(q4),
  ];

  const quadrantEntropy: [number, number, number, number] = [
    bufferEntropy(q1),
    bufferEntropy(q2),
    bufferEntropy(q3),
    bufferEntropy(q4),
  ];

  // High frequency energy: measure byte-to-byte differences
  let highFreqSum = 0;
  const sampleStep = Math.max(1, Math.floor(len / 20000));
  let sampleCount = 0;
  for (let i = sampleStep; i < len; i += sampleStep) {
    const diff = Math.abs(imageBuffer[i]! - imageBuffer[i - sampleStep]!);
    highFreqSum += diff * diff;
    sampleCount++;
  }
  const highFreqEnergy = sampleCount > 0 ? Math.sqrt(highFreqSum / sampleCount) : 0;

  // Overall stats
  const avgBrightness = averageValue(imageBuffer);
  const stdBrightness = stdDevValue(imageBuffer, avgBrightness);

  return {
    colorHistogram: histogram,
    quadrantBrightness,
    quadrantEntropy,
    highFreqEnergy,
    avgBrightness,
    stdBrightness,
  };
}

// ─── Drift Comparison ───

/**
 * Compare two fingerprints to detect identity drift.
 * Returns a DriftResult with overall score and per-dimension deltas.
 */
export function compareFingerprints(
  reference: ImageFingerprint,
  current: ImageFingerprint,
): DriftResult {
  // 1. Histogram distance (chi-squared)
  let chiSq = 0;
  for (let i = 0; i < 256; i++) {
    const r = reference.colorHistogram[i]!;
    const c = current.colorHistogram[i]!;
    const sum = r + c;
    if (sum > 0) {
      chiSq += ((r - c) ** 2) / sum;
    }
  }
  // Normalize chi-squared to 0-100 scale
  const histogramDistance = Math.min(100, chiSq * 200);

  // 2. Brightness shift
  const brightnessDelta = Math.abs(reference.avgBrightness - current.avgBrightness);
  const brightnessShift = Math.min(100, (brightnessDelta / 128) * 100);

  // 3. Structural drift (quadrant brightness pattern change)
  let quadrantDelta = 0;
  for (let i = 0; i < 4; i++) {
    quadrantDelta += Math.abs(reference.quadrantBrightness[i]! - current.quadrantBrightness[i]!);
  }
  const structuralDrift = Math.min(100, (quadrantDelta / (4 * 128)) * 100);

  // 4. Entropy drift (texture consistency)
  let entropyDelta = 0;
  for (let i = 0; i < 4; i++) {
    entropyDelta += Math.abs(reference.quadrantEntropy[i]! - current.quadrantEntropy[i]!);
  }
  const entropyDrift = Math.min(100, (entropyDelta / 4) * 15);

  // Weighted overall
  const driftScore = Math.round(
    histogramDistance * 0.35 +
    brightnessShift * 0.20 +
    structuralDrift * 0.25 +
    entropyDrift * 0.20,
  );

  const drifted = driftScore > DRIFT_THRESHOLD;

  let message = 'Identity stable';
  if (driftScore > DRIFT_CRITICAL) {
    message = 'Critical identity drift detected — character appearance has changed significantly';
  } else if (drifted) {
    message = 'Moderate identity drift — consider stronger LoRA conditioning or seed lock';
  }

  return {
    driftScore,
    details: { histogramDistance, brightnessShift, structuralDrift, entropyDrift },
    drifted,
    message,
  };
}

// ─── Temporal Flicker Detection ───

/**
 * Detect temporal flicker across a sequence of image buffers.
 * Flicker = rapid brightness/color oscillations between consecutive frames.
 */
export function detectFlicker(shotBuffers: Buffer[]): FlickerResult {
  if (shotBuffers.length < 3) {
    return { flickerScore: 0, flickering: false, transitionCount: 0, message: 'Too few shots to assess flicker' };
  }

  const brightnesses = shotBuffers.map(b => averageValue(b));
  const entropies = shotBuffers.map(b => bufferEntropy(b));

  // Detect oscillations: sign changes in the brightness delta sequence
  let transitionCount = 0;
  const deltas: number[] = [];

  for (let i = 1; i < brightnesses.length; i++) {
    deltas.push(brightnesses[i]! - brightnesses[i - 1]!);
  }

  for (let i = 1; i < deltas.length; i++) {
    // Sign change = oscillation
    if ((deltas[i]! > 0 && deltas[i - 1]! < 0) || (deltas[i]! < 0 && deltas[i - 1]! > 0)) {
      const magnitude = Math.abs(deltas[i]! - deltas[i - 1]!);
      if (magnitude > 10) { // Only count significant oscillations
        transitionCount++;
      }
    }
  }

  // Also check entropy oscillations
  const entropyDeltas: number[] = [];
  for (let i = 1; i < entropies.length; i++) {
    entropyDeltas.push(entropies[i]! - entropies[i - 1]!);
  }

  let entropyOscillations = 0;
  for (let i = 1; i < entropyDeltas.length; i++) {
    if ((entropyDeltas[i]! > 0 && entropyDeltas[i - 1]! < 0) || (entropyDeltas[i]! < 0 && entropyDeltas[i - 1]! > 0)) {
      if (Math.abs(entropyDeltas[i]! - entropyDeltas[i - 1]!) > 0.5) {
        entropyOscillations++;
      }
    }
  }

  // Max delta magnitude
  const maxDelta = deltas.reduce((max, d) => Math.max(max, Math.abs(d)), 0);

  // Score: combination of oscillation count and magnitude
  const oscillationRate = (transitionCount + entropyOscillations) / Math.max(1, deltas.length);
  const flickerScore = Math.min(100, Math.round(
    oscillationRate * 50 + (maxDelta / 128) * 50,
  ));

  const flickering = flickerScore > FLICKER_THRESHOLD;

  let message = 'No flicker detected';
  if (flickerScore > 70) {
    message = 'Severe flicker — rapid visual oscillation between shots';
  } else if (flickering) {
    message = 'Moderate flicker — some visual inconsistency in shot sequence';
  }

  return { flickerScore, flickering, transitionCount: transitionCount + entropyOscillations, message };
}

// ─── Conditioning Recommendations ───

/**
 * Based on drift analysis, recommend conditioning adjustments
 * to reduce identity drift in subsequent generations.
 */
export function recommendConditioning(drift: DriftResult): {
  adjustments: Record<string, unknown>;
  message: string;
} {
  if (!drift.drifted) {
    return { adjustments: {}, message: 'No adjustments needed' };
  }

  const adjustments: Record<string, unknown> = {};
  const suggestions: string[] = [];

  // High histogram distance → strengthen LoRA
  if (drift.details.histogramDistance > 40) {
    adjustments.loraStrengthMultiplier = 1.3;
    suggestions.push('Increase LoRA strength by 30%');
  }

  // High structural drift → lock seed
  if (drift.details.structuralDrift > 40) {
    adjustments.seedLocked = true;
    suggestions.push('Lock seed for consistency');
  }

  // Brightness shift → adjust CFG
  if (drift.details.brightnessShift > 30) {
    adjustments.cfgBoost = 1.5;
    suggestions.push('Increase CFG scale by 1.5');
  }

  // General drift → reduce denoise
  if (drift.driftScore > DRIFT_CRITICAL) {
    adjustments.denoiseReduction = 0.1;
    suggestions.push('Reduce denoise strength by 0.1');
  }

  return {
    adjustments,
    message: suggestions.join('; ') || 'Apply stronger character conditioning',
  };
}

// ─── Helpers ───

function emptyFingerprint(): ImageFingerprint {
  return {
    colorHistogram: new Float64Array(256),
    quadrantBrightness: [128, 128, 128, 128],
    quadrantEntropy: [0, 0, 0, 0],
    highFreqEnergy: 0,
    avgBrightness: 128,
    stdBrightness: 0,
  };
}

function averageValue(buf: Buffer | Uint8Array): number {
  if (buf.length === 0) return 128;
  const step = Math.max(1, Math.floor(buf.length / 5000));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < buf.length; i += step) {
    sum += buf[i]!;
    count++;
  }
  return sum / count;
}

function stdDevValue(buf: Buffer, mean: number): number {
  if (buf.length === 0) return 0;
  const step = Math.max(1, Math.floor(buf.length / 5000));
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < buf.length; i += step) {
    const diff = buf[i]! - mean;
    sumSq += diff * diff;
    count++;
  }
  return Math.sqrt(sumSq / count);
}

function bufferEntropy(buf: Buffer | Uint8Array): number {
  if (buf.length === 0) return 0;
  const freq = new Uint32Array(256);
  const step = Math.max(1, Math.floor(buf.length / 10000));
  let count = 0;
  for (let i = 0; i < buf.length; i += step) {
    freq[buf[i]!]++;
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
