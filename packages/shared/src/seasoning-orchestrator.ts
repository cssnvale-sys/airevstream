import type { WarmingActivity } from './types.js';
import type { SeasoningAction, EnrollmentStatus, RiskAssessment, SeasoningPhase, ActivityLogEntry } from './seasoning-types.js';
import type { PhaseConfig, GraduationCriteria, SeasoningSchedule } from './seasoning-config.js';
import { getNextPhase, SEASONING_RISK_THRESHOLDS } from './seasoning-config.js';

// ─── Enrollment Shape (matches Prisma SeasoningEnrollment) ───

export interface EnrollmentRecord {
  id: string;
  status: EnrollmentStatus;
  currentPhase: string | null;
  phaseStartedAt: Date | string | null;
  activitiesCompleted: number;
  lastActivityAt: Date | string | null;
  nextScheduledAt: Date | string | null;
  failureCount: number;
  activityLog: ActivityLogEntry[];
  socialAccountId: string | null;
  createdAt: Date | string;
}

// ─── State Machine ───

/**
 * Determines the next action for an enrollment based on its current state.
 * Returns null if no action is needed (e.g., already graduated, waiting for cooldown).
 */
export function determineNextAction(
  enrollment: EnrollmentRecord,
  schedule: SeasoningSchedule,
): SeasoningAction | null {
  const { status, id } = enrollment;

  switch (status) {
    case 'pending':
      return { type: 'signup', enrollmentId: id };

    case 'signing_up':
      // Signup in progress — no action needed
      return null;

    case 'needs_human':
      // Waiting for human intervention — no automated action
      return null;

    case 'phase_1':
    case 'phase_2':
    case 'phase_3':
    case 'phase_4': {
      const phaseKey = status as 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4';
      const phaseConfig = schedule.phases[phaseKey];

      // Check if we should advance to the next phase
      if (shouldAdvancePhase(enrollment, phaseConfig)) {
        const next = getNextPhase(status as SeasoningPhase);
        if (next === 'seasoned') {
          // Check graduation
          if (shouldGraduate(enrollment, schedule.graduationCriteria)) {
            return { type: 'graduate', enrollmentId: id };
          }
        }
        // Advance to next warming phase
        return { type: 'warm', enrollmentId: id, params: { advanceTo: next } };
      }

      // Otherwise, continue warming in current phase
      return { type: 'warm', enrollmentId: id, params: { phase: status } };
    }

    case 'seasoned':
      if (shouldGraduate(enrollment, schedule.graduationCriteria)) {
        return { type: 'graduate', enrollmentId: id };
      }
      return null;

    case 'paused':
      // Paused — check if risk has subsided
      return { type: 'check', enrollmentId: id };

    case 'failed':
    case 'graduated':
      return null;

    default:
      return null;
  }
}

// ─── Phase Advancement ───

/**
 * Determines if an enrollment has completed the requirements for its current phase.
 */
export function shouldAdvancePhase(
  enrollment: EnrollmentRecord,
  phaseConfig: PhaseConfig,
): boolean {
  if (!enrollment.phaseStartedAt) return false;

  const phaseStart = new Date(enrollment.phaseStartedAt);
  const now = new Date();
  const daysSincePhaseStart = (now.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24);

  // Must have spent minimum days in phase
  if (daysSincePhaseStart < phaseConfig.durationDays) return false;

  // Must have completed minimum activities for the phase
  // Count activities logged during this phase
  const phaseActivities = enrollment.activityLog.filter((entry) => {
    const entryTime = new Date(entry.timestamp);
    return entryTime >= phaseStart && entry.success;
  });
  const totalPhaseActivities = phaseActivities.reduce(
    (sum, entry) => sum + entry.activities.length,
    0,
  );

  const minRequired = phaseConfig.minDailyActivities * phaseConfig.durationDays;
  return totalPhaseActivities >= minRequired;
}

// ─── Graduation Check ───

/**
 * Determines if an enrollment meets all graduation criteria.
 */
export function shouldGraduate(
  enrollment: EnrollmentRecord,
  criteria: GraduationCriteria,
): boolean {
  const createdAt = new Date(enrollment.createdAt);
  const now = new Date();
  const totalDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (totalDays < criteria.minDaysTotal) return false;
  if (enrollment.activitiesCompleted < criteria.minActivitiesCompleted) return false;

  if (criteria.requireAllPhases) {
    // Enrollment must be in 'seasoned' or 'phase_4' status to graduate
    const terminalStatuses: EnrollmentStatus[] = ['seasoned', 'phase_4'];
    if (!terminalStatuses.includes(enrollment.status)) return false;
  }

  return true;
}

