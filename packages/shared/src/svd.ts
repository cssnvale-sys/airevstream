/**
 * Stable Video Diffusion (SVD) Video Generation Workflow Builder
 *
 * Builds ComfyUI API-format workflows for the SVD image-to-video model.
 * SVD takes a single keyframe image + motion parameters and generates
 * a short video clip (14-25 frames) with real motion.
 *
 * Model: svd_xt_1_1.safetensors (Stable Video Diffusion XT 1.1)
 * Architecture: SD1.5-based (~5GB, runs natively on Apple Silicon MPS)
 * Output: Video frames → VHS_VideoCombine → MP4
 *
 * Advantages over FramePack:
 * - Works natively on Apple Silicon MPS (no 390GB tensor issue)
 * - 2-5 min per clip (vs 10-15 min with CPU fallback)
 * - Built into ComfyUI core (no custom wrapper needed)
 */

import type { ComfyUIWorkflow } from './comfyui-composer.js';
import { createLogger } from './logger.js';

const logger = createLogger('svd');

/** Parameters for SVD video generation */
export interface SVDParams {
  /** Path/filename of the keyframe image (must be in ComfyUI input directory) */
  keyframeImage: string;
  /** Width of output video */
  width?: number;
  /** Height of output video */
  height?: number;
  /** Number of video frames to generate (default 25, max ~40) */
  videoFrames?: number;
  /** Motion bucket ID (1-255, higher = more motion, default 127) */
  motionBucketId?: number;
  /** Output FPS (default 8) */
  fps?: number;
  /** Augmentation level for noise (0-10, default 0) */
  augmentationLevel?: number;
  /** Random seed */
  seed: number;
  /** Number of sampling steps (default 25) */
  steps?: number;
  /** CFG scale (default 2.5 for SVD) */
  cfg?: number;
  /** Sampler name (default "euler") */
  sampler?: string;
  /** Scheduler (default "karras") */
  scheduler?: string;
  /** Model filename in checkpoints/ (default svd_xt_1_1.safetensors) */
  modelFile?: string;
  /** VAE filename (default ae.safetensors — SD1.5 VAE) */
  vaeFile?: string;
  /** CLIP Vision model filename */
  clipVisionFile?: string;
  /** Output filename prefix */
  filenamePrefix?: string;
  /** Output frame rate for video file (default 8) */
  frameRate?: number;
  /** Output video format (default video/h264-mp4) */
  videoFormat?: string;
  /** CRF quality (default 20, lower = higher quality) */
  crf?: number;
}

/**
 * Build a ComfyUI API-format workflow for SVD image-to-video generation.
 *
 * Node graph:
 *   1. CheckpointLoaderSimple → MODEL, CLIP, VAE (SVD checkpoint)
 *   2. VAELoader → VAE (separate VAE for decoding)
 *   3. CLIPVisionLoader → CLIP_VISION (sigclip)
 *   4. LoadImage → IMAGE (keyframe)
 *   5. SVD_img2vid_Conditioning → positive, negative, latent
 *   6. KSampler → LATENT (video frames)
 *   7. VAEDecode → IMAGE (frames batch)
 *   8. VHS_VideoCombine → video file (MP4)
 */
