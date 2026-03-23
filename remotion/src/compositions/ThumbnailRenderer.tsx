import React from 'react';
import {
  AbsoluteFill,
  Img,
} from 'remotion';
import type { ThumbnailProps, ThumbnailVariant } from '../types';

// ─── Variant-Specific Style Configuration ───

interface VariantStyle {
  /** Multiplier applied to titleFontSize */
  titleScale: number;
  /** Multiplier applied to overlayFontSize */
  overlayScale: number;
  /** Whether to show the overlay text block */
  showOverlay: boolean;
  /** Whether to show the channel avatar badge */
  showAvatar: boolean;
  /** Optional badge text shown in top-right corner */
  badgeText: string | null;
  /** Optional subtitle text below the title */
  subtitle: string | null;
}

const VARIANT_STYLES: Record<ThumbnailVariant, VariantStyle> = {
  'thumbnail': {
    titleScale: 1,
    overlayScale: 1,
    showOverlay: true,
    showAvatar: true,
    badgeText: null,
    subtitle: null,
  },
  'title-card': {
    titleScale: 1.4,
    overlayScale: 1,
    showOverlay: false,
    showAvatar: true,
    badgeText: 'TITLE CARD',
    subtitle: 'EPISODE',
  },
  'episode-cover': {
    titleScale: 1.15,
    overlayScale: 1.1,
    showOverlay: true,
    showAvatar: true,
    badgeText: null,
    subtitle: null,
  },
  'social-promo': {
    titleScale: 1.1,
    overlayScale: 1.3,
    showOverlay: true,
    showAvatar: false,
    badgeText: null,
    subtitle: null,
  },
};

/**
 * ThumbnailRenderer — Static composition for rendering thumbnails and stills.
 *
 * Supports multiple variants:
 * - `thumbnail` (default): Standard 1280x720 YouTube thumbnail
 * - `title-card`: Larger title, no overlay text, "EPISODE" subtitle, "TITLE CARD" badge
 * - `episode-cover`: Medium title with episode number badge support
 * - `social-promo`: Bolder overlay text, no avatar (square-friendly)
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
  variant = 'thumbnail',
}) => {
  const style = VARIANT_STYLES[variant];
  const scaledTitleSize = Math.round(titleFontSize * style.titleScale);
  const scaledOverlaySize = Math.round(overlayFontSize * style.overlayScale);

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
      {style.showOverlay && overlayText && (
        <OverlayTextBlock
          text={overlayText}
          fontSize={scaledOverlaySize}
        />
      )}

      {/* Layer 5: Variant badge (top-right corner) */}
      {style.badgeText && (
        <VariantBadge text={style.badgeText} />
      )}

      {/* Layer 6: Title text (lower portion) */}
      <TitleBlock
        title={title}
        fontSize={scaledTitleSize}
        subtitle={style.subtitle}
      />

      {/* Layer 7: Channel avatar */}
      {style.showAvatar && channelAvatar && (
        <AvatarBadge src={channelAvatar} />
      )}

      {/* Layer 8: Subtle border/frame */}
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

// ─── Variant Badge (top-right corner) ───

interface VariantBadgeProps {
  text: string;
}

const VariantBadge: React.FC<VariantBadgeProps> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      top: 24,
      right: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '6px 16px',
      borderRadius: 4,
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      zIndex: 8,
    }}
  >
    <span
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: 2,
        fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </span>
  </div>
);

// ─── Title Block ───

interface TitleBlockProps {
  title: string;
  fontSize: number;
  subtitle: string | null;
}

const TitleBlock: React.FC<TitleBlockProps> = ({ title, fontSize, subtitle }) => (
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
      {subtitle && (
        <p
          style={{
            fontSize: Math.round(fontSize * 0.55),
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.6)',
            letterSpacing: 3,
            fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
            margin: '6px 0 0 0',
            textTransform: 'uppercase',
          }}
        >
          {subtitle}
        </p>
      )}
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
