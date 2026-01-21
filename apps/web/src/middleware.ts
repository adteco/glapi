import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/lists(.*)', '/admin(.*)', '/relationships(.*)'])

// Satellite domain configuration for cross-domain auth
// See: https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains
const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true'

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
  },
  isSatellite
    ? {
        isSatellite: true,
        domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,        // e.g., "https://glapi.net"
        signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL, // e.g., "https://adteco.com/sign-in"
        signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL, // e.g., "https://adteco.com/sign-up"
      }
    : {}
)

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
