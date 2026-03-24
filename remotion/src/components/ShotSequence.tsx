import React from 'react';
import {
  useCurrentFrame,
  Img,
  interpolate,
  Easing,
  Sequence,
} from 'remotion';
import type { ShotSequenceProps, ShotData, TransitionType } from '../types';

/**
 * ShotSequence renders a series of shots with transitions.
 * Each shot is placed in a Remotion <Sequence> and transitions
 * are handled via opacity/transform interpolation on overlapping frames.
 *
 * Used by both ShortFormVideo and LongFormVideo compositions.
 */
export const ShotSequence: React.FC<ShotSequenceProps> = ({
  shots,
  width,
  height,
}) => {
  if (shots.length === 0) {
    return <FallbackBackground width={width} height={height} />;
  }

  // Calculate the starting frame for each shot, accounting for overlapping transitions
  const shotTimeline = computeShotTimeline(shots);

  return (
    <div style={{ position: 'absolute', width, height, overflow: 'hidden' }}>
      {shotTimeline.map((entry, index) => (
        <Sequence
          key={entry.shot.id}
          from={entry.absoluteStart}
          durationInFrames={entry.shot.durationInFrames}
          layout="none"
        >
          <Shot
            shot={entry.shot}
            width={width}
            height={height}
            isFirst={index === 0}
            isLast={index === shotTimeline.length - 1}
          />
        </Sequence>
      ))}
    </div>
  );
};

// ─── Internal Types ───

interface TimelineEntry {
  shot: ShotData;
  absoluteStart: number;
}

// ─── Timeline Computation ───

function computeShotTimeline(shots: ShotData[]): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];
  let currentFrame = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    timeline.push({
      shot,
      absoluteStart: currentFrame,
    });

    // Next shot starts before this one ends (overlap for transition)
    const overlap = i < shots.length - 1
      ? Math.min(shot.transitionDurationInFrames, Math.floor(shot.durationInFrames / 2))
      : 0;

    currentFrame += shot.durationInFrames - overlap;
  }

  return timeline;
}

// ─── Single Shot Component ───

interface ShotProps {
  shot: ShotData;
  width: number;
  height: number;
  isFirst: boolean;
  isLast: boolean;
}

const Shot: React.FC<ShotProps> = ({ shot, width, height, isFirst, isLast }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, transitionIn, transitionOut, transitionDurationInFrames, motion } = shot;

  // ─── Transition In ───
  const transInDuration = isFirst && transitionIn === 'cut' ? 0 : transitionDurationInFrames;
  const entryProgress = transInDuration > 0
    ? interpolate(frame, [0, transInDuration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 1;

  // ─── Transition Out ───
  const transOutDuration = isLast && transitionOut === 'cut' ? 0 : transitionDurationInFrames;
  const exitStart = durationInFrames - transOutDuration;
  const exitProgress = transOutDuration > 0
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
      })
    : 1;

  // ─── Compute Opacity ───
  const entryOpacity = getTransitionOpacity(transitionIn, entryProgress);
  const exitOpacity = getTransitionOpacity(transitionOut, exitProgress);
  const opacity = Math.min(entryOpacity, exitOpacity);

  // ─── Compute Transform ───
  const entryTransform = getTransitionTransform(transitionIn, entryProgress, false);
  const exitTransform = getTransitionTransform(transitionOut, exitProgress, true);

  // Determine which phase we're in
  const isInExitPhase = frame >= exitStart;
  let transform = isInExitPhase ? exitTransform : entryTransform;

  // ─── Ken Burns Motion ───
  if (motion) {
    const motionProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.ease),
    });

    const scale = interpolate(motionProgress, [0, 1], [motion.startScale, motion.endScale]);
    const translateX = interpolate(motionProgress, [0, 1], [motion.startX, motion.endX]);
    const translateY = interpolate(motionProgress, [0, 1], [motion.startY, motion.endY]);

    transform = `${transform} scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        opacity,
        transform,
        willChange: 'transform, opacity',
      }}
    >
      <Img
        src={shot.src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

// ─── Transition Helpers ───

function getTransitionOpacity(type: TransitionType, progress: number): number {
  switch (type) {
    case 'fade':
      return progress;
    case 'cut':
      return progress >= 0.5 ? 1 : 0;
    case 'zoom':
      return progress;
    case 'slide-left':
    case 'slide-right':
      return 1;
    default:
      return 1;
  }
}

function getTransitionTransform(
  type: TransitionType,
  progress: number,
  isExit: boolean,
): string {
  switch (type) {
    case 'fade':
    case 'cut':
      return '';
    case 'zoom': {
      // Entry: zoom from 1.3x down to 1x (settle in)
      // Exit: zoom from 1x down to 0.8x (shrink away)
      const scale = isExit
        ? interpolate(progress, [0, 1], [0.8, 1])
        : interpolate(progress, [0, 1], [1.3, 1]);
      return `scale(${scale})`;
    }
    case 'slide-left': {
      const offset = isExit
        ? interpolate(progress, [0, 1], [-100, 0])
        : interpolate(progress, [0, 1], [100, 0]);
      return `translateX(${offset}%)`;
    }
    case 'slide-right': {
      const offset = isExit
        ? interpolate(progress, [0, 1], [100, 0])
        : interpolate(progress, [0, 1], [-100, 0]);
      return `translateX(${offset}%)`;
    }
    default:
      return '';
  }
}

// ─── Fallback ───

const FallbackBackground: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div
    style={{
      position: 'absolute',
      width,
      height,
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
    }}
  />
);
