import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define routes that should be public (not require authentication)
const isPublicRoute = createRouteMatcher([
  '/', // Make the landing page public
  '/sign-in(.*)', // Matches /sign-in and /sign-in/*
  '/sign-up(.*)', // Matches /sign-up and /sign-up/*
  '/api/clerk-webhook(.*)', // Example: if you have a Clerk webhook
  '/privacy-policy(.*)',
  '/terms-of-service(.*)',
  '/security(.*)',
  '/pricing(.*)',
  '/product(.*)',
  '/contact(.*)', // Add contact route
  '/terms(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // If the user is signed in and on the public landing page, redirect to dashboard
  if (userId && pathname === '/') {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // If the user is not signed in and trying to access a protected route, redirect to landing page
  if (!userId && !isPublicRoute(req)) {
    const landingUrl = new URL('/', req.url);
    return NextResponse.redirect(landingUrl);
  }

  // If the user is signed in and tries to access Clerk's sign-in/sign-up pages, redirect to dashboard
  if (userId && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow the request to proceed if none of the above conditions are met
  return NextResponse.next();
});

export const config = {
  // Only run middleware on actual page/API routes, not static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};