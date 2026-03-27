import React from 'react';
import { Composition, Still } from 'remotion';
import { ShortFormVideo } from './compositions/ShortFormVideo';
import { LongFormVideo } from './compositions/LongFormVideo';
import { ThumbnailRenderer } from './compositions/ThumbnailRenderer';
import { CinemaVideo } from './compositions/CinemaVideo';
import { SquareSocial } from './compositions/SquareSocial';
import { UltrawideCinema } from './compositions/UltrawideCinema';
import type {
  ShortFormVideoProps,
  LongFormVideoProps,
  ThumbnailProps,
  CinemaVideoProps,
  SquareSocialProps,
  UltrawideCinemaProps,
} from './types';
import {
  DEFAULT_SHORT_BEAT_TIMINGS,
  DEFAULT_LONG_BEAT_TIMINGS,
  DEFAULT_SQUARE_BEAT_TIMINGS,
} from './types';

// Remotion v4 Composition/Still without zod schemas requires explicit casting
const ShortFormVideoComponent = ShortFormVideo as unknown as React.FC<Record<string, unknown>>;
const LongFormVideoComponent = LongFormVideo as unknown as React.FC<Record<string, unknown>>;
const ThumbnailComponent = ThumbnailRenderer as unknown as React.FC<Record<string, unknown>>;
const CinemaVideoComponent = CinemaVideo as unknown as React.FC<Record<string, unknown>>;
const SquareSocialComponent = SquareSocial as unknown as React.FC<Record<string, unknown>>;
const UltrawideCinemaComponent = UltrawideCinema as unknown as React.FC<Record<string, unknown>>;

