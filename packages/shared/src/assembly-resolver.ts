/**
 * Assembly Resolver — converts an AssemblyManifest into Remotion render params.
 *
 * This module bridges the gap between the assembly manifest (pipeline data model)
 * and Remotion's composition props (frame-based rendering model).
 *
 * Remotion types are defined as minimal compatible interfaces here to avoid
 * cross-package runtime dependency on the remotion/ package.
 */

import type { AssemblyManifest, AssembledShot, ColorGradeSpec } from './types.js';
import { getCompositionById } from './composition-registry.js';

// ─── Minimal Remotion-compatible interfaces ───
// These mirror the types in remotion/src/types.ts without a runtime import.

export interface CinemaShotData {
  id: string;
  src: string;
  videoSrc?: string;
  isVideo?: boolean;
  durationInFrames: number;
  transitionIn: string;
  transitionOut: string;
  transitionDurationInFrames: number;
  camera?: {
    lens?: string;
    framing?: string;
    movement?: string;
    dof?: 'shallow' | 'medium' | 'deep';
    stabilization?: 'handheld' | 'steadicam' | 'tripod' | 'gimbal';
  };
  colorGrade?: {
    temperature?: number;
    tint?: number;
    contrast?: number;
    saturation?: number;
    highlights?: number;
    shadows?: number;
    blacks?: number;
    whites?: number;
    filmGrain?: number;
    vignette?: number;
  };
  subtitles?: SubtitleEntry[];
  section?: string;
}

export interface BeatTiming {
  startFrame: number;
  endFrame: number;
  section: 'hook' | 'intro' | 'content' | 'cta';
  preset?: string;
  label: string;
}

export interface SubtitleEntry {
  text: string;
  startFrame: number;
  endFrame: number;
  position?: 'top' | 'center' | 'bottom';
  style?: 'default' | 'bold' | 'outline' | 'shadow';
}

export interface CinemaAudioTrack {
  src: string;
  startFrame: number;
  durationInFrames?: number;
  volume: number;
  loop?: boolean;
  layer: 'bg' | 'mg' | 'fg';
}

// ─── Resolver Output ───

export interface ResolveResult {
  compositionId: string;
  inputProps: Record<string, unknown>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  codec: 'h264' | 'prores';
}

// ─── Core Resolver ───

/**
 * Convert an AssemblyManifest into Remotion render parameters.
 * This is the primary entry point for the production worker.
 */
export function resolveForRemotion(manifest: AssemblyManifest): ResolveResult {
  const { outputSpec, compositionId } = manifest;
  const fps = outputSpec.fps;
  const totalDurationInFrames = Math.max(1, Math.round(outputSpec.totalDurationSec * fps));

  const shots = toCinemaShotData(manifest.shots, fps);
  const beatTimings = toBeatTimings(manifest.beatTimings, fps);
  const subtitles = toSubtitleEntries(manifest.subtitles, fps);
  const audioTracks = toAudioTracks(manifest.shots, fps);

  // Build CinemaVideoProps-compatible input props
  const inputProps: Record<string, unknown> = {
    title: manifest.contentId, // Will be overridden by caller with actual title
    shots,
    audioTracks,
    fps,
    width: outputSpec.width,
    height: outputSpec.height,
  };

  // Apply global color grade if present
  if (manifest.globalColorGrade) {
    inputProps.colorGrade = toColorGrade(manifest.globalColorGrade);
  }

  if (beatTimings.length > 0) {
    inputProps.beatTimings = beatTimings;
  }

  // Build text overlays from subtitles
  if (subtitles.length > 0) {
    inputProps.textOverlays = subtitles.map(sub => ({
      text: sub.text,
      startFrame: sub.startFrame,
      durationInFrames: sub.endFrame - sub.startFrame,
      position: sub.position === 'top' ? 'top-center' : sub.position === 'bottom' ? 'bottom-center' : 'center',
      entryAnimation: 'fade-in',
      exitAnimation: 'fade-in',
      entryDurationInFrames: 6,
      exitDurationInFrames: 6,
      fontSize: 32,
      fontWeight: 600,
      color: '#ffffff',
      textShadow: '0 2px 4px rgba(0,0,0,0.8)',
    }));
  }

  return {
    compositionId,
    inputProps,
    width: outputSpec.width,
    height: outputSpec.height,
    fps,
    durationInFrames: totalDurationInFrames,
    codec: outputSpec.codec,
  };
}

// ─── Conversion Functions ───

/**
 * Convert sec-based AssembledShot[] to frame-based CinemaShotData[].
 */
export function toCinemaShotData(shots: AssembledShot[], fps: number): CinemaShotData[] {
  return shots.map((shot, idx) => ({
    id: shot.shotId,
    src: shot.keyframeUrl ?? '',
    videoSrc: shot.videoPlateUrl,
    isVideo: !!shot.videoPlateUrl,
    durationInFrames: Math.max(1, Math.round(shot.durationSec * fps)),
    transitionIn: idx === 0 ? 'fade' : (shot.transition ?? 'cut'),
    transitionOut: 'cut',
    transitionDurationInFrames: idx === 0 ? 12 : 6,
    camera: shot.camera,
    colorGrade: shot.colorGrade ? toColorGrade(shot.colorGrade) : undefined,
    section: shot.beat,
  }));
}

