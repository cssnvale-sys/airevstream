import { describe, it, expect } from 'vitest';
import type { AssemblyManifest, AssembledShot } from '../types.js';
import {
  resolveForRemotion,
  toCinemaShotData,
  toBeatTimings,
  toSubtitleEntries,
  toAudioTracks,
  deriveBeatsFromDirector,
  parseKeyframeUrls,
  toDraftManifest,
} from '../assembly-resolver.js';

// ─── Test Helpers ───

function createTestManifest(overrides?: Partial<AssemblyManifest>): AssemblyManifest {
  return {
    schemaVersion: '1.0.0',
    contentId: 'test-content-1',
    storyboardId: 'test-sb-1',
    compositionId: 'CinemaVideo',
    qualityTier: 'cinema',
    productionType: 'cinema',
    shots: [
      {
        shotId: 'shot-1',
        shotNumber: 1,
        startSec: 0,
        endSec: 5,
        durationSec: 5,
        keyframeUrl: 'production/shots/shot-1.png',
        shotClass: 'Establishing_Wide',
        transition: 'fade',
        beat: 'hook',
        camera: { lens: '24mm', framing: 'wide', movement: 'static' },
      },
      {
        shotId: 'shot-2',
        shotNumber: 2,
        startSec: 5,
        endSec: 12,
        durationSec: 7,
        keyframeUrl: 'production/shots/shot-2.png',
        shotClass: 'Dialogue_Closeup',
        transition: 'cut',
        beat: 'content',
        dialogue: { text: 'Hello world', voice: 'narrator', emotion: 'neutral', pacing: 'normal' },
        audioPlan: {
          fg: { source: 'tts', text: 'Hello world', voice: 'narrator', volume: 0.9 },
          bg: { fileKey: 'audio/ambient.wav', volume: 0.2, loop: true },
        },
      },
    ],
    beatTimings: [
      { startSec: 0, endSec: 5, section: 'hook', preset: 'POWER', label: 'hook_1' },
      { startSec: 5, endSec: 12, section: 'content', preset: 'EMOTIONAL', label: 'content_1' },
    ],
    subtitles: [
      { startSec: 5.5, endSec: 8, text: 'Hello world', position: 'bottom' },
    ],
    outputSpec: {
      width: 1920,
      height: 1080,
      fps: 24,
      aspect: '16:9',
      codec: 'h264',
      totalDurationSec: 12,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───

describe('assembly-resolver', () => {
  describe('resolveForRemotion', () => {
    it('should produce valid resolve result', () => {
      const manifest = createTestManifest();
      const result = resolveForRemotion(manifest);

      expect(result.compositionId).toBe('CinemaVideo');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.fps).toBe(24);
      expect(result.codec).toBe('h264');
      expect(result.durationInFrames).toBe(288); // 12 * 24
    });

    it('should include shots in inputProps', () => {
      const manifest = createTestManifest();
      const result = resolveForRemotion(manifest);
      const shots = result.inputProps.shots as unknown[];

      expect(shots).toHaveLength(2);
    });

    it('should include beatTimings in inputProps', () => {
      const manifest = createTestManifest();
      const result = resolveForRemotion(manifest);

      expect(result.inputProps.beatTimings).toBeDefined();
      const timings = result.inputProps.beatTimings as Array<{ startFrame: number }>;
      expect(timings).toHaveLength(2);
      expect(timings[0].startFrame).toBe(0);
    });

    it('should include textOverlays from subtitles', () => {
      const manifest = createTestManifest();
      const result = resolveForRemotion(manifest);

      expect(result.inputProps.textOverlays).toBeDefined();
      const overlays = result.inputProps.textOverlays as Array<{ text: string }>;
      expect(overlays).toHaveLength(1);
      expect(overlays[0].text).toBe('Hello world');
    });

    it('should include global color grade if present', () => {
      const manifest = createTestManifest({
        globalColorGrade: { temperature: 10, contrast: 15, saturation: -5 },
      });
      const result = resolveForRemotion(manifest);

      expect(result.inputProps.colorGrade).toBeDefined();
      const cg = result.inputProps.colorGrade as Record<string, unknown>;
      expect(cg.temperature).toBe(10);
    });
  });

  describe('toCinemaShotData', () => {
    it('should convert shots with correct frame counts', () => {
      const shots: AssembledShot[] = [
        { shotId: 's1', shotNumber: 1, startSec: 0, endSec: 3, durationSec: 3 },
        { shotId: 's2', shotNumber: 2, startSec: 3, endSec: 8, durationSec: 5, transition: 'zoom' },
      ];
      const result = toCinemaShotData(shots, 30);

      expect(result).toHaveLength(2);
      expect(result[0].durationInFrames).toBe(90); // 3 * 30
      expect(result[0].transitionIn).toBe('fade'); // first shot
      expect(result[1].durationInFrames).toBe(150); // 5 * 30
      expect(result[1].transitionIn).toBe('zoom');
    });

    it('should handle video plates', () => {
      const shots: AssembledShot[] = [
        { shotId: 's1', shotNumber: 1, startSec: 0, endSec: 5, durationSec: 5, videoPlateUrl: 'video.mp4' },
      ];
      const result = toCinemaShotData(shots, 24);

      expect(result[0].isVideo).toBe(true);
      expect(result[0].videoSrc).toBe('video.mp4');
    });

    it('should ensure minimum 1 frame duration', () => {
      const shots: AssembledShot[] = [
        { shotId: 's1', shotNumber: 1, startSec: 0, endSec: 0, durationSec: 0 },
      ];
      const result = toCinemaShotData(shots, 30);

      expect(result[0].durationInFrames).toBe(1);
    });
  });

  describe('toBeatTimings', () => {
    it('should convert sec to frame timings', () => {
      const timings = [
        { startSec: 0, endSec: 3, section: 'hook' as const, preset: 'POWER', label: 'hook_1' },
        { startSec: 3, endSec: 10, section: 'content' as const, label: 'content_1' },
      ];
      const result = toBeatTimings(timings, 30);

      expect(result).toHaveLength(2);
      expect(result[0].startFrame).toBe(0);
      expect(result[0].endFrame).toBe(90);
      expect(result[0].section).toBe('hook');
      expect(result[0].preset).toBe('POWER');
      expect(result[1].startFrame).toBe(90);
    });

    it('should return empty for undefined input', () => {
      expect(toBeatTimings(undefined, 30)).toHaveLength(0);
    });
  });

  describe('toSubtitleEntries', () => {
    it('should convert sec to frame subtitles', () => {
      const subs = [
        { startSec: 1, endSec: 3, text: 'Hello', position: 'bottom' as const },
      ];
      const result = toSubtitleEntries(subs, 24);

      expect(result).toHaveLength(1);
      expect(result[0].startFrame).toBe(24);
      expect(result[0].endFrame).toBe(72);
      expect(result[0].text).toBe('Hello');
      expect(result[0].position).toBe('bottom');
    });

    it('should return empty for undefined input', () => {
      expect(toSubtitleEntries(undefined, 30)).toHaveLength(0);
    });
  });

  describe('toAudioTracks', () => {
    it('should extract tracks from audioStemUrls', () => {
      const shots: AssembledShot[] = [{
        shotId: 's1', shotNumber: 1, startSec: 0, endSec: 5, durationSec: 5,
        audioStemUrls: { fg: 'fg.wav', bg: 'bg.wav' },
      }];
      const result = toAudioTracks(shots, 24);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.layer === 'fg')?.src).toBe('fg.wav');
      expect(result.find(t => t.layer === 'bg')?.loop).toBe(true);
    });

    it('should extract from audioPlan.fileKey when no stemUrls', () => {
      const shots: AssembledShot[] = [{
        shotId: 's1', shotNumber: 1, startSec: 2, endSec: 5, durationSec: 3,
        audioPlan: {
          bg: { fileKey: 'audio/music.wav', volume: 0.4, loop: true },
        },
      }];
      const result = toAudioTracks(shots, 30);

      expect(result).toHaveLength(1);
      expect(result[0].src).toBe('audio/music.wav');
      expect(result[0].startFrame).toBe(60);
      expect(result[0].volume).toBe(0.4);
    });

    it('should not duplicate when both stemUrls and audioPlan exist for same layer', () => {
      const shots: AssembledShot[] = [{
        shotId: 's1', shotNumber: 1, startSec: 0, endSec: 5, durationSec: 5,
        audioStemUrls: { bg: 'bg-stem.wav' },
        audioPlan: { bg: { fileKey: 'bg-plan.wav', volume: 0.3 } },
      }];
      const result = toAudioTracks(shots, 24);
      const bgTracks = result.filter(t => t.layer === 'bg');

      expect(bgTracks).toHaveLength(1);
      expect(bgTracks[0].src).toBe('bg-stem.wav');
    });
  });

  describe('deriveBeatsFromDirector', () => {
    it('should convert director sections to frame-based timings', () => {
      const sections = [
        { type: 'hook' as const, durationSec: 3, beat: 'POWER' },
        { type: 'intro' as const, durationSec: 5 },
        { type: 'content' as const, durationSec: 20 },
        { type: 'cta' as const, durationSec: 5 },
      ];
      const result = deriveBeatsFromDirector(sections, 24);

      expect(result).toHaveLength(4);
      expect(result[0].startFrame).toBe(0);
      expect(result[0].endFrame).toBe(72); // 3 * 24
      expect(result[0].section).toBe('hook');
      expect(result[0].preset).toBe('POWER');
      expect(result[1].startFrame).toBe(72);
      expect(result[1].endFrame).toBe(192); // (3+5) * 24
      expect(result[3].label).toBe('cta_4');
    });
  });

  describe('parseKeyframeUrls', () => {
    it('should return array as-is', () => {
      expect(parseKeyframeUrls(['a.png', 'b.png'])).toEqual(['a.png', 'b.png']);
    });

    it('should parse JSON string', () => {
      expect(parseKeyframeUrls('["a.png","b.png"]')).toEqual(['a.png', 'b.png']);
    });

    it('should return single URL for non-JSON string', () => {
      expect(parseKeyframeUrls('a.png')).toEqual(['a.png']);
    });

    it('should filter non-string array elements', () => {
      expect(parseKeyframeUrls(['a.png', 123, null, 'b.png'])).toEqual(['a.png', 'b.png']);
    });

    it('should return empty for null/undefined', () => {
      expect(parseKeyframeUrls(null)).toEqual([]);
      expect(parseKeyframeUrls(undefined)).toEqual([]);
    });

    it('should return empty for empty string', () => {
      expect(parseKeyframeUrls('')).toEqual([]);
    });
  });

  describe('toDraftManifest', () => {
    it('should downgrade quality tier', () => {
      const manifest = createTestManifest();
      const draft = toDraftManifest(manifest);

      expect(draft.qualityTier).toBe('draft');
      expect(draft.outputSpec.codec).toBe('h264');
    });

    it('should cap dimensions', () => {
      const manifest = createTestManifest();
      const draft = toDraftManifest(manifest);

      expect(draft.outputSpec.width).toBeLessThanOrEqual(1280);
      expect(draft.outputSpec.height).toBeLessThanOrEqual(720);
    });

    it('should not modify original manifest', () => {
      const manifest = createTestManifest();
      toDraftManifest(manifest);

      expect(manifest.qualityTier).toBe('cinema');
      expect(manifest.outputSpec.width).toBe(1920);
    });
  });
});
