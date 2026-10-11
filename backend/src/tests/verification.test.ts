import test from 'node:test';
import assert from 'node:assert/strict';
import { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createActionCore, listActionsCore } from '../handlers/actions.js';
import { getPointsCore } from '../handlers/points.js';
import { getLeaderboardCore } from '../handlers/leaderboard.js';
import { reviewActionCore } from '../handlers/verification.js';
import {
  awardedPoints,
  displayStatus,
  isApprovedForPoints,
  isReviewDecision,
  isReviewableStatus,
  isVerificationStatus,
  validateReviewInput,
} from '../lib/verification.js';
import { ACTION_POINTS } from '../lib/points.js';

const AUTH = { userId: 'sub-123', email: 'a@example.com' };
const REVIEWER = { reviewerId: 'reviewer-svc' };

function conditionalFail(): Error {
  const e = new Error('The conditional request failed');
  e.name = 'ConditionalCheckFailedException';
  return e;
}

/**
 * In-memory DynamoDB double that HONESTLY enforces the conditional
 * expressions our cores rely on (attribute_not_exists on Put; reviewable
 * status on Update). Lets us prove single-award under duplicate and
 * concurrent approval without touching AWS.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>;

function makeFakeStore() {
  const items = new Map<string, Item>();
  const keyOf = (pk: string, sk: string): string => `${pk}|${sk}`;
  const d = {
    table: 't',
    doc: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      send: async (cmd: any): Promise<any> => {
        const input = cmd.input as Item;
        if (cmd instanceof PutCommand) {
          const k = keyOf(input.Item.pk, input.Item.sk);
          if (
            typeof input.ConditionExpression === 'string' &&
            input.ConditionExpression.includes('attribute_not_exists') &&
            items.has(k)
          )
            throw conditionalFail();
          items.set(k, { ...input.Item });
          return {};
        }
        if (cmd instanceof GetCommand) {
          const k = keyOf(input.Key.pk, input.Key.sk);
          const found = items.get(k);
          return found ? { Item: { ...found } } : {};
        }
        if (cmd instanceof QueryCommand) {
          const pk = input.ExpressionAttributeValues?.[':pk'] as string;
          const prefix = input.ExpressionAttributeValues?.[':prefix'] as string | undefined;
          const out = [...items.values()].filter(
            (it) =>
              it.pk === pk && (prefix === undefined || String(it.sk).startsWith(String(prefix).replace('ACTION#', 'ACTION#'))),
          );
          return { Items: out.map((it) => ({ ...it })) };
        }
        if (cmd instanceof ScanCommand) {
          return { Items: [...items.values()].map((it) => ({ ...it })) };
        }
        if (cmd instanceof UpdateCommand) {
          const k = keyOf(input.Key.pk, input.Key.sk);
          const cur = items.get(k);
          if (!cur) throw conditionalFail();
          // Emulate: (#st = :pending OR #st = :needsReview). Legacy items
          // (no status) are NOT reviewable through this path.
          if (!isReviewableStatus(cur.status)) throw conditionalFail();
          const vals = input.ExpressionAttributeValues as Item;
          const next = { ...cur };
          next.status = vals[':decision'];
          next.points = vals[':points'];
          next.reviewedAt = vals[':at'];
          next.reviewedBy = vals[':by'];
          if (':reason' in vals) next.reviewReason = vals[':reason'];
          items.set(k, next);
          return { Attributes: { ...next } };
        }
        throw new Error(`unsupported command in fake: ${cmd.constructor.name}`);
      },
    },
  };
  return { d, items };
}

test('verification status helpers encode the lifecycle', () => {
  assert.equal(isVerificationStatus('pending'), true);
  assert.equal(isVerificationStatus('needs_review'), true);
  assert.equal(isVerificationStatus('approved'), true);
  assert.equal(isVerificationStatus('rejected'), true);
  assert.equal(isVerificationStatus('awarded'), false);
  assert.equal(isReviewDecision('approved'), true);
  assert.equal(isReviewDecision('pending'), false);
  assert.equal(isReviewableStatus('pending'), true);
  assert.equal(isReviewableStatus('needs_review'), true);
  assert.equal(isReviewableStatus('approved'), false);
  assert.equal(isReviewableStatus('rejected'), false);
  assert.equal(isReviewableStatus(undefined), false);
});

test('legacy items (no status) keep counting; pending/rejected award zero', () => {
  assert.equal(isApprovedForPoints({ points: 25 }), true);
  assert.equal(awardedPoints({ points: 25 }), 25);
  assert.equal(displayStatus({}), 'approved');
  assert.equal(awardedPoints({ status: 'approved', points: 25 }), 25);
  assert.equal(awardedPoints({ status: 'pending', points: 0 }), 0);
  assert.equal(awardedPoints({ status: 'rejected', points: 0 }), 0);
  assert.equal(awardedPoints({ status: 'needs_review', points: 0 }), 0);
  // Even a tampered pending record with nonzero points awards nothing.
  assert.equal(awardedPoints({ status: 'pending', points: 999 }), 0);
});

test('submitting evidence awards zero points until approved', async () => {
  const { d } = makeFakeStore();
  const r = await createActionCore(
    { clientActionId: 'e1', actionType: 'cleanup' },
    AUTH,
    d,
  );
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.pointsAwarded, 0);
  assert.equal(r.body.status, 'pending');
  const pts = await getPointsCore(AUTH, d);
  assert.equal(pts.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 0);
  const list = await listActionsCore(AUTH, undefined, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shown = (list.body as any).actions[0];
  assert.equal(shown.status, 'pending');
  assert.equal(shown.points, 0);
});

test('only an approved action awards its configured rule-table points', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'a1', actionType: 'plant' }, AUTH, d);
  const ok = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'a1', decision: 'approved' },
    REVIEWER,
    d,
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.status, 'approved');
  assert.equal(ok.body.pointsAwarded, ACTION_POINTS.plant);
  const pts = await getPointsCore(AUTH, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).actionCount, 1);
  const board = await getLeaderboardCore(AUTH, 10, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((board.body as any).leaders[0].totalPoints, 30);
});

test('rejected actions award zero points', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'r1', actionType: 'plant' }, AUTH, d);
  const r = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'r1', decision: 'rejected', reason: 'no evidence visible' },
    REVIEWER,
    d,
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.pointsAwarded, 0);
  const pts = await getPointsCore(AUTH, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 0);
});

test('needs_review is a valid intermediate state leading to approval', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'n1', actionType: 'recycle' }, AUTH, d);
  const mid = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'n1', decision: 'needs_review' },
    REVIEWER,
    d,
  );
  assert.equal(mid.statusCode, 200);
  assert.equal(mid.body.pointsAwarded, 0);
  const fin = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'n1', decision: 'approved' },
    REVIEWER,
    d,
  );
  assert.equal(fin.statusCode, 200);
  assert.equal(fin.body.pointsAwarded, 10);
});

test('smuggled client points are ignored — awards come from the rule table', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 's1', actionType: 'transit' }, AUTH, d);
  const r = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 's1', decision: 'approved', points: 9999, pointsAwarded: 9999 },
    REVIEWER,
    d,
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.pointsAwarded, ACTION_POINTS.transit);
});

test('duplicate approval cannot award points twice', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'd1', actionType: 'cleanup' }, AUTH, d);
  const first = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'd1', decision: 'approved' },
    REVIEWER,
    d,
  );
  assert.equal(first.statusCode, 200);
  const second = await reviewActionCore(
    { userId: 'sub-123', clientActionId: 'd1', decision: 'approved' },
    REVIEWER,
    d,
  );
  assert.equal(second.statusCode, 409);
  const pts = await getPointsCore(AUTH, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 25);
});

test('concurrent approval attempts award points exactly once', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'c1', actionType: 'energy' }, AUTH, d);
  const [a, b] = await Promise.all([
    reviewActionCore({ userId: 'sub-123', clientActionId: 'c1', decision: 'approved' }, REVIEWER, d),
    reviewActionCore({ userId: 'sub-123', clientActionId: 'c1', decision: 'approved' }, REVIEWER, d),
  ]);
  const codes = [a.statusCode, b.statusCode].sort();
  assert.deepEqual(codes, [200, 409]);
  const pts = await getPointsCore(AUTH, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 20);
});

test('review guards: auth, ownership, self-review, unknown action, bad input', async () => {
  const { d } = makeFakeStore();
  await createActionCore({ clientActionId: 'g1', actionType: 'recycle' }, AUTH, d);
  assert.equal(
    (await reviewActionCore({ userId: 'sub-123', clientActionId: 'g1', decision: 'approved' }, null, d)).statusCode,
    401,
  );
  assert.equal(
    (await reviewActionCore({ userId: 'sub-123', clientActionId: 'nope', decision: 'approved' }, REVIEWER, d)).statusCode,
    404,
  );
  assert.equal(
    (await reviewActionCore({ userId: 'sub-123', clientActionId: 'g1', decision: 'approved' }, { reviewerId: 'sub-123' }, d)).statusCode,
    403,
  );
  assert.equal(
    (await reviewActionCore({ userId: 'sub-123', clientActionId: 'g1', decision: 'maybe' }, REVIEWER, d)).statusCode,
    400,
  );
  assert.equal(validateReviewInput({}).ok, false);
  // Legacy items (no status attribute) are not reviewable in place.
  const legacy = makeFakeStore();
  legacy.items.set('USER#sub-123|ACTION#old', {
    pk: 'USER#sub-123',
    sk: 'ACTION#old',
    userId: 'sub-123',
    clientActionId: 'old',
    actionType: 'recycle',
    points: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(
    (await reviewActionCore({ userId: 'sub-123', clientActionId: 'old', decision: 'approved' }, REVIEWER, legacy.d)).statusCode,
    409,
  );
});

test('one user cannot submit another user action photo object', async () => {
  let called = false;
  const d = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: { send: async (_cmd: any) => { called = true; return {}; } },
    table: 't',
  };
  // Another user's key entirely.
  assert.equal(
    (
      await createActionCore(
        { clientActionId: 'a1', actionType: 'recycle', photoKey: 'uploads/other-user/a1.jpg' },
        AUTH,
        d,
      )
    ).statusCode,
    400,
  );
  // Own prefix but issued for a DIFFERENT action attempt.
  assert.equal(
    (
      await createActionCore(
        { clientActionId: 'a1', actionType: 'recycle', photoKey: 'uploads/sub-123/other-action.jpg' },
        AUTH,
        d,
      )
    ).statusCode,
    400,
  );
  assert.equal(called, false);
});

test('legacy submitted data still aggregates exactly as before', async () => {
  const { d, items } = makeFakeStore();
  items.set('USER#sub-123|ACTION#old1', {
    pk: 'USER#sub-123', sk: 'ACTION#old1', userId: 'sub-123',
    clientActionId: 'old1', actionType: 'recycle', points: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  items.set('USER#sub-123|ACTION#old2', {
    pk: 'USER#sub-123', sk: 'ACTION#old2', userId: 'sub-123',
    clientActionId: 'old2', actionType: 'cleanup', points: 25,
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const pts = await getPointsCore(AUTH, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 35);
  const board = await getLeaderboardCore(AUTH, 10, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((board.body as any).leaders[0].totalPoints, 35);
  const list = await listActionsCore(AUTH, undefined, d);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual((list.body as any).actions.map((a: any) => a.status), ['approved', 'approved']);
});
