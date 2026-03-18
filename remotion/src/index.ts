// ─── @airevstream/remotion ───
// Re-exports for programmatic use of compositions and types

export { RemotionRoot } from './Root';

// Compositions
export { ShortFormVideo } from './compositions/ShortFormVideo';
export { LongFormVideo } from './compositions/LongFormVideo';
export { ThumbnailRenderer } from './compositions/ThumbnailRenderer';

// Components
export { ShotSequence } from './components/ShotSequence';
export { TextOverlay } from './components/TextOverlay';
export { AudioVisualization } from './components/AudioVisualization';

// Types
export type {
  // Beat / Timing
  HiccSection,
  BeatPreset,
  BeatTiming,

  // Shot / Media
  TransitionType,
  ShotData,

  // Text Overlay
  TextPosition,
  TextAnimation,
  TextOverlayConfig,

  // Audio
  VisualizationStyle,
  AudioVisualizationConfig,

  // Composition Props
  HiccScript,
  ShortFormVideoProps,
  LongFormVideoProps,
  ThumbnailProps,

  // Component Props
  ShotSequenceProps,
  TextOverlayProps,
  AudioVisualizationProps,
} from './types';

// Constants
export {
  DEFAULT_SHORT_BEAT_TIMINGS,
  DEFAULT_LONG_BEAT_TIMINGS,
  DEFAULT_AUDIO_VIZ_CONFIG,
  BEAT_PRESET_COLORS,
} from './types';
