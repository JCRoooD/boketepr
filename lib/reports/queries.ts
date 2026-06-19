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
