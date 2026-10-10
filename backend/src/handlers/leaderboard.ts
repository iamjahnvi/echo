import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
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

export const MAX_LEADERS = 20;
const SCAN_LIMIT = 1000;

export interface LeaderEntry {
  /** Privacy-preserving display id (never a full sub or email). */
  displayId: string;
  totalPoints: number;
  actionCount: number;
}

export function maskUserId(userId: string): string {
  const tail = userId.replace(/[^A-Za-z0-9]/g, '').slice(-4);
  return `user-${tail === '' ? 'xxxx' : tail}`;
}

/**
 * GET /leaderboard core: aggregate every caller's own-visible totals.
 * Hackathon-scale design: single Scan (capped) then in-code aggregate/sort.
 * Protected endpoint — only signed-in users can view the board.
 */
export async function getLeaderboardCore(
  auth: AuthIdentity | null,
  rawLimit: unknown,
  d: StoreDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  let limit = MAX_LEADERS;
  if (rawLimit !== undefined) {
    const n = typeof rawLimit === 'string' ? Number(rawLimit) : rawLimit;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > MAX_LEADERS)
      return {
        statusCode: 400,
        body: { message: `limit must be an integer 1..${MAX_LEADERS}.` },
      };
    limit = n as number;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = (await d.doc.send(
    new ScanCommand({
      TableName: d.table,
      FilterExpression: 'begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'ACTION#' },
      ProjectionExpression: 'pk, points',
      Limit: SCAN_LIMIT,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as { Items?: any[] };
  const totals = new Map<string, { totalPoints: number; actionCount: number }>();
  for (const it of out.Items ?? []) {
    if (typeof it.pk !== 'string') continue;
    const cur = totals.get(it.pk) ?? { totalPoints: 0, actionCount: 0 };
    cur.totalPoints += typeof it.points === 'number' ? it.points : 0;
    cur.actionCount += 1;
    totals.set(it.pk, cur);
  }
  const leaders: LeaderEntry[] = [...totals.entries()]
    .map(([pk, v]) => ({
      displayId: maskUserId(pk.startsWith('USER#') ? pk.slice(5) : pk),
      totalPoints: v.totalPoints,
      actionCount: v.actionCount,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.actionCount - a.actionCount)
    .slice(0, limit);
  return {
    statusCode: 200,
    body: { leaders, participantCount: totals.size },
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await getLeaderboardCore(
    getAuthIdentity(event),
    event.queryStringParameters?.limit,
  );
  return {
    statusCode: r.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r.body),
  };
};
