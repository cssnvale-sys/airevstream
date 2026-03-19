/**
 * Video Generation Provider Interface
 *
 * Abstraction layer for AI video generation services (Veo, Sora, ComfyUI AnimateDiff, etc.)
 * All providers follow async polling: submit -> poll -> download.
 */

export interface VideoProvider {
  readonly name: string;
  readonly providerType: string;

  /** Submit a video generation request. Returns a job ID for polling. */
  generateVideo(request: VideoGenRequest): Promise<VideoGenResult>;

  /** Check the status of a submitted video generation job. */
  checkStatus(jobId: string): Promise<VideoJobStatus>;

  /** Download the completed video as a Buffer. */
  downloadVideo(jobId: string): Promise<Buffer>;

  /** Check if the provider is reachable and healthy. */
  healthCheck(): Promise<boolean>;
}

export interface VideoGenRequest {
  prompt: string;
  negativePrompt?: string;
  sourceImage?: Buffer;       // Image-to-video
  duration?: number;          // seconds (typically 2-16)
  aspectRatio?: string;       // "16:9", "9:16", "1:1"
  resolution?: string;        // "1080p", "720p", "4k"
  fps?: number;               // 24, 30, 60
  seed?: number;
  model?: string;             // Provider-specific model name
  style?: string;             // Provider-specific style preset
}

export interface VideoGenResult {
  jobId: string;
  status: VideoJobStatusType;
  estimatedWaitMs?: number;
}

export type VideoJobStatusType = 'queued' | 'processing' | 'complete' | 'failed';

export interface VideoJobStatus {
  jobId: string;
  status: VideoJobStatusType;
  progress?: number;          // 0-100
  videoUrl?: string;          // Available when complete
  durationMs?: number;        // Final video duration
  error?: string;             // Error message when failed
}
