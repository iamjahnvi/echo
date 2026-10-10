import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_POINTS,
  calculatePoints,
  isActionType,
  validateActionInput,
  actionKeys,
} from '../lib/points.js';
import { createActionCore, listActionsCore } from '../handlers/actions.js';
import { getPointsCore } from '../handlers/points.js';

test('points rule table awards legitimate values per action type', () => {
  assert.equal(calculatePoints('recycle'), 10);
  assert.equal(calculatePoints('transit'), 15);
  assert.equal(calculatePoints('energy'), 20);
  assert.equal(calculatePoints('cleanup'), 25);
  assert.equal(calculatePoints('plant'), 30);
  assert.equal(Object.keys(ACTION_POINTS).length, 5);
});

test('isActionType rejects unknown types', () => {
  assert.equal(isActionType('recycle'), true);
  assert.equal(isActionType('fly'), false);
  assert.equal(isActionType(undefined), false);
});

test('validateActionInput accepts a full valid payload incl. photo meta', () => {
  const r = validateActionInput({
    userId: 'u1',
    clientActionId: 'a1',
    actionType: 'cleanup',
    note: 'park run',
    photoName: 'park.jpg',
    photoSize: 1024,
    photoType: 'image/jpeg',
  });
  assert.equal(r.ok, true);
});

test('validateActionInput rejects bad actionType, empty userId, long note, oversize photo', () => {
  const base = { userId: 'u1', clientActionId: 'a1', actionType: 'cleanup' };
  assert.equal(validateActionInput({ ...base, actionType: 'nap' }).ok, false);
  assert.equal(validateActionInput({ ...base, userId: '  ' }).ok, false);
  assert.equal(validateActionInput({ ...base, clientActionId: '' }).ok, false);
  assert.equal(validateActionInput({ ...base, note: 'x'.repeat(501) }).ok, false);
  assert.equal(validateActionInput({ ...base, photoSize: 6 * 1024 * 1024 }).ok, false);
  assert.equal(
    validateActionInput({ ...base, photoType: 'application/pdf' }).ok,
    false,
  );
  assert.equal(validateActionInput('nope').ok, false);
});

test('actionKeys are deterministic per user+idempotency key', () => {
  assert.deepEqual(actionKeys('u1', 'a1'), { pk: 'USER#u1', sk: 'ACTION#a1' });
  assert.deepEqual(actionKeys('u1', 'a1'), actionKeys('u1', 'a1'));
});

function stubDoc(impl: (cmd: unknown) => Promise<unknown>) {
  return { doc: { send: impl }, table: 't' };
}

const AUTH = { userId: 'sub-123', email: 'a@example.com' };

test('createActionCore returns 201 with server-computed points + conditional write', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seen: any = null;
  const d = stubDoc(async (cmd: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seen = (cmd as any).input;
    return {};
  });
  const r = await createActionCore(
    { userId: 'u1', clientActionId: 'a1', actionType: 'plant' },
    AUTH,
    d,
  );
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.pointsAwarded, 30);
  assert.equal(seen.ConditionExpression, 'attribute_not_exists(pk) AND attribute_not_exists(sk)');
  assert.equal(seen.Item.points, 30);
  assert.equal(seen.Item.pk, 'USER#sub-123');
});

test('createActionCore returns 409 on duplicate idempotency key (no double award)', async () => {
  const dup = new Error('dup');
  dup.name = 'ConditionalCheckFailedException';
  const d = stubDoc(async () => {
    throw dup;
  });
  const r = await createActionCore(
    { userId: 'u1', clientActionId: 'a1', actionType: 'plant' },
    AUTH,
    d,
  );
  assert.equal(r.statusCode, 409);
});

test('createActionCore returns 400 for invalid input without touching the store', async () => {
  let called = false;
  const d = stubDoc(async () => {
    called = true;
    return {};
  });
  const r = await createActionCore({ userId: 'u1', actionType: 'bogus' }, AUTH, d);
  assert.equal(r.statusCode, 400);
  assert.equal(called, false);
});

test('listActionsCore returns newest-first actions; getPointsCore sums server-side', async () => {
  const items = [
    { clientActionId: 'old', actionType: 'recycle', points: 10, createdAt: '2026-01-01T00:00:00.000Z' },
    { clientActionId: 'new', actionType: 'cleanup', points: 25, createdAt: '2026-02-01T00:00:00.000Z' },
  ];
  const d = stubDoc(async () => ({ Items: items }));
  const list = await listActionsCore(AUTH, undefined, d);
  assert.equal(list.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acts = (list.body as any).actions;
  assert.equal(acts[0].actionId, 'new');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((list.body as any).userId, 'sub-123');
  const pts = await getPointsCore(AUTH, d);
  assert.equal(pts.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).totalPoints, 35);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((pts.body as any).actionCount, 2);
});

test('list/getPoints return 401 without authentication', async () => {
  const d = stubDoc(async () => ({ Items: [] }));
  assert.equal((await listActionsCore(null, undefined, d)).statusCode, 401);
  assert.equal((await getPointsCore(null, d)).statusCode, 401);
  assert.equal(
    (await createActionCore({ actionType: 'recycle' }, null, d)).statusCode,
    401,
  );
});

test('spoofed body userId is ignored — record owner is the token identity', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seen: any = null;
  const d = stubDoc(async (cmd: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seen = (cmd as any).input;
    return {};
  });
  const r = await createActionCore(
    { userId: 'victim', clientActionId: 'a9', actionType: 'recycle' },
    AUTH,
    d,
  );
  assert.equal(r.statusCode, 201);
  assert.equal(seen.Item.pk, 'USER#sub-123');
  assert.equal(seen.Item.userId, 'sub-123');
});

test('list queries only the caller partition even if a spoofed query is attempted', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seen: any = null;
  const d = stubDoc(async (cmd: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seen = (cmd as any).input;
    return { Items: [] };
  });
  // No query param reaches the core anymore — identity is the only input.
  const r = await listActionsCore(AUTH, undefined, d);
  assert.equal(r.statusCode, 200);
  assert.equal(seen.ExpressionAttributeValues[':pk'], 'USER#sub-123');
});