/**
 * Convert sec-based beat timings to frame-based BeatTiming[].
 */
export function toBeatTimings(
  timings: AssemblyManifest['beatTimings'],
  fps: number,
): BeatTiming[] {
  if (!timings) return [];
  return timings.map(t => ({
    startFrame: Math.round(t.startSec * fps),
    endFrame: Math.round(t.endSec * fps),
    section: t.section,
    preset: t.preset,
    label: t.label,
  }));
}

/**
 * Convert sec-based subtitles to frame-based SubtitleEntry[].
 */
export function toSubtitleEntries(
  subtitles: AssemblyManifest['subtitles'],
  fps: number,
): SubtitleEntry[] {
  if (!subtitles) return [];
  return subtitles.map(s => ({
    text: s.text,
    startFrame: Math.round(s.startSec * fps),
    endFrame: Math.round(s.endSec * fps),
    position: s.position,
  }));
}

/**
 * Extract audio tracks from assembled shots and convert to frame-based CinemaAudioTrack[].
 */
export function toAudioTracks(shots: AssembledShot[], fps: number): CinemaAudioTrack[] {
  const tracks: CinemaAudioTrack[] = [];

  for (const shot of shots) {
    const startFrame = Math.round(shot.startSec * fps);
    const stemUrls = shot.audioStemUrls;

    // Collect from audioStemUrls
    if (stemUrls) {
      for (const layer of ['fg', 'mg', 'bg'] as const) {
        const src = stemUrls[layer];
        if (src) {
          tracks.push({
            src,
            startFrame,
            volume: layer === 'fg' ? 0.9 : layer === 'bg' ? 0.3 : 0.5,
            loop: layer === 'bg',
            layer,
          });
        }
      }
    }

    // Also collect from audioPlan if fileKey is specified
    if (shot.audioPlan) {
      for (const layer of ['fg', 'mg', 'bg'] as const) {
        const layerSpec = shot.audioPlan[layer];
        if (layerSpec?.fileKey && !stemUrls?.[layer]) {
          tracks.push({
            src: layerSpec.fileKey,
            startFrame,
            volume: layerSpec.volume ?? (layer === 'fg' ? 0.9 : layer === 'bg' ? 0.3 : 0.5),
            loop: layerSpec.loop ?? layer === 'bg',
            layer,
          });
        }
      }
    }
  }

  return tracks;
}

/**
 * Derive BeatTiming[] from DirectorOutput.sections.
 */
export function deriveBeatsFromDirector(
  sections: Array<{ type: 'hook' | 'intro' | 'content' | 'cta'; durationSec: number; beat?: string }>,
  fps: number,
): BeatTiming[] {
  const timings: BeatTiming[] = [];
  let currentSec = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const startFrame = Math.round(currentSec * fps);
    const endFrame = Math.round((currentSec + section.durationSec) * fps);

    timings.push({
      startFrame,
      endFrame,
      section: section.type,
      preset: section.beat,
      label: `${section.type}_${i + 1}`,
    });

    currentSec += section.durationSec;
  }

  return timings;
}

/**
 * Safely parse keyframeUrls from a database column value.
 * Handles: string[], string (JSON), null, undefined.
 */
export function parseKeyframeUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // Not JSON, treat as single URL
      return raw.length > 0 ? [raw] : [];
    }
  }
  return [];
}

/**
 * Create a draft-quality manifest by downgrading quality settings.
 * Used for preview pipeline rendering.
 */
export function toDraftManifest(manifest: AssemblyManifest): AssemblyManifest {
  return {
    ...manifest,
    qualityTier: 'draft',
    outputSpec: {
      ...manifest.outputSpec,
      width: Math.min(manifest.outputSpec.width, 1280),
      height: Math.min(manifest.outputSpec.height, 720),
      fps: Math.min(manifest.outputSpec.fps, 24),
      codec: 'h264',
    },
    updatedAt: new Date().toISOString(),
  };
}

// ─── Internal Helpers ───

function toColorGrade(spec: ColorGradeSpec): Record<string, unknown> {
  const grade: Record<string, unknown> = {};
  if (spec.temperature !== undefined) grade.temperature = spec.temperature;
  if (spec.tint !== undefined) grade.tint = spec.tint;
  if (spec.contrast !== undefined) grade.contrast = spec.contrast;
  if (spec.saturation !== undefined) grade.saturation = spec.saturation;
  if (spec.highlights !== undefined) grade.highlights = spec.highlights;
  if (spec.shadows !== undefined) grade.shadows = spec.shadows;
  if (spec.blacks !== undefined) grade.blacks = spec.blacks;
  if (spec.whites !== undefined) grade.whites = spec.whites;
  return grade;
}
