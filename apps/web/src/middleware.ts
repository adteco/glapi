import { NextRequest, NextResponse } from 'next/server'

const protectedRoutePatterns = [/^\/dashboard(?:\/.*)?$/, /^\/lists(?:\/.*)?$/, /^\/admin(?:\/.*)?$/, /^\/relationships(?:\/.*)?$/]

// Static file extensions that should never go through auth
const isStaticFile = (pathname: string) => {
  return /\.(?:css|js|map|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/i.test(pathname)
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/_next') || isStaticFile(pathname)) {
    return NextResponse.next()
  }

  const isProtectedRoute = protectedRoutePatterns.some((pattern) => pattern.test(pathname))
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  const hasBetterAuthSession = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('better-auth.session'))

  if (hasBetterAuthSession) {
    return NextResponse.next()
  }

  const signInUrl = new URL('/sign-in', req.url)
  signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
