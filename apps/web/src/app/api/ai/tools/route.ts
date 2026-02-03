/**
 * AI Tools Manifest API Route
 *
 * Provides the AI tools manifest with ETag-based caching.
 * Clients should use the ETag for conditional requests to minimize
 * bandwidth when the manifest hasn't changed.
 */

import { NextRequest, NextResponse } from 'next/server';
import toolsManifest from '@/lib/ai/generated/tools-manifest.json';

// Generate ETag from manifest content hash (stable across requests)
const MANIFEST_ETAG = `"${toolsManifest.contentHash}"`;

// Cache-Control header for client-side caching
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';

/**
 * GET /api/ai/tools
 *
 * Returns the AI tools manifest with ETag support.
 *
 * Headers:
 * - ETag: Content hash for conditional requests
 * - Cache-Control: Allows client caching with revalidation
 *
 * Query params:
 * - scope: Filter tools by scope (optional)
 * - riskLevel: Filter by risk level (optional)
 *
 * Conditional request:
 * - Send If-None-Match header with previous ETag
 * - Returns 304 Not Modified if unchanged
 */
export async function GET(request: NextRequest) {
  // Check for conditional request
  const ifNoneMatch = request.headers.get('If-None-Match');

  if (ifNoneMatch === MANIFEST_ETAG) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: MANIFEST_ETAG,
        'Cache-Control': CACHE_CONTROL,
      },
    });
  }

  // Get query parameters for filtering
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const riskLevel = searchParams.get('riskLevel');

  // Filter tools if requested
  let tools = toolsManifest.tools as Array<{
    name: string;
    version: number;
    stability: string;
    riskLevel: string;
    scopes: string[];
  }>;

  if (scope) {
    tools = tools.filter((t) => t.scopes.includes(scope));
  }

  if (riskLevel) {
    tools = tools.filter((t) => t.riskLevel === riskLevel);
  }

  const response = {
    version: toolsManifest.version,
    generatedAt: toolsManifest.generatedAt,
    contentHash: toolsManifest.contentHash,
    toolCount: tools.length,
    tools,
  };

  return NextResponse.json(response, {
    headers: {
      ETag: MANIFEST_ETAG,
      'Cache-Control': CACHE_CONTROL,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * HEAD /api/ai/tools
 *
 * Returns headers only for cache validation.
 */
export async function HEAD() {
  return new NextResponse(null, {
    headers: {
      ETag: MANIFEST_ETAG,
      'Cache-Control': CACHE_CONTROL,
    },
  });
}
