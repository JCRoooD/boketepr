/**
 * Required environment variables, asserted at module load.
 * SEC-002 fix: replaces `process.env.X ?? ""` with throw-on-missing.
 * Import this on the server only.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var: ${name}. Check .env.local (local) or Vercel project settings (prod).`,
    );
  }
  return v;
}

const NEXT_PUBLIC_SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const NEXT_PUBLIC_SUPABASE_ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const GOOGLE_KEY = required("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

export const env = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: GOOGLE_KEY,
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  OPENAI_API_KEY: required("OPENAI_API_KEY"),
} as const;
