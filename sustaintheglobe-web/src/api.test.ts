import { describe, it, expect, vi } from 'vitest';
import {
  getApiBaseUrl,
  buildHealthUrl,
  fetchHealth,
  submitAction,
  listActions,
  getPoints,
  requestUploadUrl,
  putPhotoBytes,
  validatePhotoFile,
  newClientActionId,
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
      'invalid JSON',
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
      'request failed',
    );
  });
});

const BASE = 'http://127.0.0.1:3000';

describe('submitAction', () => {
  const input = {
    userId: 'u1',
    clientActionId: 'a1',
    actionType: 'recycle' as const,
  };

  it('POSTs to /actions and returns server-computed award', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ actionId: 'a1', pointsAwarded: 10, createdAt: 'x' }),
    );
    const r = await submitAction(BASE, input, fetcher);
    expect(r.pointsAwarded).toBe(10);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/actions`);
    expect((init?.body as string) ?? '').toContain('recycle');
  });

  it('maps 409 duplicates to a no-double-award message', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'dup' }, 409));
    await expect(submitAction(BASE, input, fetcher)).rejects.toThrow(
      'no extra points',
    );
  });

  it('maps 400 to an invalid-input message and wraps network errors', async () => {
    const bad = vi.fn(async () => jsonResponse({ message: 'nope' }, 400));
    await expect(submitAction(BASE, input, bad)).rejects.toThrow('Invalid action');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(submitAction(BASE, input, down)).rejects.toThrow('Request failed');
  });

  it('requires base URL and user ID without calling fetch', async () => {
    const fetcher = vi.fn();
    await expect(submitAction('', input, fetcher)).rejects.toThrow('not configured');
    await expect(
      submitAction(BASE, { ...input, userId: ' ' }, fetcher),
    ).rejects.toThrow('User ID is required');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('listActions / getPoints', () => {
  it('GETs the right URLs and returns parsed bodies', async () => {
    const listFetch = vi.fn(async () =>
      jsonResponse({ userId: 'u1', count: 1, actions: [] }),
    );
    await listActions(BASE, 'u1', listFetch);
    expect(listFetch).toHaveBeenCalledWith(`${BASE}/actions?userId=u1`);

    const ptsFetch = vi.fn(async () =>
      jsonResponse({ userId: 'u1', totalPoints: 35, actionCount: 2 }),
    );
    const pts = await getPoints(BASE, 'u1', ptsFetch);
    expect(pts.totalPoints).toBe(35);
    expect(ptsFetch).toHaveBeenCalledWith(`${BASE}/points?userId=u1`);
  });

  it('throws on HTTP errors and requires user ID', async () => {
    const err = vi.fn(async () => jsonResponse({}, 500));
    await expect(listActions(BASE, 'u1', err)).rejects.toThrow('HTTP 500');
    await expect(getPoints(BASE, 'u1', err)).rejects.toThrow('HTTP 500');
    const fetcher = vi.fn();
    await expect(listActions(BASE, '', fetcher)).rejects.toThrow('User ID');
    await expect(getPoints(BASE, '', fetcher)).rejects.toThrow('User ID');
    expect(fetcher).not.toHaveBeenCalled();
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

  it('requestUploadUrl POSTs to /uploads and returns the ticket', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ uploadUrl: 'https://s3.example/put', photoKey: 'uploads/u1/a1.png', expiresIn: 300 }),
    );
    const t = await requestUploadUrl(
      BASE,
      { userId: 'u1', clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
      fetcher,
    );
    expect(t.photoKey).toBe('uploads/u1/a1.png');
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${BASE}/uploads`);
  });

  it('requestUploadUrl maps 400 rejections and wraps network failures', async () => {
    const rej = vi.fn(async () => jsonResponse({ message: 'bad' }, 400));
    await expect(
      requestUploadUrl(BASE, { userId: 'u1', clientActionId: 'a', photoType: 'image/gif', photoSize: 1 }, rej),
    ).rejects.toThrow('rejected by server');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(
      requestUploadUrl(BASE, { userId: 'u1', clientActionId: 'a', photoType: 'image/png', photoSize: 1 }, down),
    ).rejects.toThrow('Upload request failed');
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
