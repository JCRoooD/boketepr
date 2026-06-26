import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client (bypasses RLS).
 *
 * Use this ONLY on the server, ONLY for trusted code paths like the AI
 * scoring endpoint that needs to update a report after the user has already
 * inserted it. Never expose this to the browser.
 *
 * Uses `lib/env.ts` so missing required env vars fail at boot, not at
 * request time. (SEC-002.)
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
