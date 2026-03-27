/**
 * Composition Registry — metadata catalog for Remotion compositions.
 *
 * Maps production types to Remotion composition IDs, providing a lookup layer
 * between the assembly manifest and the actual Remotion Root registrations.
 */

import type { ConstraintViolation } from './constraint-validator.js';

// ─── Types ───

export interface CompositionMetadata {
  /** Matches Remotion Root registration (e.g., 'ShortFormVideo') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver version */
  version: string;
  /** What type of production this composition handles */
  productionType: 'short' | 'long' | 'cinema' | 'thumbnail';
  /** Default aspect ratio */
  aspectRatio: string;
  /** Default render width */
  defaultWidth: number;
  /** Default render height */
  defaultHeight: number;
  /** Default frames per second */
  defaultFps: number;
  /** Whether this composition produces a still image (not video) */
  isStill: boolean;
  /** Target platforms this composition is suitable for */
  outputTargets: string[];
  /** TypeScript interface name for documentation */
  propsInterface: string;
  /** Props that must be provided */
  requiredProps: string[];
  /** Props with default values */
  optionalProps: Record<string, unknown>;
  /** Supported output codecs */
  supportedCodecs: Array<'h264' | 'prores' | 'vp8' | 'vp9'>;
  /** Maximum duration in seconds (null = unlimited) */
  maxDurationSec: number | null;
  /** Searchable tags */
  tags?: string[];
}

// ─── Composition Registry ───

export const COMPOSITION_REGISTRY: CompositionMetadata[] = [
  {
    id: 'ShortFormVideo',
    name: 'Short-Form Video',
    version: '1.0.0',
    productionType: 'short',
    aspectRatio: '9:16',
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultFps: 30,
    isStill: false,
    outputTargets: ['tiktok', 'instagram', 'youtube-shorts'],
    propsInterface: 'ShortFormVideoProps',
    requiredProps: ['title', 'shots', 'beatTimings'],
    optionalProps: {
      audioUrl: null,
      textOverlays: [],
      beatPreset: 'POWER',
      showAudioVisualization: false,
    },
    supportedCodecs: ['h264', 'vp9'],
    maxDurationSec: 180,
    tags: ['short', 'vertical', 'social', 'tiktok', 'reels'],
  },
  {
    id: 'LongFormVideo',
    name: 'Long-Form Video',
    version: '1.0.0',
    productionType: 'long',
    aspectRatio: '16:9',
    defaultWidth: 1920,
    defaultHeight: 1080,
    defaultFps: 30,
    isStill: false,
    outputTargets: ['youtube', 'facebook'],
    propsInterface: 'LongFormVideoProps',
    requiredProps: ['title', 'shots', 'beatTimings'],
    optionalProps: {
      audioUrl: null,
      textOverlays: [],
      beatPreset: 'EMOTIONAL',
      showAudioVisualization: false,
      showLowerThird: true,
    },
    supportedCodecs: ['h264', 'prores', 'vp9'],
    maxDurationSec: null,
    tags: ['long', 'horizontal', 'youtube', 'documentary'],
  },
  {
    id: 'CinemaVideo',
    name: 'Cinema Video',
    version: '1.0.0',
    productionType: 'cinema',
    aspectRatio: '16:9',
    defaultWidth: 1920,
    defaultHeight: 1080,
    defaultFps: 24,
    isStill: false,
    outputTargets: ['youtube', 'vimeo'],
    propsInterface: 'CinemaVideoProps',
    requiredProps: ['title', 'shots', 'fps', 'width', 'height'],
    optionalProps: {
      audioTracks: [],
      colorGrade: undefined,
      beatTimings: [],
      textOverlays: [],
      watermark: undefined,
    },
    supportedCodecs: ['h264', 'prores'],
    maxDurationSec: null,
    tags: ['cinema', 'film', 'cinematic', 'multi-track'],
  },
  {
    id: 'SquareSocial',
    name: 'Square Social Video',
    version: '1.0.0',
    productionType: 'short',
    aspectRatio: '1:1',
    defaultWidth: 1080,
    defaultHeight: 1080,
    defaultFps: 30,
    isStill: false,
    outputTargets: ['instagram', 'facebook'],
    propsInterface: 'SquareSocialProps',
    requiredProps: ['title', 'shots', 'beatTimings'],
    optionalProps: {
      audioUrl: null,
      textOverlays: [],
      beatPreset: 'POWER',
      showAudioVisualization: false,
    },
    supportedCodecs: ['h264', 'vp9'],
    maxDurationSec: 180,
    tags: ['square', 'social', 'instagram', 'facebook', 'feed', '1:1'],
  },
  {
    id: 'UltrawideCinema',
    name: 'Ultrawide Cinema Video',
    version: '1.0.0',
    productionType: 'cinema',
    aspectRatio: '21:9',
    defaultWidth: 2560,
    defaultHeight: 1080,
    defaultFps: 24,
    isStill: false,
    outputTargets: ['youtube', 'vimeo'],
    propsInterface: 'UltrawideCinemaProps',
    requiredProps: ['title', 'shots', 'fps', 'width', 'height'],
    optionalProps: {
      audioTracks: [],
      colorGrade: undefined,
      beatTimings: [],
      textOverlays: [],
      watermark: undefined,
      letterboxHeight: 40,
    },
    supportedCodecs: ['h264', 'prores'],
    maxDurationSec: null,
    tags: ['ultrawide', 'cinema', 'cinematic', '21:9', 'theatrical', 'premium'],
  },
  {
    id: 'ThumbnailRenderer',
    name: 'Thumbnail Renderer',
    version: '1.0.0',
    productionType: 'thumbnail',
    aspectRatio: '16:9',
    defaultWidth: 1280,
    defaultHeight: 720,
    defaultFps: 1,
    isStill: true,
    outputTargets: ['youtube', 'facebook', 'instagram'],
    propsInterface: 'ThumbnailProps',
    requiredProps: ['title'],
    optionalProps: {
      backgroundUrl: null,
      overlayText: null,
      channelAvatar: null,
      gradientColor: 'linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%)',
      titleFontSize: 72,
      overlayFontSize: 96,
      variant: 'thumbnail',
    },
    supportedCodecs: ['h264'],
    maxDurationSec: 0,
    tags: ['thumbnail', 'still', 'social', 'cover'],
  },
];

