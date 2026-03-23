import { describe, it, expect } from 'vitest';
import {
  validateAVSync,
  detectGlobalDrift,
  validateDurationEnvelope,
} from '../av-sync-validator.js';
import type { WordTiming, LipSyncData } from '../lip-sync.js';

// ─── Helpers ───

function makeWordTiming(word: string, startMs: number, endMs: number): WordTiming {
  return {
    word,
    startMs,
    endMs,
    visemes: [{ timeMs: startMs, viseme: 'AA', weight: 1.0, durationMs: endMs - startMs }],
  };
}

function makeLipSyncData(words: WordTiming[]): LipSyncData {
  const last = words[words.length - 1];
  return {
    totalDurationMs: last ? last.endMs : 0,
    wordTimings: words,
    visemeTimeline: words.flatMap(w => w.visemes),
    text: words.map(w => w.word).join(' '),
  };
}

// ─── Tests ───

describe('validateAVSync', () => {
  it('passes when audio and video timings are perfectly aligned', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ];
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ]);

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.passed).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('passes with drift below threshold', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ];
    // 10ms drift — well below default 40ms warning threshold even after frame-snap
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 10, 510),
      makeWordTiming('world', 510, 1010),
    ]);

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.passed).toBe(true);
    expect(result.warningCount).toBe(0);
  });

  it('warns when drift is between warning and error thresholds', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ];
    // ~42ms drift — snapped to frame at 24fps (41.67ms frame duration)
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 42, 542),
      makeWordTiming('world', 542, 1042),
    ]);

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.passed).toBe(true);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('fails when drift exceeds max threshold', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ];
    // 100ms drift — exceeds default 80ms error threshold
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 100, 600),
      makeWordTiming('world', 600, 1100),
    ]);

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('returns empty results for empty inputs', () => {
    const result = validateAVSync([], makeLipSyncData([]));
    expect(result.passed).toBe(true);
    expect(result.wordDrifts).toHaveLength(0);
    expect(result.message).toBe('No words to compare');
  });

  it('matches only the minimum shared word count', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
      makeWordTiming('extra', 1000, 1500),
    ];
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ]);

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.wordDrifts).toHaveLength(2);
  });

  it('snaps video timings to frame boundaries', () => {
    const audioTimings = [makeWordTiming('test', 100, 500)];
    // 115ms → snapped to nearest frame at 24fps: 125ms (3 * 41.67)
    const lipSyncData = makeLipSyncData([makeWordTiming('test', 115, 500)]);

    const result = validateAVSync(audioTimings, lipSyncData, { fps: 24 });
    // Drift should be based on snapped video time
    expect(result.wordDrifts[0]!.videoStartMs).not.toBe(115);
  });

  it('respects custom config thresholds', () => {
    const audioTimings = [makeWordTiming('hello', 0, 500)];
    const lipSyncData = makeLipSyncData([makeWordTiming('hello', 50, 550)]);

    // With tight 30ms threshold, 50ms drift should fail
    const result = validateAVSync(audioTimings, lipSyncData, { maxDriftMs: 30 });
    expect(result.passed).toBe(false);
  });

  it('detects drift accumulation pattern', () => {
    // Monotonically increasing drift
    const audioTimings = Array.from({ length: 10 }, (_, i) =>
      makeWordTiming(`word${i}`, i * 200, (i + 1) * 200),
    );
    const lipSyncData = makeLipSyncData(
      Array.from({ length: 10 }, (_, i) =>
        makeWordTiming(`word${i}`, i * 200 + i * 5, (i + 1) * 200 + i * 5),
      ),
    );

    const result = validateAVSync(audioTimings, lipSyncData);
    expect(result.driftAccumulating).toBe(true);
  });
});

describe('detectGlobalDrift', () => {
  it('returns 0 for perfectly aligned timings', () => {
    const audioTimings = [
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ];
    const lipSyncData = makeLipSyncData([
      makeWordTiming('hello', 0, 500),
      makeWordTiming('world', 500, 1000),
    ]);

    expect(detectGlobalDrift(audioTimings, lipSyncData)).toBe(0);
  });

  it('detects systematic positive drift', () => {
    const audioTimings = [
      makeWordTiming('a', 0, 200),
      makeWordTiming('b', 200, 400),
      makeWordTiming('c', 400, 600),
    ];
    const lipSyncData = makeLipSyncData([
      makeWordTiming('a', 50, 250),
      makeWordTiming('b', 250, 450),
      makeWordTiming('c', 450, 650),
    ]);

    expect(detectGlobalDrift(audioTimings, lipSyncData)).toBe(50);
  });

  it('returns 0 for empty inputs', () => {
    expect(detectGlobalDrift([], makeLipSyncData([]))).toBe(0);
  });
});

describe('validateDurationEnvelope', () => {
  it('passes when audio fits within video', () => {
    const result = validateDurationEnvelope(5000, 6000);
    expect(result.fits).toBe(true);
    expect(result.overrunMs).toBeLessThanOrEqual(0);
  });

  it('passes when overrun is within tolerance', () => {
    const result = validateDurationEnvelope(6200, 6000, 500);
    expect(result.fits).toBe(true);
    expect(result.overrunMs).toBe(200);
  });

  it('fails when overrun exceeds tolerance', () => {
    const result = validateDurationEnvelope(7000, 6000, 500);
    expect(result.fits).toBe(false);
    expect(result.overrunMs).toBe(1000);
  });

  it('uses default 500ms tolerance', () => {
    const pass = validateDurationEnvelope(6400, 6000);
    expect(pass.fits).toBe(true);

    const fail = validateDurationEnvelope(6600, 6000);
    expect(fail.fits).toBe(false);
  });
});
