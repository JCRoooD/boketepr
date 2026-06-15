import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase redirects users here in two scenarios:
 *   1. After they click the confirmation link in their email (email signup)
 *   2. After the OAuth provider (Google, etc.) redirects them back (OAuth login)
 *
 * Either way, Supabase has set some auth cookies. We need to:
 *   - Let the server client read those cookies and create a session
 *   - Redirect the user to where they were going (or /profile by default)
 *
 * Without this route, users would land on a 404 after confirming their email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // If exchange failed, fall through to the error redirect below.
  }

  // No code or exchange failed — send to login with an error message.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
