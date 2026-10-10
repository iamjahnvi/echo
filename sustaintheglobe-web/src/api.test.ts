import { describe, it, expect, vi } from 'vitest';
import { getApiBaseUrl, buildHealthUrl, fetchHealth } from './api';

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
