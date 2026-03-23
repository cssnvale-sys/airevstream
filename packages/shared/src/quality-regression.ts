/**
 * Quality Regression Testing (Stub)
 *
 * Automated quality regression testing using VMAF/SSIM metrics.
 * Compares rendered outputs against reference frames to catch
 * quality degradation from pipeline changes.
 */

export interface QualityRegressionTest {
  /** Test name */
  name: string;
  /** Reference media path */
  referencePath: string;
  /** Test media path */
  testPath: string;
  /** Metrics to compute */
  metrics: Array<'vmaf' | 'ssim' | 'psnr' | 'lpips'>;
  /** Minimum acceptable score per metric (0-100) */
  thresholds: Partial<Record<'vmaf' | 'ssim' | 'psnr' | 'lpips', number>>;
}

export interface RegressionResult {
  /** Test name */
  testName: string;
  /** Whether all metrics passed thresholds */
  passed: boolean;
  /** Per-metric scores */
  scores: Record<string, number>;
  /** Per-metric pass/fail */
  details: Array<{
    metric: string;
    score: number;
    threshold: number;
    passed: boolean;
  }>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Run quality regression tests comparing test outputs to reference frames.
 * @internal Not implemented. Requires external deps. See D064 & KI-061.
 * @throws Error — requires VMAF/SSIM tooling (ffmpeg with libvmaf)
 */
export function runQualityRegression(_tests: QualityRegressionTest[]): Promise<RegressionResult[]> {
  throw new Error('Not implemented — requires VMAF/SSIM tooling (ffmpeg with libvmaf). See OPERATOR-TODO.md.');
}
