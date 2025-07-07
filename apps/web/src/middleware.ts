import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes - these won't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/clerk-webhook(.*)',
  '/privacy-policy(.*)',
  '/terms-of-service(.*)',
  '/security(.*)',
  '/pricing(.*)',
  '/product(.*)',
  '/contact(.*)',
  '/terms(.*)',
  '/_next/static(.*)',  // Add static files as public
  '/_next/image(.*)',   // Add image optimization as public
  '/favicon.ico',       // Add favicon as public
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // For public routes, don't do any authentication checks
  if (isPublicRoute(req)) {
    // If signed in user visits landing page, redirect to dashboard
    if (userId && pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // If signed in user visits sign-in/sign-up, redirect to dashboard
    if (userId && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // For protected routes, check authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};