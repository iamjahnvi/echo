export interface HealthResponse {
  status: string;
  service: string;
}

export function getApiBaseUrl(env: Record<string, string | undefined>): string {
  const raw = env.VITE_API_URL ?? '';
  return raw.trim().replace(/\/+$/, '');
}

/** Use the local SAM API when development config is missing or points back at Vite. */
export function getDevelopmentApiBaseUrl(
  configuredBaseUrl: string,
  pageOrigin: string,
): string {
  const base = configuredBaseUrl.trim().replace(/\/+$/, '');
  if (base === '') return '/api';
  try {
    if (new URL(base, pageOrigin).origin === pageOrigin) return '/api';
  } catch {
    return '/api';
  }
  return base;
}

export function buildHealthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/health`;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function postJson<T>(
  url: string,
  payload: unknown,
  fetcher: FetchFn,
  headers?: Record<string, string>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
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

async function getJson<T>(url: string, fetcher: FetchFn, headers?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, headers ? { headers } : undefined);
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

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function validatePhotoFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type))
    return 'Photo must be JPEG, PNG, or WebP.';
  if (file.size <= 0) return 'Photo file is empty.';
  if (file.size > MAX_PHOTO_SIZE_BYTES) return 'Photo must be at most 5 MB.';
  return null;
}

export interface UploadTicket {
  uploadUrl: string;
  photoKey: string;
  expiresIn: number;
}

export async function requestUploadUrl(
  baseUrl: string,
  input: { clientActionId: string; photoType: string; photoSize: number },
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<UploadTicket> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  let res: Response;
  try {
    res = await fetcher(`${base}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload request failed: ${msg}`);
  }
  if (res.status === 400) throw new Error('Photo rejected by server (type/size).');
  if (!res.ok) throw new Error(`Upload request failed: HTTP ${res.status}`);
  try {
    const body = (await res.json()) as UploadTicket;
    if (typeof body.uploadUrl !== 'string' || typeof body.photoKey !== 'string')
      throw new Error('bad shape');
    return body;
  } catch (err) {
    if (err instanceof Error && err.message === 'bad shape')
      throw new Error('Upload service returned unexpected response.');
    throw new Error('Upload service returned invalid JSON.');
  }
}

/** PUT raw bytes straight to private S3 via the presigned URL (no creds involved). */
export async function putPhotoBytes(
  uploadUrl: string,
  file: Blob,
  photoType: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<void> {
  let res: Response;
  try {
    res = await fetcher(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': photoType },
      body: file,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Photo upload failed: ${msg}`);
  }
  if (!res.ok) throw new Error(`Photo upload failed: HTTP ${res.status}`);
}

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
  /** S3 key returned by requestUploadUrl — submit only after PUT succeeds. */
  photoKey?: string;
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

/** Authorization header for protected API calls. Never logs the token itself. */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** True when an API error means the session expired/invalid → re-authenticate. */
export function isSessionExpired(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b401\b/.test(msg);
}

function requireToken(token: string): void {
  if (token.trim() === '') throw new Error('Not signed in.');
}

export function newClientActionId(): string {
  const c = globalThis.crypto as undefined | { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitAction(
  baseUrl: string,
  input: SubmitActionInput,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<SubmitActionResult> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return postJson<SubmitActionResult>(`${base}/actions`, input, fetcher, authHeaders(token));
}

export async function listActions(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<{ actions: ActionItem[]; count: number }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/actions`, fetcher, authHeaders(token));
}

export async function getPoints(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<PointsSummary> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/points`, fetcher, authHeaders(token));
}

export interface UserProfile {
  userId: string;
  email: string | null;
}

export interface LeaderEntry {
  displayId: string;
  totalPoints: number;
  actionCount: number;
}

export async function getMe(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<UserProfile> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/me`, fetcher, authHeaders(token));
}

export async function getLeaderboard(
  baseUrl: string,
  token: string,
  limit = 10,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<{ leaders: LeaderEntry[]; participantCount: number }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/leaderboard?limit=${limit}`, fetcher, authHeaders(token));
}

/** Best-effort orphan cleanup: delete our own uploaded object after a failed submit. */
export async function deleteUpload(
  baseUrl: string,
  photoKey: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<void> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  let res: Response;
  try {
    res = await fetcher(
      `${base}/uploads?photoKey=${encodeURIComponent(photoKey)}`,
      { method: 'DELETE', headers: authHeaders(token) },
    );
  } catch {
    return; // cleanup is best-effort; the submit error is what matters.
  }
  if (!res.ok && res.status !== 404) {
    return;
  }
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
    res = await fetcher(buildHealthUrl(base));
  } catch {
    throw new Error(
      base.startsWith('/api')
        ? 'Could not reach the local API. Start the SAM backend on port 3000.'
        : 'Could not reach the API. Check the API URL and confirm the server is running.',
    );
  }
  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  let raw: string;
  try {
    raw = await res.text();
  } catch {
    throw new Error(`Health check failed: HTTP ${res.status}; response could not be read.`);
  }
  const looksLikeHtml =
    contentType === 'text/html' || /^\s*(?:<!doctype\s+html|<html\b)/i.test(raw);
  if (!res.ok) {
    if (base.startsWith('/api') && /\bECONNREFUSED\b/i.test(raw)) {
      throw new Error(
        `Health check failed: HTTP ${res.status}. The local API proxy cannot connect to SAM at 127.0.0.1:3000 (connection refused). Start the backend.`,
      );
    }
    const diagnostic = !looksLikeHtml
      ? ''
      : base.startsWith('/api')
        ? ' The local API proxy returned HTML; confirm SAM is running on port 3000.'
        : ' The server returned an HTML page; check that the API URL points to the backend.';
    throw new Error(`Health check failed: HTTP ${res.status}.${diagnostic}`);
  }
  if (looksLikeHtml) {
    const diagnostic = base.startsWith('/api')
      ? ' The local API proxy returned HTML; confirm SAM is running on port 3000.'
      : ' The URL is serving a web page instead of the backend API.';
    throw new Error(`Health check failed: HTTP ${res.status} returned HTML.${diagnostic}`);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    const type = contentType ?? 'unknown content type';
    throw new Error(
      `Health check failed: HTTP ${res.status} returned non-JSON (${type}). Check that the URL points to the backend API.`,
    );
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
