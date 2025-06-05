import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Explicitly allow all requests to the docs site
  // This ensures no authentication is required
  return NextResponse.next()
}

export const config = {
  // Apply middleware to all routes
  matcher: '/(.*)',
}