import React from 'react';
import {
  AbsoluteFill,
  Img,
} from 'remotion';
import type { ThumbnailProps } from '../types';

/**
 * ThumbnailRenderer — Static 1280x720 composition for rendering thumbnails.
 *
 * Designed for YouTube and social media thumbnails. This is a still frame
 * composition (1 frame long) that renders a thumbnail image with:
 * - Background image with gradient overlay
 * - Large, eye-catching overlay text
 * - Title text
 * - Channel avatar/logo
 *
 * Rendered as a still using `remotion still`.
 */
export const ThumbnailRenderer: React.FC<ThumbnailProps> = ({
  title,
  backgroundUrl,
  overlayText,
  channelAvatar,
  gradientColor,
  titleFontSize,
  overlayFontSize,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a1a',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Background image */}
      {backgroundUrl && (
        <Img
          src={backgroundUrl}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Layer 2: Gradient overlay for text readability */}
      <GradientOverlay gradientColor={gradientColor} />

      {/* Layer 3: Vignette for depth */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Layer 4: Large overlay text (the attention grabber) */}
      {overlayText && (
        <OverlayTextBlock
          text={overlayText}
          fontSize={overlayFontSize}
        />
      )}

      {/* Layer 5: Title text (lower portion) */}
      <TitleBlock
        title={title}
        fontSize={titleFontSize}
      />

      {/* Layer 6: Channel avatar */}
      {channelAvatar && (
        <AvatarBadge src={channelAvatar} />
      )}

      {/* Layer 7: Subtle border/frame */}
      <ThumbnailFrame />
    </AbsoluteFill>
  );
};

// ─── Gradient Overlay ───

interface GradientOverlayProps {
  gradientColor: string;
}

const GradientOverlay: React.FC<GradientOverlayProps> = ({ gradientColor }) => {
  // Support both CSS gradient strings and simple colors
  const isGradient = gradientColor.includes('gradient');
  const background = isGradient
    ? gradientColor
    : `linear-gradient(180deg, transparent 0%, ${gradientColor}cc 60%, ${gradientColor} 100%)`;

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background,
      }}
    />
  );
};

// ─── Overlay Text (Big, Attention-Grabbing) ───

interface OverlayTextBlockProps {
  text: string;
  fontSize: number;
}

const OverlayTextBlock: React.FC<OverlayTextBlockProps> = ({ text, fontSize }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        textAlign: 'center',
        zIndex: 5,
      }}
    >
      <h1
        style={{
          fontSize,
          fontWeight: 900,
          color: '#ffffff',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          letterSpacing: -1,
          fontFamily: '"Impact", "Arial Black", "Helvetica Neue", sans-serif',
          textShadow: `
            0 0 20px rgba(0,0,0,0.9),
            0 4px 8px rgba(0,0,0,0.8),
            0 0 60px rgba(0,0,0,0.4)
          `,
          margin: 0,
          WebkitTextStroke: '2px rgba(0,0,0,0.3)',
          paintOrder: 'stroke fill',
        }}
      >
        {text}
      </h1>
    </div>
  );
};

// ─── Title Block ───

interface TitleBlockProps {
  title: string;
  fontSize: number;
}

const TitleBlock: React.FC<TitleBlockProps> = ({ title, fontSize }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 40,
      left: 40,
      right: 120, // Leave room for avatar on the right
      zIndex: 5,
    }}
  >
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        padding: '12px 20px',
        borderRadius: 8,
        backdropFilter: 'blur(12px)',
        borderLeft: '4px solid #ffffff',
      }}
    >
      <p
        style={{
          fontSize,
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1.3,
          fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
          margin: 0,
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}
      >
        {title}
      </p>
    </div>
  </div>
);

// ─── Channel Avatar Badge ───

interface AvatarBadgeProps {
  src: string;
}

const AvatarBadge: React.FC<AvatarBadgeProps> = ({ src }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 40,
      right: 40,
      width: 64,
      height: 64,
      borderRadius: '50%',
      overflow: 'hidden',
      border: '3px solid rgba(255, 255, 255, 0.9)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      zIndex: 6,
    }}
  >
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  </div>
);

// ─── Thumbnail Frame (subtle border) ───

const ThumbnailFrame: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      border: '3px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 0,
      pointerEvents: 'none',
      zIndex: 10,
    }}
  />
);
