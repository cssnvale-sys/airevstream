import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';
import type { TextOverlayProps, TextAnimation, TextPosition } from '../types';

/**
 * Animated text overlay component with configurable entry/exit animations.
 * Supports multiple position presets and animation types.
 */
export const TextOverlay: React.FC<TextOverlayProps> = ({
  config,
  compositionWidth,
  compositionHeight,
}) => {
  const frame = useCurrentFrame();

  const {
    text,
    startFrame,
    durationInFrames,
    position,
    entryAnimation,
    exitAnimation,
    entryDurationInFrames,
    exitDurationInFrames,
    fontSize,
    fontWeight,
    color,
    textShadow,
    backgroundColor,
    padding,
    borderRadius,
    maxWidth,
  } = config;

  // Calculate local frame relative to this overlay's start
  const localFrame = frame - startFrame;
  const endFrame = startFrame + durationInFrames;

  // If we're outside the visible range, render nothing
  if (frame < startFrame || frame >= endFrame) {
    return null;
  }

  // ─── Entry Animation Progress (0 -> 1) ───
  const entryProgress = interpolate(
    localFrame,
    [0, entryDurationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // ─── Exit Animation Progress (1 -> 0) ───
  const exitStart = durationInFrames - exitDurationInFrames;
  const exitProgress = interpolate(
    localFrame,
    [exitStart, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.in(Easing.cubic),
    },
  );

  // Combined opacity from entry and exit
  const entryOpacity = getAnimationOpacity(entryAnimation, entryProgress);
  const exitOpacity = getAnimationOpacity(exitAnimation, exitProgress);
  const opacity = Math.min(entryOpacity, exitOpacity);

  // Combined transform from entry and exit
  const entryTransform = getAnimationTransform(entryAnimation, entryProgress);
  const exitTransform = getAnimationTransform(exitAnimation, exitProgress, true);

  // Merge transforms - use entry during entry phase, exit during exit phase
  const isInExitPhase = localFrame >= exitStart;
  const activeTransform = isInExitPhase && exitAnimation !== 'none'
    ? exitTransform
    : entryTransform;

  // Typewriter effect: reveal characters progressively
  const displayText = entryAnimation === 'typewriter'
    ? text.slice(0, Math.floor(entryProgress * text.length))
    : text;

  const positionStyles = getPositionStyles(position, compositionWidth, compositionHeight, padding ?? 0, maxWidth);

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        opacity,
        transform: activeTransform,
        fontSize,
        fontWeight,
        color,
        textShadow: textShadow ?? '2px 2px 8px rgba(0, 0, 0, 0.8)',
        backgroundColor: backgroundColor ?? 'transparent',
        padding: padding ?? 0,
        borderRadius: borderRadius ?? 0,
        maxWidth: maxWidth ?? 'none',
        lineHeight: 1.3,
        fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
        zIndex: 10,
        willChange: 'transform, opacity',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
      }}
    >
      {displayText}
    </div>
  );
};

// ─── Animation Helpers ───

function getAnimationOpacity(animation: TextAnimation, progress: number): number {
  switch (animation) {
    case 'fade-in':
      return progress;
    case 'slide-up':
    case 'slide-down':
    case 'slide-left':
    case 'slide-right':
      return progress;
    case 'scale-up':
      return progress;
    case 'typewriter':
      return 1;
    case 'none':
      return 1;
    default:
      return 1;
  }
}

function getAnimationTransform(
  animation: TextAnimation,
  progress: number,
  isExit = false,
): string {
  // For entry, progress goes 0→1 so offset = 1-progress gives 1→0 (moving in)
  // For exit, progress goes 1→0 so offset = 1-progress gives 0→1 (moving away)
  const offset = 1 - progress;

  switch (animation) {
    case 'fade-in':
      return 'none';
    case 'slide-up':
      return `translateY(${offset * 60}px)`;
    case 'slide-down':
      return `translateY(${-offset * 60}px)`;
    case 'slide-left':
      return `translateX(${offset * 80}px)`;
    case 'slide-right':
      return `translateX(${-offset * 80}px)`;
    case 'scale-up': {
      const scale = interpolate(progress, [0, 1], [0.5, 1]);
      return `scale(${scale})`;
    }
    case 'typewriter':
      return 'none';
    case 'none':
      return 'none';
    default:
      return 'none';
  }
}

function getPositionStyles(
  position: TextPosition,
  width: number,
  height: number,
  padding: number,
  maxWidth?: number,
): React.CSSProperties {
  const margin = 40;
  const base: React.CSSProperties = {};

  // Horizontal alignment
  if (position.includes('left')) {
    base.left = margin;
    base.textAlign = 'left';
  } else if (position.includes('right')) {
    base.right = margin;
    base.textAlign = 'right';
  } else {
    // center
    base.left = '50%';
    base.transform = 'translateX(-50%)';
    base.textAlign = 'center';
    if (maxWidth) {
      base.width = maxWidth;
    } else {
      base.width = width - margin * 2;
    }
  }

  // Vertical alignment
  if (position.startsWith('top')) {
    base.top = margin;
  } else if (position.startsWith('bottom')) {
    base.bottom = margin;
  } else {
    // center vertically
    base.top = '50%';
    // Combine with horizontal centering transform if needed
    if (position === 'center') {
      base.transform = 'translate(-50%, -50%)';
    }
  }

  return base;
}
