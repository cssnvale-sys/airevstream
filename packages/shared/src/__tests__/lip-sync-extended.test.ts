import { describe, it, expect } from 'vitest';
import {
  generateVisemeTrackFromPhonemes,
  wordToVisemes,
  generateLipSyncData,
  getVisemeAtTime,
  visemeTimelineToFrames,
} from '../lip-sync.js';
import type { PhonemeTimestamp } from '../lip-sync.js';

describe('generateVisemeTrackFromPhonemes', () => {
  it('should map CMU phonemes to visemes', () => {
    const timestamps: PhonemeTimestamp[] = [
      { phoneme: 'HH', startMs: 0, endMs: 50 },
      { phoneme: 'AH', startMs: 50, endMs: 100 },
      { phoneme: 'L', startMs: 100, endMs: 150 },
      { phoneme: 'OW', startMs: 150, endMs: 250 },
    ];
    const track = generateVisemeTrackFromPhonemes(timestamps);
    expect(track.length).toBe(5); // 4 phonemes + trailing IDLE
    expect(track[0]!.viseme).toBe('IH'); // HH -> IH
    expect(track[1]!.viseme).toBe('AA'); // AH -> AA
    expect(track[2]!.viseme).toBe('DD'); // L -> DD
    expect(track[3]!.viseme).toBe('OH'); // OW -> OH
    expect(track[4]!.viseme).toBe('IDLE'); // trailing
  });

  it('should strip stress markers from phonemes', () => {
    const timestamps: PhonemeTimestamp[] = [
      { phoneme: 'AH0', startMs: 0, endMs: 100 },
      { phoneme: 'EY1', startMs: 100, endMs: 200 },
    ];
    const track = generateVisemeTrackFromPhonemes(timestamps);
    expect(track[0]!.viseme).toBe('AA'); // AH -> AA
    expect(track[1]!.viseme).toBe('EE'); // EY -> EE
  });

  it('should return IDLE for empty timestamps', () => {
    const track = generateVisemeTrackFromPhonemes([]);
    expect(track).toHaveLength(1);
    expect(track[0]!.viseme).toBe('IDLE');
  });

  it('should have correct timing from timestamps', () => {
    const timestamps: PhonemeTimestamp[] = [
      { phoneme: 'B', startMs: 100, endMs: 200 },
      { phoneme: 'AA', startMs: 200, endMs: 400 },
    ];
    const track = generateVisemeTrackFromPhonemes(timestamps);
    expect(track[0]!.timeMs).toBe(100);
    expect(track[0]!.durationMs).toBe(100);
    expect(track[1]!.timeMs).toBe(200);
    expect(track[1]!.durationMs).toBe(200);
  });

  it('should handle silence phonemes', () => {
    const timestamps: PhonemeTimestamp[] = [
      { phoneme: 'SIL', startMs: 0, endMs: 100 },
      { phoneme: 'SP', startMs: 100, endMs: 200 },
    ];
    const track = generateVisemeTrackFromPhonemes(timestamps);
    expect(track[0]!.viseme).toBe('IDLE');
    expect(track[1]!.viseme).toBe('IDLE');
  });
});

describe('wordToVisemes', () => {
  it('should handle digraphs (sh, th, ch)', () => {
    const visemes = wordToVisemes('she');
    expect(visemes[0]).toBe('CH'); // sh -> CH
  });

  it('should return IDLE for empty string', () => {
    const visemes = wordToVisemes('');
    expect(visemes).toEqual(['IDLE']);
  });
});

describe('generateLipSyncData', () => {
  it('should generate timeline for text', () => {
    const data = generateLipSyncData('hello world', 2000);
    expect(data.wordTimings).toHaveLength(2);
    expect(data.visemeTimeline.length).toBeGreaterThan(0);
    expect(data.text).toBe('hello world');
  });

  it('should handle empty text', () => {
    const data = generateLipSyncData('');
    expect(data.totalDurationMs).toBe(0);
    expect(data.wordTimings).toHaveLength(0);
  });
});

describe('visemeTimelineToFrames', () => {
  it('should convert timeline to frame-indexed array', () => {
    const data = generateLipSyncData('test', 1000);
    const frames = visemeTimelineToFrames(data.visemeTimeline, 24, 24);
    expect(frames).toHaveLength(24);
    expect(frames[0]!.frame).toBe(0);
    expect(frames[23]!.frame).toBe(23);
  });
});
