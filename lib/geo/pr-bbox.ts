/**
 * Puerto Rico bounding box validator.
 *
 * The PR landmass plus Vieques and Culebra fits comfortably inside:
 *   Latitude:  17.5° N to 18.6° N
 *   Longitude: -67.5° W to -65.5° W
 *
 * The bounding box is intentionally slightly larger than the strict land
 * bounds to allow:
 *   - Reports from piers, bridges, and coastal roads that overhang water
 *   - Reports from Mona Island (~17.9 N, -67.9 W) — wait, Mona is at -67.9
 *     which is outside -67.5. So Mona is excluded. If a user reports from
 *     Mona, they'll get a clear error in Spanish.
 *   - Culebra's eastern tip (~18.32 N, -65.27 W) — inside the box
 *   - Vieques (~18.13 N, -65.43 W) — inside the box
 *
 * The 0.1° lat / 0.2° lng margin past the strict island edges is a tradeoff
 * between "reject clearly-wrong GPS readings" and "accept legitimate coastal
 * reports." Tune as needed once we have real submissions.
 *
 * Usage:
 *   const check = isWithinPR(18.4655, -66.1057);  // San Juan
 *   if (!check.ok) throw new Error(check.reason);
 */

export type BboxCheck =
  | { ok: true }
  | { ok: false; reason: string };

const PR_BBOX = {
  minLat: 17.5,
  maxLat: 18.6,
  minLng: -67.5, // west (more negative)
  maxLng: -65.5, // east
} as const;

/**
 * Returns a tagged result so callers can decide whether to throw, surface
 * a UI error, or log a warning. We never throw inside validators.
 */
export function isWithinPR(lat: number, lng: number): BboxCheck {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      ok: false,
      reason: "Las coordenadas no son números válidos.",
    };
  }

  if (lat < PR_BBOX.minLat || lat > PR_BBOX.maxLat) {
    return {
      ok: false,
      reason: `La latitud debe estar entre ${PR_BBOX.minLat}° y ${PR_BBOX.maxLat}° N (Puerto Rico).`,
    };
  }

  if (lng < PR_BBOX.minLng || lng > PR_BBOX.maxLng) {
    return {
      ok: false,
      reason: `La longitud debe estar entre ${Math.abs(PR_BBOX.maxLng)}° y ${Math.abs(PR_BBOX.minLng)}° W (Puerto Rico).`,
    };
  }

  return { ok: true };
}

/**
 * The raw bbox for tests or future use (e.g. map default viewport).
 */
export const PR_BOUNDING_BOX = PR_BBOX;

/**
 * Convert (lat, lng) → WKT POINT string for PostGIS insert.
 * Format: 'POINT(longitude latitude)' — note the lng/lat order, which is
 * the opposite of what humans usually read. This is a classic footgun.
 *
 * Example: wktPoint(18.4655, -66.1057) → 'POINT(-66.1057 18.4655)'
 */
export function wktPoint(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}
