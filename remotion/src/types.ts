// ─── Remotion Composition Types ───
// Types shared across all compositions and components

// ─── Beat / Timing Types ───

/**
 * H.I.C.C. Framework sections:
 * - Hook: Attention-grabbing opening (first 1-3 seconds)
 * - Intro: Set context and expectations
 * - Content: Main body, broken into multiple beats
 * - CTA: Call to action / closing
 */
export type HiccSection = 'hook' | 'intro' | 'content' | 'cta';

/** Beat preset names from @airevstream/shared */
export type BeatPreset =
  | 'INTIMATE'
  | 'TENSION'
  | 'POWER'
  | 'AWE'
  | 'PSYCHOLOGICAL'
  | 'EMOTIONAL'
  | 'MOMENTUM'
  | 'CALM';

/** A single beat timing entry within the video timeline */
export interface BeatTiming {
  /** Frame at which this beat starts */
  startFrame: number;
  /** Frame at which this beat ends */
  endFrame: number;
  /** Which H.I.C.C. section this beat belongs to */
  section: HiccSection;
  /** Optional beat preset for audio/visual mood */
  preset?: BeatPreset;
  /** Label for identification (e.g., "hook_1", "content_3") */
  label: string;
}

// ─── Shot / Media Types ───

/** Transition type between shots */
export type TransitionType = 'fade' | 'cut' | 'zoom' | 'slide-left' | 'slide-right';

/** A single shot within a video sequence */
export interface ShotData {
  /** Unique identifier for this shot */
  id: string;
  /** URL of the image/video source for this shot */
  src: string;
  /** Duration in frames this shot should display */
  durationInFrames: number;
  /** Transition to use when entering this shot */
  transitionIn: TransitionType;
  /** Transition to use when exiting this shot */
  transitionOut: TransitionType;
  /** Duration of the transition in frames */
  transitionDurationInFrames: number;
  /** Optional Ken Burns / camera motion */
  motion?: {
    /** Scale at start (1.0 = 100%) */
    startScale: number;
    /** Scale at end */
    endScale: number;
    /** X translation offset start (px) */
    startX: number;
    /** X translation offset end (px) */
    endX: number;
    /** Y translation offset start (px) */
    startY: number;
    /** Y translation offset end (px) */
    endY: number;
  };
  /** Which H.I.C.C. section this shot belongs to */
  section?: HiccSection;
}

// ─── Text Overlay Types ───

/** Position presets for text overlays */
export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Animation type for text entry/exit */
export type TextAnimation =
  | 'fade-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale-up'
  | 'typewriter'
  | 'none';

/** Configuration for a single text overlay */
export interface TextOverlayConfig {
  /** The text content to display */
  text: string;
  /** Frame at which this overlay appears */
  startFrame: number;
  /** Duration the overlay is visible (in frames) */
  durationInFrames: number;
  /** Position on screen */
  position: TextPosition;
  /** Entry animation */
  entryAnimation: TextAnimation;
  /** Exit animation */
  exitAnimation: TextAnimation;
  /** Duration of entry animation in frames */
  entryDurationInFrames: number;
  /** Duration of exit animation in frames */
  exitDurationInFrames: number;
  /** Font size in pixels */
  fontSize: number;
  /** Font weight */
  fontWeight: number;
  /** Text color (CSS color) */
  color: string;
  /** Optional text shadow for readability */
  textShadow?: string;
  /** Optional background behind text */
  backgroundColor?: string;
  /** Optional padding around text */
  padding?: number;
  /** Optional border radius */
  borderRadius?: number;
  /** Optional max width */
  maxWidth?: number;
}

// ─── Audio Types ───

/** Audio visualization style */
export type VisualizationStyle = 'waveform' | 'bars' | 'circle' | 'line';

/** Configuration for audio visualization */
export interface AudioVisualizationConfig {
  /** Style of visualization */
  style: VisualizationStyle;
  /** Color of the visualization elements */
  color: string;
  /** Opacity of the visualization (0-1) */
  opacity: number;
  /** Width of the visualization area */
  width: number;
  /** Height of the visualization area */
  height: number;
  /** Number of bars/segments (for bar visualization) */
  barCount: number;
  /** Gap between bars in pixels */
  barGap: number;
  /** Smoothing factor (0-1) */
  smoothing: number;
}

// ─── Composition Props ───

/** H.I.C.C. script structure */
export interface HiccScript {
  hook: string;
  intro: string;
  content: string[];
  cta: string;
}

/** Props for ShortFormVideo (9:16 vertical, e.g., TikTok, Reels, Shorts) */
export interface ShortFormVideoProps {
  /** Video title */
  title: string;
  /** H.I.C.C. structured script */
  script: HiccScript;
  /** Array of shot data for the visual sequence */
  shots: ShotData[];
  /** URL to background audio track */
  audioUrl: string | null;
  /** Beat timing markers for the H.I.C.C. framework */
  beatTimings: BeatTiming[];
  /** Text overlays to render */
  textOverlays: TextOverlayConfig[];
  /** Beat preset for mood/style */
  beatPreset: BeatPreset;
  /** Whether to show audio visualization */
  showAudioVisualization: boolean;
}

