/**
 * Evidence-backed verification lifecycle (Phase 1 foundation — no AI yet).
 *
 * States: every ACTION item carries `status`:
 *   pending → approved | rejected | needs_review
 *   needs_review → approved | rejected
 * Terminal states (approved/rejected) accept no further transitions.
 *
 * Compatibility contract (no migration, no data loss):
 * - Items written before this lifecycle have NO `status` attribute. They are
 *   treated as APPROVED (points keep counting) — legacy evidence of the old
 *   submit-and-award behavior. Only status-bearing items are reviewable.
 * - New submissions are stored with `status: 'pending'` and `points: 0`:
 *   uploading evidence or submitting an action awards NOTHING by itself.
 * - Points are set to the server rule-table value ONLY by the approve
 *   transition. Clients can never supply their own point rewards: neither
 *   submit nor review input contains a points field, and any smuggled
 *   `points` property is ignored.
 *
 * Concurrency: the approve/reject transition is a single conditional
 * UpdateCommand (`status` must still be pending/needs_review), so duplicate
 * or concurrent approvals award points at most once — losers observe
 * ConditionalCheckFailedException (mapped to 409).
 *
 * NOTE on DynamoDB syntax: `status` is a DynamoDB reserved word, so every
 * expression touching it must alias it (e.g. `#st`).
 */

export const VERIFICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'needs_review',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Decisions a trusted reviewer may record. */
export const REVIEW_DECISIONS = ['approved', 'rejected', 'needs_review'] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function isVerificationStatus(v: unknown): v is VerificationStatus {
  return (
    typeof v === 'string' &&
    (VERIFICATION_STATUSES as readonly string[]).includes(v)
  );
}

export function isReviewDecision(v: unknown): v is ReviewDecision {
  return (
    typeof v === 'string' &&
    (REVIEW_DECISIONS as readonly string[]).includes(v)
  );
}

/** Reviewable (non-terminal) states a transition may start from. */
export function isReviewableStatus(v: unknown): boolean {
  return v === 'pending' || v === 'needs_review';
}

/**
 * Whether an item's stored points count toward totals.
 * Legacy items (no status attribute) count as approved — this preserves
 * existing user data without a migration.
 */
export function isApprovedForPoints(item: {
  status?: unknown;
  points?: unknown;
}): boolean {
  if (item.status === undefined) return true;
  return item.status === 'approved';
}

/** Points an item contributes to totals: awarded value or zero. */
export function awardedPoints(item: {
  status?: unknown;
  points?: unknown;
}): number {
  if (!isApprovedForPoints(item)) return 0;
  return typeof item.points === 'number' ? item.points : 0;
}

/** Display status for read paths (legacy items read as approved). */
export function displayStatus(item: { status?: unknown }): VerificationStatus {
  return isVerificationStatus(item.status) ? item.status : 'approved';
}

export interface ReviewInput {
  /** Owner of the action under review (partition key, without USER# prefix). */
  userId: string;
  /** Idempotency key of the action (sort key, without ACTION# prefix). */
  clientActionId: string;
  decision: ReviewDecision;
  /** Optional reviewer note (never a points value). */
  reason?: string;
}

export const MAX_REVIEW_REASON_LENGTH = 500;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function validateReviewInput(
  body: unknown,
):
  | { ok: true; value: ReviewInput }
  | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be JSON.' };
  const { userId, clientActionId, decision, reason } = body;
  if (typeof userId !== 'string' || userId.trim() === '')
    return { ok: false, error: 'userId is required.' };
  if (userId.length > 128) return { ok: false, error: 'userId is too long.' };
  if (typeof clientActionId !== 'string' || clientActionId.trim() === '')
    return { ok: false, error: 'clientActionId is required.' };
  if (clientActionId.length > 128)
    return { ok: false, error: 'clientActionId is too long.' };
  if (!isReviewDecision(decision))
    return {
      ok: false,
      error: `decision must be one of: ${REVIEW_DECISIONS.join(', ')}.`,
    };
  // NOTE: a smuggled `points`/`pointsAwarded` property is deliberately NOT
  // read here — point values come only from the server rule table.
  if (reason !== undefined) {
    if (typeof reason !== 'string')
      return { ok: false, error: 'reason must be a string.' };
    if (reason.length > MAX_REVIEW_REASON_LENGTH)
      return {
        ok: false,
        error: `reason must be at most ${MAX_REVIEW_REASON_LENGTH} characters.`,
      };
  }
  const value: ReviewInput = {
    userId: userId.trim(),
    clientActionId: clientActionId.trim(),
    decision,
  };
  if (reason !== undefined) value.reason = reason;
  return { ok: true, value };
}
