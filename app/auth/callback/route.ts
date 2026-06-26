import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Sanitize a redirect target to prevent open-redirect attacks. */
function safeNext(next: string | null | undefined): string {
  if (!next) return "/profile";
  // Only allow same-origin paths starting with /
  if (!next.startsWith("/") || next.startsWith("//")) return "/profile";
  return next;
}

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
 *
 * SECURITY (SEC-006): the `next` query param is run through safeNext() so
 * a malicious OAuth provider redirect (or crafted link in an email) can't
 * bounce the user to an attacker-controlled origin after a legitimate
 * authentication. Matches the helper in app/auth/actions.ts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

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
