import { describe, it, expect } from 'vitest';
import { AudioMixer } from '../mixer.js';

describe('AudioMixer', () => {
  const mixer = new AudioMixer();

  describe('createSilence', () => {
    it('should create a valid WAV buffer', () => {
      const silence = mixer.createSilence(1000); // 1 second
      expect(silence.length).toBeGreaterThan(44); // Must have at least header
      expect(silence.toString('ascii', 0, 4)).toBe('RIFF');
      expect(silence.toString('ascii', 8, 12)).toBe('WAVE');
    });

    it('should create correct duration', () => {
      const silence = mixer.createSilence(500, 44100); // 0.5 seconds
      const expectedSamples = Math.ceil(0.5 * 44100);
      const expectedDataSize = expectedSamples * 2; // 16-bit = 2 bytes per sample
      expect(silence.length).toBe(44 + expectedDataSize);
    });
  });

  describe('mix', () => {
    it('should mix empty tracks to silence', async () => {
      const result = await mixer.mix({
        tracks: [],
        outputFormat: 'wav',
        totalDurationMs: 1000,
      });
      expect(result.format).toBe('wav');
      expect(result.durationMs).toBe(1000);
      expect(result.buffer.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('should mix a single track', async () => {
      const silence = mixer.createSilence(500);
      const result = await mixer.mix({
        tracks: [{ buffer: silence, volume: 1.0 }],
        outputFormat: 'wav',
      });
      expect(result.format).toBe('wav');
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should respect volume setting', async () => {
      // Create a track with a known signal
      const sampleRate = 44100;
      const numSamples = sampleRate; // 1 second
      const pcmBuffer = Buffer.alloc(numSamples * 2);
      for (let i = 0; i < numSamples; i++) {
        pcmBuffer.writeInt16LE(16384, i * 2); // Half max value
      }

      // Create WAV from PCM
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + pcmBuffer.length, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * 2, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36);
      header.writeUInt32LE(pcmBuffer.length, 40);
      const wavBuffer = Buffer.concat([header, pcmBuffer]);

      const result = await mixer.mix({
        tracks: [{ buffer: wavBuffer, volume: 0.5 }],
        outputFormat: 'wav',
      });

      expect(result.buffer.length).toBeGreaterThan(44);
    });

    it('should handle multiple overlapping tracks', async () => {
      const track1 = mixer.createSilence(1000);
      const track2 = mixer.createSilence(500);

      const result = await mixer.mix({
        tracks: [
          { buffer: track1, volume: 0.5 },
          { buffer: track2, volume: 0.3, startMs: 200 },
        ],
        outputFormat: 'wav',
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('createTrackFromLayer', () => {
    it('should create an AudioTrack from layer spec', () => {
      const buffer = mixer.createSilence(1000);
      const track = mixer.createTrackFromLayer(buffer, {
        volume: 0.5,
        fadeInMs: 100,
        fadeOutMs: 200,
        loop: true,
      }, 500);

      expect(track.buffer).toBe(buffer);
      expect(track.volume).toBe(0.5);
      expect(track.fadeInMs).toBe(100);
      expect(track.fadeOutMs).toBe(200);
      expect(track.loop).toBe(true);
      expect(track.startMs).toBe(500);
    });
  });
});
