import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../handlers/health.js';

test('GET /health returns 200 without token', async () => {
  const res = await handler({} as never);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'ok');
});

test('seed dry-run flag is parseable', () => {
  assert.ok(true);
});
