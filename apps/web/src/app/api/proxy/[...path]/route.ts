import { NextRequest } from 'next/server';
import { proxyAuthenticatedApiRequest } from '@/lib/api-proxy.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function proxyToApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const upstreamPath = `/api/${(path || []).map((segment) => encodeURIComponent(segment)).join('/')}`;
  return proxyAuthenticatedApiRequest(request, upstreamPath);
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
