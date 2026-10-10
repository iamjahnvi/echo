import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import {
  actionKeys,
  calculatePoints,
  validateActionInput,
} from '../lib/points.js';

export interface StoreDeps {
  // Minimal structural type so tests can inject a stub without AWS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: { send: (cmd: any) => Promise<any> };
  table: string;
}

function deps(): StoreDeps {
  return { doc: docClient, table: process.env.TABLE_NAME ?? DEFAULT_TABLE };
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isConditionalFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ConditionalCheckFailedException'
  );
}

export interface ActionRecord {
  pk: string;
  sk: string;
  userId: string;
  clientActionId: string;
  actionType: string;
  points: number;
  note?: string;
  photoName?: string;
  photoSize?: number;
  photoType?: string;
  createdAt: string;
}

/** POST /actions core: validate → server-computed points → idempotent conditional write. */
export async function createActionCore(
  rawBody: unknown,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const v = validateActionInput(rawBody);
  if (!v.ok) return { statusCode: 400, body: { message: v.error } };

  const points = calculatePoints(v.value.actionType);
  const { pk, sk } = actionKeys(v.value.userId, v.value.clientActionId);
  const createdAt = new Date().toISOString();
  const item: ActionRecord = {
    pk,
    sk,
    userId: v.value.userId,
    clientActionId: v.value.clientActionId,
    actionType: v.value.actionType,
    points,
    createdAt,
  };
  if (v.value.note !== undefined) item.note = v.value.note;
  if (v.value.photoName !== undefined) item.photoName = v.value.photoName;
  if (v.value.photoSize !== undefined) item.photoSize = v.value.photoSize;
  if (v.value.photoType !== undefined) item.photoType = v.value.photoType;

  try {
    await d.doc.send(
      new PutCommand({
        TableName: d.table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }),
    );
  } catch (err) {
    // Same idempotency key retried (refresh/retry) → no double award.
    if (isConditionalFailure(err))
      return {
        statusCode: 409,
        body: { message: 'Duplicate action (same clientActionId already recorded).' },
      };
    throw err;
  }
  return {
    statusCode: 201,
    body: {
      actionId: v.value.clientActionId,
      pointsAwarded: points,
      createdAt,
    },
  };
}

export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let parsed: unknown;
  try {
    parsed = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { message: 'Request body must be JSON.' });
  }
  const r = await createActionCore(parsed);
  return json(r.statusCode, r.body);
};

/** GET /actions?userId= core: newest-first list, capped. */
export async function listActionsCore(
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
      Limit: 50,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as { Items?: any[] };
  const actions = (out.Items ?? [])
    .map((it) => ({
      actionId: it.clientActionId,
      actionType: it.actionType,
      points: it.points,
      note: it.note,
      photoName: it.photoName,
      createdAt: it.createdAt,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { statusCode: 200, body: { userId: userId.trim(), count: actions.length, actions } };
}

export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await listActionsCore(event.queryStringParameters?.userId);
  return json(r.statusCode, r.body);
};
