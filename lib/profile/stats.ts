import { createClient } from "@/lib/supabase/server";

/**
 * Profile stats — server-side computation of a user's report history.
 *
 * Returns counts broken down by:
 *   - total
 *   - active vs fixed (status='active' / status='fixed')
 *   - disputed (reserved for v2; today we never set this)
 *   - severity bucket (Leve ≤3, Moderado ≤6, Severo ≤8, Peligroso >8)
 *
 * Implementation: a single SELECT that pulls only the columns we
 * need (status, severity), then a small aggregation loop in JS.
 *
 * Why not an SQL `FILTER (WHERE ...)` aggregation:
 *   - PostgREST doesn't expose FILTER directly; we'd need an RPC
 *     function. For ≤500 reports per user (well under our rate
 *     limit), the JS aggregation runs in <1ms.
 *   - The `reports_user_id_idx` index (migration 0001) makes the
 *     SELECT cheap even at higher volumes.
 *
 * RLS note: `reports_read_all` is a public-read policy, but we
 * filter by `user_id = :me` so the result only includes this
 * user's rows. No service-role key needed.
 */
export type ProfileStats = {
  total: number;
  active: number;
  fixed: number;
  disputed: number;
  byBucket: {
    leve: number;
    moderado: number;
    severo: number;
    peligroso: number;
  };
};

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("reports")
    .select("status, severity")
    .eq("user_id", userId);

  if (error || !rows) {
    console.error("fetchProfileStats failed", error);
    return EMPTY_STATS;
  }

  const stats: ProfileStats = {
    total: rows.length,
    active: 0,
    fixed: 0,
    disputed: 0,
    byBucket: { leve: 0, moderado: 0, severo: 0, peligroso: 0 },
  };

  for (const r of rows) {
    if (r.status === "active") stats.active++;
    else if (r.status === "fixed") stats.fixed++;
    else if (r.status === "disputed") stats.disputed++;

    const sev = r.severity;
    if (sev <= 3) stats.byBucket.leve++;
    else if (sev <= 6) stats.byBucket.moderado++;
    else if (sev <= 8) stats.byBucket.severo++;
    else stats.byBucket.peligroso++;
  }

  return stats;
}

const EMPTY_STATS: ProfileStats = {
  total: 0,
  active: 0,
  fixed: 0,
  disputed: 0,
  byBucket: { leve: 0, moderado: 0, severo: 0, peligroso: 0 },
};