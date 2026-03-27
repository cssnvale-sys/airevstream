import React from 'react';
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { ShotSequence } from '../components/ShotSequence';
import { TextOverlay } from '../components/TextOverlay';
import { AudioVisualization } from '../components/AudioVisualization';
import type {
  ShortFormVideoProps,
  BeatTiming,
  HiccSection,
} from '../types';
import {
  DEFAULT_SHORT_BEAT_TIMINGS,
  DEFAULT_AUDIO_VIZ_CONFIG,
  BEAT_PRESET_COLORS,
} from '../types';

/**
 * ShortFormVideo — 9:16 vertical video composition (1080x1920, 30fps)
 *
 * Designed for TikTok, Instagram Reels, and YouTube Shorts.
 * Uses the H.I.C.C. framework (Hook/Intro/Content/CTA) to structure
 * the beat timing and visual rhythm of the video.
 *
 * The composition layers are (bottom to top):
 * 1. Background gradient (mood-matched to beat preset)
 * 2. Shot sequence (images with transitions)
 * 3. Section indicator (H.I.C.C. phase)
 * 4. Text overlays (animated)
 * 5. Audio visualization
 * 6. Audio track
 */
export const ShortFormVideo: React.FC<ShortFormVideoProps> = ({
  title: _title,
  script,
  shots,
  audioUrl,
  beatTimings,
  textOverlays,
  beatPreset,
  showAudioVisualization,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const timings = beatTimings.length > 0 ? beatTimings : DEFAULT_SHORT_BEAT_TIMINGS;
  const currentSection = getCurrentSection(frame, timings);
  const colors = BEAT_PRESET_COLORS[beatPreset];

  // ─── Section Progress ───
  const currentBeat = timings.find(
    (b) => frame >= b.startFrame && frame < b.endFrame,
  );
  const sectionProgress = currentBeat
    ? interpolate(
        frame,
        [currentBeat.startFrame, currentBeat.endFrame],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Animated background gradient */}
      <MoodBackground
        colors={colors}
        frame={frame}
        width={width}
        height={height}
        section={currentSection}
      />

      {/* Layer 2: Shot sequence */}
      <ShotSequence shots={shots} width={width} height={height} />

      {/* Layer 3: Vignette overlay for depth */}
      <Vignette width={width} height={height} />

      {/* Layer 4: H.I.C.C. Section indicator (subtle) */}
      <SectionIndicator
        section={currentSection}
        progress={sectionProgress}
        width={width}
      />

      {/* Layer 5: Script text for current section */}
      <ScriptText
        script={script}
        section={currentSection}
        frame={frame}
        timings={timings}
        width={width}
        height={height}
        isVertical
      />

      {/* Layer 6: Custom text overlays */}
      {textOverlays.map((overlay, i) => (
        <TextOverlay
          key={`overlay-${i}`}
          config={overlay}
          compositionWidth={width}
          compositionHeight={height}
        />
      ))}

      {/* Layer 7: Audio visualization */}
      {showAudioVisualization && audioUrl && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <AudioVisualization
            audioUrl={audioUrl}
            config={{
              ...DEFAULT_AUDIO_VIZ_CONFIG,
              width: width * 0.7,
              height: 50,
              color: colors.accent,
            }}
          />
        </div>
      )}

      {/* Layer 8: Audio track */}
      {audioUrl && (
        <Audio src={audioUrl} volume={0.8} />
      )}
    </AbsoluteFill>
  );
};

// ─── Supporting Components ───

interface MoodBackgroundProps {
  colors: { primary: string; secondary: string; accent: string };
  frame: number;
  width: number;
  height: number;
  section: HiccSection;
}

const MoodBackground: React.FC<MoodBackgroundProps> = ({
  colors,
  frame,
  width,
  height,
  section,
}) => {
  // Subtle animated gradient shift based on frame
  const angle = interpolate(frame, [0, 600], [135, 225], {
    extrapolateRight: 'extend',
  });

  // Intensity varies by H.I.C.C. section
  const intensityMap: Record<HiccSection, number> = {
    hook: 1.0,
    intro: 0.7,
    content: 0.5,
    cta: 0.9,
  };
  const intensity = intensityMap[section];

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        background: `linear-gradient(${angle}deg, ${colors.secondary} 0%, ${colors.primary} 50%, ${colors.secondary} 100%)`,
        opacity: intensity,
      }}
    />
  );
};

const Vignette: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div
    style={{
      position: 'absolute',
      width,
      height,
      background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

interface SectionIndicatorProps {
  section: HiccSection;
  progress: number;
  width: number;
}

const SectionIndicator: React.FC<SectionIndicatorProps> = ({
  section,
  progress,
  width,
}) => {
  const labels: Record<HiccSection, string> = {
    hook: 'HOOK',
    intro: 'INTRO',
    content: 'CONTENT',
    cta: 'CTA',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: 0.4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: 2,
          fontFamily: '"Inter", monospace',
          textTransform: 'uppercase',
        }}
      >
        {labels[section]}
      </span>
      <div
        style={{
          width: 60,
          height: 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: '#ffffff',
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
};

// ─── Script Text Renderer ───

interface ScriptTextProps {
  script: { hook: string; intro: string; content: string[]; cta: string };
  section: HiccSection;
  frame: number;
  timings: BeatTiming[];
  width: number;
  height: number;
  isVertical: boolean;
}

const ScriptText: React.FC<ScriptTextProps> = ({
  script,
  section,
  frame,
  timings,
  width,
  height,
  isVertical,
}) => {
  // Find current beat for timing
  const currentBeat = timings.find(
    (b) => frame >= b.startFrame && frame < b.endFrame,
  );

  if (!currentBeat) return null;

  // Determine which text to show
  let text = '';
  switch (section) {
    case 'hook':
      text = script.hook;
      break;
    case 'intro':
      text = script.intro;
      break;
    case 'content':
      // Split content across the content beats
      const contentBeats = timings.filter((b) => b.section === 'content');
      const contentIndex = contentBeats.indexOf(currentBeat);
      if (contentIndex >= 0 && contentIndex < script.content.length) {
        text = script.content[contentIndex];
      } else if (script.content.length > 0) {
        // Distribute content evenly across beats
        const beatProgress = interpolate(
          frame,
          [contentBeats[0]?.startFrame ?? 0, contentBeats[contentBeats.length - 1]?.endFrame ?? 1],
          [0, script.content.length],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        text = script.content[Math.min(Math.floor(beatProgress), script.content.length - 1)];
      }
      break;
    case 'cta':
      text = script.cta;
      break;
  }

  if (!text) return null;

  // Entry animation for each section change
  const localFrame = frame - currentBeat.startFrame;
  const entryDuration = 15;
  const entryOpacity = interpolate(localFrame, [0, entryDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const entrySlide = interpolate(localFrame, [0, entryDuration], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const margin = isVertical ? 48 : 80;
  const fontSize = isVertical ? 36 : 28;
  const bottomPosition = isVertical ? 200 : 80;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomPosition,
        left: margin,
        right: margin,
        opacity: entryOpacity,
        transform: `translateY(${entrySlide}px)`,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize,
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0px 4px rgba(0,0,0,0.7)',
          lineHeight: 1.4,
          fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
};

// ─── Utility ───

function getCurrentSection(frame: number, timings: BeatTiming[]): HiccSection {
  for (const beat of timings) {
    if (frame >= beat.startFrame && frame < beat.endFrame) {
      return beat.section;
    }
  }
  // Default to content if between beats
  return 'content';
}
