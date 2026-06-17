/**
 * Geohash → lat/lng decoder.
 *
 * Server-side reports store a 6-character geohash (Goal 3). The map needs
 * numeric `{lat, lng}` to drop a pin, so we decode on the client.
 *
 * Why not just SELECT the PostGIS `location` column as GeoJSON? We could,
 * but it adds complexity (custom Accept header, GeoJSON parsing) and the
 * 6-char geohash is already denormalized for indexing. ~1.2 km grid at
 * 6 chars is more than precise enough for a pin.
 *
 * We re-implement the decode here instead of pulling in ngeohash for the
 * client bundle because the encode side already lives in
 * `lib/geo/geohash.ts` and we don't need the full library. The decode is
 * ~40 lines.
 *
 * Reference: http://geohash.org (and the Wikipedia algorithm).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function decodeGeohash(geohash: string): LatLng {
  let evenBit = true;
  let lat = [-90, 90] as [number, number];
  let lng = [-180, 180] as [number, number];

  for (let i = 0; i < geohash.length; i++) {
    const ch = geohash[i]!.toLowerCase();
    const cd = BASE32.indexOf(ch);
    if (cd === -1) {
      throw new Error(`Invalid geohash character: ${ch}`);
    }
    for (let j = 4; j >= 0; j--) {
      const bit = (cd >> j) & 1;
      if (evenBit) {
        const mid = (lng[0] + lng[1]) / 2;
        if (bit === 1) lng = [mid, lng[1]];
        else lng = [lng[0], mid];
      } else {
        const mid = (lat[0] + lat[1]) / 2;
        if (bit === 1) lat = [mid, lat[1]];
        else lat = [lat[0], mid];
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (lat[0] + lat[1]) / 2,
    lng: (lng[0] + lng[1]) / 2,
  };
}
