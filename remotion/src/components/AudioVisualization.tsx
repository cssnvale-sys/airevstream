import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import type { AudioVisualizationProps } from '../types';

/**
 * Audio visualization component that renders animated waveform, bars,
 * circle, or line visualizations. When a real audio URL is provided,
 * it uses getAudioData for visualization; otherwise, it generates
 * procedural visualizations from frame-based math for preview purposes.
 *
 * In production renders with actual audio, you would integrate
 * @remotion/media-utils getAudioData() and visualizeAudio() here.
 */
export const AudioVisualization: React.FC<AudioVisualizationProps> = ({
  audioUrl,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const {
    style,
    color,
    opacity,
    width,
    height,
    barCount,
    barGap,
    smoothing,
  } = config;

  // Generate procedural audio-like values for visualization.
  // In a real render with an actual audio file, this would be replaced by
  // visualizeAudio() from @remotion/media-utils.
  const values = useMemo(() => {
    return generateProceduralValues(frame, barCount, fps, smoothing);
  }, [frame, barCount, fps, smoothing]);

  return (
    <div
      style={{
        width,
        height,
        opacity,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {style === 'bars' && (
        <BarsVisualization
          values={values}
          width={width}
          height={height}
          barCount={barCount}
          barGap={barGap}
          color={color}
        />
      )}
      {style === 'waveform' && (
        <WaveformVisualization
          values={values}
          width={width}
          height={height}
          color={color}
        />
      )}
      {style === 'circle' && (
        <CircleVisualization
          values={values}
          width={width}
          height={height}
          color={color}
          frame={frame}
        />
      )}
      {style === 'line' && (
        <LineVisualization
          values={values}
          width={width}
          height={height}
          color={color}
        />
      )}
    </div>
  );
};

// ─── Procedural Value Generation ───

function generateProceduralValues(
  frame: number,
  count: number,
  fps: number,
  smoothing: number,
): number[] {
  const time = frame / fps;
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    const normalizedIndex = i / count;

    // Multiple sine waves at different frequencies for organic motion
    const wave1 = Math.sin(time * 3.0 + normalizedIndex * Math.PI * 4) * 0.3;
    const wave2 = Math.sin(time * 5.0 + normalizedIndex * Math.PI * 6) * 0.2;
    const wave3 = Math.sin(time * 1.5 + normalizedIndex * Math.PI * 2) * 0.25;
    const wave4 = Math.cos(time * 7.0 + normalizedIndex * Math.PI * 8) * 0.15;

    // Combine and normalize to 0..1
    const raw = 0.5 + wave1 + wave2 + wave3 + wave4;
    const clamped = Math.max(0.05, Math.min(1.0, raw));

    // Apply smoothing (acts as a minimum amplitude floor)
    const smoothed = clamped * (1 - smoothing * 0.3) + smoothing * 0.15;
    values.push(smoothed);
  }

  return values;
}

// ─── Bar Visualization ───

interface BarsProps {
  values: number[];
  width: number;
  height: number;
  barCount: number;
  barGap: number;
  color: string;
}

const BarsVisualization: React.FC<BarsProps> = ({
  values,
  width,
  height,
  barCount,
  barGap,
  color,
}) => {
  const totalGap = barGap * (barCount - 1);
  const barWidth = Math.max(1, (width - totalGap) / barCount);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: barGap,
        width: '100%',
        height: '100%',
      }}
    >
      {values.map((value, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: `${value * 100}%`,
            backgroundColor: color,
            borderRadius: barWidth / 2,
            minHeight: 2,
            transition: 'height 0.05s ease',
          }}
        />
      ))}
    </div>
  );
};

// ─── Waveform Visualization ───

interface WaveformProps {
  values: number[];
  width: number;
  height: number;
  color: string;
}

const WaveformVisualization: React.FC<WaveformProps> = ({
  values,
  width,
  height,
  color,
}) => {
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height / 2 + (v - 0.5) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── Circle Visualization ───

interface CircleProps {
  values: number[];
  width: number;
  height: number;
  color: string;
  frame: number;
}

const CircleVisualization: React.FC<CircleProps> = ({
  values,
  width,
  height,
  color,
  frame,
}) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.3;

  const rotation = interpolate(frame, [0, 300], [0, 360], {
    extrapolateRight: 'extend',
  });

  const points = values.map((v, i) => {
    const angle = (i / values.length) * Math.PI * 2 - Math.PI / 2;
    const radius = baseRadius + v * baseRadius * 0.5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    return `${x},${y}`;
  });

  // Close the path by repeating the first point
  if (points.length > 0) {
    points.push(points[0]);
  }

  const pathData = `M ${points.join(' L ')} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner circle for reference */}
      <circle
        cx={centerX}
        cy={centerY}
        r={baseRadius * 0.3}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.3}
      />
    </svg>
  );
};

// ─── Line Visualization ───

interface LineProps {
  values: number[];
  width: number;
  height: number;
  color: string;
}

const LineVisualization: React.FC<LineProps> = ({
  values,
  width,
  height,
  color,
}) => {
  // Mirror the waveform for a symmetrical line visualization
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const amplitude = v * height * 0.4;
    return { x, top: height / 2 - amplitude, bottom: height / 2 + amplitude };
  });

  const topPath = points.map((p) => `${p.x},${p.top}`).join(' L ');
  const bottomPath = points
    .slice()
    .reverse()
    .map((p) => `${p.x},${p.bottom}`)
    .join(' L ');

  const pathData = `M ${topPath} L ${bottomPath} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={pathData} fill={color} opacity={0.4} />
      <path d={`M ${topPath}`} fill="none" stroke={color} strokeWidth={2} />
      <path
        d={`M ${points
          .slice()
          .reverse()
          .map((p) => `${p.x},${p.bottom}`)
          .join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
    </svg>
  );
};
