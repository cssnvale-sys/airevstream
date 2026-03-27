import { createLogger, generateLipSyncData } from '@airevstream/shared';
import type { LipSyncData } from '@airevstream/shared';
import type { TTSConfig, TTSRequest, TTSResult, VoiceProfile } from './types.js';

const logger = createLogger('tts-client');

const DEFAULT_VOICES: VoiceProfile[] = [
  { id: 'en-us-male-1', name: 'English Male', language: 'en', gender: 'male', provider: 'local', providerVoiceId: 'en_US-lessac-medium' },
  { id: 'en-us-female-1', name: 'English Female', language: 'en', gender: 'female', provider: 'local', providerVoiceId: 'en_US-amy-medium' },
  { id: 'en-gb-male-1', name: 'British Male', language: 'en', gender: 'male', provider: 'local', providerVoiceId: 'en_GB-alan-medium' },
  { id: 'es-male-1', name: 'Spanish Male', language: 'es', gender: 'male', provider: 'local', providerVoiceId: 'es_ES-davefx-medium' },
  { id: 'fr-female-1', name: 'French Female', language: 'fr', gender: 'female', provider: 'local', providerVoiceId: 'fr_FR-siwis-medium' },
];

export class TTSClient {
  private config: TTSConfig;

  constructor(config?: Partial<TTSConfig>) {
    this.config = {
      provider: config?.provider ?? 'local',
      apiKey: config?.apiKey ?? process.env.TTS_API_KEY,
      baseUrl: config?.baseUrl ?? process.env.TTS_BASE_URL ?? 'http://localhost:5500',
      defaultVoice: config?.defaultVoice ?? 'en_US-lessac-medium',
      defaultLanguage: config?.defaultLanguage ?? 'en',
    };
  }

  /** List available voices */
  getVoices(language?: string): VoiceProfile[] {
    if (language) {
      return DEFAULT_VOICES.filter(v => v.language === language);
    }
    return [...DEFAULT_VOICES];
  }

  /** Check if TTS service is reachable */
  async isHealthy(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'local':
        case 'piper': {
          // Piper TTS server health check
          const res = await fetch(`${this.config.baseUrl}/api/voices`, {
            signal: AbortSignal.timeout(5000),
          });
          return res.ok;
        }
        case 'elevenlabs': {
          const res = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': this.config.apiKey ?? '' },
            signal: AbortSignal.timeout(5000),
          });
          return res.ok;
        }
        case 'google': {
          return !!this.config.apiKey;
        }
        default:
          return false;
      }
    } catch (err) {
      logger.debug({ provider: this.config.provider, err }, 'Health check failed');
      return false;
    }
  }

  /** Generate speech from text */
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    logger.info({ provider: this.config.provider, textLength: request.text.length }, 'Generating TTS audio');

    switch (this.config.provider) {
      case 'local':
      case 'piper':
        return this.synthesizePiper(request);
      case 'elevenlabs':
        return this.synthesizeElevenLabs(request);
      default:
        return this.synthesizePlaceholder(request);
    }
  }

  /** Piper TTS (self-hosted, free) */
  private async synthesizePiper(request: TTSRequest): Promise<TTSResult> {
    const voice = request.voice ?? this.config.defaultVoice;
    const params = new URLSearchParams({
      text: request.text,
      voice: voice ?? 'en_US-lessac-medium',
    });
    if (request.speed) params.set('lengthScale', String(1 / request.speed));

    const res = await fetch(`${this.config.baseUrl}/api/tts?${params}`, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Piper TTS failed (${res.status}): ${await res.text()}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    // Estimate duration: ~150 words per minute average
    const wordCount = request.text.split(/\s+/).length;
    const durationMs = Math.round((wordCount / 150) * 60_000 * (1 / (request.speed ?? 1)));

    logger.info({ voice, durationMs }, 'Piper TTS completed');
    return {
      audioBuffer,
      format: 'wav',
      durationMs,
      sampleRate: 22050,
    };
  }

  /** ElevenLabs TTS (cloud, paid) */
  private async synthesizeElevenLabs(request: TTSRequest): Promise<TTSResult> {
    const voiceId = request.voice ?? '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey ?? '',
      },
      body: JSON.stringify({
        text: request.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${await res.text()}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const wordCount = request.text.split(/\s+/).length;
    const durationMs = Math.round((wordCount / 150) * 60_000);

    logger.info({ voiceId, durationMs }, 'ElevenLabs TTS completed');
    return {
      audioBuffer,
      format: 'mp3',
      durationMs,
      sampleRate: 44100,
    };
  }

  /** Placeholder for providers not yet implemented */
  private async synthesizePlaceholder(request: TTSRequest): Promise<TTSResult> {
    logger.warn({ provider: this.config.provider }, 'Using placeholder TTS — generating silent audio');
    const wordCount = request.text.split(/\s+/).length;
    const durationMs = Math.round((wordCount / 150) * 60_000);
    // Generate minimal valid WAV header for silence
    const sampleRate = 22050;
    const numSamples = Math.round((durationMs / 1000) * sampleRate);
    const dataSize = numSamples * 2; // 16-bit mono
    const buffer = Buffer.alloc(44 + dataSize);
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20);  // PCM
    buffer.writeUInt16LE(1, 22);  // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
    buffer.writeUInt16LE(2, 32);  // block align
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    // Data is zero-filled (silence)
    return { audioBuffer: buffer, format: 'wav', durationMs, sampleRate };
  }

  /**
   * Synthesize speech with lip-sync data.
   * Returns both the audio result and viseme timeline for character animation.
   */
  async synthesizeWithLipSync(request: TTSRequest): Promise<{ tts: TTSResult; lipSync: LipSyncData }> {
    const tts = await this.synthesize(request);

    // Generate lip-sync data from text and actual/estimated duration
    const lipSync = generateLipSyncData(
      request.text,
      tts.durationMs,
      request.speed,
    );

    // If the TTS provider returned word-level timing, merge it
    if (tts.wordTimings && tts.wordTimings.length > 0) {
      for (let i = 0; i < Math.min(tts.wordTimings.length, lipSync.wordTimings.length); i++) {
        const providerTiming = tts.wordTimings[i]!;
        const lipSyncWord = lipSync.wordTimings[i]!;
        lipSyncWord.startMs = providerTiming.startMs;
        lipSyncWord.endMs = providerTiming.endMs;
      }
    }

    logger.info({ wordCount: lipSync.wordTimings.length, visemeCount: lipSync.visemeTimeline.length }, 'Lip-sync data generated');

    return { tts, lipSync };
  }

  /** Estimate audio duration from text (useful for storyboard planning) */
  estimateDuration(text: string, speed = 1.0): number {
    const wordCount = text.split(/\s+/).length;
    return Math.round((wordCount / 150) * 60_000 * (1 / speed));
  }
}
