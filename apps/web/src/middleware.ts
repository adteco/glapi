import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/lists(.*)', '/admin(.*)', '/relationships(.*)'])

// Static file extensions that should never go through auth
const isStaticFile = (pathname: string) => {
  return /\.(?:css|js|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/i.test(pathname)
}

// Satellite domain configuration for cross-domain auth
// See: https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains
const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true'

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl

    // Explicitly skip static files - belt and suspenders with matcher
    if (pathname.startsWith('/_next') || isStaticFile(pathname)) {
      return NextResponse.next()
    }

    if (isProtectedRoute(req)) await auth.protect()
  },
  (req) => {
    const isLocal = req.nextUrl.hostname === 'localhost' || req.nextUrl.hostname === '127.0.0.1'
    if (isLocal) return {}

    return isSatellite
      ? {
          isSatellite: true,
          domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,        // e.g., "https://glapi.net"
          signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL, // e.g., "https://adteco.com/sign-in"
          signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL, // e.g., "https://adteco.com/sign-up"
        }
      : {}
  }
)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
