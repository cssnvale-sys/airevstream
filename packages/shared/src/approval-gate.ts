import { APPROVAL_DEFAULTS, QUALITY_THRESHOLDS } from './constants.js';

// ─── Types ───

export interface ApprovalGateInput {
  trustScore: number;
  gateWindowHrs: number;
  contentCreatedAt: Date | string;
  qualityScore: number | null;
  now?: Date;
}

export interface ApprovalGateResult {
  shouldAutoApprove: boolean;
  shouldAutoReject: boolean;
  deadline: Date | null;
  remainingHrs: number | null;
  reason: string;
}

export type ApprovalAction = 'approve' | 'reject';

export interface TrustUpdateInput {
  currentTrustScore: number;
  currentGateWindowHrs: number;
  action: ApprovalAction;
  qualityScore: number | null;
}

export interface TrustUpdateResult {
  newTrustScore: number;
  newGateWindowHrs: number;
}

// ─── Core Functions ───

/**
 * Evaluate whether content should be auto-approved, auto-rejected, or wait for manual review.
 */
export function evaluateApprovalGate(input: ApprovalGateInput): ApprovalGateResult {
  const { trustScore, gateWindowHrs, qualityScore, now = new Date() } = input;
  const createdAt = typeof input.contentCreatedAt === 'string' ? new Date(input.contentCreatedAt) : input.contentCreatedAt;

  // Auto-reject: quality below rejection threshold
  if (qualityScore != null && qualityScore < QUALITY_THRESHOLDS.AUTO_REJECT) {
    return {
      shouldAutoApprove: false,
      shouldAutoReject: true,
      deadline: null,
      remainingHrs: null,
      reason: `Quality score ${qualityScore} is below auto-reject threshold (${QUALITY_THRESHOLDS.AUTO_REJECT})`,
    };
  }

  // Auto-approve: high quality + high trust
  if (
    qualityScore != null &&
    qualityScore >= QUALITY_THRESHOLDS.AUTO_APPROVE &&
    trustScore >= APPROVAL_DEFAULTS.TRUST_SCORE_AUTO_APPROVE
  ) {
    return {
      shouldAutoApprove: true,
      shouldAutoReject: false,
      deadline: null,
      remainingHrs: null,
      reason: `Quality ${qualityScore} >= ${QUALITY_THRESHOLDS.AUTO_APPROVE} and trust ${trustScore} >= ${APPROVAL_DEFAULTS.TRUST_SCORE_AUTO_APPROVE}`,
    };
  }

  // Gate window: check if deadline has passed
  const deadline = new Date(createdAt.getTime() + gateWindowHrs * 60 * 60 * 1000);
  const remainingMs = deadline.getTime() - now.getTime();
  const remainingHrs = Math.max(0, remainingMs / (60 * 60 * 1000));

  if (remainingMs <= 0) {
    return {
      shouldAutoApprove: true,
      shouldAutoReject: false,
      deadline,
      remainingHrs: 0,
      reason: `Gate window expired (${gateWindowHrs}h) — auto-approving`,
    };
  }

  // Within gate window — wait for manual review
  return {
    shouldAutoApprove: false,
    shouldAutoReject: false,
    deadline,
    remainingHrs: Math.round(remainingHrs * 100) / 100,
    reason: `Awaiting manual review (${remainingHrs.toFixed(1)}h remaining)`,
  };
}

/**
 * Compute updated trust score and gate window after a manual approve/reject action.
 */
export function updateTrustAfterAction(input: TrustUpdateInput): TrustUpdateResult {
  const { currentTrustScore, currentGateWindowHrs, action } = input;

  if (action === 'approve') {
    return {
      newTrustScore: Math.min(100, currentTrustScore + APPROVAL_DEFAULTS.TRUST_SCORE_INCREMENT),
      newGateWindowHrs: Math.max(
        APPROVAL_DEFAULTS.MIN_GATE_WINDOW_HRS,
        currentGateWindowHrs - 0.5,
      ),
    };
  }

  // reject
  return {
    newTrustScore: Math.max(0, currentTrustScore - APPROVAL_DEFAULTS.TRUST_SCORE_DECREMENT),
    newGateWindowHrs: Math.min(
      APPROVAL_DEFAULTS.MAX_GATE_WINDOW_HRS,
      currentGateWindowHrs + 2,
    ),
  };
}
