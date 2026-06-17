import { MapView } from "@/components/map/MapView";
import { MAX_INITIAL_PINS, type ReportPin } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * /map — Goal 5 public map.
 *
 * Server component: fetches the most recent active reports (limit 500,
 * T5.6) and the current user (for the "mark as fixed" check), then
 * hands both to the client-side <MapView /> which handles the Google
 * Map rendering, Realtime subscriptions, and pin interactions.
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

  // Initial 500 active reports, newest first. T5.6.
  const { data: initialReports, error } = await supabase
    .from("reports")
    .select(
      "id, geohash, severity, severity_reason, hazards, created_at, photo_url, thumbnail_url, status, user_id",
    )
    .eq("status", "active")
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