// ─── Session Scheduling ───

/**
 * Calculates the next session time with Gaussian jitter.
 * Uses Box-Muller transform for normally distributed randomness.
 */
export function calculateNextSessionTime(
  enrollment: EnrollmentRecord,
  phaseConfig: PhaseConfig,
): Date {
  const now = new Date();

  // Base delay: cooldown hours converted to ms
  const minCooldownMs = phaseConfig.cooldownHours.min * 60 * 60 * 1000;
  const maxCooldownMs = phaseConfig.cooldownHours.max * 60 * 60 * 1000;

  // Gaussian jitter centered between min and max cooldown
  const mean = (minCooldownMs + maxCooldownMs) / 2;
  const stddev = (maxCooldownMs - minCooldownMs) / 4; // ~95% within min/max

  const jitteredDelay = gaussianRandom(mean, stddev);

  // Clamp to min/max
  const clampedDelay = Math.max(minCooldownMs, Math.min(maxCooldownMs, jitteredDelay));

  return new Date(now.getTime() + clampedDelay);
}

// ─── Activity Selection ───

/**
 * Selects activities appropriate for the current phase and account age.
 * Earlier phases get more passive activities; later phases get interactive ones.
 */
export function selectActivitiesForSession(
  phase: SeasoningPhase,
  phaseConfig: PhaseConfig,
): WarmingActivity[] {
  const { allowedActivities, minDailyActivities, maxDailyActivities } = phaseConfig;

  // Random count between min and max per session (usually 1 session = fraction of daily)
  const sessionsPerDay = (phaseConfig.sessionsPerDay.min + phaseConfig.sessionsPerDay.max) / 2;
  const perSessionMin = Math.max(1, Math.floor(minDailyActivities / sessionsPerDay));
  const perSessionMax = Math.max(perSessionMin, Math.ceil(maxDailyActivities / sessionsPerDay));

  const count = Math.floor(Math.random() * (perSessionMax - perSessionMin + 1)) + perSessionMin;

  // Weighted selection: passive activities more likely in early phases
  const selected: WarmingActivity[] = [];
  for (let i = 0; i < count; i++) {
    const activity = allowedActivities[Math.floor(Math.random() * allowedActivities.length)];
    selected.push(activity);
  }

  return selected;
}

// ─── Risk Assessment ───

/**
 * Assesses the risk level of an enrollment based on activity patterns,
 * failure rate, and health signals.
 */
export function assessRisk(enrollment: EnrollmentRecord): RiskAssessment {
  const factors: string[] = [];
  let score = 0;

  // Factor 1: High failure count
  if (enrollment.failureCount >= SEASONING_RISK_THRESHOLDS.maxConsecutiveFailures) {
    factors.push('Too many consecutive failures');
    score += 40;
  } else if (enrollment.failureCount > 0) {
    score += enrollment.failureCount * 10;
    if (enrollment.failureCount > 1) factors.push('Multiple failures');
  }

  // Factor 2: Too many activities in recent 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActivities = enrollment.activityLog.filter(
    (entry) => new Date(entry.timestamp) > oneDayAgo,
  );
  const recentActivityCount = recentActivities.reduce(
    (sum, entry) => sum + entry.activities.length,
    0,
  );
  if (recentActivityCount > SEASONING_RISK_THRESHOLDS.maxDailyActivities) {
    factors.push('Exceeded daily activity limit');
    score += 30;
  }

  // Factor 3: Sessions too close together
  if (enrollment.lastActivityAt) {
    const hoursSinceLastActivity =
      (Date.now() - new Date(enrollment.lastActivityAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastActivity < SEASONING_RISK_THRESHOLDS.minSessionGapHours) {
      factors.push('Sessions too close together');
      score += 20;
    }
  }

  // Factor 4: Stale enrollment (no activity for days)
  if (enrollment.lastActivityAt) {
    const daysSinceActivity =
      (Date.now() - new Date(enrollment.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > SEASONING_RISK_THRESHOLDS.staleDays) {
      factors.push('Account inactive too long — may raise suspicion on resume');
      score += 15;
    }
  }

  // Factor 5: Errors in recent activity log
  const recentErrors = recentActivities.filter((entry) => !entry.success);
  if (recentErrors.length > 0) {
    factors.push(`${recentErrors.length} failed sessions in last 24h`);
    score += recentErrors.length * 10;
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

  return { level, factors, score };
}

// ─── Helpers ───

/** Box-Muller transform for Gaussian random numbers */
function gaussianRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}
