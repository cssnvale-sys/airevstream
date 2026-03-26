/**
 * Quality Regression Testing — VMAF/SSIM/PSNR via ffmpeg
 *
 * Automated quality regression testing using ffmpeg with libvmaf.
 * Compares rendered outputs against reference frames to catch
 * quality degradation from pipeline changes.
 *
 * Uses injectable `execFn` for testability (same pattern as Remotion CLI calls).
 */

// Node imports are dynamic to avoid webpack issues in Next.js client bundle

// ─── Types ───

export interface QualityRegressionTest {
  /** Test name */
  name: string;
  /** Reference media path */
  referencePath: string;
  /** Test media path */
  testPath: string;
  /** Metrics to compute */
  metrics: Array<'vmaf' | 'ssim' | 'psnr'>;
  /** Minimum acceptable score per metric (0-100) */
  thresholds: Partial<Record<'vmaf' | 'ssim' | 'psnr', number>>;
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

export interface VMAFCompareOptions {
  /** Path to the distorted (test) video */
  distortedPath: string;
  /** Path to the reference video */
  referencePath: string;
  /** VMAF model version (default: vmaf_v0.6.1) */
  model?: string;
}

export interface VMAFCompareResult {
  /** VMAF mean score (0-100) */
  vmaf: number;
  /** SSIM mean score (0-1, scaled to 0-100 for consistency) */
  ssim: number;
  /** PSNR mean score (dB, higher = better) */
  psnr: number;
  /** Raw JSON log from ffmpeg */
  rawLog?: Record<string, unknown>;
}

/** Exec function signature for dependency injection */
export type ExecFn = (
  cmd: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

// ─── Default Exec ───

let defaultExecFn: ExecFn | undefined;

async function getDefaultExecFn(): Promise<ExecFn> {
  if (!defaultExecFn) {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    defaultExecFn = (cmd: string, args: string[]) =>
      execFileAsync(cmd, args, { timeout: 300_000 });
  }
  return defaultExecFn;
}

// ─── VMAF Availability Check ───

/**
 * Check if ffmpeg with libvmaf support is available.
 */
export async function isVMAFAvailable(execFn?: ExecFn): Promise<boolean> {
  const exec = execFn ?? await getDefaultExecFn();
  try {
    const { stdout } = await exec('ffmpeg', ['-filters']);
    return stdout.includes('libvmaf');
  } catch (err) {
    console.warn('[VMAF] ffmpeg with libvmaf not available:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

// ─── VMAF Comparison ───

/**
 * Compare two video files using ffmpeg's libvmaf filter.
 * Returns VMAF, SSIM, and PSNR scores.
 */
export async function compareVMAF(
  options: VMAFCompareOptions,
  execFn?: ExecFn,
): Promise<VMAFCompareResult> {
  const exec = execFn ?? await getDefaultExecFn();
  const model = options.model ?? 'vmaf_v0.6.1';
  const { randomUUID } = await import('node:crypto');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const logPath = join(tmpdir(), `vmaf-${randomUUID()}.json`);

  try {
    // Run ffmpeg with libvmaf filter
    await exec('ffmpeg', [
      '-i', options.distortedPath,
      '-i', options.referencePath,
      '-lavfi',
      `libvmaf=model=version=${model}:log_fmt=json:log_path=${logPath}:feature=name=float_ssim:feature=name=psnr`,
      '-f', 'null',
      '-',
    ]);

    // Parse the JSON log
    const { readFile } = await import('node:fs/promises');
    const logContent = await readFile(logPath, 'utf-8');
    const logData = JSON.parse(logContent) as Record<string, unknown>;

    const pooledMetrics = logData.pooled_metrics as Record<string, Record<string, number>> | undefined;

    const vmaf = pooledMetrics?.vmaf?.mean ?? 0;
    const ssim = pooledMetrics?.float_ssim?.mean ?? 0;
    const psnr = pooledMetrics?.psnr?.mean ?? 0;

    return {
      vmaf,
      ssim: ssim * 100, // Scale 0-1 to 0-100
      psnr,
      rawLog: logData,
    };
  } finally {
    // Clean up temp log file
    const { unlink } = await import('node:fs/promises');
    await unlink(logPath).catch(() => {});
  }
}

// ─── Quality Regression Runner ───

/**
 * Run quality regression tests comparing test outputs to reference frames.
 * Each test specifies which metrics to compute and minimum thresholds.
 *
 * Requires ffmpeg with libvmaf support. See OPERATOR-TODO.md.
 */
export async function runQualityRegression(
  tests: QualityRegressionTest[],
  execFn?: ExecFn,
): Promise<RegressionResult[]> {
  const available = await isVMAFAvailable(execFn);
  if (!available) {
    throw new Error(
      'ffmpeg with libvmaf not available. Install ffmpeg with --enable-libvmaf. See OPERATOR-TODO.md.',
    );
  }

  const results: RegressionResult[] = [];

  for (const test of tests) {
    const compareResult = await compareVMAF(
      {
        distortedPath: test.testPath,
        referencePath: test.referencePath,
      },
      execFn,
    );

    const details: RegressionResult['details'] = [];
    let allPassed = true;

    for (const metric of test.metrics) {
      const score = metric === 'vmaf'
        ? compareResult.vmaf
        : metric === 'ssim'
          ? compareResult.ssim
          : compareResult.psnr;

      const threshold = test.thresholds[metric] ?? 0;
      const passed = score >= threshold;

      if (!passed) allPassed = false;

      details.push({ metric, score, threshold, passed });
    }

    results.push({
      testName: test.name,
      passed: allPassed,
      scores: {
        vmaf: compareResult.vmaf,
        ssim: compareResult.ssim,
        psnr: compareResult.psnr,
      },
      details,
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}
