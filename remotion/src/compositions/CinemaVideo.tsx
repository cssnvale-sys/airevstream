import React from 'react';
import {
  useCurrentFrame,
  Sequence,
  Img,
  Video,
  interpolate,
} from 'remotion';
import type { CinemaVideoProps, CinemaShotData, TextOverlayConfig } from '../types';
import { CameraMotion } from '../components/CameraMotion';
import { ColorGrade } from '../components/ColorGrade';
import { MultiTrackAudio } from '../components/MultiTrackAudio';
import { SubtitleOverlay } from '../components/SubtitleOverlay';

/**
 * CinemaVideo — Cinema-quality video composition.
 *
 * Features:
 * - 24fps default (cinema standard)
 * - Video plate support (not just images)
 * - Per-shot color grading
 * - Multi-track audio
 * - Subtitle overlays
 * - Camera motion presets
 * - Film grain and vignette effects
 */
export const CinemaVideo: React.FC<CinemaVideoProps> = ({
  shots,
  audioTracks,
  width,
  height,
  colorGrade,
  textOverlays,
  watermark,
}) => {
  // Calculate shot start frames
  let currentStartFrame = 0;
  const shotTimings = shots.map((shot) => {
    const start = currentStartFrame;
    currentStartFrame += shot.durationInFrames;
    return { shot, startFrame: start };
  });

  // Collect all subtitles across shots
  const allSubtitles = shots.flatMap((shot) => shot.subtitles ?? []);

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#000000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shot sequence */}
      {shotTimings.map(({ shot, startFrame }) => (
        <Sequence
          key={shot.id}
          from={startFrame}
          durationInFrames={shot.durationInFrames}
        >
          <CinemaShot
            shot={shot}
            width={width}
            height={height}
            globalColorGrade={colorGrade}
          />
        </Sequence>
      ))}

      {/* Multi-track audio */}
      {audioTracks.length > 0 && (
        <MultiTrackAudio tracks={audioTracks} />
      )}

      {/* Subtitles */}
      {allSubtitles.length > 0 && (
        <SubtitleOverlay subtitles={allSubtitles} width={width} height={height} />
      )}

      {/* Text overlays */}
      {textOverlays?.map((overlay, index) => (
        <Sequence
          key={`overlay-${index}`}
          from={overlay.startFrame}
          durationInFrames={overlay.durationInFrames}
        >
          <TextOverlayRenderer config={overlay} width={width} height={height} />
        </Sequence>
      ))}

      {/* Watermark */}
      {watermark && (
        <WatermarkRenderer config={watermark} width={width} height={height} />
      )}
    </div>
  );
};

// ─── Sub-components ───

const CinemaShot: React.FC<{
  shot: CinemaShotData;
  width: number;
  height: number;
  globalColorGrade?: CinemaVideoProps['colorGrade'];
}> = ({ shot, width, height, globalColorGrade }) => {
  const frame = useCurrentFrame();

  // Merge global and per-shot color grades
  const effectiveGrade = { ...globalColorGrade, ...shot.colorGrade };

  // Transition opacity
  const transitionDuration = shot.transitionDurationInFrames;
  const fadeIn = interpolate(frame, [0, transitionDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [shot.durationInFrames - transitionDuration, shot.durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const effectiveFadeIn = shot.transitionIn === 'cut' ? 1 : fadeIn;
  const effectiveFadeOut = shot.transitionOut === 'cut' ? 1 : fadeOut;
  const opacity = effectiveFadeIn * effectiveFadeOut;

  return (
    <div style={{ width, height, opacity, position: 'relative' }}>
      <ColorGrade grade={effectiveGrade}>
        <CameraMotion camera={shot.camera} durationInFrames={shot.durationInFrames}>
          {shot.isVideo && shot.videoSrc ? (
            <Video
              src={shot.videoSrc}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Img
              src={shot.src}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </CameraMotion>
      </ColorGrade>
    </div>
  );
};

const TextOverlayRenderer: React.FC<{
  config: TextOverlayConfig;
  width: number;
  height: number;
}> = ({ config, width, height }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, config.entryDurationInFrames, config.durationInFrames - config.exitDurationInFrames, config.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const positionStyle = getOverlayPosition(config.position, width, height);

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyle,
        opacity,
        fontSize: config.fontSize,
        fontWeight: config.fontWeight,
        color: config.color,
        textShadow: config.textShadow,
        backgroundColor: config.backgroundColor,
        padding: config.padding,
        borderRadius: config.borderRadius,
        maxWidth: config.maxWidth,
        zIndex: 50,
      }}
    >
      {config.text}
    </div>
  );
};

const WatermarkRenderer: React.FC<{
  config: NonNullable<CinemaVideoProps['watermark']>;
  width: number;
  height: number;
}> = ({ config, width: _width, height: _height }) => {
  const positionStyles: React.CSSProperties = {};
  const margin = 20;

  if (config.position.includes('top')) positionStyles.top = margin;
  if (config.position.includes('bottom')) positionStyles.bottom = margin;
  if (config.position.includes('left')) positionStyles.left = margin;
  if (config.position.includes('right')) positionStyles.right = margin;

  return (
    <div
      style={{
        position: 'absolute',
        ...positionStyles,
        opacity: config.opacity,
        fontSize: config.size,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Arial, sans-serif',
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {config.imageUrl ? (
        <Img src={config.imageUrl} style={{ height: config.size, width: 'auto' }} />
      ) : (
        config.text
      )}
    </div>
  );
};

function getOverlayPosition(
  position: string,
  _width: number,
  _height: number,
): React.CSSProperties {
  const margin = 40;
  switch (position) {
    case 'top-left': return { top: margin, left: margin };
    case 'top-center': return { top: margin, left: '50%', transform: 'translateX(-50%)' };
    case 'top-right': return { top: margin, right: margin };
    case 'center': return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'bottom-left': return { bottom: margin, left: margin };
    case 'bottom-center': return { bottom: margin, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right': return { bottom: margin, right: margin };
    default: return { bottom: margin, left: '50%', transform: 'translateX(-50%)' };
  }
}
