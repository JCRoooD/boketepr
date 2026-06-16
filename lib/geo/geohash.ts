/**
 * Geohash wrapper.
 *
 * The `ngeohash` package encodes (lat, lng) → a base-32 string. Precision 6
 * gives us ~1.2km × 0.6km cells at PR latitudes — good for fast "give me
 * all reports in this neighborhood" queries without scanning the whole
 * reports table.
 *
 * Precision reference:
 *   1  ≈ 2,500 km
 *   2  ≈   630 km
 *   3  ≈    78 km
 *   4  ≈    20 km
 *   5  ≈     4.8 km
 *   6  ≈     1.2 km   ← what we use
 *   7  ≈     0.15 km
 *
 * We always use precision 6. If you need finer, change GEOHASH_PRECISION
 * (and update the index plan in the migration).
 */
import ngeohash from "ngeohash";

export const GEOHASH_PRECISION = 6;

export function encodeGeohash(lat: number, lng: number): string {
  return ngeohash.encode(lat, lng, GEOHASH_PRECISION);
}

/**
 * Get the 8 neighboring geohash cells (the center cell + N/NE/E/SE/S/SW/W/NW).
 * Used for radius queries: "give me all reports within 1.2km of this point"
 * by querying the 9 cells that touch the target cell.
 */
export function geohashNeighbors(lat: number, lng: number): string[] {
  return ngeohash.neighbors(lat, lng, GEOHASH_PRECISION);
}

/**
 * Geohash of a point + all 8 neighbors. Convenience wrapper.
 */
export function geohashWithNeighbors(lat: number, lng: number): string[] {
  return [encodeGeohash(lat, lng), ...geohashNeighbors(lat, lng)];
}
