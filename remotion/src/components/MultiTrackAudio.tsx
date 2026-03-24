import React from 'react';
import { Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CinemaAudioTrack } from '../types';

interface MultiTrackAudioProps {
  tracks: CinemaAudioTrack[];
}

/**
 * MultiTrackAudio — Renders multiple audio tracks with volume control and timing.
 */
export const MultiTrackAudio: React.FC<MultiTrackAudioProps> = ({ tracks }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <>
      {tracks.map((track, index) => {
        const trackEnd = track.durationInFrames
          ? track.startFrame + track.durationInFrames
          : durationInFrames;

        // Only render if we're within the track's time range
        if (frame < track.startFrame || frame >= trackEnd) {
          return null;
        }

        return (
          <Audio
            key={`audio-${track.layer}-${index}`}
            src={track.src}
            startFrom={0}
            endAt={track.durationInFrames ?? durationInFrames - track.startFrame}
            volume={track.volume}
            loop={track.loop}
          />
        );
      })}
    </>
  );
};
