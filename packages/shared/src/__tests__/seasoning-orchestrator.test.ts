import { describe, it, expect } from 'vitest';
import {
  determineNextAction,
  shouldAdvancePhase,
  shouldGraduate,
  calculateNextSessionTime,
  selectActivitiesForSession,
  assessRisk,
  type EnrollmentRecord,
} from '../seasoning-orchestrator.js';
import { DEFAULT_SEASONING_SCHEDULE } from '../seasoning-config.js';
import type { ActivityLogEntry } from '../seasoning-types.js';

function makeEnrollment(overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  return {
    id: 'enroll-1',
    status: 'phase_1',
    currentPhase: 'phase_1',
    phaseStartedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    activitiesCompleted: 60,
    lastActivityAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
    nextScheduledAt: null,
    failureCount: 0,
    activityLog: [],
    socialAccountId: 'social-1',
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
    ...overrides,
  };
}

function makeActivityLogs(count: number, phase: string, daysAgo: number): ActivityLogEntry[] {
  const logs: ActivityLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    logs.push({
      timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + i * 60 * 60 * 1000).toISOString(),
      phase: phase as ActivityLogEntry['phase'],
      activities: ['browse', 'watch'],
      durationMs: 300000,
      success: true,
    });
  }
  return logs;
}

