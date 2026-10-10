import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import {
  actionKeys,
  calculatePoints,
  validateActionInput,
} from '../lib/points.js';
import {
  getAuthIdentity,
  unauthorizedBody,
  type AuthIdentity,
} from '../lib/auth.js';

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
  photoKey?: string;
  createdAt: string;
}

/**
 * POST /actions core: authenticate → validate → server-computed points →
 * idempotent conditional write. Any caller-supplied userId is IGNORED; the
 * data owner is always the verified token identity.
 */
export async function createActionCore(
  rawBody: unknown,
  auth: AuthIdentity | null,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  const merged =
    typeof rawBody === 'object' && rawBody !== null
      ? { ...(rawBody as Record<string, unknown>), userId: auth.userId }
      : { userId: auth.userId };
  const v = validateActionInput(merged);
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
  if (v.value.photoKey !== undefined) item.photoKey = v.value.photoKey;

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
  const r = await createActionCore(parsed, getAuthIdentity(event));
  return json(r.statusCode, r.body);
};

export const MAX_LIST_LIMIT = 50;

function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

function decodeCursor(
  raw: unknown,
): { ok: true; key: Record<string, unknown> } | { ok: false } {
  if (typeof raw !== 'string' || raw === '') return { ok: false };
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) return { ok: false };
    return { ok: true, key: parsed as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

/**
 * GET /actions core: the query-string userId (if any) is IGNORED — callers can
 * only ever read their own actions. Returns newest-first list with limit/cursor
 * pagination.
 */
export async function listActionsCore(
  auth: AuthIdentity | null,
  opts?: { limit?: unknown; nextToken?: unknown },
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  const userId = auth.userId;
  let limit = MAX_LIST_LIMIT;
  if (opts?.limit !== undefined) {
    const n = typeof opts.limit === 'string' ? Number(opts.limit) : opts.limit;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > MAX_LIST_LIMIT)
      return {
        statusCode: 400,
        body: { message: `limit must be an integer 1..${MAX_LIST_LIMIT}.` },
      };
    limit = n as number;
  }
  let startKey: Record<string, unknown> | undefined;
  if (opts?.nextToken !== undefined) {
    const c = decodeCursor(opts.nextToken);
    if (!c.ok)
      return { statusCode: 400, body: { message: 'nextToken is invalid.' } };
    startKey = c.key;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = (await d.doc.send(
    new QueryCommand({
      TableName: d.table,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'ACTION#',
      },
      Limit: limit,
      ...(startKey ? { ExclusiveStartKey: startKey } : {}),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as { Items?: any[]; LastEvaluatedKey?: Record<string, unknown> };
  const actions = (out.Items ?? [])
    .map((it) => ({
      actionId: it.clientActionId,
      actionType: it.actionType,
      points: it.points,
      note: it.note,
      photoName: it.photoName,
      photoKey: it.photoKey,
      createdAt: it.createdAt,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const body: Record<string, unknown> = {
    userId,
    count: actions.length,
    actions,
  };
  if (out.LastEvaluatedKey) body.nextToken = encodeCursor(out.LastEvaluatedKey);
  return { statusCode: 200, body };
}

export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await listActionsCore(getAuthIdentity(event), {
    limit: event.queryStringParameters?.limit,
    nextToken: event.queryStringParameters?.nextToken,
  });
  return json(r.statusCode, r.body);
};
