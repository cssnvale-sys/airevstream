/**
 * Lip-Sync Pipeline Module
 *
 * Provides viseme mapping, word timing estimation, and lip-sync data
 * generation for synchronizing character mouth animations with dialogue.
 *
 * Viseme set uses the standard 15-viseme system (Preston Blair style):
 *   IDLE, PP, FF, TH, DD, KK, CH, SS, NN, RR, AA, EE, IH, OH, OO
 */

// ─── Viseme Types ───

/** Standard 15-viseme set for mouth shape animation */
export type Viseme =
  | 'IDLE'  // Neutral/closed mouth
  | 'PP'    // B, M, P — lips pressed
  | 'FF'    // F, V — bottom lip under top teeth
  | 'TH'    // Th — tongue between teeth
  | 'DD'    // D, T, N, L — tongue behind upper teeth
  | 'KK'    // K, G, Ng — back of tongue up
  | 'CH'    // Ch, J, Sh — teeth together, lips rounded
  | 'SS'    // S, Z — teeth together, lips spread
  | 'NN'    // N, Ng (nasal) — mouth slightly open
  | 'RR'    // R — lips slightly rounded
  | 'AA'    // A, I (open) — wide open mouth
  | 'EE'    // E, I (closed) — wide lips, narrow opening
  | 'IH'    // I (short) — slightly open, relaxed
  | 'OH'    // O — rounded lips, medium open
  | 'OO';   // U, W — tight rounded lips

/** A single viseme keyframe */
export interface VisemeKeyframe {
  /** Time offset from audio start in milliseconds */
  timeMs: number;
  /** Viseme shape to display */
  viseme: Viseme;
  /** Blend weight (0-1) for smooth transitions */
  weight: number;
  /** Duration this viseme holds in milliseconds */
  durationMs: number;
}

/** Word-level timing data */
export interface WordTiming {
  /** The word text */
  word: string;
  /** Start time in milliseconds from audio start */
  startMs: number;
  /** End time in milliseconds */
  endMs: number;
  /** Visemes for this word */
  visemes: VisemeKeyframe[];
}

/** Complete lip-sync data for an audio segment */
export interface LipSyncData {
  /** Total duration of the audio in milliseconds */
  totalDurationMs: number;
  /** Word-by-word timing */
  wordTimings: WordTiming[];
  /** Flattened viseme timeline for rendering */
  visemeTimeline: VisemeKeyframe[];
  /** Source text */
  text: string;
}

/** Lip-sync configuration in ShotSpec */
export interface LipSyncSpec {
  /** Enable lip-sync for this shot */
  enabled: boolean;
  /** Viseme rendering mode */
  mode: 'subtitle-only' | 'character-rig' | 'overlay';
  /** Smoothing amount for viseme transitions (0-1) */
  smoothing?: number;
  /** Exaggeration factor for mouth shapes (0.5-2.0) */
  exaggeration?: number;
  /** Character ID for multi-character scenes */
  characterId?: string;
}

// ─── Phoneme → Viseme Mapping ───

/** Map English phonemes/letters to visemes */
const PHONEME_VISEME_MAP: Record<string, Viseme> = {
  // Bilabials
  b: 'PP', m: 'PP', p: 'PP',
  // Labiodentals
  f: 'FF', v: 'FF',
  // Dentals
  th: 'TH',
  // Alveolars
  d: 'DD', t: 'DD', l: 'DD', n: 'DD',
  // Velars
  k: 'KK', g: 'KK', ng: 'KK',
  // Post-alveolars
  ch: 'CH', j: 'CH', sh: 'CH', zh: 'CH',
  // Sibilants
  s: 'SS', z: 'SS',
  // Approximants
  r: 'RR', w: 'OO', y: 'EE',
  // Glottal
  h: 'IH',
  // Vowels
  a: 'AA', ah: 'AA', aw: 'AA',
  e: 'EE', ee: 'EE', ay: 'EE',
  i: 'IH', ih: 'IH',
  o: 'OH', ow: 'OH',
  u: 'OO', oo: 'OO',
};

/**
 * Map a single character/digraph to a viseme.
 */
function charToViseme(char: string): Viseme {
  const lower = char.toLowerCase();
  return PHONEME_VISEME_MAP[lower] ?? 'IH';
}

