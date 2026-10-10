import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getAuthIdentity, unauthorizedBody } from '../lib/auth.js';

function eventWith(authorizer: unknown): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer },
  } as unknown as APIGatewayProxyEvent;
}

test('getAuthIdentity reads sub+email from REST authorizer claims', () => {
  const id = getAuthIdentity(
    eventWith({ claims: { sub: 'sub-1', email: 'a@example.com' } }),
  );
  assert.deepEqual(id, { userId: 'sub-1', email: 'a@example.com' });
});

test('getAuthIdentity supports HTTP-API jwt.claims shape', () => {
  const id = getAuthIdentity(eventWith({ jwt: { claims: { sub: 'sub-2' } } }));
  assert.deepEqual(id, { userId: 'sub-2', email: undefined });
});

test('getAuthIdentity returns null for missing/empty/unsigned identity', () => {
  assert.equal(getAuthIdentity(eventWith(undefined)), null);
  assert.equal(getAuthIdentity(eventWith({})), null);
  assert.equal(getAuthIdentity(eventWith({ claims: {} })), null);
  assert.equal(getAuthIdentity(eventWith({ claims: { sub: '  ' } })), null);
  // A body-supplied userId is NOT an identity — claims only.
  assert.equal(
    getAuthIdentity({ body: JSON.stringify({ userId: 'victim' }) } as APIGatewayProxyEvent),
    null,
  );
});

test('unauthorizedBody does not leak tokens or secrets', () => {
  const s = JSON.stringify(unauthorizedBody());
  assert.ok(!/bearer|token|secret|password/i.test(s));
});
