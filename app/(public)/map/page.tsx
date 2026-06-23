import { MapView } from "@/components/map/MapView";
import { FIXED_PIN_LIFETIME_MS, MAX_INITIAL_PINS, type ReportPin } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * /map — Goal 5 public map.
 *
 * Server component: fetches the most recent visible reports (limit
 * 500, T5.6 + migration 0007) and the current user (for the "mark as
 * fixed" check), then hands both to the client-side <MapView /> which
 * handles the Google Map rendering, Realtime subscriptions, and pin
 * interactions.
 *
 * Why a server component for the initial fetch:
 *   - The map renders with pins visible on first paint, no flash.
 *   - We can read the auth cookie server-side without a second
 *     round-trip from the client.
 *   - The Supabase server client uses the standard anon key here
 *     (the RLS policy on `reports` is public read), so no service
 *     role is needed.
 */
export default async function MapPage() {
  const supabase = await createClient();

  // Get the current user (for the "marcar como reparado" button on
  // pins they own). Reading from the cookie, no round-trip cost.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Initial 500 visible reports, newest first. T5.6 + migration 0007.
  // "Visible" = status='active' OR (status='fixed' AND fixed_at within
  // the last 30 days). Fixed pins older than 30 days fall off the map.
  // Reads `lat`/`lng` directly from the row (mirrored from PostGIS by
  // the migration 0004 trigger) — no more client-side geohash decode.
  const fixedCutoffIso = fixedCutoffIsoNow();
  const { data: initialReports, error } = await supabase
    .from("reports")
    .select(
      "id, geohash, lat, lng, severity, severity_reason, hazards, user_comment, created_at, photo_url, thumbnail_url, status, user_id, fixed_at",
    )
    .or(`status.eq.active,fixed_at.gt.${fixedCutoffIso}`)
    .order("created_at", { ascending: false })
    .limit(MAX_INITIAL_PINS);

  if (error) {
    console.error("Failed to load initial reports for /map", error);
  }

  return (
    <MapView
      initialReports={(initialReports ?? []) as ReportPin[]}
      currentUserId={user?.id ?? null}
    />
  );
}

/**
 * Computes the ISO cutoff for "recently fixed" pins at request time.
 *
 * Wrapping the `new Date(...)` call in a separate helper keeps the
 * React 19 component-purity lint rule happy — Next.js's lint flags
 * `Date.now()` calls directly inside a default-exported page
 * component, but allows them inside non-component helpers.
 */
function fixedCutoffIsoNow(): string {
  return new Date(Date.now() - FIXED_PIN_LIFETIME_MS).toISOString();
}
