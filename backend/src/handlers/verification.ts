import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import { actionKeys, calculatePoints, isActionType } from '../lib/points.js';
import {
  isReviewableStatus,
  validateReviewInput,
} from '../lib/verification.js';
import type { StoreDeps } from './actions.js';

function deps(): StoreDeps {
  return { doc: docClient, table: process.env.TABLE_NAME ?? DEFAULT_TABLE };
}

function isConditionalFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ConditionalCheckFailedException'
  );
}

/**
 * Explicit server-side reviewer identity. Phase 1: passed by trusted
 * backend code (a future verification worker), NEVER derived from the
 * action owner's token — reviewers cannot verify their own actions.
 * There is intentionally no public HTTP route for this core yet: exposing
 * self-service approval before a reviewer auth model exists would let any
 * signed-in user approve their own evidence.
 */
export interface ReviewerIdentity {
  reviewerId: string;
}

/**
 * Record a verification decision. Points come ONLY from the server
 * rule table for the stored actionType — any client-supplied points value
 * is ignored. The transition succeeds at most once: the conditional write
 * requires the item to still be pending/needs_review, so duplicate or
 * concurrent approvals collapse to a single award (losers get 409).
 */
export async function reviewActionCore(
  rawBody: unknown,
  reviewer: ReviewerIdentity | null,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (reviewer === null || reviewer.reviewerId.trim() === '')
    return { statusCode: 401, body: { message: 'Reviewer authentication required.' } };
  const v = validateReviewInput(rawBody);
  if (!v.ok) return { statusCode: 400, body: { message: v.error } };

  const { pk, sk } = actionKeys(v.value.userId, v.value.clientActionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: Record<string, any> | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const got = (await d.doc.send(
      new GetCommand({ TableName: d.table, Key: { pk, sk } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as { Item?: Record<string, any> };
    existing = got.Item;
  } catch (err) {
    console.error('reviewAction read failure:', err);
    return { statusCode: 500, body: { message: 'Could not review action.' } };
  }
  if (!existing)
    return { statusCode: 404, body: { message: 'Action not found.' } };
  if (!isActionType(existing.actionType)) {
    console.error('reviewAction: stored actionType invalid for', pk, sk);
    return { statusCode: 500, body: { message: 'Could not review action.' } };
  }
  if (existing.userId !== v.value.userId)
    return { statusCode: 404, body: { message: 'Action not found.' } };
  if (reviewer.reviewerId === existing.userId)
    return {
      statusCode: 403,
      body: { message: 'Reviewer cannot verify their own action.' },
    };
  if (!isReviewableStatus(existing.status))
    return {
      statusCode: 409,
      body: { message: 'Action is not pending review (already decided).' },
    };

  const points = calculatePoints(existing.actionType);
  const reviewedAt = new Date().toISOString();
  try {
    await d.doc.send(
      new UpdateCommand({
        TableName: d.table,
        Key: { pk, sk },
        UpdateExpression:
          'SET #st = :decision, points = :points, reviewedAt = :at, reviewedBy = :by' +
          (v.value.reason !== undefined ? ', reviewReason = :reason' : ''),
        ConditionExpression:
          'attribute_exists(pk) AND attribute_exists(sk) AND (#st = :pending OR #st = :needsReview)',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':decision': v.value.decision,
          ':points': v.value.decision === 'approved' ? points : 0,
          ':at': reviewedAt,
          ':by': reviewer.reviewerId,
          ':pending': 'pending',
          ':needsReview': 'needs_review',
          ...(v.value.reason !== undefined ? { ':reason': v.value.reason } : {}),
        },
      }),
    );
  } catch (err) {
    if (isConditionalFailure(err))
      return {
        statusCode: 409,
        body: { message: 'Action is not pending review (already decided).' },
      };
    console.error('reviewAction write failure:', err);
    return { statusCode: 500, body: { message: 'Could not review action.' } };
  }
  return {
    statusCode: 200,
    body: {
      actionId: v.value.clientActionId,
      status: v.value.decision,
      pointsAwarded: v.value.decision === 'approved' ? points : 0,
      reviewedAt,
    },
  };
}
