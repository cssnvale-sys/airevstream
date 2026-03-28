'use client';

import { useRef, useState, useCallback } from 'react';
import { useComplexityMode } from '@/hooks/use-complexity-mode';
import { isVisible, FIELD_VISIBILITY } from '@/lib/complexity-fields';
import type { ShotData } from './shot-editor-panel';

interface TimelineProps {
  shots: ShotData[];
  totalDurationSec: number;
  selectedShotId: string | null;
  onSelectShot: (id: string) => void;
  currentTimeSec?: number;
}

const TRACK_HEIGHT = 32;
const RULER_HEIGHT = 24;
const PADDING = 16;

export function Timeline({ shots, totalDurationSec, selectedShotId, onSelectShot, currentTimeSec }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  const { mode } = useComplexityMode();

  const showAudioTrack = isVisible(FIELD_VISIBILITY.timeline.audio, mode);
  const showBeatsTrack = isVisible(FIELD_VISIBILITY.timeline.beats, mode);
  const trackCount = 1 + (showAudioTrack ? 1 : 0) + (showBeatsTrack ? 1 : 0);

  const totalWidth = totalDurationSec * pixelsPerSecond;

  const handleZoom = useCallback((delta: number) => {
    setPixelsPerSecond((prev) => Math.max(10, Math.min(200, prev + delta)));
  }, []);

  return (
    <div className="bg-bg-secondary border-t border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border">
        <span className="text-xs text-text-secondary font-medium">Timeline</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleZoom(-10)} className="text-xs text-text-secondary hover:text-text-primary px-1 transition-colors" aria-label="Zoom out">&minus;</button>
          <span className="text-xs text-text-tertiary">{pixelsPerSecond}px/s</span>
          <button type="button" onClick={() => handleZoom(10)} className="text-xs text-text-secondary hover:text-text-primary px-1 transition-colors" aria-label="Zoom in">+</button>
        </div>
      </div>

      {/* Scrollable timeline */}
      <div ref={containerRef} className="overflow-x-auto overflow-y-hidden" style={{ height: RULER_HEIGHT + TRACK_HEIGHT * trackCount + PADDING * 2 }}>
        <div style={{ width: totalWidth + PADDING * 2, position: 'relative', height: '100%', paddingLeft: PADDING, paddingRight: PADDING }}>
          {/* Ruler */}
          <div style={{ height: RULER_HEIGHT }} className="relative border-b border-border">
            {Array.from({ length: Math.ceil(totalDurationSec) + 1 }).map((_, i) => (
              <div
                key={i}
                style={{ position: 'absolute', left: i * pixelsPerSecond }}
                className="text-[10px] text-text-tertiary"
              >
                {formatTime(i)}
              </div>
            ))}
          </div>

          {/* Playhead */}
          {currentTimeSec !== undefined && (
            <div
              style={{
                position: 'absolute',
                left: currentTimeSec * pixelsPerSecond + PADDING,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: 'rgb(var(--accent-red))',
                zIndex: 20,
              }}
            />
          )}

          {/* Video track */}
          <div style={{ height: TRACK_HEIGHT, marginTop: 4 }} className="relative flex items-center">
            <span className="absolute -left-0 text-[10px] text-text-tertiary w-12">Video</span>
            {shots.map((shot) => {
              const left = shot.startSec * pixelsPerSecond;
              const width = (shot.endSec - shot.startSec) * pixelsPerSecond;
              return (
                <button
                  type="button"
                  key={shot.id}
                  onClick={() => onSelectShot(shot.id)}
                  style={{ position: 'absolute', left, width: Math.max(width - 2, 4), height: TRACK_HEIGHT - 4 }}
                  className={`rounded text-xs flex items-center justify-center overflow-hidden transition-colors ${
                    selectedShotId === shot.id
                      ? 'bg-accent-blue/40 border border-accent-blue text-white'
                      : 'bg-accent-blue/15 border border-accent-blue/30 text-text-secondary hover:bg-accent-blue/25'
                  }`}
                >
                  <span className="truncate px-1" title={`Shot ${shot.shotNumber}`}>S{shot.shotNumber}</span>
                </button>
              );
            })}
          </div>

          {/* Audio BG track — advanced+ */}
          {showAudioTrack && (
            <div style={{ height: TRACK_HEIGHT, marginTop: 2 }} className="relative flex items-center">
              <span className="absolute -left-0 text-[10px] text-text-tertiary w-12">Audio</span>
              <div
                style={{ position: 'absolute', left: 0, width: totalWidth, height: TRACK_HEIGHT - 8 }}
                className="bg-accent-green/10 border border-accent-green/20 rounded"
              />
            </div>
          )}

          {/* Beat sections track — advanced+ */}
          {showBeatsTrack && (
            <div style={{ height: TRACK_HEIGHT, marginTop: 2 }} className="relative flex items-center">
              <span className="absolute -left-0 text-[10px] text-text-tertiary w-12">Beats</span>
              {['Hook', 'Intro', 'Content', 'CTA'].map((label, i) => {
                const sectionWidth = totalWidth / 4;
                const colors = ['bg-accent-red/15', 'bg-accent-amber/15', 'bg-accent-blue/10', 'bg-accent-green/15'];
                return (
                  <div
                    key={label}
                    style={{ position: 'absolute', left: i * sectionWidth, width: sectionWidth - 2, height: TRACK_HEIGHT - 8 }}
                    className={`${colors[i]} border border-white/5 rounded flex items-center justify-center`}
                  >
                    <span className="text-[10px] text-text-tertiary">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
