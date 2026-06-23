/**
 * Spanish-language relative time formatter for the map + detail panel.
 *
 * Examples:
 *   "hace un momento"  → < 60 seconds
 *   "hace 5 min"       → < 60 minutes
 *   "hace 2 h"         → < 24 hours
 *   "hace 3 días"      → < 30 days
 *   "hace 2 meses"     → < 12 months
 *   "hace 1 año"       → otherwise
 *
 * Matches the es_PR convention (no accent on "hace" — "hace X días" is
 * the form used across the app; the rest of the labels follow the
 * Spanish word for the unit, not the abbreviation).
 *
 * Pure function — no hooks, no DOM, safe in Server Components.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function relativeTimeEs(
  isoTimestamp: string,
  now: number = Date.now(),
): string {
  const t = new Date(isoTimestamp).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now - t;
  if (diff < 0) return "hace un momento";
  if (diff < 45 * SECOND_MS) return "hace un momento";
  if (diff < HOUR_MS) {
    const m = Math.round(diff / MINUTE_MS);
    return m === 1 ? "hace 1 min" : `hace ${m} min`;
  }
  if (diff < DAY_MS) {
    const h = Math.round(diff / HOUR_MS);
    return h === 1 ? "hace 1 h" : `hace ${h} h`;
  }
  if (diff < MONTH_MS) {
    const d = Math.round(diff / DAY_MS);
    return d === 1 ? "hace 1 día" : `hace ${d} días`;
  }
  if (diff < YEAR_MS) {
    const mo = Math.round(diff / MONTH_MS);
    return mo === 1 ? "hace 1 mes" : `hace ${mo} meses`;
  }
  const y = Math.round(diff / YEAR_MS);
  return y === 1 ? "hace 1 año" : `hace ${y} años`;
}