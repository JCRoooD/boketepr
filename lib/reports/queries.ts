import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Report } from "@/lib/supabase/types";

/**
 * Report queries used by the public map (Goal 5).
 *
 * The map needs:
 *   - An initial fetch of the most recent ~500 visible reports so the
 *     page renders without a blank map.
 *   - A Realtime subscription so newly submitted reports appear as pins
 *     without a page reload.
 *
 * Display coordinates: the rows expose `lat` / `lng` directly (mirrored
 * from the PostGIS `location` column by a trigger — migration 0004).
 * Earlier versions decoded the 6-char `geohash` to its cell center, which
 * is lossy by up to ~600 m. The `geohash` column is still in the
 * ReportPin type (and still in the row) because it backs the cell-based
 * neighbor index, but no UI code reads it for display anymore.
 *
 * "Visible" = status='active' OR (status='fixed' AND fixed_at within the
 * last 30 days). Fixed pins older than 30 days have fallen off the map
 * (query filter, not deleted — the row is still in the DB).
 */

export const MAX_INITIAL_PINS = 500;

/**
 * How long fixed pins stay visible on the map as a green check before
 * falling off. 30 days gives enough time for users who haven't loaded
 * the map recently to see the most recent repair activity without
 * cluttering the map indefinitely.
 *
 * Note: this is the *display* lifetime. The row stays in the DB
 * forever — `status='fixed'` rows are filtered out of the map fetch
 * after this window.
 */
export const FIXED_PIN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Subset of `Report` that the map needs. Includes `status` + `fixed_at`
 * so the renderer can switch between severity-color (active) and green
 * check (recently fixed) styling.
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
  | "fixed_at"
>;

/**
 * True when the row is a recently-fixed pin that should still be shown
 * on the map (green check glyph instead of severity number).
 *
 * We compare against a client-side clock — for the initial render
 * before Realtime kicks in, every client sees a slightly different
 * threshold, but the discrepancy is at most a few seconds and only
 * affects the edge case where a pin was fixed exactly 30 days ago.
 * Acceptable for a UX-only filter.
 */
export function isRecentlyFixed(pin: ReportPin, now: number = Date.now()): boolean {
  if (pin.status !== "fixed") return false;
  if (!pin.fixed_at) return false;
  const fixedMs = new Date(pin.fixed_at).getTime();
  if (Number.isNaN(fixedMs)) return false;
  return now - fixedMs < FIXED_PIN_LIFETIME_MS;
}

/**
 * Fetch the most recent VISIBLE reports for the initial map render.
 *
 * "Visible" = status='active' OR (status='fixed' AND fixed_at within the
 * last 30 days). Fixed pins older than 30 days fall off the map but stay
 * in the DB (e.g. for /report/[id] share links).
 *
 * The `.or()` filter uses PostgREST's OR syntax: `status.eq.active,fixed_at.gt.<iso>`.
 * RLS allows public reads on `reports`, so no service role needed.
 */
export async function fetchActiveReports(limit = MAX_INITIAL_PINS): Promise<ReportPin[]> {
  const supabase = createBrowserClient();
  const cutoffIso = new Date(Date.now() - FIXED_PIN_LIFETIME_MS).toISOString();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, geohash, lat, lng, severity, severity_reason, hazards, user_comment, created_at, photo_url, thumbnail_url, status, user_id, fixed_at",
    )
    // status=active, OR fixed_at within the lifetime window
    .or(`status.eq.active,fixed_at.gt.${cutoffIso}`)
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
 * We filter to `status = 'active'` in the callback so we don't animate
 * in pins that are already fixed. The pin cache + UPDATE handler take
 * care of the flip-active-to-fixed transition.
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
        // Only animate in if it's active. (Fixed-on-insert is not a
        // thing today — `status` defaults to 'active' — but the
        // guard is cheap.)
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
 * Subscribe to UPDATEs so we can:
 *   - Re-render a pin when its severity changes (rare — admin-only)
 *   - Keep the pin visible (with a green check) when its status flips
 *     to 'fixed'. Previously the handler filtered the pin out, but
 *     post-migration-0007 fixed pins stay visible for 30 days.
 *   - Drop the pin once `fixed_at` is older than the lifetime window.
 *     The server-side query filter does this for new fetches; the
 *     client-side handler covers the in-session case (a pin that
 *     flips fixed → falls-off-30-days-while-the-tab-is-open).
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