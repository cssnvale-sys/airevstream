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
  LongFormVideoProps,
  BeatTiming,
  HiccSection,
} from '../types';
import {
  DEFAULT_LONG_BEAT_TIMINGS,
  DEFAULT_AUDIO_VIZ_CONFIG,
  BEAT_PRESET_COLORS,
} from '../types';

/**
 * LongFormVideo — 16:9 horizontal video composition (1920x1080, 30fps)
 *
 * Designed for YouTube and other landscape video platforms.
 * Uses the H.I.C.C. framework (Hook/Intro/Content/CTA) to structure
 * the beat timing and visual rhythm of the video.
 *
 * Composition layers (bottom to top):
 * 1. Background gradient (mood-matched to beat preset)
 * 2. Shot sequence (images with transitions)
 * 3. Vignette overlay
 * 4. Lower third (title bar) — optional
 * 5. Script text for current section
 * 6. Custom text overlays
 * 7. Audio visualization
 * 8. Audio track
 */
export const LongFormVideo: React.FC<LongFormVideoProps> = ({
  title,
  script,
  shots,
  audioUrl,
  beatTimings,
  textOverlays,
  beatPreset,
  showAudioVisualization,
  showLowerThird,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const timings = beatTimings.length > 0 ? beatTimings : DEFAULT_LONG_BEAT_TIMINGS;
  const currentSection = getCurrentSection(frame, timings);
  const colors = BEAT_PRESET_COLORS[beatPreset];

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

      {/* Layer 3: Cinematic vignette */}
      <CinematicVignette width={width} height={height} />

      {/* Layer 4: Section indicator (top-right, subtle) */}
      <SectionIndicator
        section={currentSection}
        progress={sectionProgress}
      />

      {/* Layer 5: Lower third title bar */}
      {showLowerThird && (
        <LowerThird
          title={title}
          frame={frame}
          width={width}
          height={height}
          accentColor={colors.accent}
        />
      )}

      {/* Layer 6: Script text for current H.I.C.C. section */}
      <ScriptText
        script={script}
        section={currentSection}
        frame={frame}
        timings={timings}
        width={width}
        height={height}
      />

      {/* Layer 7: Custom text overlays */}
      {textOverlays.map((overlay, i) => (
        <TextOverlay
          key={`overlay-${i}`}
          config={overlay}
          compositionWidth={width}
          compositionHeight={height}
        />
      ))}

      {/* Layer 8: Audio visualization */}
      {showAudioVisualization && audioUrl && (
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            right: 40,
          }}
        >
          <AudioVisualization
            audioUrl={audioUrl}
            config={{
              ...DEFAULT_AUDIO_VIZ_CONFIG,
              width: 200,
              height: 40,
              color: colors.accent,
              style: 'bars',
            }}
          />
        </div>
      )}

      {/* Layer 9: Audio track */}
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
  const angle = interpolate(frame, [0, 900], [135, 225], {
    extrapolateRight: 'extend',
  });

  const intensityMap: Record<HiccSection, number> = {
    hook: 1.0,
    intro: 0.6,
    content: 0.4,
    cta: 0.85,
  };

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        background: `linear-gradient(${angle}deg, ${colors.secondary} 0%, ${colors.primary} 50%, ${colors.secondary} 100%)`,
        opacity: intensityMap[section],
      }}
    />
  );
};

const CinematicVignette: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <>
    {/* Standard vignette */}
    <div
      style={{
        position: 'absolute',
        width,
        height,
        background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)`,
        pointerEvents: 'none',
      }}
    />
    {/* Cinematic letterbox bars (subtle) */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#000000',
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#000000',
      }}
    />
  </>
);

interface SectionIndicatorProps {
  section: HiccSection;
  progress: number;
}

const SectionIndicator: React.FC<SectionIndicatorProps> = ({
  section,
  progress,
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
        top: 20,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
        opacity: 0.3,
      }}
    >
      <span
        style={{
          fontSize: 10,
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
          width: 50,
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

// ─── Lower Third ───

interface LowerThirdProps {
  title: string;
  frame: number;
  width: number;
  height: number;
  accentColor: string;
}

const LowerThird: React.FC<LowerThirdProps> = ({
  title,
  frame,
  width,
  height,
  accentColor,
}) => {
  // Lower third animates in during the first 45 frames, stays, then fades out
  const entryDuration = 30;
  const stayDuration = 150;
  const exitDuration = 20;
  const totalDuration = entryDuration + stayDuration + exitDuration;

  // Only show during intro section roughly
  const showStart = 30; // Half a second in
  const localFrame = frame - showStart;

  if (localFrame < 0 || localFrame > totalDuration) return null;

  const opacity = interpolate(
    localFrame,
    [0, entryDuration, entryDuration + stayDuration, totalDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const slideX = interpolate(
    localFrame,
    [0, entryDuration],
    [-300, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const barWidth = interpolate(
    localFrame,
    [0, entryDuration * 0.6],
    [0, 4],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 100,
        left: 60,
        opacity,
        transform: `translateX(${slideX}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: barWidth,
          height: 48,
          backgroundColor: accentColor,
          borderRadius: 2,
        }}
      />
      {/* Title text */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px 20px',
          borderRadius: 4,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#ffffff',
            fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </span>
      </div>
    </div>
  );
};

// ─── Script Text ───

interface ScriptTextProps {
  script: { hook: string; intro: string; content: string[]; cta: string };
  section: HiccSection;
  frame: number;
  timings: BeatTiming[];
  width: number;
  height: number;
}

const ScriptText: React.FC<ScriptTextProps> = ({
  script,
  section,
  frame,
  timings,
  width,
  height,
}) => {
  const currentBeat = timings.find(
    (b) => frame >= b.startFrame && frame < b.endFrame,
  );

  if (!currentBeat) return null;

  let text = '';
  switch (section) {
    case 'hook':
      text = script.hook;
      break;
    case 'intro':
      text = script.intro;
      break;
    case 'content': {
      const contentBeats = timings.filter((b) => b.section === 'content');
      const contentIndex = contentBeats.indexOf(currentBeat);
      if (contentIndex >= 0 && contentIndex < script.content.length) {
        text = script.content[contentIndex];
      } else if (script.content.length > 0) {
        const beatProgress = interpolate(
          frame,
          [contentBeats[0]?.startFrame ?? 0, contentBeats[contentBeats.length - 1]?.endFrame ?? 1],
          [0, script.content.length],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        text = script.content[Math.min(Math.floor(beatProgress), script.content.length - 1)];
      }
      break;
    }
    case 'cta':
      text = script.cta;
      break;
  }

  if (!text) return null;

  const localFrame = frame - currentBeat.startFrame;
  const entryDuration = 20;

  const entryOpacity = interpolate(localFrame, [0, entryDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const entrySlide = interpolate(localFrame, [0, entryDuration], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 80,
        right: 80,
        opacity: entryOpacity,
        transform: `translateY(${entrySlide}px)`,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: '#ffffff',
          textShadow: '0 2px 10px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)',
          lineHeight: 1.5,
          fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          maxWidth: width * 0.7,
          marginLeft: 'auto',
          marginRight: 'auto',
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
  return 'content';
}
