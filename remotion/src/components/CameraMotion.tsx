import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import type { CinemaCamera, ShotData } from '../types';

interface CameraMotionProps {
  camera?: CinemaCamera;
  /** Explicit Ken Burns motion keyframes (takes priority over camera.movement) */
  motion?: ShotData['motion'];
  durationInFrames: number;
  children: React.ReactNode;
}

/**
 * CameraMotion — Applies animated camera transforms to children.
 *
 * Supports pan, tilt, zoom, dolly, crane movements with spring easing.
 * When `motion` (explicit Ken Burns keyframes) is provided, it takes priority
 * over the `camera.movement` string preset.
 */
export const CameraMotion: React.FC<CameraMotionProps> = ({ camera, motion, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // If explicit Ken Burns motion keyframes are provided, use them directly
  if (motion) {
    const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    const scale = interpolate(progress, [0, 1], [motion.startScale, motion.endScale]);
    const translateX = interpolate(progress, [0, 1], [motion.startX, motion.endX]);
    const translateY = interpolate(progress, [0, 1], [motion.startY, motion.endY]);

    // Stabilization jitter (applied on top of Ken Burns motion)
    const jitter = camera?.stabilization === 'handheld'
      ? {
          x: Math.sin(frame * 0.3) * 1.5 + Math.cos(frame * 0.7) * 0.8,
          y: Math.cos(frame * 0.4) * 1.2 + Math.sin(frame * 0.6) * 0.6,
        }
      : { x: 0, y: 0 };

    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${translateX + jitter.x}px, ${translateY + jitter.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Fall back to camera.movement string-based presets
  if (!camera?.movement || camera.movement === 'static') {
    return <div style={{ width: '100%', height: '100%' }}>{children}</div>;
  }

  // Use spring for natural motion easing
  const springProgress = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 80, mass: 1 },
    durationInFrames,
  });

  const transforms = getMovementTransform(camera.movement, springProgress);

  // DOF effect: no CSS-only implementation yet (would need layered blur approach)
  // See: https://developer.mozilla.org/en-US/docs/Web/CSS/filter for future options

  // Stabilization jitter
  const jitter = camera.stabilization === 'handheld'
    ? {
        x: Math.sin(frame * 0.3) * 1.5 + Math.cos(frame * 0.7) * 0.8,
        y: Math.cos(frame * 0.4) * 1.2 + Math.sin(frame * 0.6) * 0.6,
      }
    : { x: 0, y: 0 };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${transforms.translateX + jitter.x}px, ${transforms.translateY + jitter.y}px) scale(${transforms.scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};

function getMovementTransform(movement: string, progress: number) {
  switch (movement) {
    case 'pan-left':
      return { translateX: interpolate(progress, [0, 1], [0, -80]), translateY: 0, scale: 1.05 };
    case 'pan-right':
      return { translateX: interpolate(progress, [0, 1], [0, 80]), translateY: 0, scale: 1.05 };
    case 'tilt-up':
      return { translateX: 0, translateY: interpolate(progress, [0, 1], [0, -60]), scale: 1.05 };
    case 'tilt-down':
      return { translateX: 0, translateY: interpolate(progress, [0, 1], [0, 60]), scale: 1.05 };
    case 'dolly-in':
      return { translateX: 0, translateY: 0, scale: interpolate(progress, [0, 1], [1, 1.3]) };
    case 'dolly-out':
      return { translateX: 0, translateY: 0, scale: interpolate(progress, [0, 1], [1.3, 1]) };
    case 'crane-up':
      return { translateX: 0, translateY: interpolate(progress, [0, 1], [20, -40]), scale: interpolate(progress, [0, 1], [1.1, 1]) };
    case 'crane-down':
      return { translateX: 0, translateY: interpolate(progress, [0, 1], [-40, 20]), scale: interpolate(progress, [0, 1], [1, 1.1]) };
    case 'zoom-in':
      return { translateX: 0, translateY: 0, scale: interpolate(progress, [0, 1], [1, 1.5]) };
    case 'zoom-out':
      return { translateX: 0, translateY: 0, scale: interpolate(progress, [0, 1], [1.5, 1]) };
    case 'orbit-left':
      return {
        translateX: interpolate(progress, [0, 1], [0, -50]),
        translateY: interpolate(progress, [0, 0.5, 1], [0, -15, 0]),
        scale: 1.05,
      };
    case 'orbit-right':
      return {
        translateX: interpolate(progress, [0, 1], [0, 50]),
        translateY: interpolate(progress, [0, 0.5, 1], [0, -15, 0]),
        scale: 1.05,
      };
    case 'tracking-left':
      return { translateX: interpolate(progress, [0, 1], [0, -120]), translateY: 0, scale: 1 };
    case 'tracking-right':
      return { translateX: interpolate(progress, [0, 1], [0, 120]), translateY: 0, scale: 1 };
    case 'handheld-subtle':
      return { translateX: 0, translateY: 0, scale: 1 }; // Jitter handled separately
    default:
      return { translateX: 0, translateY: 0, scale: 1 };
  }
}