// ─── Lookup Functions ───

/**
 * Find the best composition for a production type and optional aspect ratio.
 * Prefers cinema compositions for cinema type, otherwise matches on productionType.
 */
export function getCompositionForProduction(
  productionType: string,
  aspect?: string,
): CompositionMetadata | undefined {
  const candidates = COMPOSITION_REGISTRY.filter(c => c.productionType === productionType);
  if (candidates.length === 0) return undefined;

  if (aspect) {
    const match = candidates.find(c => c.aspectRatio === aspect);
    if (match) return match;
  }

  return candidates[0];
}

/**
 * Find a composition by its Remotion ID.
 */
export function getCompositionById(id: string): CompositionMetadata | undefined {
  return COMPOSITION_REGISTRY.find(c => c.id === id);
}

/**
 * Validate that a set of props satisfies a composition's requirements.
 * Returns an array of constraint violations (empty if valid).
 */
export function validateCompositionProps(
  compositionId: string,
  props: Record<string, unknown>,
): ConstraintViolation[] {
  const composition = getCompositionById(compositionId);
  if (!composition) {
    return [{
      field: 'compositionId',
      message: `Unknown composition: ${compositionId}`,
      severity: 'error',
    }];
  }

  const violations: ConstraintViolation[] = [];

  for (const field of composition.requiredProps) {
    const value = props[field];
    if (value === undefined || value === null) {
      violations.push({
        field,
        message: `Composition "${composition.name}" requires prop "${field}"`,
        severity: 'error',
      });
    }
  }

  return violations;
}
