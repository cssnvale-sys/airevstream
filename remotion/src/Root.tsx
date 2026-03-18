import React from 'react';
import { Composition, Still } from 'remotion';
import { ShortFormVideo } from './compositions/ShortFormVideo';
import { LongFormVideo } from './compositions/LongFormVideo';
import { ThumbnailRenderer } from './compositions/ThumbnailRenderer';
import type {
  ShortFormVideoProps,
  LongFormVideoProps,
  ThumbnailProps,
} from './types';
import {
  DEFAULT_SHORT_BEAT_TIMINGS,
  DEFAULT_LONG_BEAT_TIMINGS,
} from './types';

// Remotion v4 Composition/Still without zod schemas requires explicit casting
const ShortFormVideoComponent = ShortFormVideo as unknown as React.FC<Record<string, unknown>>;
const LongFormVideoComponent = LongFormVideo as unknown as React.FC<Record<string, unknown>>;
const ThumbnailComponent = ThumbnailRenderer as unknown as React.FC<Record<string, unknown>>;

/**
 * Remotion Root — Registers all compositions for rendering.
 *
 * Compositions:
 * - ShortFormVideo: 9:16 vertical (1080x1920, 30fps, 60s default)
 * - LongFormVideo: 16:9 horizontal (1920x1080, 30fps, 300s default)
 * - ThumbnailRenderer: 1280x720 still image
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
    </>
  );
};
