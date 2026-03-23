/**
 * Audio-Video Sync Validator
 *
 * Validates that TTS word timings align with viseme keyframe positions
 * within acceptable drift tolerances. Detects systematic drift accumulation
 * and duration envelope mismatches.
 */

import type { WordTiming, LipSyncData } from './lip-sync.js';

// ─── Types ───

export interface AVSyncConfig {
  /** Maximum acceptable per-word drift in ms (default 80 = ~2 frames at 24fps) */
  maxDriftMs?: number;
  /** Warning threshold in ms (default 40 = ~1 frame at 24fps) */
  warningDriftMs?: number;
  /** Video frame rate for snap-to-frame alignment (default 24) */
  fps?: number;
  /** Duration envelope tolerance in ms (default 500) */
  durationToleranceMs?: number;
}

export type DriftSeverity = 'ok' | 'warning' | 'error';

export interface WordDriftResult {
  /** Word index */
  index: number;
  /** Word text */
  word: string;
  /** Audio start time in ms */
  audioStartMs: number;
  /** Video (viseme) start time in ms, snapped to frame boundary */
  videoStartMs: number;
  /** Drift in ms (positive = video leads audio, negative = video lags audio) */
  driftMs: number;
  /** Severity classification */
  severity: DriftSeverity;
}

export interface AVSyncCheckResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Per-word drift results */
  wordDrifts: WordDriftResult[];
  /** Number of words with error-level drift */
  errorCount: number;
  /** Number of words with warning-level drift */
  warningCount: number;
  /** Maximum absolute drift across all words in ms */
  maxDriftMs: number;
  /** Average absolute drift in ms */
  avgDriftMs: number;
  /** Global drift estimate (systematic offset) in ms */
  globalDriftMs: number;
  /** Whether drift is accumulating monotonically */
  driftAccumulating: boolean;
  /** Human-readable summary */
  message: string;
}

export interface DurationEnvelopeResult {
  /** Whether video duration fits audio duration within tolerance */
  fits: boolean;
  /** How much audio overruns video (positive = audio too long) in ms */
  overrunMs: number;
  /** Human-readable message */
  message: string;
}

// ─── Constants ───

const DEFAULT_MAX_DRIFT_MS = 80;
const DEFAULT_WARNING_DRIFT_MS = 40;
const DEFAULT_FPS = 24;
const DEFAULT_DURATION_TOLERANCE_MS = 500;

// ─── Core Functions ───

/**
 * Snap a time value to the nearest video frame boundary.
 */
function snapToFrame(ms: number, fps: number): number {
  const frameDurationMs = 1000 / fps;
  return Math.round(ms / frameDurationMs) * frameDurationMs;
}

/**
 * Validate audio-video sync between TTS word timings and lip-sync viseme data.
 *
 * Matches audio words to lip-sync words by index (1:1 correspondence).
 * Snaps video timing to frame boundaries, measures per-word drift,
 * and detects monotonically increasing drift (accumulation pattern).
 */
