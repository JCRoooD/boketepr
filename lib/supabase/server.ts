import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/supabase/types";

/**
 * Server-side Supabase client (for Server Components, Server Actions, and
 * Route Handlers).
 *
 * In Next.js 16, `cookies()` is async — we must await it before reading or
 * writing cookies. The try/catch in `setAll` is the canonical pattern from
 * the @supabase/ssr docs: it lets the call succeed when called from a Server
 * Component (where cookies are read-only) without throwing.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (read-only cookies).
            // Safe to ignore if you have middleware refreshing user sessions.
          }
        },
      },
    },
  );
}
