import type { AudioMixConfig, AudioTrack, AudioMixResult } from './types.js';

// WAV header constants
const WAV_HEADER_SIZE = 44;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1; // mono output
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

/**
 * AudioMixer — Mixes multiple audio tracks into a single WAV output.
 *
 * Supports volume control, fading, looping, and timed placement.
 * Works with raw WAV PCM data without external dependencies.
 */
export class AudioMixer {
  /**
   * Mix multiple audio tracks into a single output.
   */
  async mix(config: AudioMixConfig): Promise<AudioMixResult> {
    const sampleRate = config.sampleRate ?? 44100;

    // Calculate total duration
    let totalDurationMs = config.totalDurationMs ?? 0;

    if (totalDurationMs <= 0) {
      // Auto-detect from tracks
      for (const track of config.tracks) {
        const trackDurationMs = this.getTrackDurationMs(track, sampleRate);
        const endMs = (track.startMs ?? 0) + trackDurationMs;
        totalDurationMs = Math.max(totalDurationMs, endMs);
      }
    }

    if (totalDurationMs <= 0) {
      totalDurationMs = 1000; // fallback 1 second
    }

    const totalSamples = Math.ceil((totalDurationMs / 1000) * sampleRate);

    // Create output buffer (float for mixing precision)
    const mixBuffer = new Float32Array(totalSamples);

    // Mix each track
    for (const track of config.tracks) {
      this.mixTrack(mixBuffer, track, sampleRate, totalSamples);
    }

    // Clamp and convert to 16-bit PCM
    const pcmBuffer = this.floatToPCM16(mixBuffer);

    // Create WAV file
    const wavBuffer = this.createWavBuffer(pcmBuffer, sampleRate);

    return {
      buffer: wavBuffer,
      format: 'wav',
      durationMs: totalDurationMs,
    };
  }

  /**
   * Create a silent audio track of specified duration.
   */
  createSilence(durationMs: number, sampleRate: number = 44100): Buffer {
    const totalSamples = Math.ceil((durationMs / 1000) * sampleRate);
    const pcmBuffer = Buffer.alloc(totalSamples * BYTES_PER_SAMPLE);
    return this.createWavBuffer(pcmBuffer, sampleRate);
  }

  /**
   * Create an AudioTrack from an AudioLayerSpec (convenience for pipeline integration).
   */
  createTrackFromLayer(
    layerBuffer: Buffer,
    layer: { volume?: number; fadeInMs?: number; fadeOutMs?: number; loop?: boolean },
    startMs: number = 0,
  ): AudioTrack {
    return {
      buffer: layerBuffer,
      startMs,
      volume: layer.volume ?? 1.0,
      fadeInMs: layer.fadeInMs,
      fadeOutMs: layer.fadeOutMs,
      loop: layer.loop,
    };
  }

  // ─── Private Methods ───

  private getTrackDurationMs(track: AudioTrack, sampleRate: number): number {
    const samples = this.extractPCMSamples(track.buffer);
    if (!samples) return 0;
    return (samples.length / sampleRate) * 1000;
  }

