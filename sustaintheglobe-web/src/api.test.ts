import { describe, it, expect, vi } from 'vitest';
import {
  getApiBaseUrl,
  getDevelopmentApiBaseUrl,
  buildHealthUrl,
  fetchHealth,
  submitAction,
  listActions,
  getPoints,
  requestUploadUrl,
  putPhotoBytes,
  validatePhotoFile,
  newClientActionId,
  authHeaders,
  isSessionExpired,
  getMe,
  getLeaderboard,
  deleteUpload,
} from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getApiBaseUrl', () => {
  it('returns empty string when unset', () => {
    expect(getApiBaseUrl({})).toBe('');
  });

  it('trims whitespace and trailing slashes', () => {
    expect(getApiBaseUrl({ VITE_API_URL: 'https://api.example.com/Prod/// ' })).toBe(
      'https://api.example.com/Prod',
    );
  });

  it('keeps localhost URLs intact', () => {
    expect(getApiBaseUrl({ VITE_API_URL: 'http://127.0.0.1:3000' })).toBe(
      'http://127.0.0.1:3000',
    );
  });
});

describe('getDevelopmentApiBaseUrl', () => {
  it('uses the SAM proxy when unset, invalid, or pointed at the Vite page', () => {
    expect(getDevelopmentApiBaseUrl('', 'http://localhost:5173')).toBe('/api');
    expect(getDevelopmentApiBaseUrl('PASTE_API_URL_HERE', 'http://localhost:5173')).toBe('/api');
    expect(getDevelopmentApiBaseUrl('http://localhost:5173', 'http://localhost:5173')).toBe('/api');
  });

  it('keeps a configured external API URL for development', () => {
    expect(getDevelopmentApiBaseUrl('https://api.example.com/Prod/', 'http://localhost:5173')).toBe(
      'https://api.example.com/Prod',
    );
  });
});

describe('buildHealthUrl', () => {
  it('appends /health without doubling slashes', () => {
    expect(buildHealthUrl('https://api.example.com/Prod/')).toBe(
      'https://api.example.com/Prod/health',
    );
  });
});

describe('fetchHealth', () => {
  it('returns parsed body on success', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ status: 'ok', service: 'sustain-the-globe-api' }),
    );
    const body = await fetchHealth('http://127.0.0.1:3000', fetcher);
    expect(body.status).toBe('ok');
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:3000/health');
  });

  it('throws when base URL is missing', async () => {
    const fetcher = vi.fn();
    await expect(fetchHealth('', fetcher)).rejects.toThrow('not configured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('throws on non-200 status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'boom' }, 500));
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('throws on invalid JSON', async () => {
    const fetcher = vi.fn(
      async () => new Response('not-json{{{', { status: 200 }),
    );
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'HTTP 200 returned non-JSON',
    );
  });

  it('diagnoses a Vite HTML fallback instead of calling it invalid JSON', async () => {
    const fetcher = vi.fn(async () => new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));
    await expect(fetchHealth('/api', fetcher)).rejects.toThrow(
      'HTTP 200 returned HTML. The local API proxy returned HTML',
    );
  });

  it('includes HTTP status and identifies HTML on error responses', async () => {
    const fetcher = vi.fn(async () => new Response('<html>not found</html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    }));
    await expect(fetchHealth('http://localhost:5173', fetcher)).rejects.toThrow(
      'HTTP 404. The server returned an HTML page',
    );
  });

  it('throws on unexpected response shape', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ status: 'weird' }));
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'unexpected response',
    );
  });

  it('wraps network failures', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'Could not reach the API',
    );
  });
});

const BASE = 'http://127.0.0.1:3000';
const TOKEN = 'test-access-token';

