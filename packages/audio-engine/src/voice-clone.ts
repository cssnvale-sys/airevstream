import { createLogger } from '@airevstream/shared';
import type { VoiceProfile } from './types.js';

const logger = createLogger('voice-clone');

export interface VoiceCloneRequest {
  name: string;
  description?: string;
  files: Buffer[]; // Audio samples (min 1, recommended 3-5 for best quality)
  labels?: Record<string, string>; // e.g., { accent: 'american', age: 'young' }
}

export interface VoiceCloneResult {
  voiceId: string;
  name: string;
  previewUrl?: string;
  samples: number;
}

export interface ClonedVoice {
  voiceId: string;
  name: string;
  description?: string;
  previewUrl?: string;
  samples: Array<{
    sampleId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    hash: string;
  }>;
  labels?: Record<string, string>;
  category: 'cloned' | 'generated' | 'premade';
  createdAt: Date;
}

export class VoiceCloneClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ELEVENLABS_API_KEY ?? '';
  }

  /** Check if voice cloning is available (API key configured) */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /** List all voices including cloned ones */
  async listVoices(): Promise<ClonedVoice[]> {
    const res = await fetch(`${this.baseUrl}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to list voices (${res.status}): ${await res.text()}`);
    }

    const data = await res.json() as { voices: Array<Record<string, unknown>> };
    
    return (data.voices ?? []).map((v: Record<string, unknown>) => ({
      voiceId: String(v.voice_id ?? v.id ?? ''),
      name: String(v.name ?? 'Unknown'),
      description: v.description ? String(v.description) : undefined,
      previewUrl: v.preview_url ? String(v.preview_url) : undefined,
      samples: (v.samples as Array<Record<string, unknown>> ?? []).map((s: Record<string, unknown>) => ({
        sampleId: String(s.sample_id ?? s.id ?? ''),
        fileName: String(s.file_name ?? 'sample.wav'),
        mimeType: String(s.mime_type ?? 'audio/wav'),
        sizeBytes: Number(s.size_bytes ?? 0),
        hash: String(s.hash_sha256 ?? ''),
      })),
      labels: v.labels as Record<string, string> | undefined,
      category: (v.category as 'cloned' | 'generated' | 'premade') ?? 'cloned',
      createdAt: new Date(v.date_created as string ?? Date.now()),
    }));
  }

  /** Create a new voice clone from audio samples */
  async createVoiceClone(request: VoiceCloneRequest): Promise<VoiceCloneResult> {
    if (request.files.length === 0) {
      throw new Error('At least one audio sample is required for voice cloning');
    }

    logger.info({ name: request.name, sampleCount: request.files.length }, 'Creating voice clone');

    const formData = new FormData();
    formData.append('name', request.name);
    if (request.description) {
      formData.append('description', request.description);
    }
    if (request.labels) {
      formData.append('labels', JSON.stringify(request.labels));
    }

    request.files.forEach((file, i) => {
      // Convert Buffer to Blob-compatible format
      const uint8Array = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
      formData.append('files', new Blob([uint8Array as unknown as ArrayBuffer]), `sample_${i}.wav`);
    });

    const res = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: { 
        'xi-api-key': this.apiKey,
        // Don't set Content-Type - let fetch set it with boundary for FormData
      },
      body: formData,
      signal: AbortSignal.timeout(120_000), // Voice cloning can take time
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText }, 'Voice clone creation failed');
      throw new Error(`Voice clone creation failed (${res.status}): ${errorText}`);
    }

    const data = await res.json() as { voice_id: string; name: string };
    
    logger.info({ voiceId: data.voice_id }, 'Voice clone created successfully');

    return {
      voiceId: data.voice_id,
      name: data.name,
      samples: request.files.length,
    };
  }

  /** Delete a cloned voice */
  async deleteVoice(voiceId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': this.apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to delete voice (${res.status}): ${await res.text()}`);
    }

    logger.info({ voiceId }, 'Voice deleted successfully');
  }

  /** Get voice details including samples */
  async getVoice(voiceId: string): Promise<ClonedVoice> {
    const res = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      headers: { 'xi-api-key': this.apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to get voice details (${res.status}): ${await res.text()}`);
    }

    const v = await res.json() as Record<string, unknown>;

    return {
      voiceId: String(v.voice_id ?? v.id ?? voiceId),
      name: String(v.name ?? 'Unknown'),
      description: v.description ? String(v.description) : undefined,
      previewUrl: v.preview_url ? String(v.preview_url) : undefined,
      samples: (v.samples as Array<Record<string, unknown>> ?? []).map((s: Record<string, unknown>) => ({
        sampleId: String(s.sample_id ?? s.id ?? ''),
        fileName: String(s.file_name ?? 'sample.wav'),
        mimeType: String(s.mime_type ?? 'audio/wav'),
        sizeBytes: Number(s.size_bytes ?? 0),
        hash: String(s.hash_sha256 ?? ''),
      })),
      labels: v.labels as Record<string, string> | undefined,
      category: (v.category as 'cloned' | 'generated' | 'premade') ?? 'cloned',
      createdAt: new Date(v.date_created as string ?? Date.now()),
    };
  }

  /** Edit voice metadata */
  async editVoice(voiceId: string, updates: { name?: string; description?: string; labels?: Record<string, string> }): Promise<void> {
    const formData = new FormData();
    if (updates.name) formData.append('name', updates.name);
    if (updates.description) formData.append('description', updates.description);
    if (updates.labels) formData.append('labels', JSON.stringify(updates.labels));

    const res = await fetch(`${this.baseUrl}/voices/${voiceId}/edit`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to edit voice (${res.status}): ${await res.text()}`);
    }

    logger.info({ voiceId, updates: Object.keys(updates) }, 'Voice edited successfully');
  }

  /** Generate a preview of a voice with sample text */
  async generatePreview(voiceId: string, text: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 500), // Limit preview length
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Preview generation failed (${res.status}): ${await res.text()}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  /** Convert a cloned voice to a VoiceProfile for use with TTSClient */
  toVoiceProfile(clonedVoice: ClonedVoice, language = 'en'): VoiceProfile {
    return {
      id: `cloned-${clonedVoice.voiceId}`,
      name: clonedVoice.name,
      language,
      gender: 'neutral', // Cloned voices preserve the original speaker's gender
      provider: 'elevenlabs',
      providerVoiceId: clonedVoice.voiceId,
    };
  }
}
