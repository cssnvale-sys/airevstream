import { describe, it, expect } from 'vitest';
import { buildProductionScript, formatProductionScriptAsText } from '../production-script.js';
import type { AssembledShot, AssemblyManifest } from '../types.js';

describe('production-script', () => {
  const mockShots: AssembledShot[] = [
    {
      shotId: 'shot-1',
      shotNumber: 1,
      startSec: 0,
      endSec: 5,
      durationSec: 5,
      beat: 'POWER',
      transition: 'fade',
      dialogue: { text: 'Watch this.', voice: 'narrator', emotion: 'excited', pacing: 'fast' },
      audioPlan: {
        bg: { source: 'generate', volume: 0.3, text: 'tense ambient drone' },
        mg: { source: 'generate', volume: 0.5, text: 'heartbeat thump' },
        fg: { source: 'tts', volume: 0.9, text: 'Watch this.' },
      },
    },
    {
      shotId: 'shot-2',
      shotNumber: 2,
      startSec: 5,
      endSec: 15,
      durationSec: 10,
      beat: 'EMOTIONAL',
      transition: 'cut',
      camera: { lens: '85mm', framing: 'close-up', movement: 'dolly-in', dof: 'shallow' },
    },
  ];

  const mockAgentOutputs = {
    director: {
      concept: 'A cinematic test',
      narrative: 'Testing the production script generator',
      emotionalArc: ['curiosity', 'tension', 'revelation'],
      sections: [
        { type: 'hook', beat: 'POWER', description: 'Opening hook', durationSec: 5 },
        { type: 'content', beat: 'EMOTIONAL', description: 'Main content', durationSec: 10 },
      ],
      visualDirection: 'Cinematic',
      audioDirection: 'Ambient',
      totalDurationSec: 15,
    },
    lookdev: {
      globalStyle: 'Cinematic documentary',
      colorPalette: ['#333', '#fff', '#f00'],
      lightingScheme: 'Golden hour',
      lensKit: ['35mm', '85mm'],
      aspectRatio: '16:9',
    },
    dialogue: {
      tracks: [
        { shotNumber: 1, text: 'Watch this.', voice: 'narrator', emotion: 'excited', pacing: 'fast' },
        { shotNumber: 2, text: 'Now here is the secret.', voice: 'narrator', emotion: 'serious', pacing: 'normal' },
      ],
      narrationStyle: 'Documentary',
    },
    sound: {
      audioLayers: [
        {
          shotNumber: 1,
          bg: { source: 'ambient drone', volume: 0.3, description: 'tense ambient drone with sub-bass rumble' },
          mg: { source: 'heartbeat', volume: 0.5, description: 'heartbeat thump and glass break' },
          fg: { source: 'voice', volume: 0.9, description: 'narrator voice' },
        },
        {
          shotNumber: 2,
          bg: { source: 'emotional pad', volume: 0.2, description: 'soft emotional pad' },
          mg: null,
          fg: { source: 'voice', volume: 0.9, description: 'narrator voice' },
        },
      ],
      masterVolume: 0.8,
      mixNotes: 'Balanced mix',
    },
    psychology: {
      hookOptimizations: [
        { shotNumber: 1, original: 'Watch this.', optimized: 'You won\'t believe what happens next.', technique: 'curiosity_gap' },
      ],
      ctaRewrites: [],
      emotionalTriggers: [
        { shotNumber: 1, trigger: 'curiosity', placement: 'opening frame' },
      ],
      retentionTechniques: ['open loop at 3s'],
      persuasionScore: 78,
    },
    finishing: {
      colorGrade: { temperature: 10, contrast: 20, saturation: 5 },
      postProcess: { sharpen: 15, filmGrain: 20, vignette: 10 },
      subtitles: [
        { startSec: 0, endSec: 5, text: 'Watch this.' },
        { startSec: 5, endSec: 15, text: 'Now here is the secret.' },
      ],
      deliveryFormat: { codec: 'h264', width: 1920, height: 1080, fps: 24 },
    },
  };

  const beatTimings: AssemblyManifest['beatTimings'] = [
    { startSec: 0, endSec: 5, section: 'hook', preset: 'POWER', label: 'hook_1' },
    { startSec: 5, endSec: 15, section: 'content', preset: 'EMOTIONAL', label: 'content_1' },
  ];

  it('should build a timecoded production script with all elements', () => {
    const script = buildProductionScript({
      contentId: 'test-content-id',
      storyboardId: 'test-sb-id',
      title: 'Test Video',
      contentType: 'video_short',
      platform: 'youtube',
      agentOutputs: mockAgentOutputs,
      assembledShots: mockShots,
      beatTimings,
      subtitles: mockAgentOutputs.finishing.subtitles,
      outputSpec: { width: 1920, height: 1080, fps: 24, aspect: '16:9', codec: 'h264', totalDurationSec: 15 },
    });

    expect(script.schemaVersion).toBe('1.0.0');
    expect(script.title).toBe('Test Video');
    expect(script.concept).toBe('A cinematic test');
    expect(script.emotionalArc).toEqual(['curiosity', 'tension', 'revelation']);
    expect(script.cues).toHaveLength(2);

    // Check first cue
    const cue1 = script.cues[0]!;
    expect(cue1.shotNumber).toBe(1);
    expect(cue1.startTime).toBe('00:00');
    expect(cue1.endTime).toBe('00:05');
    expect(cue1.section).toBe('hook');
    expect(cue1.beatPreset).toBe('POWER');

    // Dialogue should have hook optimization applied
    expect(cue1.dialogue?.text).toBe('You won\'t believe what happens next.');

    // Audio layers from sound agent
    expect(cue1.audioBg?.description).toBe('tense ambient drone with sub-bass rumble');
    expect(cue1.audioMg?.description).toBe('heartbeat thump and glass break');

    // SFX cues should be extracted
    expect(cue1.sfxCues?.length).toBeGreaterThan(0);
    expect(cue1.sfxCues?.[0]?.description).toBe('heartbeat thump');

    // Psychology
    expect(cue1.characterBlocking).toContain('curiosity');
    expect(cue1.textOverlay?.text).toBe('You won\'t believe what happens next.');

    // Check second cue
    const cue2 = script.cues[1]!;
    expect(cue2.shotNumber).toBe(2);
    expect(cue2.startTime).toBe('00:05');
    expect(cue2.endTime).toBe('00:15');
    expect(cue2.section).toBe('content');
    expect(cue2.dialogue?.text).toBe('Now here is the secret.');
    expect(cue2.camera.lens).toBe('85mm');
    expect(cue2.camera.framing).toBe('close-up');

    // Global info
    expect(script.globalStyle).toBe('Cinematic documentary');
    expect(script.colorPalette).toEqual(['#333', '#fff', '#f00']);
    expect(script.masterVolume).toBe(0.8);
    expect(script.persuasionScore).toBe(78);
    expect(script.retentionTechniques).toEqual(['open loop at 3s']);
  });

  it('should handle missing agent outputs gracefully', () => {
    const script = buildProductionScript({
      contentId: 'test-content-id',
      storyboardId: 'test-sb-id',
      title: 'Minimal Video',
      contentType: 'video_long',
      platform: 'tiktok',
      agentOutputs: {},
      assembledShots: mockShots,
    });

    expect(script.cues).toHaveLength(2);
    expect(script.cues[0]!.visualDescription).toContain('Shot 1');
    // Dialogue comes from assembled shot's dialogue field, not agent output
    expect(script.cues[0]!.dialogue?.text).toBe('Watch this.');
    expect(script.concept).toBe('Untitled production');
  });

  it('should format as readable text', () => {
    const script = buildProductionScript({
      contentId: 'test-content-id',
      storyboardId: 'test-sb-id',
      title: 'Test Video',
      contentType: 'video_short',
      platform: 'youtube',
      agentOutputs: mockAgentOutputs,
      assembledShots: mockShots,
      beatTimings,
    });

    const text = formatProductionScriptAsText(script);
    expect(text).toContain('PRODUCTION SCRIPT: Test Video');
    expect(text).toContain('SHOT SHEET');
    expect(text).toContain('00:00 → 00:05');
    expect(text).toContain('DIALOGUE:');
    expect(text).toContain('AUDIO BG:');
    expect(text).toContain('SFX');
    expect(text).toContain('BEAT TIMINGS');
    expect(text).toContain('DELIVERY');
  });
});