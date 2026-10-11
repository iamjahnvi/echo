import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAwsSdkConfig } from '../lib/dynamo.js';
import { createActionCore, listActionsCore } from '../handlers/actions.js';
import { getPointsCore } from '../handlers/points.js';
import { getLeaderboardCore } from '../handlers/leaderboard.js';

const AUTH = { userId: 'sub-123', email: 'a@example.com' };

function stubDocFailing(msg = 'boom') {
  return {
    doc: {
      send: async () => {
        throw new Error(msg);
      },
    },
    table: 't',
  };
}

test('AWS SDK config forwards the Lambda session token (regression: 502s + S3 403)', () => {
  const savedKey = process.env.AWS_ACCESS_KEY_ID;
  const savedSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const savedToken = process.env.AWS_SESSION_TOKEN;
  try {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secretexample';
    process.env.AWS_SESSION_TOKEN = 'session-token-example';
    const cfg = buildAwsSdkConfig();
    assert.ok(cfg.credentials, 'expected explicit credentials when env keys exist');
    assert.equal(cfg.credentials?.accessKeyId, 'AKIAEXAMPLE');
    assert.equal(cfg.credentials?.secretAccessKey, 'secretexample');
    assert.equal(
      cfg.credentials?.sessionToken,
      'session-token-example',
      'session token must be forwarded — omitting it caused UnrecognizedClientException on every DynamoDB call and 403 on every presigned S3 PUT',
    );
  } finally {
    if (savedKey === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = savedKey;
    if (savedSecret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = savedSecret;
    if (savedToken === undefined) delete process.env.AWS_SESSION_TOKEN;
    else process.env.AWS_SESSION_TOKEN = savedToken;
  }
});

test('AWS SDK config omits credentials when no env keys exist (role chain)', () => {
  const savedKey = process.env.AWS_ACCESS_KEY_ID;
  try {
    delete process.env.AWS_ACCESS_KEY_ID;
    const cfg = buildAwsSdkConfig();
    assert.equal(cfg.credentials, undefined);
  } finally {
    if (savedKey !== undefined) process.env.AWS_ACCESS_KEY_ID = savedKey;
  }
});

test('POST /actions core returns JSON 500 (not throw) on store failure', async () => {
  const r = await createActionCore(
    { clientActionId: 'a1', actionType: 'recycle' },
    AUTH,
    stubDocFailing('UnrecognizedClientException'),
  );
  assert.equal(r.statusCode, 500);
  assert.deepEqual(r.body, { message: 'Could not record action.' });
});

test('GET /actions core returns JSON 500 (not throw) on store failure', async () => {
  const r = await listActionsCore(AUTH, undefined, stubDocFailing());
  assert.equal(r.statusCode, 500);
  assert.deepEqual(r.body, { message: 'Could not list actions.' });
});

test('GET /points core returns JSON 500 (not throw) on store failure', async () => {
  const r = await getPointsCore(AUTH, stubDocFailing());
  assert.equal(r.statusCode, 500);
  assert.deepEqual(r.body, { message: 'Could not load points.' });
});

test('GET /leaderboard core returns JSON 500 (not throw) on store failure', async () => {
  const r = await getLeaderboardCore(AUTH, undefined, stubDocFailing());
  assert.equal(r.statusCode, 500);
  assert.deepEqual(r.body, { message: 'Could not load leaderboard.' });
});

test('store-failure bodies never leak internal error detail', async () => {  const secret = 'SECRET-secret-key-material';
  const results = [
    await createActionCore(
      { clientActionId: 'a9', actionType: 'plant' },
      AUTH,
      stubDocFailing(secret),
    ),
    await listActionsCore(AUTH, undefined, stubDocFailing(secret)),
    await getPointsCore(AUTH, stubDocFailing(secret)),
    await getLeaderboardCore(AUTH, undefined, stubDocFailing(secret)),
  ];
  for (const r of results) {
    assert.equal(r.statusCode, 500);
    assert.ok(!JSON.stringify(r.body).includes(secret));
    assert.ok(!JSON.stringify(r.body).toLowerCase().includes('stack'));
  }
});

test('Query shapes keep the sort-key condition out of FilterExpression (regression: ValidationException)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seen: any[] = [];
  const d = {
    doc: {
      send: async (cmd: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seen.push((cmd as any).input);
        return { Items: [] };
      },
    },
    table: 't',
  };
  await listActionsCore(AUTH, undefined, d);
  await getPointsCore(AUTH, d);
  assert.equal(seen.length, 2);
  for (const input of seen) {
    assert.match(
      input.KeyConditionExpression,
      /begins_with\(sk, :prefix\)/,
      'sk condition must live in KeyConditionExpression',
    );
    assert.equal(
      input.FilterExpression,
      undefined,
      'primary-key attributes are rejected in FilterExpression by DynamoDB',
    );
  }
});
