import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyAuthenticatedApiRequest } from './api-proxy.server';

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('proxyAuthenticatedApiRequest', () => {
  const originalEnv = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3031';
    process.env.NODE_ENV = 'production';
    authMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv.NEXT_PUBLIC_API_URL;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    vi.unstubAllGlobals();
  });

  it('forwards cookies when Clerk auth is unavailable', async () => {
    authMock.mockResolvedValue({
      userId: null,
      orgId: null,
      getToken: vi.fn().mockResolvedValue(null),
    });

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

  it('adds Clerk auth headers when a Clerk session is available', async () => {
    authMock.mockResolvedValue({
      userId: 'user_123',
      orgId: 'org_123',
      getToken: vi.fn().mockResolvedValue('clerk_jwt_token'),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost:3030/api/trpc/workflows.list', {
      headers: {
        cookie: 'better-auth.session_token=session123',
      },
    });

    const response = await proxyAuthenticatedApiRequest(request, '/api/trpc/workflows.list');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer clerk_jwt_token');
    expect(headers.get('x-organization-id')).toBe('org_123');
    expect(headers.get('x-user-id')).toBe('user_123');
    expect(headers.get('cookie')).toContain('better-auth.session_token=session123');
  });
});
