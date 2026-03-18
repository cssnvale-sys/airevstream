export interface TTSConfig {
  provider: 'piper' | 'elevenlabs' | 'google' | 'local';
  apiKey?: string;
  baseUrl?: string;
  defaultVoice?: string;
  defaultLanguage?: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;    // 0.5 - 2.0, default 1.0
  pitch?: number;    // 0.5 - 2.0, default 1.0
}

export interface TTSResult {
  audioBuffer: Buffer;
  format: 'wav' | 'mp3' | 'ogg';
  durationMs: number;
  sampleRate: number;
}

export interface AudioMixConfig {
  tracks: AudioTrack[];
  outputFormat: 'wav' | 'mp3';
  sampleRate?: number;   // default 44100
  totalDurationMs?: number;
}

export interface AudioTrack {
  buffer: Buffer;
  startMs?: number;       // default 0
  volume?: number;        // 0.0 - 1.0, default 1.0
  fadeInMs?: number;
  fadeOutMs?: number;
  loop?: boolean;
}

export interface AudioMixResult {
  buffer: Buffer;
  format: 'wav' | 'mp3';
  durationMs: number;
}

export type VoiceProfile = {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: TTSConfig['provider'];
  providerVoiceId: string;
};
