import type { Platform } from './types.js';
import type { WarmingActivity } from '@airevstream/browser-automation';

// ─── Enrollment Status ───

export type EnrollmentStatus =
  | 'pending'
  | 'signing_up'
  | 'needs_human'
  | 'phase_1'
  | 'phase_2'
  | 'phase_3'
  | 'phase_4'
  | 'seasoned'
  | 'failed'
  | 'graduated'
  | 'paused';

// ─── Seasoning Phases ───

export type SeasoningPhase = 'signup' | 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4' | 'seasoned';

// ─── Cohort Status ───

export type CohortStatus = 'pending' | 'enrolling' | 'active' | 'paused' | 'completed';

// ─── Seasoning Action ───

export interface SeasoningAction {
  type: 'signup' | 'warm' | 'check' | 'graduate' | 'pause';
  enrollmentId: string;
  params?: Record<string, unknown>;
}

// ─── Risk Assessment ───

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  level: RiskLevel;
  factors: string[];
  score: number; // 0-100, higher = riskier
}

// ─── Activity Logging ───

export interface ActivityLogEntry {
  timestamp: string;
  phase: SeasoningPhase;
  activities: WarmingActivity[];
  durationMs: number;
  success: boolean;
  proxyUsed?: string;
  error?: string;
}

// ─── Enrollment Summary (for API responses) ───

export interface EnrollmentSummary {
  id: string;
  emailAccountId: string;
  email: string;
  platform: Platform;
  status: EnrollmentStatus;
  currentPhase: SeasoningPhase | null;
  activitiesCompleted: number;
  healthScore: number;
  lastActivityAt: string | null;
  nextScheduledAt: string | null;
  failureCount: number;
  failureReason: string | null;
}

// ─── Cohort Summary ───

export interface CohortSummary {
  id: string;
  name: string;
  status: CohortStatus;
  platforms: Platform[];
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  startedAt: string | null;
  createdAt: string;
  phaseCounts: Record<EnrollmentStatus, number>;
}

// ─── Seasoning Stats ───

export interface SeasoningStats {
  totalCohorts: number;
  activeCohorts: number;
  totalEnrollments: number;
  byStatus: Record<EnrollmentStatus, number>;
  byPlatform: Record<string, number>;
  graduatedLast7Days: number;
  failedLast7Days: number;
}
