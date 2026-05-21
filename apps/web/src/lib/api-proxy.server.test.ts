import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyAuthenticatedApiRequest } from './api-proxy.server';

describe('proxyAuthenticatedApiRequest', () => {
  const originalEnv = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3031';
    process.env.NODE_ENV = 'production';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv.NEXT_PUBLIC_API_URL;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    vi.unstubAllGlobals();
  });

  it('forwards Better Auth cookies without identity headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest(
      'http://localhost:3030/api/trpc/workflows.list?batch=1',
      {
        headers: {
          cookie: 'better-auth.session_token=session123; other=value',
        },
      }
    );

    const response = await proxyAuthenticatedApiRequest(request, '/api/trpc/workflows.list');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3031/api/trpc/workflows.list?batch=1');

    const headers = new Headers(init.headers);
    expect(headers.get('cookie')).toContain('better-auth.session_token=session123');
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-organization-id')).toBeNull();
    expect(headers.get('x-user-id')).toBeNull();
  });

  it('strips caller-supplied auth and tenant headers before proxying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost:3030/api/trpc/workflows.list', {
      headers: {
        authorization: 'Bearer caller-token',
        cookie: 'better-auth.session_token=session123',
        'x-organization-id': 'forged-org',
        'x-user-id': 'forged-user',
        'x-clerk-organization-id': 'org_123',
        'x-clerk-user-id': 'user_123',
      },
    });

    const response = await proxyAuthenticatedApiRequest(request, '/api/trpc/workflows.list');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-organization-id')).toBeNull();
    expect(headers.get('x-user-id')).toBeNull();
    expect(headers.get('x-clerk-organization-id')).toBeNull();
    expect(headers.get('x-clerk-user-id')).toBeNull();
    expect(headers.get('cookie')).toContain('better-auth.session_token=session123');
  });
});