export function validateAVSync(
  audioTimings: WordTiming[],
  lipSyncData: LipSyncData,
  config?: AVSyncConfig,
): AVSyncCheckResult {
  const maxDrift = config?.maxDriftMs ?? DEFAULT_MAX_DRIFT_MS;
  const warningDrift = config?.warningDriftMs ?? DEFAULT_WARNING_DRIFT_MS;
  const fps = config?.fps ?? DEFAULT_FPS;

  const videoTimings = lipSyncData.wordTimings;
  const matchCount = Math.min(audioTimings.length, videoTimings.length);

  if (matchCount === 0) {
    return {
      passed: true,
      wordDrifts: [],
      errorCount: 0,
      warningCount: 0,
      maxDriftMs: 0,
      avgDriftMs: 0,
      globalDriftMs: 0,
      driftAccumulating: false,
      message: 'No words to compare',
    };
  }

  const wordDrifts: WordDriftResult[] = [];

  for (let i = 0; i < matchCount; i++) {
    const audio = audioTimings[i]!;
    const video = videoTimings[i]!;

    const videoSnapped = snapToFrame(video.startMs, fps);
    const driftMs = videoSnapped - audio.startMs;
    const absDrift = Math.abs(driftMs);

    let severity: DriftSeverity = 'ok';
    if (absDrift >= maxDrift) severity = 'error';
    else if (absDrift >= warningDrift) severity = 'warning';

    wordDrifts.push({
      index: i,
      word: audio.word,
      audioStartMs: audio.startMs,
      videoStartMs: videoSnapped,
      driftMs,
      severity,
    });
  }

  const errorCount = wordDrifts.filter(d => d.severity === 'error').length;
  const warningCount = wordDrifts.filter(d => d.severity === 'warning').length;
  const absValues = wordDrifts.map(d => Math.abs(d.driftMs));
  const maxDriftMs = Math.max(...absValues, 0);
  const avgDriftMs = absValues.length > 0
    ? absValues.reduce((a, b) => a + b, 0) / absValues.length
    : 0;

  const globalDriftMs = detectGlobalDrift(audioTimings, lipSyncData);
  const driftAccumulating = isDriftAccumulating(wordDrifts);

  const passed = errorCount === 0;
  let message = passed
    ? `AV sync OK: ${matchCount} words, max drift ${maxDriftMs.toFixed(1)}ms`
    : `AV sync FAILED: ${errorCount} words exceed ${maxDrift}ms drift threshold`;

  if (driftAccumulating) {
    message += ' (drift accumulating — possible systematic offset)';
  }

  return {
    passed,
    wordDrifts,
    errorCount,
    warningCount,
    maxDriftMs,
    avgDriftMs: Math.round(avgDriftMs * 10) / 10,
    globalDriftMs,
    driftAccumulating,
    message,
  };
}

/**
 * Detect global (systematic) drift between audio and video timings.
 * Returns the median drift in ms. Positive = video leads, negative = video lags.
 */
export function detectGlobalDrift(
  audioTimings: WordTiming[],
  lipSyncData: LipSyncData,
): number {
  const videoTimings = lipSyncData.wordTimings;
  const matchCount = Math.min(audioTimings.length, videoTimings.length);

  if (matchCount === 0) return 0;

  const drifts: number[] = [];
  for (let i = 0; i < matchCount; i++) {
    drifts.push(videoTimings[i]!.startMs - audioTimings[i]!.startMs);
  }

  // Use median for robustness against outliers
  drifts.sort((a, b) => a - b);
  const mid = Math.floor(drifts.length / 2);
  const median = drifts.length % 2 === 0
    ? (drifts[mid - 1]! + drifts[mid]!) / 2
    : drifts[mid]!;

  return Math.round(median * 10) / 10;
}

/**
 * Validate that audio and video durations are compatible within tolerance.
 */
export function validateDurationEnvelope(
  audioDurationMs: number,
  videoDurationMs: number,
  toleranceMs?: number,
): DurationEnvelopeResult {
  const tolerance = toleranceMs ?? DEFAULT_DURATION_TOLERANCE_MS;
  const overrunMs = audioDurationMs - videoDurationMs;
  const fits = overrunMs <= tolerance;

  let message: string;
  if (overrunMs <= 0) {
    message = `Audio (${audioDurationMs}ms) fits within video (${videoDurationMs}ms)`;
  } else if (fits) {
    message = `Audio overruns video by ${overrunMs}ms (within ${tolerance}ms tolerance)`;
  } else {
    message = `Audio overruns video by ${overrunMs}ms (exceeds ${tolerance}ms tolerance)`;
  }

  return { fits, overrunMs, message };
}

// ─── Internal Helpers ───

/**
 * Check if drift is monotonically increasing (accumulation pattern).
 * Returns true if 75%+ of consecutive drift changes go the same direction.
 */
function isDriftAccumulating(drifts: WordDriftResult[]): boolean {
  if (drifts.length < 4) return false;

  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < drifts.length; i++) {
    const delta = drifts[i]!.driftMs - drifts[i - 1]!.driftMs;
    if (delta > 0) increasing++;
    else if (delta < 0) decreasing++;
  }

  const total = increasing + decreasing;
  if (total === 0) return false;

  const dominant = Math.max(increasing, decreasing);
  return dominant / total >= 0.75;
}
