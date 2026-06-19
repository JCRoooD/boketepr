/**
 * Ambient type augmentations for the Google Maps JavaScript API.
 *
 * The official `@types/google.maps` package doesn't include
 * `PlaceAutocompleteElement` yet (the new "Places API (New)" web
 * component shipped after the last published types). We declare just
 * what we use, to keep the rest of the project's `lib/` types in sync
 * with the installed `@types/google.maps`.
 *
 * Reference:
 *   https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
 */

declare global {
  namespace google.maps.places {
    /**
     * Options for constructing a `PlaceAutocompleteElement`.
     *
     * We only declare the options we use. Anything else is forwarded
     * through the constructor (the actual class accepts more).
     */
    interface PlaceAutocompleteElementOptions {
      componentRestrictions?: { country: string | string[] };
      includedPrimaryTypes?: string[];
      excludedPrimaryTypes?: string[];
      locationBias?:
        | google.maps.LatLng
        | google.maps.LatLngLiteral
        | google.maps.LatLngBounds
        | google.maps.LatLngBoundsLiteral
        | google.maps.Circle
        | google.maps.CircleLiteral;
      locationRestriction?:
        | google.maps.LatLngBounds
        | google.maps.LatLngBoundsLiteral;
    }

    /**
     * The new "Places API (New)" web component. Drop this into the DOM
     * and listen for the `gmp-select` event.
     *
     * The event's shape depends on which subclass dispatches it:
     *   - `PlaceAutocompleteElement` (this class) dispatches an event
     *     with `{ placePrediction }`. To get a full Place, call
     *     `placePrediction.toPlace()` (one async Places API (New)
     *     Detail call), then `place.fetchFields(...)` for the fields
     *     you want (another API call).
     *   - `BasicPlaceAutocompleteElement` dispatches an event with
     *     `{ place }` directly (it already called `toPlace()` for
     *     you). You still need `fetchFields()` to load fields like
     *     `location` and `formattedAddress`.
     *
     * Google's docs still describe `event.place` as the universal
     * shape, but the v65 SDK bundle really delivers `placePrediction`
     * from `PlaceAutocompleteElement`. Inspect the SDK source before
     * trusting the docs.
     */
    class PlaceAutocompleteElement extends HTMLElement {
      constructor(options?: PlaceAutocompleteElementOptions);
      addEventListener(
        type: "gmp-select",
        listener: (event: {
          place?: Place;
          placePrediction?: { toPlace(): Promise<Place> };
        }) => void,
      ): void;
    }

    /**
     * Place class returned by the new "Places API (New)". We only
     * declare the methods + fields we actually consume.
     */
    class Place {
      /** Loads the requested fields. Throws on API error. */
      fetchFields(options: { fields: string[] }): Promise<void>;
      /** Latitude/longitude. Null until fetchFields(['location']) resolves. */
      location: google.maps.LatLng | null;
      /** Full address, e.g. "1600 Amphitheatre Pkwy, Mountain View, CA". */
      formattedAddress: string | null;
      /** Display name, e.g. "Googleplex". */
      displayName: string | null;
    }
  }
}

export {};