/** Props for LongFormVideo (16:9 horizontal, e.g., YouTube) */
export interface LongFormVideoProps {
  /** Video title */
  title: string;
  /** H.I.C.C. structured script */
  script: HiccScript;
  /** Array of shot data for the visual sequence */
  shots: ShotData[];
  /** URL to background audio track */
  audioUrl: string | null;
  /** Beat timing markers for the H.I.C.C. framework */
  beatTimings: BeatTiming[];
  /** Text overlays to render */
  textOverlays: TextOverlayConfig[];
  /** Beat preset for mood/style */
  beatPreset: BeatPreset;
  /** Whether to show audio visualization */
  showAudioVisualization: boolean;
  /** Optional lower-third title display */
  showLowerThird: boolean;
}

/** Props for ThumbnailRenderer (static image) */
export interface ThumbnailProps {
  /** Main title text */
  title: string;
  /** URL for the background image */
  backgroundUrl: string | null;
  /** Optional large overlay text (bold, eye-catching) */
  overlayText: string | null;
  /** URL for the channel avatar/logo */
  channelAvatar: string | null;
  /** Gradient overlay color (CSS gradient or color) */
  gradientColor: string;
  /** Title font size */
  titleFontSize: number;
  /** Overlay text font size */
  overlayFontSize: number;
}

// ─── Component Props ───

/** Props for the ShotSequence component */
export interface ShotSequenceProps {
  /** Array of shots to render in sequence */
  shots: ShotData[];
  /** Width of the composition */
  width: number;
  /** Height of the composition */
  height: number;
}

/** Props for the TextOverlay component */
export interface TextOverlayProps {
  config: TextOverlayConfig;
  /** Width of the composition (for positioning) */
  compositionWidth: number;
  /** Height of the composition (for positioning) */
  compositionHeight: number;
}

/** Props for the AudioVisualization component */
export interface AudioVisualizationProps {
  /** URL of the audio to visualize */
  audioUrl: string;
  /** Visualization configuration */
  config: AudioVisualizationConfig;
}

// ─── Default Values ───

/** Default beat timings for a 60-second short-form video at 30fps */
export const DEFAULT_SHORT_BEAT_TIMINGS: BeatTiming[] = [
  { startFrame: 0, endFrame: 90, section: 'hook', label: 'hook_1', preset: 'POWER' },
  { startFrame: 90, endFrame: 270, section: 'intro', label: 'intro_1', preset: 'MOMENTUM' },
  { startFrame: 270, endFrame: 1500, section: 'content', label: 'content_main', preset: 'EMOTIONAL' },
  { startFrame: 1500, endFrame: 1800, section: 'cta', label: 'cta_1', preset: 'INTIMATE' },
];

/** Default beat timings for a 300-second long-form video at 30fps */
export const DEFAULT_LONG_BEAT_TIMINGS: BeatTiming[] = [
  { startFrame: 0, endFrame: 150, section: 'hook', label: 'hook_1', preset: 'POWER' },
  { startFrame: 150, endFrame: 600, section: 'intro', label: 'intro_1', preset: 'MOMENTUM' },
  { startFrame: 600, endFrame: 8100, section: 'content', label: 'content_main', preset: 'EMOTIONAL' },
  { startFrame: 8100, endFrame: 9000, section: 'cta', label: 'cta_1', preset: 'INTIMATE' },
];

/** Default audio visualization config */
export const DEFAULT_AUDIO_VIZ_CONFIG: AudioVisualizationConfig = {
  style: 'bars',
  color: '#ffffff',
  opacity: 0.6,
  width: 300,
  height: 60,
  barCount: 32,
  barGap: 2,
  smoothing: 0.8,
};

/** Mood color mappings for beat presets */
export const BEAT_PRESET_COLORS: Record<BeatPreset, { primary: string; secondary: string; accent: string }> = {
  INTIMATE: { primary: '#2d1b69', secondary: '#1a0a3e', accent: '#8b5cf6' },
  TENSION: { primary: '#4a0000', secondary: '#1a0000', accent: '#ef4444' },
  POWER: { primary: '#1e3a5f', secondary: '#0a1929', accent: '#3b82f6' },
  AWE: { primary: '#1a3320', secondary: '#0a1a10', accent: '#22c55e' },
  PSYCHOLOGICAL: { primary: '#3d1f00', secondary: '#1a0d00', accent: '#f59e0b' },
  EMOTIONAL: { primary: '#3d0a2e', secondary: '#1a0413', accent: '#ec4899' },
  MOMENTUM: { primary: '#1a2744', secondary: '#0a1225', accent: '#06b6d4' },
  CALM: { primary: '#1a2e1a', secondary: '#0a140a', accent: '#a3e635' },
};
