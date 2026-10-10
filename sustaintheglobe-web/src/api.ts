export interface HealthResponse {
  status: string;
  service: string;
}

export function getApiBaseUrl(env: Record<string, string | undefined>): string {
  const raw = env.VITE_API_URL ?? '';
  return raw.trim().replace(/\/+$/, '');
}

export function buildHealthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/health`;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function postJson<T>(url: string, payload: unknown, fetcher: FetchFn): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request failed: ${msg}`);
  }
  if (res.status === 400) throw new Error('Invalid action (check inputs).');
  if (res.status === 409)
    throw new Error('Duplicate action (already recorded — no extra points).');
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Server returned invalid JSON.');
  }
}

async function getJson<T>(url: string, fetcher: FetchFn): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request failed: ${msg}`);
  }
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Server returned invalid JSON.');
  }
}

export type ActionType = 'recycle' | 'cleanup' | 'plant' | 'transit' | 'energy';

export const ACTION_TYPES: ActionType[] = [
  'recycle',
  'cleanup',
  'plant',
  'transit',
  'energy',
];

export interface SubmitActionInput {
  userId: string;
  clientActionId: string;
  actionType: ActionType;
  note?: string;
  photoName?: string;
  photoSize?: number;
  photoType?: string;
}

export interface SubmitActionResult {
  actionId: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface ActionItem {
  actionId: string;
  actionType: string;
  points: number;
  note?: string;
  photoName?: string;
  createdAt: string;
}

export interface PointsSummary {
  userId: string;
  totalPoints: number;
  actionCount: number;
}

export function newClientActionId(): string {
  const c = globalThis.crypto as undefined | { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitAction(
  baseUrl: string,
  input: SubmitActionInput,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<SubmitActionResult> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  if (input.userId.trim() === '') throw new Error('User ID is required.');
  return postJson<SubmitActionResult>(`${base}/actions`, input, fetcher);
}

export async function listActions(
  baseUrl: string,
  userId: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<{ actions: ActionItem[]; count: number }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  if (userId.trim() === '') throw new Error('User ID is required.');
  return getJson(`${base}/actions?userId=${encodeURIComponent(userId.trim())}`, fetcher);
}

export async function getPoints(
  baseUrl: string,
  userId: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<PointsSummary> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  if (userId.trim() === '') throw new Error('User ID is required.');
  return getJson(`${base}/points?userId=${encodeURIComponent(userId.trim())}`, fetcher);
}

export async function fetchHealth(
  baseUrl: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<HealthResponse> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') {
    throw new Error('API URL is not configured (VITE_API_URL).');
  }
  let res: Response;
  try {
    res = await fetcher(`${base}/health`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Health check request failed: ${msg}`);
  }
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('Health check returned invalid JSON.');
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    (body as { status?: unknown }).status !== 'ok'
  ) {
    throw new Error('Health check returned unexpected response.');
  }
  return body as HealthResponse;
}
