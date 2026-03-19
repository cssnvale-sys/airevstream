'use client';

import type { ShotData } from './shot-editor-panel';

interface ShotPreviewProps {
  shot: ShotData | null;
}

export function ShotPreview({ shot }: ShotPreviewProps) {
  if (!shot) {
    return (
      <div className="aspect-video bg-bg-tertiary rounded-lg flex items-center justify-center border border-border">
        <p className="text-text-secondary text-sm">No shot selected</p>
      </div>
    );
  }

  const keyframe = shot.keyframeUrls[0];

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden border border-border relative">
      {keyframe ? (
        <img
          src={keyframe}
          alt={`Shot ${shot.shotNumber}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-bg-tertiary">
          <div className="text-center">
            <p className="text-text-secondary text-sm">Shot {shot.shotNumber}</p>
            <p className="text-text-tertiary text-xs mt-1">{shot.status === 'generating' ? 'Generating...' : 'No keyframe yet'}</p>
          </div>
        </div>
      )}
      {/* Shot info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between text-white text-xs">
          <span>Shot {shot.shotNumber}</span>
          <span>{shot.endSec - shot.startSec}s</span>
        </div>
      </div>
    </div>
  );
}
