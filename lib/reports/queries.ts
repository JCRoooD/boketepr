import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Report } from "@/lib/supabase/types";

/**
 * Report queries used by the public map (Goal 5).
 *
 * The map needs:
 *   - An initial fetch of the most recent ~500 active reports so the page
 *     renders without a blank map.
 *   - A Realtime subscription so newly submitted reports appear as pins
 *     without a page reload.
 *
 * Display coordinates: the rows expose `lat` / `lng` directly (mirrored
 * from the PostGIS `location` column by a trigger — migration 0004).
 * Earlier versions decoded the 6-char `geohash` to its cell center, which
 * is lossy by up to ~600 m. The `geohash` column is still in the
 * ReportPin type (and still in the row) because it backs the cell-based
 * neighbor index, but no UI code reads it for display anymore.
 */

export const MAX_INITIAL_PINS = 500;

/**
 * Default radius for the /submit duplicate-detection card, in meters.
 * 50 m is tight enough that two reports at this distance almost certainly
 * describe the same physical hoyo (a pothole is 0.5–2 m wide; GPS drift
 * is ~10–15 m on mobile, up to ~50 m on desktop / WiFi triangulation).
 * Tunable later once we see real duplicate rates.
 */
export const DEFAULT_NEARBY_RADIUS_M = 50;

/**
 * Subset of a nearby report shown under the "ya hay reportes cerca"
 * prompt on /submit. Mirrors the columns returned by the
 * `find_nearby_reports` RPC (migration 0005). Distance is computed
 * server-side via PostGIS ST_Distance.
 */
export type NearbyReport = {
  id: string;
  lat: number;
  lng: number;
  severity: number;
  severity_reason: string;
  hazards: string[];
  user_comment: string | null;
  created_at: string;
  photo_url: string;
  thumbnail_url: string | null;
  /** Approx. great-circle distance in meters from the user's chosen point. */
  distance_m: number;
};

/**
 * Fetch up to `maxResults` active reports within `radiusMeters` of the
 * given point. Backed by PostGIS `ST_DWithin` on the `geography(point)`
 * column with the GiST index from migration 0001 — no scan, no JS-side
 * distance math.
 *
 * Used by the /submit form to show a duplicate-detection card when the
 * user has already picked a location. RLS lets anon read active rows,
 * and the RPC is granted to anon + authenticated, so this works for
 * both pre- and post-login sessions.
 */
export async function fetchNearbyReports(
  lat: number,
  lng: number,
  radiusMeters = DEFAULT_NEARBY_RADIUS_M,
  maxResults = 5,
): Promise<NearbyReport[]> {
  const supabase = createBrowserClient();
  // Note on param names: the SQL function declares IN params as
  // `in_lat`, `in_lng`, `in_radius_m`, `in_max_results`. The OUT
  // columns keep the clean names (`lat`, `lng`, `distance_m`) so the
  // API response shape is unchanged. Renaming the IN params was
  // necessary to avoid shadowing the OUT columns inside the function
  // body — see migration 0006 for details.
  const { data, error } = await supabase.rpc("find_nearby_reports", {
    in_lat: lat,
    in_lng: lng,
    in_radius_m: radiusMeters,
    in_max_results: maxResults,
  });

  if (error) {
    console.error("fetchNearbyReports failed", error);
    return [];
  }
  return (data ?? []) as NearbyReport[];
}

/**
 * Subset of `Report` that the map needs. Excludes large fields (the
 * severity_reason is short, hazards is small, photo_url is a string).
 */
export type ReportPin = Pick<
  Report,
  | "id"
  | "geohash"
  | "lat"
  | "lng"
  | "severity"
  | "severity_reason"
  | "hazards"
  | "user_comment"
  | "created_at"
  | "photo_url"
  | "thumbnail_url"
  | "status"
  | "user_id"
>;

/**
 * Fetch the most recent active reports for the initial map render.
 *
 * Uses the browser client (RLS allows public reads on `reports`).
 */
export async function fetchActiveReports(limit = MAX_INITIAL_PINS): Promise<ReportPin[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, geohash, lat, lng, severity, severity_reason, hazards, user_comment, created_at, photo_url, thumbnail_url, status, user_id",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchActiveReports failed", error);
    return [];
  }
  return (data ?? []) as ReportPin[];
}

export type ReportsSubscription = {
  /** Call to stop listening. Idempotent. */
  unsubscribe: () => void;
};

/**
 * Subscribe to the `public.reports` table for new active reports. The
 * callback receives the new row in the same shape as `ReportPin` (the
 * Realtime payload uses the same column types as the table Row).
 *
 * We filter to `status = 'active'` in the callback to avoid animating in
 * pins that have been retroactively fixed. (We don't yet have a "mark
 * fixed" UI, but T5.8 is in this same goal.)
 */
export function subscribeToNewReports(
  onNew: (row: ReportPin) => void,
): ReportsSubscription {
  const supabase = createBrowserClient();
  const channel = supabase
    .channel("public:reports:new")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "reports" },
      (payload) => {
        const row = payload.new as ReportPin & { status?: string };
        // Only animate in if it's already active (it should be — that's
        // the default — but a future update flow could change it).
        if (row.status && row.status !== "active") return;
        onNew(row as ReportPin);
      },
    )
    .subscribe();

  return {
    unsubscribe() {
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscribe to UPDATEs so we can drop pins when the user marks one as
 * fixed (status flips from 'active' → 'fixed'). The callback receives
 * the updated row.
 */
export function subscribeToReportUpdates(
  onUpdate: (row: ReportPin) => void,
): ReportsSubscription {
  const supabase = createBrowserClient();
  const channel = supabase
    .channel("public:reports:updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "reports" },
      (payload) => {
        onUpdate(payload.new as ReportPin);
      },
    )
    .subscribe();

  return {
    unsubscribe() {
      supabase.removeChannel(channel);
    },
  };
}
