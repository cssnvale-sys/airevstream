import { describe, it, expect, vi } from 'vitest';
import {
  isVMAFAvailable,
  compareVMAF,
  runQualityRegression,
} from '../quality-regression.js';
import type { ExecFn, QualityRegressionTest } from '../quality-regression.js';

// ─── Mock execFn ───

function createMockExec(overrides?: {
  filtersOutput?: string;
  vmafLogContent?: string;
  shouldFail?: boolean;
}): ExecFn {
  return async (cmd: string, args: string[]) => {
    if (overrides?.shouldFail) {
      throw new Error('Command failed');
    }

    // Handle `ffmpeg -filters` check
    if (args.includes('-filters')) {
      return {
        stdout: overrides?.filtersOutput ?? '  T.. libvmaf            Calculate the VMAF between two video streams.',
        stderr: '',
      };
    }

    // Handle VMAF comparison — write mock JSON log
    const logPathArg = args.find(a => a.includes('log_path='));
    if (logPathArg) {
      const logPath = logPathArg.split('log_path=')[1]?.split(':')[0] ?? '';
      if (logPath) {
        const { writeFile } = await import('node:fs/promises');
        const logContent = overrides?.vmafLogContent ?? JSON.stringify({
          pooled_metrics: {
            vmaf: { min: 80, max: 95, mean: 87.5, harmonic_mean: 86.2 },
            float_ssim: { min: 0.92, max: 0.99, mean: 0.965, harmonic_mean: 0.96 },
            psnr: { min: 30, max: 45, mean: 38.2, harmonic_mean: 37.5 },
          },
        });
        await writeFile(logPath, logContent, 'utf-8');
      }
    }

    return { stdout: '', stderr: '' };
  };
}

// ─── Tests ───

describe('isVMAFAvailable', () => {
  it('returns true when ffmpeg has libvmaf', async () => {
    const exec = createMockExec();
    expect(await isVMAFAvailable(exec)).toBe(true);
  });

  it('returns false when ffmpeg lacks libvmaf', async () => {
    const exec = createMockExec({ filtersOutput: 'some other filters' });
    expect(await isVMAFAvailable(exec)).toBe(false);
  });

  it('returns false when ffmpeg is not installed', async () => {
    const exec = createMockExec({ shouldFail: true });
    expect(await isVMAFAvailable(exec)).toBe(false);
  });
});

describe('compareVMAF', () => {
  it('parses VMAF, SSIM, and PSNR from ffmpeg log', async () => {
    const exec = createMockExec();

    const result = await compareVMAF(
      { distortedPath: '/tmp/test.mp4', referencePath: '/tmp/ref.mp4' },
      exec,
    );

    expect(result.vmaf).toBe(87.5);
    expect(result.ssim).toBe(96.5); // 0.965 * 100
    expect(result.psnr).toBe(38.2);
    expect(result.rawLog).toBeDefined();
  });

  it('handles missing metrics gracefully', async () => {
    const exec = createMockExec({
      vmafLogContent: JSON.stringify({
        pooled_metrics: {
          vmaf: { mean: 75 },
        },
      }),
    });

    const result = await compareVMAF(
      { distortedPath: '/tmp/test.mp4', referencePath: '/tmp/ref.mp4' },
      exec,
    );

    expect(result.vmaf).toBe(75);
    expect(result.ssim).toBe(0);
    expect(result.psnr).toBe(0);
  });
});

describe('runQualityRegression', () => {
  it('passes when all metrics exceed thresholds', async () => {
    const exec = createMockExec();

    const tests: QualityRegressionTest[] = [{
      name: 'baseline-quality',
      referencePath: '/tmp/ref.mp4',
      testPath: '/tmp/test.mp4',
      metrics: ['vmaf', 'ssim'],
      thresholds: { vmaf: 80, ssim: 90 },
    }];

    const results = await runQualityRegression(tests, exec);
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
    expect(results[0]!.details).toHaveLength(2);
  });

  it('fails when a metric is below threshold', async () => {
    const exec = createMockExec();

    const tests: QualityRegressionTest[] = [{
      name: 'strict-quality',
      referencePath: '/tmp/ref.mp4',
      testPath: '/tmp/test.mp4',
      metrics: ['vmaf'],
      thresholds: { vmaf: 95 }, // 87.5 < 95
    }];

    const results = await runQualityRegression(tests, exec);
    expect(results[0]!.passed).toBe(false);
    expect(results[0]!.details[0]!.passed).toBe(false);
  });

  it('throws when VMAF is not available', async () => {
    const exec = createMockExec({ filtersOutput: 'no vmaf here' });

    await expect(runQualityRegression([], exec)).rejects.toThrow('libvmaf not available');
  });

  it('runs multiple tests', async () => {
    const exec = createMockExec();

    const tests: QualityRegressionTest[] = [
      {
        name: 'test-1',
        referencePath: '/tmp/ref.mp4',
        testPath: '/tmp/test1.mp4',
        metrics: ['vmaf'],
        thresholds: { vmaf: 80 },
      },
      {
        name: 'test-2',
        referencePath: '/tmp/ref.mp4',
        testPath: '/tmp/test2.mp4',
        metrics: ['psnr'],
        thresholds: { psnr: 30 },
      },
    ];

    const results = await runQualityRegression(tests, exec);
    expect(results).toHaveLength(2);
    expect(results[0]!.testName).toBe('test-1');
    expect(results[1]!.testName).toBe('test-2');
  });
});