describe('determineNextAction', () => {
  it('returns signup for pending enrollment', () => {
    const enrollment = makeEnrollment({ status: 'pending' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toEqual({ type: 'signup', enrollmentId: 'enroll-1' });
  });

  it('returns null for signing_up enrollment', () => {
    const enrollment = makeEnrollment({ status: 'signing_up' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toBeNull();
  });

  it('returns null for needs_human enrollment', () => {
    const enrollment = makeEnrollment({ status: 'needs_human' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toBeNull();
  });

  it('returns warm action for phase_1 enrollment', () => {
    const enrollment = makeEnrollment({ status: 'phase_1' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('warm');
  });

  it('returns null for graduated enrollment', () => {
    const enrollment = makeEnrollment({ status: 'graduated' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toBeNull();
  });

  it('returns null for failed enrollment', () => {
    const enrollment = makeEnrollment({ status: 'failed' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toBeNull();
  });

  it('returns check action for paused enrollment', () => {
    const enrollment = makeEnrollment({ status: 'paused' });
    const action = determineNextAction(enrollment, DEFAULT_SEASONING_SCHEDULE);
    expect(action).toEqual({ type: 'check', enrollmentId: 'enroll-1' });
  });
});

describe('shouldAdvancePhase', () => {
  it('returns false when not enough days have passed', () => {
    const enrollment = makeEnrollment({
      phaseStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    });
    const result = shouldAdvancePhase(enrollment, DEFAULT_SEASONING_SCHEDULE.phases.phase_1);
    expect(result).toBe(false);
  });

  it('returns false with no phaseStartedAt', () => {
    const enrollment = makeEnrollment({ phaseStartedAt: null });
    const result = shouldAdvancePhase(enrollment, DEFAULT_SEASONING_SCHEDULE.phases.phase_1);
    expect(result).toBe(false);
  });

  it('returns true when duration met and activities sufficient', () => {
    const phaseStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago (phase_1 is 3 days)
    const logs = makeActivityLogs(10, 'phase_1', 3); // 10 sessions with 2 activities each = 20 activities
    const enrollment = makeEnrollment({
      phaseStartedAt: phaseStart.toISOString(),
      activityLog: logs,
    });
    const result = shouldAdvancePhase(enrollment, DEFAULT_SEASONING_SCHEDULE.phases.phase_1);
    expect(result).toBe(true);
  });

  it('returns false when duration met but not enough activities', () => {
    const phaseStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const enrollment = makeEnrollment({
      phaseStartedAt: phaseStart.toISOString(),
      activityLog: [], // no activities
    });
    const result = shouldAdvancePhase(enrollment, DEFAULT_SEASONING_SCHEDULE.phases.phase_1);
    expect(result).toBe(false);
  });
});

describe('shouldGraduate', () => {
  const criteria = DEFAULT_SEASONING_SCHEDULE.graduationCriteria;

  it('returns true when all criteria met', () => {
    const enrollment = makeEnrollment({
      status: 'seasoned',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      activitiesCompleted: 60,
    });
    const result = shouldGraduate(enrollment, criteria);
    expect(result).toBe(true);
  });

  it('returns false when not enough days', () => {
    const enrollment = makeEnrollment({
      status: 'seasoned',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      activitiesCompleted: 60,
    });
    const result = shouldGraduate(enrollment, criteria);
    expect(result).toBe(false);
  });

  it('returns false when not enough activities', () => {
    const enrollment = makeEnrollment({
      status: 'seasoned',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      activitiesCompleted: 10,
    });
    const result = shouldGraduate(enrollment, criteria);
    expect(result).toBe(false);
  });

  it('returns false when requireAllPhases and not in terminal status', () => {
    const enrollment = makeEnrollment({
      status: 'phase_2',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      activitiesCompleted: 60,
    });
    const result = shouldGraduate(enrollment, criteria);
    expect(result).toBe(false);
  });
});

describe('calculateNextSessionTime', () => {
  it('returns a future date', () => {
    const enrollment = makeEnrollment();
    const nextTime = calculateNextSessionTime(enrollment, DEFAULT_SEASONING_SCHEDULE.phases.phase_1);
    expect(nextTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('respects cooldown bounds roughly', () => {
    const enrollment = makeEnrollment();
    const phaseConfig = DEFAULT_SEASONING_SCHEDULE.phases.phase_1;
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      const nextTime = calculateNextSessionTime(enrollment, phaseConfig);
      const delayHours = (nextTime.getTime() - Date.now()) / (1000 * 60 * 60);
      results.push(delayHours);
    }
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    // Average should be roughly between min and max cooldown
    expect(avg).toBeGreaterThan(phaseConfig.cooldownHours.min * 0.5);
    expect(avg).toBeLessThan(phaseConfig.cooldownHours.max * 1.5);
  });
});

describe('selectActivitiesForSession', () => {
  it('returns only allowed activities for the phase', () => {
    const phaseConfig = DEFAULT_SEASONING_SCHEDULE.phases.phase_1;
    const activities = selectActivitiesForSession('phase_1', phaseConfig);
    expect(activities.length).toBeGreaterThan(0);
    for (const activity of activities) {
      expect(phaseConfig.allowedActivities).toContain(activity);
    }
  });

  it('returns more activities for later phases', () => {
    const phase1Config = DEFAULT_SEASONING_SCHEDULE.phases.phase_1;
    const phase4Config = DEFAULT_SEASONING_SCHEDULE.phases.phase_4;
    // Run multiple times to get averages
    let phase1Total = 0;
    let phase4Total = 0;
    const runs = 50;
    for (let i = 0; i < runs; i++) {
      phase1Total += selectActivitiesForSession('phase_1', phase1Config).length;
      phase4Total += selectActivitiesForSession('phase_4', phase4Config).length;
    }
    // Phase 4 should have more activities on average
    expect(phase4Total / runs).toBeGreaterThanOrEqual(phase1Total / runs);
  });
});

describe('assessRisk', () => {
  it('returns low risk for healthy enrollment', () => {
    const enrollment = makeEnrollment({
      failureCount: 0,
      activityLog: [],
      lastActivityAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    });
    const risk = assessRisk(enrollment);
    expect(risk.level).toBe('low');
    expect(risk.score).toBeLessThan(30);
  });

  it('returns high risk for enrollment with many failures and recent errors', () => {
    const recentErrors: ActivityLogEntry[] = Array.from({ length: 3 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      phase: 'phase_1' as const,
      activities: ['browse' as const],
      durationMs: 60000,
      success: false,
      error: 'Browser crashed',
    }));
    const enrollment = makeEnrollment({
      failureCount: 5,
      activityLog: recentErrors,
    });
    const risk = assessRisk(enrollment);
    expect(risk.level).toBe('high');
    expect(risk.factors).toContain('Too many consecutive failures');
  });

  it('flags excessive daily activities', () => {
    const recentLogs: ActivityLogEntry[] = [];
    for (let i = 0; i < 25; i++) {
      recentLogs.push({
        timestamp: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(), // Every 30 min
        phase: 'phase_2',
        activities: ['browse'],
        durationMs: 60000,
        success: true,
      });
    }
    const enrollment = makeEnrollment({
      activityLog: recentLogs,
    });
    const risk = assessRisk(enrollment);
    expect(risk.factors).toContain('Exceeded daily activity limit');
  });

  it('flags stale enrollment', () => {
    const enrollment = makeEnrollment({
      lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    });
    const risk = assessRisk(enrollment);
    expect(risk.factors.some((f) => f.includes('inactive'))).toBe(true);
  });

  it('flags sessions too close together', () => {
    const enrollment = makeEnrollment({
      lastActivityAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    });
    const risk = assessRisk(enrollment);
    expect(risk.factors).toContain('Sessions too close together');
  });
});
