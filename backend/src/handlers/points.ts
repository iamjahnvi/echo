import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import type { StoreDeps } from './actions.js';

function deps(): StoreDeps {
  return { doc: docClient, table: process.env.TABLE_NAME ?? DEFAULT_TABLE };
}

/** GET /points?userId= core: total = server-side sum of recorded action points. */
export async function getPointsCore(
  userId: unknown,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (typeof userId !== 'string' || userId.trim() === '')
    return { statusCode: 400, body: { message: 'userId query parameter is required.' } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = (await d.doc.send(
    new QueryCommand({
      TableName: d.table,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId.trim()}`,
        ':prefix': 'ACTION#',
      },
      Limit: 200,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as { Items?: any[] };
  const items = out.Items ?? [];
  const totalPoints = items.reduce(
    (sum, it) => sum + (typeof it.points === 'number' ? it.points : 0),
    0,
  );
  return {
    statusCode: 200,
    body: { userId: userId.trim(), totalPoints, actionCount: items.length },
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await getPointsCore(event.queryStringParameters?.userId);
  return {
    statusCode: r.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r.body),
  };
};