export function composeSVDWorkflow(params: SVDParams): ComfyUIWorkflow {
  const {
    keyframeImage,
    width = 1024,
    height = 576,
    videoFrames = 25,
    motionBucketId = 127,
    fps = 8,
    augmentationLevel = 0.0,
    seed,
    steps = 25,
    cfg = 2.5,
    sampler = 'euler',
    scheduler = 'karras',
    modelFile = 'svd_xt_1_1.safetensors',
    vaeFile = 'ae.safetensors',
    clipVisionFile = 'sigclip_vision_patch14_384.safetensors',
    filenamePrefix = 'airevstream_svd',
    frameRate = 8,
    videoFormat = 'video/h264-mp4',
    crf = 20,
  } = params;

  const workflow: ComfyUIWorkflow = {};

  // Node 1: CheckpointLoaderSimple (SVD model)
  workflow['1'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: modelFile },
    _meta: { title: 'Load SVD Model' },
  };

  // Node 2: VAELoader (separate VAE for SVD decoding)
  workflow['2'] = {
    class_type: 'VAELoader',
    inputs: { vae_name: vaeFile },
    _meta: { title: 'Load VAE' },
  };

  // Node 3: CLIPVisionLoader (CLIP Vision for image conditioning)
  workflow['3'] = {
    class_type: 'CLIPVisionLoader',
    inputs: { clip_name: clipVisionFile },
    _meta: { title: 'Load CLIP Vision' },
  };

  // Node 4: LoadImage (keyframe)
  workflow['4'] = {
    class_type: 'LoadImage',
    inputs: { image: keyframeImage },
    _meta: { title: 'Load Keyframe' },
  };

  // Node 5: SVD_img2vid_Conditioning (condition the model for video generation)
  workflow['5'] = {
    class_type: 'SVD_img2vid_Conditioning',
    inputs: {
      clip_vision: ['3', 0],
      init_image: ['4', 0],
      vae: ['2', 0],
      width,
      height,
      video_frames: videoFrames,
      motion_bucket_id: motionBucketId,
      fps,
      augmentation_level: augmentationLevel,
    },
    _meta: { title: 'SVD Conditioning' },
  };

  // Node 6: KSampler (generate video frames)
  workflow['6'] = {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      positive: ['5', 0],
      negative: ['5', 1],
      latent_image: ['5', 2],
      seed,
      steps,
      cfg,
      sampler_name: sampler,
      scheduler,
      denoise: 1.0,
    },
    _meta: { title: 'SVD Sampler' },
  };

  // Node 7: VAEDecode (decode latent to image frames)
  workflow['7'] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['6', 0],
      vae: ['2', 0],
    },
    _meta: { title: 'VAE Decode' },
  };

  // Node 8: VHS_VideoCombine (combine frames into MP4 video)
  workflow['8'] = {
    class_type: 'VHS_VideoCombine',
    inputs: {
      images: ['7', 0],
      frame_rate: frameRate,
      loop_count: 0,
      filename_prefix: filenamePrefix,
      format: videoFormat,
      pix_fmt: 'yuv420p',
      crf,
      save_output: true,
      pingpong: false,
    },
    _meta: { title: 'Save Video (MP4)' },
  };

  logger.info(
    { keyframeImage, motionBucketId, videoFrames, fps, seed, steps, modelFile },
    'Composed SVD video workflow',
  );

  return workflow;
}

/** Default SVD parameters optimized for AIRevStream shot generation */
export const SVD_DEFAULTS: Partial<SVDParams> = {
  steps: 25,
  cfg: 2.5,
  sampler: 'euler',
  scheduler: 'karras',
  modelFile: 'svd_xt.safetensors',
  vaeFile: 'ae2.safetensors',
  clipVisionFile: 'sigclip_vision_patch14_384.safetensors',
  videoFrames: 25,
  motionBucketId: 127,
  fps: 8,
  augmentationLevel: 0.0,
  frameRate: 8,
  videoFormat: 'video/h264-mp4',
  crf: 20,
};

/**
 * Map camera movement string to SVD motion_bucket_id.
 * Higher motion_bucket_id = more motion in generated video.
 */
export function cameraMovementToMotionBucket(movement?: string): number {
  const map: Record<string, number> = {
    'pan-left': 100,
    'pan-right': 100,
    'tilt-up': 90,
    'tilt-down': 90,
    'dolly-in': 127,
    'dolly-out': 127,
    'crane-up': 180,
    'crane-down': 180,
    'zoom-in': 200,
    'zoom-out': 200,
    'orbit-left': 150,
    'orbit-right': 150,
    'tracking-left': 150,
    'tracking-right': 150,
    'handheld-subtle': 60,
    'static': 40,
  };
  return map[movement ?? ''] ?? 127;
}

/**
 * Convenience function to compose an SVD workflow from shot parameters.
 *
 * @param keyframeImage - filename of the keyframe in ComfyUI input directory
 * @param _prompt - unused (SVD is image-conditioned, not text-conditioned)
 * @param seed - random seed
 * @param _durationSec - unused (SVD generates fixed frame count, not duration-based)
 * @param cameraMovement - camera movement string for motion mapping
 * @returns ComfyUI workflow JSON for SVD video generation
 */
export function composeSVDForShot(
  keyframeImage: string,
  _prompt: string,
  seed: number,
  _durationSec: number,
  cameraMovement?: string,
): ComfyUIWorkflow {
  const motionBucketId = cameraMovementToMotionBucket(cameraMovement);

  return composeSVDWorkflow({
    keyframeImage,
    seed,
    motionBucketId,
    ...SVD_DEFAULTS,
  });
}