/**
 * Remotion Root — Registers all compositions for rendering.
 *
 * Compositions:
 * - ShortFormVideo: 9:16 vertical (1080x1920, 30fps, 60s default)
 * - LongFormVideo: 16:9 horizontal (1920x1080, 30fps, 300s default)
 * - ThumbnailRenderer: 1280x720 still image
 * - CinemaVideo: 16:9 cinema (1920x1080, 24fps, 120s default)
 * - SquareSocial: 1:1 square (1080x1080, 30fps, 30s default)
 * - UltrawideCinema: 21:9 ultrawide (2560x1080, 24fps, 120s default)
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ─── Short Form Video (9:16 Vertical) ─── */}
      <Composition
        id="ShortFormVideo"
        component={ShortFormVideoComponent}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: 'Short Form Video',
          script: {
            hook: 'You won\'t believe what happens next...',
            intro: 'Today we\'re exploring something incredible.',
            content: [
              'First, let\'s look at the main concept.',
              'Here\'s where it gets really interesting.',
              'And the results speak for themselves.',
            ],
            cta: 'Follow for more content like this!',
          },
          shots: [
            {
              id: 'shot-1',
              src: 'https://placehold.co/1080x1920/1a1a3e/ffffff?text=Hook',
              durationInFrames: 90,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 15,
              motion: {
                startScale: 1.0,
                endScale: 1.1,
                startX: 0,
                endX: 0,
                startY: 0,
                endY: -10,
              },
            },
            {
              id: 'shot-2',
              src: 'https://placehold.co/1080x1920/2d1b69/ffffff?text=Intro',
              durationInFrames: 180,
              transitionIn: 'fade',
              transitionOut: 'zoom',
              transitionDurationInFrames: 15,
            },
            {
              id: 'shot-3',
              src: 'https://placehold.co/1080x1920/0a1929/ffffff?text=Content',
              durationInFrames: 1230,
              transitionIn: 'zoom',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
              motion: {
                startScale: 1.05,
                endScale: 1.0,
                startX: 10,
                endX: -10,
                startY: 0,
                endY: 0,
              },
            },
            {
              id: 'shot-4',
              src: 'https://placehold.co/1080x1920/3d0a2e/ffffff?text=CTA',
              durationInFrames: 300,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
            },
          ],
          audioUrl: null,
          beatTimings: DEFAULT_SHORT_BEAT_TIMINGS,
          textOverlays: [],
          beatPreset: 'POWER',
          showAudioVisualization: false,
        }}
      />

      {/* ─── Long Form Video (16:9 Horizontal) ─── */}
      <Composition
        id="LongFormVideo"
        component={LongFormVideoComponent}
        durationInFrames={9000} // 300 seconds (5 minutes) at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Long Form Video',
          script: {
            hook: 'What if everything you knew was wrong?',
            intro: 'In this video, we break down the complete picture.',
            content: [
              'Let\'s start with the fundamentals.',
              'Now let\'s dive deeper into the mechanics.',
              'Here\'s where theory meets practice.',
              'The data tells a compelling story.',
              'And the implications are far-reaching.',
            ],
            cta: 'If you found this valuable, hit subscribe and turn on notifications!',
          },
          shots: [
            {
              id: 'long-shot-1',
              src: 'https://placehold.co/1920x1080/1e3a5f/ffffff?text=Hook',
              durationInFrames: 150,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
              motion: {
                startScale: 1.0,
                endScale: 1.05,
                startX: 0,
                endX: 5,
                startY: 0,
                endY: 0,
              },
            },
            {
              id: 'long-shot-2',
              src: 'https://placehold.co/1920x1080/2d1b69/ffffff?text=Intro',
              durationInFrames: 450,
              transitionIn: 'fade',
              transitionOut: 'slide-left',
              transitionDurationInFrames: 25,
            },
            {
              id: 'long-shot-3',
              src: 'https://placehold.co/1920x1080/0a1929/ffffff?text=Content+1',
              durationInFrames: 1500,
              transitionIn: 'slide-left',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
              motion: {
                startScale: 1.0,
                endScale: 1.08,
                startX: -5,
                endX: 5,
                startY: 0,
                endY: 0,
              },
            },
            {
              id: 'long-shot-4',
              src: 'https://placehold.co/1920x1080/1a3320/ffffff?text=Content+2',
              durationInFrames: 1500,
              transitionIn: 'fade',
              transitionOut: 'zoom',
              transitionDurationInFrames: 25,
            },
            {
              id: 'long-shot-5',
              src: 'https://placehold.co/1920x1080/3d1f00/ffffff?text=Content+3',
              durationInFrames: 1500,
              transitionIn: 'zoom',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
              motion: {
                startScale: 1.1,
                endScale: 1.0,
                startX: 0,
                endX: 0,
                startY: -5,
                endY: 5,
              },
            },
            {
              id: 'long-shot-6',
              src: 'https://placehold.co/1920x1080/3d0a2e/ffffff?text=Content+4',
              durationInFrames: 1500,
              transitionIn: 'fade',
              transitionOut: 'slide-right',
              transitionDurationInFrames: 25,
            },
            {
              id: 'long-shot-7',
              src: 'https://placehold.co/1920x1080/1a2744/ffffff?text=Content+5',
              durationInFrames: 1500,
              transitionIn: 'slide-right',
              transitionOut: 'fade',
              transitionDurationInFrames: 20,
            },
            {
              id: 'long-shot-8',
              src: 'https://placehold.co/1920x1080/4a0000/ffffff?text=CTA',
              durationInFrames: 900,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 30,
            },
          ],
          audioUrl: null,
          beatTimings: DEFAULT_LONG_BEAT_TIMINGS,
          textOverlays: [],
          beatPreset: 'MOMENTUM',
          showAudioVisualization: false,
          showLowerThird: true,
        }}
      />

      {/* ─── Thumbnail Renderer (Still Image) ─── */}
      <Still
        id="ThumbnailRenderer"
        component={ThumbnailComponent}
        width={1280}
        height={720}
        defaultProps={{
          title: 'The Complete Guide to AI Content Creation',
          backgroundUrl: 'https://placehold.co/1280x720/0a0a1a/ffffff?text=Background',
          overlayText: 'AI SECRETS',
          channelAvatar: null,
          gradientColor: '#0a0a1a',
          titleFontSize: 24,
          overlayFontSize: 72,
        }}
      />

      {/* ─── Cinema Video (16:9 Horizontal, 24fps Cinema) ─── */}
      <Composition
        id="CinemaVideo"
        component={CinemaVideoComponent}
        durationInFrames={2880} // 120 seconds at 24fps
        fps={24}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Cinema Video',
          shots: [
            {
              id: 'cinema-shot-1',
              src: 'https://placehold.co/1920x1080/0a0a1a/ffffff?text=Cinema+Shot+1',
              durationInFrames: 720,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'dolly-in', lens: '35mm', framing: 'wide' },
            },
            {
              id: 'cinema-shot-2',
              src: 'https://placehold.co/1920x1080/1a0a3e/ffffff?text=Cinema+Shot+2',
              durationInFrames: 1440,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'pan-left', lens: '85mm', framing: 'close-up' },
            },
            {
              id: 'cinema-shot-3',
              src: 'https://placehold.co/1920x1080/0a1929/ffffff?text=Cinema+Shot+3',
              durationInFrames: 720,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'crane-up', lens: '24mm', framing: 'wide' },
            },
          ],
          audioTracks: [],
          fps: 24,
          width: 1920,
          height: 1080,
          colorGrade: { contrast: 10, saturation: -10, filmGrain: 15, vignette: 20 },
          beatTimings: [],
          textOverlays: [],
          watermark: undefined,
        } satisfies CinemaVideoProps}
      />

      {/* ─── Square Social (1:1 Square) ─── */}
      <Composition
        id="SquareSocial"
        component={SquareSocialComponent}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          title: 'Square Social Video',
          script: {
            hook: 'Stop scrolling — this is for you.',
            intro: 'Here\'s something you need to know.',
            content: [
              'The key insight that changes everything.',
              'And here\'s how to apply it.',
            ],
            cta: 'Save this post and share it!',
          },
          shots: [
            {
              id: 'sq-shot-1',
              src: 'https://placehold.co/1080x1080/1a1a3e/ffffff?text=Hook',
              durationInFrames: 60,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 10,
              motion: {
                startScale: 1.0,
                endScale: 1.08,
                startX: 0,
                endX: 0,
                startY: 0,
                endY: -5,
              },
            },
            {
              id: 'sq-shot-2',
              src: 'https://placehold.co/1080x1080/2d1b69/ffffff?text=Intro',
              durationInFrames: 120,
              transitionIn: 'fade',
              transitionOut: 'fade',
              transitionDurationInFrames: 10,
            },
            {
              id: 'sq-shot-3',
              src: 'https://placehold.co/1080x1080/0a1929/ffffff?text=Content',
              durationInFrames: 570,
              transitionIn: 'fade',
              transitionOut: 'zoom',
              transitionDurationInFrames: 15,
              motion: {
                startScale: 1.0,
                endScale: 1.05,
                startX: -5,
                endX: 5,
                startY: 0,
                endY: 0,
              },
            },
            {
              id: 'sq-shot-4',
              src: 'https://placehold.co/1080x1080/3d0a2e/ffffff?text=CTA',
              durationInFrames: 150,
              transitionIn: 'zoom',
              transitionOut: 'fade',
              transitionDurationInFrames: 15,
            },
          ],
          audioUrl: null,
          beatTimings: DEFAULT_SQUARE_BEAT_TIMINGS,
          textOverlays: [],
          beatPreset: 'POWER',
          showAudioVisualization: false,
        } satisfies SquareSocialProps}
      />

      {/* ─── Ultrawide Cinema (21:9 Ultrawide) ─── */}
      <Composition
        id="UltrawideCinema"
        component={UltrawideCinemaComponent}
        durationInFrames={2880} // 120 seconds at 24fps
        fps={24}
        width={2560}
        height={1080}
        defaultProps={{
          title: 'Ultrawide Cinema Video',
          shots: [
            {
              id: 'uw-shot-1',
              src: 'https://placehold.co/2560x1080/0a0a1a/ffffff?text=Ultrawide+Shot+1',
              durationInFrames: 720,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'dolly-in', lens: '24mm', framing: 'wide' },
            },
            {
              id: 'uw-shot-2',
              src: 'https://placehold.co/2560x1080/1a0a3e/ffffff?text=Ultrawide+Shot+2',
              durationInFrames: 1440,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'pan-left', lens: '50mm', framing: 'medium' },
            },
            {
              id: 'uw-shot-3',
              src: 'https://placehold.co/2560x1080/0a1929/ffffff?text=Ultrawide+Shot+3',
              durationInFrames: 720,
              transitionIn: 'fade' as const,
              transitionOut: 'fade' as const,
              transitionDurationInFrames: 24,
              camera: { movement: 'crane-up', lens: '24mm', framing: 'wide' },
            },
          ],
          audioTracks: [],
          fps: 24,
          width: 2560,
          height: 1080,
          colorGrade: { contrast: 12, saturation: -15, filmGrain: 20, vignette: 25 },
          beatTimings: [],
          textOverlays: [],
          watermark: undefined,
          letterboxHeight: 40,
        } satisfies UltrawideCinemaProps}
      />
    </>
  );
};
