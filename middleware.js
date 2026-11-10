import { NextResponse } from 'next/server'

// Casinoze Support — staff only.
// Player routes (/dashboard, /profile, /notifications) live in My-Clients-App.
const ADMIN_ROUTES = ['/admin']
const SUPER_ADMIN_ROUTES = ['/superadmin']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Supabase may split the session across cookies (…-auth-token.0, .1),
  // so match by prefix.
  const isLoggedIn = request.cookies.getAll()
    .some(c => /^sb-.+-auth-token/.test(c.name) && c.value)

  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isSuperAdminRoute = SUPER_ADMIN_ROUTES.some(r => pathname.startsWith(r))

  // Role is checked again server-side on every API route; this only keeps
  // signed-out visitors off the staff pages.
  if (!isLoggedIn && (isAdminRoute || isSuperAdminRoute)) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Deliberately no "logged in, bounce away from /auth/login" rule.
  // Pairing that with the role check in pages/index.js produced an infinite
  // redirect for a signed-in non-staff session: / sent them to /auth/login,
  // middleware sent them back to /. The login page signs out non-staff
  // itself, so a staff member seeing the login form is harmless.

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*', '/auth/:path*'],
}
