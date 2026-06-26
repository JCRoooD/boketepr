/**
 * Strict Supabase Storage URL validator.
 *
 * Used by /api/reports to ensure the `photo_url` submitted by a user
 * is genuinely one of OUR photos in the `photos` bucket, AND that the
 * file lives in the caller's own user_id folder. Replaces the previous
 * `String.includes("/storage/v1/object/public/photos/")` check which
 * was trivially bypassable via path traversal, URL fragments, or any
 * host containing the substring. (SEC-004 in the security audit.)
 *
 * The user_id assertion is defense-in-depth: even if the public bucket
 * were to be misconfigured, an attacker can't get us to record a URL
 * pointing to another user's folder.
 */
export function isOurPhotoUrl(url: string, userId: string): boolean {
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseBase) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // 1. Hostname must equal our Supabase project host. URL parsing
  //    normalizes the host to lowercase; comparing to the raw env
  //    value (which is also lowercase by convention) is fine.
  let expectedHost: string;
  try {
    expectedHost = new URL(supabaseBase).host;
  } catch {
    return false;
  }
  if (parsed.host !== expectedHost) return false;

  // 2. Path must start with /storage/v1/object/public/photos/
  if (!parsed.pathname.startsWith("/storage/v1/object/public/photos/")) {
    return false;
  }

  // 3. First path segment after /photos/ must be the caller's user_id.
  //    Path is /storage/v1/object/public/photos/<user_id>/<filename>
  //    So the segment at index 5 (after split) is the user_id.
  const segments = parsed.pathname.split("/");
  // Expect exactly: ["", "storage", "v1", "object", "public", "photos", "<user_id>", "..."]
  if (segments.length < 7) return false;
  const pathUserId = segments[6];

  // user_id is a UUID (36 chars, hyphenated). Defensive check — also
  // rejects segment values like "." or "..".
  if (!/^[0-9a-f-]{36}$/.test(pathUserId)) return false;
  if (pathUserId !== userId) return false;

  return true;
}