import { describe, it, expect } from 'vitest';
import { TTSClient } from '../tts-client.js';

describe('TTSClient', () => {
  it('should create an instance with default config', () => {
    const client = new TTSClient();
    expect(client).toBeInstanceOf(TTSClient);
  });

  it('should list voices', () => {
    const client = new TTSClient();
    const voices = client.getVoices();
    expect(voices.length).toBeGreaterThan(0);
  });

  it('should filter voices by language', () => {
    const client = new TTSClient();
    const enVoices = client.getVoices('en');
    expect(enVoices.every(v => v.language === 'en')).toBe(true);
  });

  it('should estimate duration from text', () => {
    const client = new TTSClient();
    const duration = client.estimateDuration('This is a test sentence with about ten words');
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10000);
  });

  it('should synthesize placeholder audio', async () => {
    const client = new TTSClient({ provider: 'google' }); // Uses placeholder path
    const result = await client.synthesize({ text: 'Hello world test' });
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    expect(result.audioBuffer.length).toBeGreaterThan(44); // WAV header at minimum
    expect(result.format).toBe('wav');
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
