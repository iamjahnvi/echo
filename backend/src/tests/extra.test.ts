import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as meHandler } from '../handlers/me.js';
import { listActionsCore } from '../handlers/actions.js';
import {
  getLeaderboardCore,
  handler as boardHandler,
  maskUserId,
} from '../handlers/leaderboard.js';
import { deleteUploadCore } from '../handlers/uploads.js';

function stubDoc(impl: (cmd: unknown) => Promise<unknown>) {
  return { doc: { send: impl }, table: 't' };
}

const AUTH = { userId: 'sub-123', email: 'a@example.com' };

function eventWithClaims(claims: unknown): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer: { claims } },
  } as unknown as APIGatewayProxyEvent;
}

test('GET /me returns the verified Cognito profile attributes', async () => {
  const ok = await meHandler(eventWithClaims({ sub: 'sub-1', email: 'a@b.c', address: '1 Main St' }));
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(JSON.parse(ok.body), { userId: 'sub-1', email: 'a@b.c', address: '1 Main St' });

  const noMail = await meHandler(eventWithClaims({ sub: 'sub-2' }));
  assert.deepEqual(JSON.parse(noMail.body), { userId: 'sub-2', email: null, address: null });

  const anon = await meHandler({} as APIGatewayProxyEvent);
  assert.equal(anon.statusCode, 401);
});

test('list pagination honours limit, passes cursor through, rejects junk', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seen: any = null;
  const key = { pk: 'USER#x', sk: 'ACTION#y' };
  const token = Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
  const d = stubDoc(async (cmd: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seen = (cmd as any).input;
    return { Items: [], LastEvaluatedKey: key };
  });
  const r = await listActionsCore(AUTH, { limit: '10', nextToken: token }, d);
  assert.equal(r.statusCode, 200);
  assert.equal(seen.Limit, 10);
  assert.deepEqual(seen.ExclusiveStartKey, key);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((r.body as any).nextToken, token);

  const d2 = stubDoc(async () => ({ Items: [] }));
  assert.equal((await listActionsCore(AUTH, { limit: 0 }, d2)).statusCode, 400);
  assert.equal((await listActionsCore(AUTH, { limit: 51 }, d2)).statusCode, 400);
  assert.equal((await listActionsCore(AUTH, { nextToken: '!!!' }, d2)).statusCode, 400);
  const plain = await listActionsCore(AUTH, undefined, d2);
  assert.equal(plain.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((plain.body as any).nextToken, undefined);
});

test('maskUserId never exposes full subs or emails', () => {
  assert.equal(maskUserId('USER#abc')[0], 'u');
  const m = maskUserId('abcdef-123456');
  assert.ok(!m.includes('abcdef'));
  assert.ok(m.startsWith('user-'));
});

test('leaderboard aggregates totals, masks ids, sorts desc, caps limit', async () => {
  const d = stubDoc(async () => ({
    Items: [
      { pk: 'USER#aaa', points: 10 },
      { pk: 'USER#bbb', points: 25 },
      { pk: 'USER#aaa', points: 30 },
      { pk: 'USER#ccc', points: 'junk' },
    ],
  }));
  const r = await getLeaderboardCore(AUTH, undefined, d);
  assert.equal(r.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = r.body as any;
  assert.equal(body.participantCount, 3);
  assert.equal(body.leaders.length, 3);
  assert.equal(body.leaders[0].totalPoints, 40);
  assert.equal(body.leaders[0].actionCount, 2);
  for (const l of body.leaders) {
    assert.ok(!JSON.stringify(l).includes('USER#'));
    assert.ok(!JSON.stringify(l).includes('@'));
  }
});

test('leaderboard requires auth and validates limit', async () => {
  const d = stubDoc(async () => ({ Items: [] }));
  assert.equal((await getLeaderboardCore(null, undefined, d)).statusCode, 401);
  assert.equal((await getLeaderboardCore(AUTH, 0, d)).statusCode, 400);
  assert.equal((await getLeaderboardCore(AUTH, 99, d)).statusCode, 400);
  assert.equal((await getLeaderboardCore(AUTH, 'x', d)).statusCode, 400);
  const ok = await getLeaderboardCore(AUTH, '5', d);
  assert.equal(ok.statusCode, 200);
});

test('leaderboard handler maps events and 401s', async () => {
  const anon = await boardHandler({} as APIGatewayProxyEvent);
  assert.equal(anon.statusCode, 401);
});

test('deleteUploadCore enforces ownership and reports clearly', async () => {
  let deleted: unknown = null;
  const d = {
    bucket: 'b',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s3: { send: async (cmd: any) => { deleted = cmd.input; return {}; } },
  };
  const ok = await deleteUploadCore('uploads/sub-123/a1.jpg', AUTH, d);
  assert.equal(ok.statusCode, 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((deleted as any).Key, 'uploads/sub-123/a1.jpg');

  assert.equal((await deleteUploadCore('', AUTH, d)).statusCode, 400);
  assert.equal(
    (await deleteUploadCore('uploads/other/a1.jpg', AUTH, d)).statusCode,
    403,
  );
  assert.equal((await deleteUploadCore('uploads/sub-123/a1.jpg', null, d)).statusCode, 401);
  assert.equal(
    (await deleteUploadCore('uploads/sub-123/a1.jpg', AUTH, { ...d, bucket: '' })).statusCode,
    500,
  );
  const failing = {
    bucket: 'b',
    s3: {
      send: async () => {
        throw new Error('s3 down');
      },
    },
  };
  assert.equal(
    (await deleteUploadCore('uploads/sub-123/a1.jpg', AUTH, failing)).statusCode,
    500,
  );
});
