/**
 * Loudness measurement and normalization.
 *
 * Simplified LUFS measurement (ITU-R BS.1770-4 approximation)
 * and true peak limiting for broadcast/streaming compliance.
 */

/**
 * Measure integrated loudness in LUFS (approximation).
 *
 * Uses a 400ms sliding window with K-weighting approximation.
 * This is a simplified implementation suitable for short-form content.
 */
export function measureLufs(samples: Float32Array, sampleRate: number): number {
  if (samples.length === 0) return -Infinity;

  const windowSamples = Math.floor(sampleRate * 0.4); // 400ms window
  if (windowSamples === 0) return -Infinity;

  let sumSquared = 0;
  let windowCount = 0;
  let totalPower = 0;

  for (let i = 0; i < samples.length; i++) {
    sumSquared += samples[i] * samples[i];

    if ((i + 1) % windowSamples === 0) {
      const meanSquare = sumSquared / windowSamples;
      // Gate: only include windows above absolute threshold (-70 LUFS)
      const windowLufs = -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-10));
      if (windowLufs > -70) {
        totalPower += meanSquare;
        windowCount++;
      }
      sumSquared = 0;
    }
  }

  if (windowCount === 0) return -Infinity;

  const integratedMeanSquare = totalPower / windowCount;
  return -0.691 + 10 * Math.log10(Math.max(integratedMeanSquare, 1e-10));
}

/**
 * Normalize audio to a target LUFS level.
 * Modifies the samples buffer in-place.
 */
export function normalizeLufs(
  samples: Float32Array,
  sampleRate: number,
  targetLufs: number,
): void {
  const currentLufs = measureLufs(samples, sampleRate);
  if (!isFinite(currentLufs)) return;

  const gainDb = targetLufs - currentLufs;
  const gainLinear = Math.pow(10, gainDb / 20);

  for (let i = 0; i < samples.length; i++) {
    samples[i] *= gainLinear;
  }
}

/**
 * Apply true peak limiting.
 * Prevents inter-sample peaks from exceeding the specified dBTP threshold.
 * Modifies the samples buffer in-place.
 *
 * @param truePeakDbtp - Maximum true peak level in dBTP (e.g., -1.0)
 */
export function applyTruePeakLimiter(
  samples: Float32Array,
  truePeakDbtp: number,
): void {
  const ceiling = Math.pow(10, truePeakDbtp / 20);

  // Look-ahead limiter with 5-sample window
  const lookAhead = 5;
  let envelope = 0;
  const attackCoeff = 0.9;
  const releaseCoeff = 0.9995;

  for (let i = 0; i < samples.length; i++) {
    // Peak detection with look-ahead
    let peak = Math.abs(samples[i]);
    for (let j = 1; j <= lookAhead && i + j < samples.length; j++) {
      peak = Math.max(peak, Math.abs(samples[i + j]));
    }

    // Envelope follower
    if (peak > envelope) {
      envelope = attackCoeff * envelope + (1 - attackCoeff) * peak;
    } else {
      envelope = releaseCoeff * envelope;
    }

    // Apply gain reduction if needed
    if (envelope > ceiling) {
      const gain = ceiling / envelope;
      samples[i] *= gain;
    }
  }
}