/**
 * Extract visemes from a word using letter-based approximation.
 * For production, this should be replaced with actual phoneme data from TTS.
 */
export function wordToVisemes(word: string): Viseme[] {
  const visemes: Viseme[] = [];
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');

  let i = 0;
  while (i < lower.length) {
    // Check for digraphs first
    if (i + 1 < lower.length) {
      const digraph = lower.slice(i, i + 2);
      if (PHONEME_VISEME_MAP[digraph]) {
        visemes.push(PHONEME_VISEME_MAP[digraph]!);
        i += 2;
        continue;
      }
    }
    visemes.push(charToViseme(lower[i]!));
    i++;
  }

  return visemes.length > 0 ? visemes : ['IDLE'];
}

// ─── Lip-Sync Data Generation ───

/**
 * Generate lip-sync data from text using word-level timing estimation.
 *
 * Uses a simple model: ~150 words/minute at 1x speed.
 * Each word's visemes are distributed evenly across the word's duration.
 * Adds IDLE frames between words for natural pauses.
 */
export function generateLipSyncData(
  text: string,
  durationMs?: number,
  speed = 1.0,
): LipSyncData {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return {
      totalDurationMs: 0,
      wordTimings: [],
      visemeTimeline: [{ timeMs: 0, viseme: 'IDLE', weight: 1, durationMs: 0 }],
      text,
    };
  }

  // Estimate total duration if not provided
  const totalDurationMs = durationMs ?? Math.round((words.length / 150) * 60000 * (1 / speed));

  // Average time per word (with pauses)
  const wordDurationMs = totalDurationMs / words.length;
  const speakRatio = 0.75; // 75% speaking, 25% pause
  const speakMs = wordDurationMs * speakRatio;
  const pauseMs = wordDurationMs * (1 - speakRatio);

  const wordTimings: WordTiming[] = [];
  const visemeTimeline: VisemeKeyframe[] = [];
  let currentMs = 0;

  for (const word of words) {
    const visemes = wordToVisemes(word);
    const visemeDuration = speakMs / Math.max(1, visemes.length);
    const wordStart = currentMs;

    const wordVisemes: VisemeKeyframe[] = visemes.map((viseme, vi) => {
      const kf: VisemeKeyframe = {
        timeMs: Math.round(currentMs + vi * visemeDuration),
        viseme,
        weight: 1.0,
        durationMs: Math.round(visemeDuration),
      };
      return kf;
    });

    wordTimings.push({
      word,
      startMs: Math.round(wordStart),
      endMs: Math.round(wordStart + speakMs),
      visemes: wordVisemes,
    });

    visemeTimeline.push(...wordVisemes);

    // Add pause between words
    currentMs += speakMs;
    if (pauseMs > 20) { // Only add pause if meaningful
      visemeTimeline.push({
        timeMs: Math.round(currentMs),
        viseme: 'IDLE',
        weight: 0.5,
        durationMs: Math.round(pauseMs),
      });
    }
    currentMs += pauseMs;
  }

  // End with IDLE
  visemeTimeline.push({
    timeMs: Math.round(currentMs),
    viseme: 'IDLE',
    weight: 1.0,
    durationMs: 0,
  });

  return { totalDurationMs, wordTimings, visemeTimeline, text };
}

/**
 * Get the active viseme at a given time offset.
 */
export function getVisemeAtTime(
  timeline: VisemeKeyframe[],
  timeMs: number,
): VisemeKeyframe {
  // Binary search would be more efficient for large timelines
  let best = timeline[0] ?? { timeMs: 0, viseme: 'IDLE' as Viseme, weight: 1, durationMs: 0 };
  for (const kf of timeline) {
    if (kf.timeMs <= timeMs) {
      best = kf;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Convert viseme timeline to frame-indexed array for Remotion.
 */
export function visemeTimelineToFrames(
  timeline: VisemeKeyframe[],
  fps: number,
  totalFrames: number,
): Array<{ frame: number; viseme: Viseme; weight: number }> {
  const frames: Array<{ frame: number; viseme: Viseme; weight: number }> = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    const timeMs = (frame / fps) * 1000;
    const kf = getVisemeAtTime(timeline, timeMs);
    frames.push({ frame, viseme: kf.viseme, weight: kf.weight });
  }

  return frames;
}
