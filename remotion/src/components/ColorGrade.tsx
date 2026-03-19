import React from 'react';
import type { CinemaColorGrade } from '../types';

interface ColorGradeProps {
  grade?: CinemaColorGrade;
  children: React.ReactNode;
}

/**
 * ColorGrade — Applies color grading via CSS filters and overlays.
 */
export const ColorGrade: React.FC<ColorGradeProps> = ({ grade, children }) => {
  if (!grade) {
    return <>{children}</>;
  }

  // Build CSS filter string
  const filters: string[] = [];

  if (grade.contrast !== undefined && grade.contrast !== 0) {
    filters.push(`contrast(${100 + grade.contrast}%)`);
  }
  if (grade.saturation !== undefined && grade.saturation !== 0) {
    filters.push(`saturate(${100 + grade.saturation}%)`);
  }
  if (grade.temperature !== undefined && grade.temperature !== 0) {
    // Approximate color temperature with hue-rotate
    // Warm = orange shift, Cool = blue shift
    const hueShift = grade.temperature * 0.3;
    filters.push(`hue-rotate(${hueShift}deg)`);
  }
  if (grade.highlights !== undefined && grade.highlights !== 0) {
    const brightness = 100 + grade.highlights * 0.3;
    filters.push(`brightness(${brightness}%)`);
  }

  const filterString = filters.length > 0 ? filters.join(' ') : 'none';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Main content with CSS filters */}
      <div
        style={{
          width: '100%',
          height: '100%',
          filter: filterString,
        }}
      >
        {children}
      </div>

      {/* Film grain overlay */}
      {grade.filmGrain && grade.filmGrain > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: grade.filmGrain / 200,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Vignette overlay */}
      {grade.vignette && grade.vignette > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${grade.vignette / 100}) 100%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
