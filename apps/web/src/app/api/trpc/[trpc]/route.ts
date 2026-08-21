import { NextRequest } from 'next/server';
import { proxyAuthenticatedApiRequest } from '@/lib/api-proxy.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function proxyToApi(
  request: NextRequest,
  context: { params: Promise<{ trpc: string }> }
) {
  // Browser hits the web-origin Next route /api/trpc/*; upstream Fastify
  // serves tRPC at /trpc/*.
  return proxyAuthenticatedApiRequest(
    request,
    request.nextUrl.pathname.replace(/^\/api\/trpc/, '/trpc')
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ trpc: string }> }
) {
  return proxyToApi(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trpc: string }> }
) {
  return proxyToApi(request, context);
}
