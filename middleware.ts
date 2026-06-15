import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every request before the route handler. Two jobs:
 *   1. Refresh the Supabase auth session (so users stay logged in)
 *   2. Redirect unauthenticated users away from protected routes
 *
 * Protected routes (require login):
 *   - /profile       — user dashboard
 *   - /submit        — report submission (Goal 3)
 *   - /map/admin     — moderation (future)
 *
 * Public auth routes (logged-in users get redirected to /profile):
 *   - /login
 *   - /signup
 */

const PROTECTED_PREFIXES = ["/profile", "/submit", "/mis-reportes"];
const AUTH_PREFIXES = [
  "/login",
  "/signup",
  "/auth/callback",
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // If logged in and visiting an auth page, bounce to /profile.
  if (user && AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    return NextResponse.redirect(url);
  }

  // If not logged in and visiting a protected page, bounce to /login.
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * Run on every route except:
   *   - Next.js internals (_next/static, _next/image, favicon, etc.)
   *   - Static assets served from /public (svg, png, jpg, etc.)
   *   - The Supabase auth callback (it needs to set cookies before middleware runs)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
