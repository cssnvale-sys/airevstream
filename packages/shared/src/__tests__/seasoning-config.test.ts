import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SEASONING_SCHEDULE,
  PLATFORM_SIGNUP_CONSTRAINTS,
  SEASONING_RISK_THRESHOLDS,
  getNextPhase,
  getPhaseIndex,
  isTerminalPhase,
} from '../seasoning-config.js';

describe('DEFAULT_SEASONING_SCHEDULE', () => {
  it('has all 4 phases', () => {
    expect(Object.keys(DEFAULT_SEASONING_SCHEDULE.phases)).toEqual(['phase_1', 'phase_2', 'phase_3', 'phase_4']);
  });

  it('each phase has valid config', () => {
    for (const [key, phase] of Object.entries(DEFAULT_SEASONING_SCHEDULE.phases)) {
      expect(phase.name).toBeTruthy();
      expect(phase.durationDays).toBeGreaterThan(0);
      expect(phase.minDailyActivities).toBeGreaterThan(0);
      expect(phase.maxDailyActivities).toBeGreaterThanOrEqual(phase.minDailyActivities);
      expect(phase.allowedActivities.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(phase.intensity);
      expect(phase.minSessionMinutes).toBeGreaterThan(0);
      expect(phase.maxSessionMinutes).toBeGreaterThanOrEqual(phase.minSessionMinutes);
      expect(phase.sessionsPerDay.min).toBeGreaterThan(0);
      expect(phase.sessionsPerDay.max).toBeGreaterThanOrEqual(phase.sessionsPerDay.min);
      expect(phase.cooldownHours.min).toBeGreaterThan(0);
      expect(phase.cooldownHours.max).toBeGreaterThanOrEqual(phase.cooldownHours.min);
    }
  });

  it('phases get progressively more active', () => {
    const phases = DEFAULT_SEASONING_SCHEDULE.phases;
    expect(phases.phase_4.maxDailyActivities).toBeGreaterThanOrEqual(phases.phase_1.maxDailyActivities);
    expect(phases.phase_3.allowedActivities.length).toBeGreaterThanOrEqual(phases.phase_1.allowedActivities.length);
  });

  it('has valid graduation criteria', () => {
    const criteria = DEFAULT_SEASONING_SCHEDULE.graduationCriteria;
    expect(criteria.minDaysTotal).toBeGreaterThan(0);
    expect(criteria.minHealthScore).toBeGreaterThan(0);
    expect(criteria.minActivitiesCompleted).toBeGreaterThan(0);
    expect(criteria.requireAllPhases).toBe(true);
  });

  it('total phase duration adds up to at least graduation days', () => {
    const totalDays = Object.values(DEFAULT_SEASONING_SCHEDULE.phases)
      .reduce((sum, phase) => sum + phase.durationDays, 0);
    expect(totalDays).toBeGreaterThanOrEqual(DEFAULT_SEASONING_SCHEDULE.graduationCriteria.minDaysTotal);
  });
});

describe('PLATFORM_SIGNUP_CONSTRAINTS', () => {
  it('covers all 4 platforms', () => {
    expect(Object.keys(PLATFORM_SIGNUP_CONSTRAINTS)).toEqual(['youtube', 'tiktok', 'instagram', 'facebook']);
  });

  it('each platform has valid constraints', () => {
    for (const [platform, constraints] of Object.entries(PLATFORM_SIGNUP_CONSTRAINTS)) {
      expect(constraints.maxSignupsPerDay).toBeGreaterThan(0);
      expect(constraints.cooldownBetweenSignupsMinutes).toBeGreaterThan(0);
      expect(typeof constraints.requiresPhoneVerification).toBe('boolean');
      expect(typeof constraints.requiresCaptcha).toBe('boolean');
      expect(constraints.signupUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('SEASONING_RISK_THRESHOLDS', () => {
  it('has all expected threshold keys', () => {
    expect(SEASONING_RISK_THRESHOLDS.maxDailyActivities).toBeGreaterThan(0);
    expect(SEASONING_RISK_THRESHOLDS.maxConsecutiveFailures).toBeGreaterThan(0);
    expect(SEASONING_RISK_THRESHOLDS.minHealthScore).toBeGreaterThan(0);
    expect(SEASONING_RISK_THRESHOLDS.staleDays).toBeGreaterThan(0);
    expect(SEASONING_RISK_THRESHOLDS.maxGlobalConcurrentSessions).toBeGreaterThan(0);
    expect(SEASONING_RISK_THRESHOLDS.minSessionGapHours).toBeGreaterThan(0);
  });
});

describe('phase helpers', () => {
  it('getNextPhase returns correct progression', () => {
    expect(getNextPhase('signup')).toBe('phase_1');
    expect(getNextPhase('phase_1')).toBe('phase_2');
    expect(getNextPhase('phase_2')).toBe('phase_3');
    expect(getNextPhase('phase_3')).toBe('phase_4');
    expect(getNextPhase('phase_4')).toBe('seasoned');
    expect(getNextPhase('seasoned')).toBeNull();
  });

  it('getPhaseIndex returns correct indices', () => {
    expect(getPhaseIndex('signup')).toBe(0);
    expect(getPhaseIndex('phase_1')).toBe(1);
    expect(getPhaseIndex('seasoned')).toBe(5);
  });

  it('isTerminalPhase is true only for seasoned', () => {
    expect(isTerminalPhase('seasoned')).toBe(true);
    expect(isTerminalPhase('phase_1')).toBe(false);
    expect(isTerminalPhase('signup')).toBe(false);
  });
});
