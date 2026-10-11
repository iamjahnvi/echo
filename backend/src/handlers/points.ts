import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../lib/cors.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import {
  getAuthIdentity,
  unauthorizedBody,
  type AuthIdentity,
} from '../lib/auth.js';
import type { StoreDeps } from './actions.js';

function deps(): StoreDeps {
  return { doc: docClient, table: process.env.TABLE_NAME ?? DEFAULT_TABLE };
}

/**
 * GET /points core: total = server-side sum of the CALLER's recorded action
 * points. Any query-string userId is ignored — no cross-user reads.
 */
export async function getPointsCore(
  auth: AuthIdentity | null,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  const userId = auth.userId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let out: { Items?: any[] };
  try {
    out = (await d.doc.send(
      new QueryCommand({
        TableName: d.table,
        // sk is the RANGE key: sort-key conditions belong in the key
        // condition (a FilterExpression on a primary key attribute is
        // rejected with ValidationException → 500/502 at runtime).
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'ACTION#',
        },
        Limit: 200,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as { Items?: any[] };
  } catch (err) {
    console.error('getPoints store failure:', err);
    return { statusCode: 500, body: { message: 'Could not load points.' } };
  }
  const items = out.Items ?? [];
  const totalPoints = items.reduce(
    (sum, it) => sum + (typeof it.points === 'number' ? it.points : 0),
    0,
  );
  return {
    statusCode: 200,
    body: { userId, totalPoints, actionCount: items.length },
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await getPointsCore(getAuthIdentity(event));
  return {
    statusCode: r.statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(r.body),
  };
};
