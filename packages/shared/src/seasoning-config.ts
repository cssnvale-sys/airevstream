import type { Platform } from './types.js';
import type { WarmingActivity } from '@airevstream/browser-automation';
import type { SeasoningPhase } from './seasoning-types.js';

// ─── Phase Configuration ───

export interface PhaseConfig {
  name: string;
  durationDays: number;
  minDailyActivities: number;
  maxDailyActivities: number;
  allowedActivities: WarmingActivity[];
  intensity: 'low' | 'medium' | 'high';
  minSessionMinutes: number;
  maxSessionMinutes: number;
  sessionsPerDay: { min: number; max: number };
  cooldownHours: { min: number; max: number };
}

// ─── Graduation Criteria ───

export interface GraduationCriteria {
  minDaysTotal: number;
  minHealthScore: number;
  minActivitiesCompleted: number;
  requireAllPhases: boolean;
}

// ─── Seasoning Schedule ───

export interface SeasoningSchedule {
  id: string;
  name: string;
  description: string;
  phases: Record<Exclude<SeasoningPhase, 'signup' | 'seasoned'>, PhaseConfig>;
  graduationCriteria: GraduationCriteria;
}

// ─── Cohort Configuration ───

export interface CohortConfig {
  name: string;
  platforms: Platform[];
  scheduleId: string;
  staggerMinutes: { min: number; max: number };
  maxConcurrentSignups: number;
  maxConcurrentWarmingSessions: number;
  proxyType: 'residential' | 'datacenter' | 'mobile';
}

// ─── Default Schedule ───

export const DEFAULT_SEASONING_SCHEDULE: SeasoningSchedule = {
  id: 'default',
  name: 'Standard Seasoning',
  description: 'Conservative 3-week seasoning: passive → engagement → active',
  phases: {
    phase_1: {
      name: 'Passive Consumption',
      durationDays: 3,
      minDailyActivities: 2,
      maxDailyActivities: 5,
      allowedActivities: ['browse', 'watch', 'search'],
      intensity: 'low',
      minSessionMinutes: 5,
      maxSessionMinutes: 15,
      sessionsPerDay: { min: 1, max: 2 },
      cooldownHours: { min: 6, max: 12 },
    },
    phase_2: {
      name: 'Light Engagement',
      durationDays: 4,
      minDailyActivities: 3,
      maxDailyActivities: 8,
      allowedActivities: ['browse', 'watch', 'search', 'like', 'follow'],
      intensity: 'low',
      minSessionMinutes: 10,
      maxSessionMinutes: 25,
      sessionsPerDay: { min: 1, max: 3 },
      cooldownHours: { min: 4, max: 10 },
    },
    phase_3: {
      name: 'Active Engagement',
      durationDays: 7,
      minDailyActivities: 5,
      maxDailyActivities: 12,
      allowedActivities: ['browse', 'watch', 'search', 'like', 'follow', 'comment', 'subscribe'],
      intensity: 'medium',
      minSessionMinutes: 15,
      maxSessionMinutes: 40,
      sessionsPerDay: { min: 2, max: 4 },
      cooldownHours: { min: 3, max: 8 },
    },
    phase_4: {
      name: 'Full Activity',
      durationDays: 7,
      minDailyActivities: 5,
      maxDailyActivities: 15,
      allowedActivities: ['browse', 'watch', 'search', 'like', 'follow', 'comment', 'subscribe'],
      intensity: 'medium',
      minSessionMinutes: 15,
      maxSessionMinutes: 45,
      sessionsPerDay: { min: 2, max: 5 },
      cooldownHours: { min: 2, max: 6 },
    },
  },
  graduationCriteria: {
    minDaysTotal: 21,
    minHealthScore: 70,
    minActivitiesCompleted: 50,
    requireAllPhases: true,
  },
};

// ─── Platform Signup Constraints ───

export interface PlatformSignupConstraints {
  maxSignupsPerDay: number;
  cooldownBetweenSignupsMinutes: number;
  requiresPhoneVerification: boolean;
  requiresCaptcha: boolean;
  signupUrl: string;
}

export const PLATFORM_SIGNUP_CONSTRAINTS: Record<Platform, PlatformSignupConstraints> = {
  youtube: {
    maxSignupsPerDay: 3,
    cooldownBetweenSignupsMinutes: 60,
    requiresPhoneVerification: true,
    requiresCaptcha: true,
    signupUrl: 'https://accounts.google.com/signup',
  },
  tiktok: {
    maxSignupsPerDay: 5,
    cooldownBetweenSignupsMinutes: 30,
    requiresPhoneVerification: true,
    requiresCaptcha: true,
    signupUrl: 'https://www.tiktok.com/signup',
  },
  instagram: {
    maxSignupsPerDay: 3,
    cooldownBetweenSignupsMinutes: 45,
    requiresPhoneVerification: true,
    requiresCaptcha: true,
    signupUrl: 'https://www.instagram.com/accounts/emailsignup/',
  },
  facebook: {
    maxSignupsPerDay: 3,
    cooldownBetweenSignupsMinutes: 60,
    requiresPhoneVerification: true,
    requiresCaptcha: true,
    signupUrl: 'https://www.facebook.com/r.php',
  },
};

// ─── Risk Thresholds ───

export const SEASONING_RISK_THRESHOLDS = {
  /** Max activities in a 24h window before risk is elevated */
  maxDailyActivities: 20,
  /** Max failed attempts before pausing enrollment */
  maxConsecutiveFailures: 3,
  /** Health score below which we pause the enrollment */
  minHealthScore: 30,
  /** Days of inactivity before flagging as stale */
  staleDays: 3,
  /** Max concurrent browser sessions across all enrollments */
  maxGlobalConcurrentSessions: 5,
  /** Minimum hours between sessions for the same account */
  minSessionGapHours: 2,
} as const;

// ─── Phase Progression Helpers ───

const PHASE_ORDER: SeasoningPhase[] = ['signup', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'seasoned'];

export function getNextPhase(current: SeasoningPhase): SeasoningPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export function getPhaseIndex(phase: SeasoningPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function isTerminalPhase(phase: SeasoningPhase): boolean {
  return phase === 'seasoned';
}