describe('submitAction', () => {
  const input = {
    userId: 'token-owner',
    clientActionId: 'a1',
    actionType: 'recycle' as const,
  };

  it('POSTs to /actions with a Bearer token and returns server-computed award', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ actionId: 'a1', pointsAwarded: 10, createdAt: 'x' }),
    );
    const r = await submitAction(BASE, input, TOKEN, fetcher);
    expect(r.pointsAwarded).toBe(10);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/actions`);
    expect((init?.body as string) ?? '').toContain('recycle');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('rejects missing token without calling fetch', async () => {
    const fetcher = vi.fn();
    await expect(submitAction(BASE, input, '', fetcher)).rejects.toThrow(
      'Not signed in',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps 409 duplicates to a no-double-award message', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'dup' }, 409));
    await expect(submitAction(BASE, input, TOKEN, fetcher)).rejects.toThrow(
      'no extra points',
    );
  });

  it('maps 400 to an invalid-input message and wraps network errors', async () => {
    const bad = vi.fn(async () => jsonResponse({ message: 'nope' }, 400));
    await expect(submitAction(BASE, input, TOKEN, bad)).rejects.toThrow('Invalid action');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(submitAction(BASE, input, TOKEN, down)).rejects.toThrow('Request failed');
  });

  it('requires base URL without calling fetch', async () => {
    const fetcher = vi.fn();
    await expect(submitAction('', input, TOKEN, fetcher)).rejects.toThrow('not configured');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('listActions / getPoints', () => {
  it('GETs the token-protected URLs (no userId in the URL) and returns bodies', async () => {
    const listFetch = vi.fn(async () =>
      jsonResponse({ userId: 'sub', count: 1, actions: [] }),
    );
    await listActions(BASE, TOKEN, listFetch);
    const [listUrl, listInit] = listFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(listUrl).toBe(`${BASE}/actions`);
    expect((listInit?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    const ptsFetch = vi.fn(async () =>
      jsonResponse({ userId: 'sub', totalPoints: 35, actionCount: 2 }),
    );
    const pts = await getPoints(BASE, TOKEN, ptsFetch);
    expect(pts.totalPoints).toBe(35);
    const [ptsUrl] = ptsFetch.mock.calls[0] as unknown as [string];
    expect(ptsUrl).toBe(`${BASE}/points`);
  });

  it('throws on HTTP errors and rejects missing token', async () => {
    const err = vi.fn(async () => jsonResponse({}, 500));
    await expect(listActions(BASE, TOKEN, err)).rejects.toThrow('HTTP 500');
    await expect(getPoints(BASE, TOKEN, err)).rejects.toThrow('HTTP 500');
    const fetcher = vi.fn();
    await expect(listActions(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    await expect(getPoints(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('detects expired sessions from 401 errors', () => {
    expect(isSessionExpired(new Error('Request failed: HTTP 401'))).toBe(true);
    expect(isSessionExpired(new Error('Request failed: HTTP 500'))).toBe(false);
    expect(authHeaders(TOKEN)).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });
});

describe('photo upload flow', () => {
  it('validatePhotoFile accepts jpeg/png/webp ≤5MB, rejects gif/empty/oversize', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/webp', size: 100 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/gif', size: 100 })).toMatch(/JPEG/);
    expect(validatePhotoFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(validatePhotoFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(
      /5 MB/,
    );
  });

  it('requestUploadUrl POSTs to /uploads with a Bearer token and returns the ticket', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ uploadUrl: 'https://s3.example/put', photoKey: 'uploads/u1/a1.png', expiresIn: 300 }),
    );
    const t = await requestUploadUrl(
      BASE,
      { clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
      TOKEN,
      fetcher,
    );
    expect(t.photoKey).toBe('uploads/u1/a1.png');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/uploads`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('requestUploadUrl maps 400 rejections and wraps network failures', async () => {
    const rej = vi.fn(async () => jsonResponse({ message: 'bad' }, 400));
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/gif', photoSize: 1 }, TOKEN, rej),
    ).rejects.toThrow('rejected by server');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/png', photoSize: 1 }, TOKEN, down),
    ).rejects.toThrow('Upload request failed');
    const anon = vi.fn();
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/png', photoSize: 1 }, '', anon),
    ).rejects.toThrow('Not signed in');
    expect(anon).not.toHaveBeenCalled();
  });

  it('putPhotoBytes PUTs bytes with content type and throws on HTTP/network failure', async () => {
    const ok = vi.fn(async () => new Response(null, { status: 200 }));
    const blob = new Blob(['bytes'], { type: 'image/png' });
    await putPhotoBytes('https://s3.example/put', blob, 'image/png', ok);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://s3.example/put');
    expect(init?.method).toBe('PUT');

    const denied = vi.fn(async () => new Response(null, { status: 403 }));
    await expect(putPhotoBytes('https://s3.example/put', blob, 'image/png', denied)).rejects.toThrow(
      'HTTP 403',
    );
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(putPhotoBytes('https://s3.example/put', blob, 'image/png', down)).rejects.toThrow(
      'Photo upload failed',
    );
  });

  it('newClientActionId generates unique ids', () => {
    expect(newClientActionId()).not.toBe(newClientActionId());
  });
});

describe('profile, leaderboard, orphan cleanup', () => {
  it('getMe GETs /me with Bearer and returns the profile', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ userId: 'sub-1', email: 'a@example.com' }),
    );
    const me = await getMe(BASE, TOKEN, fetcher);
    expect(me.email).toBe('a@example.com');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/me`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('getLeaderboard GETs /leaderboard with limit and Bearer', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ leaders: [{ displayId: 'user-1', totalPoints: 40, actionCount: 2 }], participantCount: 1 }),
    );
    const board = await getLeaderboard(BASE, TOKEN, 5, fetcher);
    expect(board.participantCount).toBe(1);
    expect(board.leaders[0].totalPoints).toBe(40);
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${BASE}/leaderboard?limit=5`);
  });

  it('getMe/getLeaderboard reject missing token and surface HTTP errors', async () => {
    const fetcher = vi.fn();
    await expect(getMe(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    await expect(getLeaderboard(BASE, '', 10, fetcher)).rejects.toThrow('Not signed in');
    expect(fetcher).not.toHaveBeenCalled();
    const err = vi.fn(async () => jsonResponse({}, 401));
    await expect(getMe(BASE, TOKEN, err)).rejects.toThrow('401');
  });

  it('deleteUpload sends authed DELETE and tolerates cleanup failures', async () => {
    const ok = vi.fn(async () => jsonResponse({ deleted: true }));
    await deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, ok);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/uploads?photoKey=${encodeURIComponent('uploads/sub/a.jpg')}`);
    expect(init?.method).toBe('DELETE');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(
      deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, down),
    ).resolves.toBeUndefined(); // best-effort: never throws
    const gone = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, gone),
    ).resolves.toBeUndefined();
  });
});