  private mixTrack(
    output: Float32Array,
    track: AudioTrack,
    sampleRate: number,
    totalSamples: number,
  ): void {
    const samples = this.extractPCMSamples(track.buffer);
    if (!samples || samples.length === 0) return;

    const volume = track.volume ?? 1.0;
    const startSample = Math.floor(((track.startMs ?? 0) / 1000) * sampleRate);
    const fadeInSamples = track.fadeInMs ? Math.floor((track.fadeInMs / 1000) * sampleRate) : 0;
    const fadeOutMs = track.fadeOutMs ?? 0;

    if (track.loop) {
      // Loop the track to fill remaining output
      let outputPos = Math.max(0, startSample);
      while (outputPos < totalSamples) {
        for (let i = 0; i < samples.length && outputPos < totalSamples; i++, outputPos++) {
          const sampleValue = samples[i] * volume;
          const localPos = outputPos - startSample;

          // Apply fade in
          let fadeMultiplier = 1.0;
          if (fadeInSamples > 0 && localPos < fadeInSamples) {
            fadeMultiplier = localPos / fadeInSamples;
          }

          output[outputPos] += sampleValue * fadeMultiplier;
        }
      }
    } else {
      // Single play
      const trackDurationSamples = samples.length;
      const fadeOutSamples = fadeOutMs ? Math.floor((fadeOutMs / 1000) * sampleRate) : 0;

      for (let i = 0; i < trackDurationSamples; i++) {
        const outputPos = startSample + i;
        if (outputPos < 0 || outputPos >= totalSamples) continue;

        const sampleValue = samples[i] * volume;
        let fadeMultiplier = 1.0;

        // Fade in
        if (fadeInSamples > 0 && i < fadeInSamples) {
          fadeMultiplier = i / fadeInSamples;
        }

        // Fade out
        if (fadeOutSamples > 0 && i >= trackDurationSamples - fadeOutSamples) {
          const fadeOutPos = trackDurationSamples - i;
          fadeMultiplier *= fadeOutPos / fadeOutSamples;
        }

        output[outputPos] += sampleValue * fadeMultiplier;
      }
    }
  }

  /**
   * Extract normalized float PCM samples from a WAV buffer.
   * Returns null if the buffer is not a valid WAV.
   */
  private extractPCMSamples(buffer: Buffer): Float32Array | null {
    if (buffer.length < WAV_HEADER_SIZE) return null;

    // Check RIFF header
    const riff = buffer.toString('ascii', 0, 4);
    const wave = buffer.toString('ascii', 8, 12);

    if (riff !== 'RIFF' || wave !== 'WAVE') {
      // Not a WAV file — treat entire buffer as raw 16-bit PCM
      return this.rawPCMToFloat(buffer);
    }

    // Find data chunk
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);

      if (chunkId === 'data') {
        const dataStart = offset + 8;
        const dataEnd = Math.min(dataStart + chunkSize, buffer.length);
        const dataBuffer = buffer.subarray(dataStart, dataEnd);
        return this.rawPCMToFloat(dataBuffer);
      }

      offset += 8 + chunkSize;
      // Align to even byte boundary
      if (offset % 2 !== 0) offset++;
    }

    return null;
  }

  private rawPCMToFloat(buffer: Buffer): Float32Array {
    const sampleCount = Math.floor(buffer.length / BYTES_PER_SAMPLE);
    const samples = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const value = buffer.readInt16LE(i * BYTES_PER_SAMPLE);
      samples[i] = value / 32768; // Normalize to -1.0 to 1.0
    }

    return samples;
  }

  private floatToPCM16(samples: Float32Array): Buffer {
    const buffer = Buffer.alloc(samples.length * BYTES_PER_SAMPLE);

    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1.0, 1.0]
      const clamped = Math.max(-1.0, Math.min(1.0, samples[i]));
      const value = Math.round(clamped * 32767);
      buffer.writeInt16LE(value, i * BYTES_PER_SAMPLE);
    }

    return buffer;
  }

  private createWavBuffer(pcmData: Buffer, sampleRate: number): Buffer {
    const header = Buffer.alloc(WAV_HEADER_SIZE);
    const dataSize = pcmData.length;
    const fileSize = WAV_HEADER_SIZE + dataSize - 8;
    const byteRate = sampleRate * NUM_CHANNELS * BYTES_PER_SAMPLE;
    const blockAlign = NUM_CHANNELS * BYTES_PER_SAMPLE;

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);           // Sub-chunk size
    header.writeUInt16LE(1, 20);            // Audio format (PCM)
    header.writeUInt16LE(NUM_CHANNELS, 22); // Number of channels
    header.writeUInt32LE(sampleRate, 24);   // Sample rate
    header.writeUInt32LE(byteRate, 28);     // Byte rate
    header.writeUInt16LE(blockAlign, 32);   // Block align
    header.writeUInt16LE(BITS_PER_SAMPLE, 34); // Bits per sample

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
