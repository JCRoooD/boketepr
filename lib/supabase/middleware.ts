import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Refresh the Supabase auth session on every request.
 *
 * Supabase stores the session in cookies that expire (default 1 hour for the
 * access token, 1 week for the refresh token). The middleware runs on every
 * request before the page renders, so it's the right place to:
 *   1. Read the current session from cookies
 *   2. If expired, use the refresh token to get a new one
 *   3. Write the refreshed cookies back to the response
 *
 * This is the canonical @supabase/ssr Next.js pattern. Without it, users get
 * randomly logged out mid-session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Calling getUser() forces the JWT to be validated and the
  // session to be refreshed. Do not remove this line or sessions will go stale.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
