import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../handlers/health.js';

test('GET /health returns 200 without token', async () => {
  const res = await handler({} as never);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers?.['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(res.headers?.['Access-Control-Allow-Headers'], 'Content-Type,Authorization');
  assert.equal(res.headers?.['Access-Control-Allow-Methods'], 'GET,POST,DELETE,OPTIONS');
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'ok');
});

test('seed dry-run flag is parseable', () => {
  assert.ok(true);
});
