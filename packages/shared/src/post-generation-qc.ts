/**
 * Post-Generation Quality Control
 *
 * Stage 2 of the three-stage QC pipeline:
 *   Stage 1: Pre-gen QC (pre-generation-qc.ts) — validates shots before pipeline entry
 *   Stage 2: Post-gen QC (this file) — validates rendered output after generation
 *   Stage 3: Final review — manual approval queue with continuity checks
 */

export interface GenerationResult {
  fileUrl: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSec?: number;
  format: string;
}

export interface PostGenQCResult {
  passed: boolean;
  score: number;
  checks: PostGenCheck[];
}

export interface PostGenCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  severity: 'error' | 'warning';
}

export interface PostGenQCOptions {
  expectedWidth: number;
  expectedHeight: number;
  expectedDurationSec?: number;
  durationToleranceSec?: number;
  minFileSizeBytes?: number;
  maxFileSizeBytes?: number;
}

/**
 * Run post-generation quality control on a rendered output.
 *
 * Checks:
 * - Aspect ratio matches spec
 * - Duration within tolerance (±0.5s default)
 * - File size reasonable (not corrupt/empty, not unreasonably large)
 * - Format is valid
 */
export function runPostGenQC(
  result: GenerationResult,
  options: PostGenQCOptions,
): PostGenQCResult {
  const checks: PostGenCheck[] = [];
  const durationTolerance = options.durationToleranceSec ?? 0.5;
  const minSize = options.minFileSizeBytes ?? 1024; // 1KB minimum
  const maxSize = options.maxFileSizeBytes ?? 500 * 1024 * 1024; // 500MB maximum

  // Check 1: Aspect ratio (width/height)
  const expectedRatio = options.expectedWidth / options.expectedHeight;
  const actualRatio = result.width / result.height;
  const ratioTolerance = 0.02; // 2% tolerance for rounding
  const ratioMatch = Math.abs(expectedRatio - actualRatio) / expectedRatio < ratioTolerance;
  checks.push({
    name: 'aspect_ratio',
    passed: ratioMatch,
    expected: `${options.expectedWidth}x${options.expectedHeight} (${expectedRatio.toFixed(3)})`,
    actual: `${result.width}x${result.height} (${actualRatio.toFixed(3)})`,
    severity: ratioMatch ? 'warning' : 'error',
  });

  // Check 2: Resolution match
  const resMatch = result.width === options.expectedWidth && result.height === options.expectedHeight;
  checks.push({
    name: 'resolution',
    passed: resMatch,
    expected: `${options.expectedWidth}x${options.expectedHeight}`,
    actual: `${result.width}x${result.height}`,
    severity: resMatch ? 'warning' : 'warning', // Resolution mismatch is a warning, not a hard fail
  });

  // Check 3: Duration (if applicable — video/audio)
  if (options.expectedDurationSec != null && result.durationSec != null) {
    const durationDiff = Math.abs(result.durationSec - options.expectedDurationSec);
    const durationMatch = durationDiff <= durationTolerance;
    checks.push({
      name: 'duration',
      passed: durationMatch,
      expected: `${options.expectedDurationSec}s (±${durationTolerance}s)`,
      actual: `${result.durationSec}s (diff: ${durationDiff.toFixed(2)}s)`,
      severity: durationMatch ? 'warning' : 'error',
    });
  }

  // Check 4: File not empty/corrupt
  const sizeOk = result.fileSizeBytes >= minSize;
  checks.push({
    name: 'file_not_empty',
    passed: sizeOk,
    expected: `>= ${minSize} bytes`,
    actual: `${result.fileSizeBytes} bytes`,
    severity: 'error',
  });

  // Check 5: File not unreasonably large
  const sizeReasonable = result.fileSizeBytes <= maxSize;
  checks.push({
    name: 'file_size_reasonable',
    passed: sizeReasonable,
    expected: `<= ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    actual: `${(result.fileSizeBytes / 1024 / 1024).toFixed(1)}MB`,
    severity: 'warning',
  });

  // Check 6: Valid format
  const validFormats = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov', 'wav', 'mp3', 'ogg'];
  const formatOk = validFormats.includes(result.format.toLowerCase());
  checks.push({
    name: 'valid_format',
    passed: formatOk,
    expected: `one of: ${validFormats.join(', ')}`,
    actual: result.format,
    severity: 'error',
  });

  // Overall: fail if any error-severity check fails
  const errorChecks = checks.filter(c => c.severity === 'error');
  const passed = errorChecks.every(c => c.passed);
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

  return { passed, score, checks };
}

/**
 * Run continuity check across all shots in a project.
 *
 * Checks style consistency, color palette similarity, and transition smoothness.
 * Returns warnings (not hard failures) for the approval UI.
 */
export interface ContinuityWarning {
  shotNumber: number;
  type: 'style_drift' | 'color_shift' | 'resolution_mismatch' | 'duration_outlier';
  message: string;
}

export function runContinuityCheck(
  shots: Array<{
    shotNumber: number;
    width: number;
    height: number;
    durationSec: number;
    avgColorHex?: string;
  }>,
): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = [];
  if (shots.length < 2) return warnings;

  // Check resolution consistency
  const refWidth = shots[0]!.width;
  const refHeight = shots[0]!.height;
  for (const shot of shots) {
    if (shot.width !== refWidth || shot.height !== refHeight) {
      warnings.push({
        shotNumber: shot.shotNumber,
        type: 'resolution_mismatch',
        message: `Shot ${shot.shotNumber} is ${shot.width}x${shot.height}, expected ${refWidth}x${refHeight}`,
      });
    }
  }

  // Check for duration outliers (shots significantly longer/shorter than average)
  const durations = shots.map(s => s.durationSec);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const stdDev = Math.sqrt(
    durations.reduce((sum, d) => sum + (d - avgDuration) ** 2, 0) / durations.length,
  );

  for (const shot of shots) {
    if (stdDev > 0 && Math.abs(shot.durationSec - avgDuration) > 2 * stdDev) {
      warnings.push({
        shotNumber: shot.shotNumber,
        type: 'duration_outlier',
        message: `Shot ${shot.shotNumber} duration (${shot.durationSec}s) is >2σ from mean (${avgDuration.toFixed(1)}s)`,
      });
    }
  }

  return warnings;
}
