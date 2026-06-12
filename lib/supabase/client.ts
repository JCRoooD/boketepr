import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/**
 * Browser-side Supabase client.
 *
 * Use this in Client Components (anything with "use client"). The session
 * lives in cookies, so it stays in sync with the server-side auth state.
 *
 * Throws if the public env vars are missing — call sites should be inside
 * the protected route tree so this is fine.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
