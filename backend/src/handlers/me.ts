import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../lib/cors.js';
import { getAuthIdentity, unauthorizedBody } from '../lib/auth.js';

/** GET /me: reliable current-user profile from the verified token. */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const auth = getAuthIdentity(event);
  if (auth === null) {
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(unauthorizedBody()),
    };
  }
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: auth.userId, email: auth.email ?? null, address: auth.address ?? null }),
  };
};
