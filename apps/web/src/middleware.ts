import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/lists(.*)', '/admin(.*)', '/relationships(.*)'])

// Satellite domain configuration for cross-domain auth
const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true'
const domain = process.env.NEXT_PUBLIC_CLERK_SATELLITE_DOMAIN // e.g., "glapi.net"
const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL   // e.g., "https://adteco.com/sign-in"

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
  },
  {
    ...(isSatellite && {
      isSatellite: true,
      domain,
      signInUrl,
    }),
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
