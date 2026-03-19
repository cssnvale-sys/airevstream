import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { SubtitleEntry } from '../types';

interface SubtitleOverlayProps {
  subtitles: SubtitleEntry[];
  width: number;
  height: number;
}

/**
 * SubtitleOverlay — Renders timed subtitle entries with fade transitions.
 */
export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ subtitles, width, height }) => {
  const frame = useCurrentFrame();

  return (
    <>
      {subtitles.map((subtitle, index) => {
        if (frame < subtitle.startFrame || frame > subtitle.endFrame) {
          return null;
        }

        const fadeIn = interpolate(
          frame,
          [subtitle.startFrame, subtitle.startFrame + 10],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        const fadeOut = interpolate(
          frame,
          [subtitle.endFrame - 10, subtitle.endFrame],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        const opacity = fadeIn * fadeOut;

        const positionStyles = getPositionStyles(subtitle.position ?? 'bottom', height);
        const textStyles = getTextStyles(subtitle.style ?? 'default');

        return (
          <div
            key={`subtitle-${index}`}
            style={{
              position: 'absolute',
              ...positionStyles,
              opacity,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            <span
              style={{
                ...textStyles,
                maxWidth: width * 0.8,
                textAlign: 'center',
              }}
            >
              {subtitle.text}
            </span>
          </div>
        );
      })}
    </>
  );
};

function getPositionStyles(position: string, height: number): React.CSSProperties {
  switch (position) {
    case 'top':
      return { top: height * 0.08, left: 0 };
    case 'center':
      return { top: '50%', left: 0, transform: 'translateY(-50%)' };
    case 'bottom':
    default:
      return { bottom: height * 0.08, left: 0 };
  }
}

function getTextStyles(style: string): React.CSSProperties {
  const base: React.CSSProperties = {
    color: '#ffffff',
    fontSize: 32,
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '8px 16px',
    lineHeight: 1.4,
  };

  switch (style) {
    case 'bold':
      return { ...base, fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4 };
    case 'outline':
      return {
        ...base,
        fontWeight: 600,
        textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
      };
    case 'shadow':
      return { ...base, textShadow: '2px 2px 8px rgba(0,0,0,0.8)' };
    case 'default':
    default:
      return { ...base, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4 };
  }
}
