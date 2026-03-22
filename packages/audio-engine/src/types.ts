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

export interface AudioDuckingConfig {
  /** Index of the track that triggers ducking (typically FG/dialogue) */
  triggerTrackIndex: number;
  /** Indices of tracks to duck when trigger is active */
  targetTrackIndices: number[];
  /** Attenuation in dB when ducking is active (e.g., -12) */
  duckingDb: number;
  /** Attack time in ms — how quickly ducking engages */
  attackMs?: number;
  /** Release time in ms — how quickly ducking disengages */
  releaseMs?: number;
  /** RMS threshold (0-1) for trigger detection — below this = silence */
  threshold?: number;
}

export interface LoudnessConfig {
  /** Target integrated loudness in LUFS (e.g., -14 for YouTube, -16 for broadcast) */
  targetLufs: number;
  /** True peak limit in dBTP (e.g., -1) */
  truePeakDbtp?: number;
}

export interface AudioMixConfig {
  tracks: AudioTrack[];
  outputFormat: 'wav' | 'mp3';
  sampleRate?: number;   // default 44100
  totalDurationMs?: number;
  ducking?: AudioDuckingConfig;
  loudness?: LoudnessConfig;
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
