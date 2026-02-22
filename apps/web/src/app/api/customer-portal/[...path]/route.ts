import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildUpstreamUrl(request: NextRequest, path: string[]): URL {
  const safePath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const url = new URL(`${API_BASE_URL}/api/customer-portal/${safePath}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  return url;
}

async function proxyToApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, path || []);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('connection');
  requestHeaders.delete('content-length');

  const method = request.method.toUpperCase();
  const canHaveBody = method !== 'GET' && method !== 'HEAD';
  const body = canHaveBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  const upstream = await fetch(upstreamUrl.toString(), {
    method,
    headers: requestHeaders,
    body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'content-length' || lower === 'transfer-encoding' || lower === 'connection') {
      return;
    }
    if (lower === 'set-cookie') {
      return;
    }
    responseHeaders.set(key, value);
  });

  const getSetCookie = (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    const cookieValues = getSetCookie.call(upstream.headers);
    cookieValues.forEach((cookie) => responseHeaders.append('set-cookie', cookie));
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyToApi(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyToApi(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyToApi(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyToApi(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyToApi(request, context);
}
