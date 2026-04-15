import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';

function buildUpstreamUrl(request: NextRequest, upstreamPath: string): URL {
  const normalizedPath = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  return url;
}

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('authorization');
  headers.delete('x-organization-id');
  headers.delete('x-user-id');
  headers.delete('x-clerk-organization-id');
  headers.delete('x-clerk-user-id');

  return headers;
}

function buildProxyResponse(upstream: Response): NextResponse {
  const responseHeaders = new Headers();

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Exclude hop-by-hop headers and headers that would be invalidated by the proxy
    if (
      lower === 'content-length' ||
      lower === 'content-encoding' ||
      lower === 'transfer-encoding' ||
      lower === 'connection' ||
      lower === 'keep-alive' ||
      lower === 'proxy-authenticate' ||
      lower === 'proxy-authorization' ||
      lower === 'te' ||
      lower === 'trailer' ||
      lower === 'upgrade'
    ) {
      return;
    }
    if (lower === 'set-cookie') {
      return;
    }
    responseHeaders.set(key, value);
  });

  const getSetCookie = (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    getSetCookie.call(upstream.headers).forEach((cookie) => responseHeaders.append('set-cookie', cookie));
  } else {
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) {
      responseHeaders.append('set-cookie', cookie);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function proxyAuthenticatedApiRequest(
  request: NextRequest,
  upstreamPath: string
): Promise<NextResponse> {
  let userId: string | null = null;
  let orgId: string | null = null;
  let token: string | null = null;

  try {
    const clerkAuth = await auth();
    userId = clerkAuth.userId;
    orgId = clerkAuth.orgId;
    token = userId ? await clerkAuth.getToken() : null;
  } catch (error) {
    // During the Better Auth migration, requests may reach this proxy without a
    // valid Clerk session. In that case we still forward cookies so the API can
    // resolve Better Auth sessions directly.
    console.warn('[api-proxy] Clerk auth unavailable, forwarding request with cookies only');
  }

  const upstreamUrl = buildUpstreamUrl(request, upstreamPath);
  const headers = buildUpstreamHeaders(request);
  
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  
  if (orgId) {
    headers.set('x-organization-id', orgId);
  }
  
  if (userId) {
    headers.set('x-user-id', userId);
  }

  const method = request.method.toUpperCase();
  const canHaveBody = method !== 'GET' && method !== 'HEAD';
  const body = canHaveBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  const upstream = await fetch(upstreamUrl.toString(), {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  return buildProxyResponse(upstream);
}
