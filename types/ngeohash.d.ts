// Ambient declaration for the `ngeohash` package, which ships no types of
// its own. The signatures below cover everything we use in lib/geo/geohash.ts.
//
// Source: https://github.com/sunng87/node-geohash (MIT, by Jason Snell / Ning Sun)

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "ngeohash" {
  function encode(latitude: number, longitude: number, precision?: number): string;
  function decode(hashString: string): {
    latitude: number;
    longitude: number;
    error: { latitude: number; longitude: number };
  };
  function neighbors(latitude: number, longitude: number, precision?: number): string[];

  function decode_bbox(hashString: string): {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };

  function bboxes(
    minLat: number,
    minLon: number,
    maxLat: number,
    maxLon: number,
    precision: number,
  ): string[];

  function expand(hashString: string): string[];

  const _default: {
    encode: typeof encode;
    decode: typeof decode;
    neighbors: typeof neighbors;
    decode_bbox: typeof decode_bbox;
    bboxes: typeof bboxes;
    expand: typeof expand;
  };

  export default _default;
}
