import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../lib/cors.js';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME as DEFAULT_TABLE } from '../lib/dynamo.js';
import {
  actionKeys,
  validateActionInput,
} from '../lib/points.js';
import {
  awardedPoints,
  displayStatus,
  type VerificationStatus,
} from '../lib/verification.js';
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
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
  /** Verification lifecycle state. Absent ONLY on pre-lifecycle legacy items. */
  status?: VerificationStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  note?: string;
  photoName?: string;
  photoSize?: number;
  photoType?: string;
  photoKey?: string;
  createdAt: string;
}

/**
 * POST /actions core: authenticate → validate → store as PENDING with ZERO
 * points → idempotent conditional write. Uploading evidence or submitting an
 * action never awards points by itself; only the approve transition
 * (trusted backend logic) sets the server-computed point value.
 * Any caller-supplied userId is IGNORED; the data owner is always the
 * verified token identity.
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

  const { pk, sk } = actionKeys(v.value.userId, v.value.clientActionId);
  const createdAt = new Date().toISOString();
  const item: ActionRecord = {
    pk,
    sk,
    userId: v.value.userId,
    clientActionId: v.value.clientActionId,
    actionType: v.value.actionType,
    // Evidence submitted, not yet verified: zero points until approved.
    points: 0,
    status: 'pending',
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
    // Any other store failure (credentials, permissions, table config,
    // throttling) must surface as a JSON 500 — never an unhandled throw,
    // which API Gateway reports as a bare 502 with no useful body.
    console.error('createAction store failure:', err);
    return { statusCode: 500, body: { message: 'Could not record action.' } };
  }
  return {
    statusCode: 201,
    body: {
      actionId: v.value.clientActionId,
      // Nothing awarded yet: verification decides (approve → rule value).
      pointsAwarded: 0,
      status: 'pending' as VerificationStatus,
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
  let out: { Items?: any[]; LastEvaluatedKey?: Record<string, unknown> };
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
        Limit: limit,
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as { Items?: any[]; LastEvaluatedKey?: Record<string, unknown> };
  } catch (err) {
    console.error('listActions store failure:', err);
    return { statusCode: 500, body: { message: 'Could not list actions.' } };
  }
  const actions = (out.Items ?? [])
    .map((it) => ({
      actionId: it.clientActionId,
      actionType: it.actionType,
      // Pending/rejected evidence contributes zero until approved.
      points: awardedPoints(it),
      status: displayStatus(it),
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
