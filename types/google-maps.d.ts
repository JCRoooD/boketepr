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
     * and listen for the `gmp-placeselect` event to get a `Place` object.
     *
     * `fetchFields` makes a follow-up call to load the requested fields
     * (location, formattedAddress, displayName, etc.).
     */
    class PlaceAutocompleteElement extends HTMLElement {
      constructor(options?: PlaceAutocompleteElementOptions);
      addEventListener(
        type: "gmp-placeselect",
        listener: (event: { place: Place }) => void,
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
