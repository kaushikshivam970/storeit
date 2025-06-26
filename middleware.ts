import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/documents', '/images', '/media', '/others']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if current route is protected
  const requiresAuth = protectedRoutes.some((route) => pathname.startsWith(route))

  if (!requiresAuth) {
    return NextResponse.next()
  }

  // Check for session token in cookies
  const token = req.cookies.get('appwrite-session')?.value

  if (!token) {
    const signInUrl = req.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    signInUrl.searchParams.set('redirect', pathname) // optional: redirect back after login
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/documents/:path*',
    '/images/:path*',
    '/media/:path*',
    '/others/:path*'
  ],
}
