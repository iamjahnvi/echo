import type { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Identity derived ONLY from the verified JWT claims that the trusted API
 * Gateway Cognito authorizer places on the request context. A request-body
 * userId, query-string userId, or any unverified token is never accepted.
 */
export interface AuthIdentity {
  /** Cognito `sub` claim — stable per user, used as the data owner id. */
  userId: string;
  email?: string;
  address?: string;
}

interface AuthorizerShape {
  claims?: Record<string, unknown>;
  jwt?: { claims?: Record<string, unknown> };
}

export function getAuthIdentity(event: APIGatewayProxyEvent): AuthIdentity | null {
  const rc = event.requestContext as unknown as { authorizer?: unknown } | undefined;
  const authz = rc?.authorizer as AuthorizerShape | undefined;
  // REST API (Cognito authorizer): authorizer.claims. HTTP API (JWT): authorizer.jwt.claims.
  const claims = authz?.claims ?? authz?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || sub.trim() === '') return null;
  const email = claims?.email;
  const address = claims?.address;
  return {
    userId: sub,
    email: typeof email === 'string' && email !== '' ? email : undefined,
    address: typeof address === 'string' && address.trim() !== '' ? address : undefined,
  };
}

export function unauthorizedBody(): Record<string, unknown> {
  return { message: 'Missing or invalid authentication.' };
}
