"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Check, Loader2, MapPin, Pencil, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PR_BOUNDING_BOX } from "@/lib/geo/pr-bbox";
import { cn } from "@/lib/utils";

/**
 * LocationInput
 *
 * Three ways to confirm where the hoyo is:
 *   1. "Usar mi ubicación" — Browser Geolocation API
 *   2. "Buscar dirección"  — Google Places Autocomplete (PR-only)
 *   3. "Ingresar coordenadas" — manual lat/lng (dev / fallback)
 *
 * Only one mode is active at a time. The chosen location is reported
 * back to the parent with a `source` discriminator and (for places)
 * a formatted address. A unified "Ubicación confirmada" card below
 * the three buttons is always shown when a location is set, regardless
 * of source.
 *
 * Why three options:
 *   - GPS is the obvious one, but on a desktop browser it can be 50-500
 *     m off (WiFi triangulation), and it fails entirely if the user
 *     denies permission.
 *   - Places autocomplete is precise (street-level) and works without
 *     any permission prompt, but it depends on the Places API being
 *     enabled in Google Cloud (see README).
 *   - Manual coords is the universal fallback and the only option
 *     for headless / scripted submissions.
 */
type LocationSource = "gps" | "places" | "manual";

export interface LocationValue {
  lat: number;
  lng: number;
  source: LocationSource;
  /** Human-readable label, only set when source is "places". */
  address?: string;
}

/**
 * PR bounding box in the shape the new `PlaceAutocompleteElement`
 * expects for `locationRestriction`. Note the SW/NE corner convention:
 * south/west is the lower-left, north/east is the upper-right.
 *
 * The legacy `componentRestrictions: { country: "pr" }` option does
 * NOT work with the new `PlaceAutocompleteElement` (it was a legacy
 * Autocomplete widget option). For the new API you must give a
 * LatLngBoundsLiteral that covers the whole island.
 */
const PR_LOCATION_RESTRICTION = {
  south: PR_BOUNDING_BOX.minLat,
  west: PR_BOUNDING_BOX.minLng,
  north: PR_BOUNDING_BOX.maxLat,
  east: PR_BOUNDING_BOX.maxLng,
} as const;

export function LocationInput({
  lat,
  lng,
  address,
  source,
  onChange,
  disabled,
}: {
  lat: number | null;
  lng: number | null;
  address?: string | null;
  source?: LocationSource | null;
  onChange: (loc: LocationValue) => void;
  disabled?: boolean;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasGoogleKey = Boolean(apiKey);

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium leading-none">Ubicación</Label>

      <div className="flex flex-wrap items-center gap-2">
        <GpsButton
          lat={lat}
          lng={lng}
          onChange={onChange}
          disabled={disabled}
        />

        <PlacesButton
          lat={lat}
          lng={lng}
          onChange={onChange}
          disabled={disabled || !hasGoogleKey}
          apiKey={apiKey}
        />

        <ManualButton
          lat={lat}
          lng={lng}
          onChange={onChange}
          disabled={disabled}
        />
      </div>

      {/* Unified "current location" card — always shown when a
          location is set, regardless of which button set it. */}
      {lat != null && lng != null && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/30 dark:text-green-200"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="font-medium">Ubicación confirmada</p>
            {address && <p className="text-xs">{address}</p>}
            <p className="font-mono text-xs">
              {lat.toFixed(5)}°, {lng.toFixed(5)}°
              {source && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-green-700/70 dark:text-green-300/70">
                  ({source})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {!hasGoogleKey && (
        <p className="text-xs text-muted-foreground">
          La búsqueda por dirección no está disponible: falta la clave de
          Google Maps. Usa tu ubicación o ingresa las coordenadas
          manualmente.
        </p>
      )}

      {hasGoogleKey && <PoweredByGoogle />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GPS button
// ---------------------------------------------------------------------------

function GpsButton({
  lat,
  lng,
  onChange,
  disabled,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (loc: LocationValue) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "denied" | "unavailable" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function requestGps() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setErrorMsg(
        "Tu navegador no soporta geolocalización. Ingresa las coordenadas manualmente.",
      );
      return;
    }

    setStatus("requesting");
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setErrorMsg(
            "No nos diste permiso para usar tu ubicación. Ingresa las coordenadas manualmente.",
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus("unavailable");
          setErrorMsg(
            "No pudimos obtener tu ubicación. Ingresa las coordenadas manualmente.",
          );
        } else {
          setStatus("error");
          setErrorMsg(
            "Algo salió mal al obtener tu ubicación. Ingresa las coordenadas manualmente.",
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <Button
      type="button"
      onClick={requestGps}
      disabled={disabled || status === "requesting"}
      variant="default"
    >
      {status === "requesting" ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <MapPin className="mr-2 size-4" />
      )}
      Usar mi ubicación
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Places autocomplete button
// ---------------------------------------------------------------------------

function PlacesButton({
  lat,
  lng,
  onChange,
  disabled,
  apiKey,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (loc: LocationValue) => void;
  disabled?: boolean;
  apiKey: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "searching" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!apiKey) {
    // Render nothing — the parent LocationInput shows a hint instead.
    return null;
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={() => {
            setOpen((s) => !s);
            setErrorMsg(null);
          }}
          disabled={disabled}
          variant="secondary"
        >
          <Search className="mr-2 size-4" />
          {open ? "Ocultar búsqueda" : "Buscar dirección"}
        </Button>

        {open && (
          <PlacesAutocomplete
            containerRef={containerRef}
            onPick={(loc) => {
              setErrorMsg(null);
              setStatus("idle");
              onChange(loc);
              setOpen(false);
            }}
            onError={(msg) => {
              setErrorMsg(msg);
              setStatus("error");
            }}
            onStatusChange={setStatus}
            disabled={disabled}
          />
        )}

        {errorMsg && (
          <p
            className={cn(
              "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
            )}
          >
            {errorMsg}
          </p>
        )}

        {/* Mount point for the PlaceAutocompleteElement web component.
            The element renders its own input + shadow-DOM dropdown, so
            the container needs to be visible (not display:none). */}
        <div ref={containerRef} />
      </div>
    </APIProvider>
  );
}

function PlacesAutocomplete({
  containerRef,
  onPick,
  onError,
  onStatusChange,
  disabled,
}: {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  onPick: (loc: LocationValue) => void;
  onError: (msg: string) => void;
  onStatusChange: (s: "idle" | "searching" | "error") => void;
  disabled?: boolean;
}) {
  const placesLib = useMapsLibrary("places");
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null,
  );

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;

    // Construct the new web component. We use `locationRestriction` (a
    // LatLngBoundsLiteral covering the whole island) instead of the
    // legacy `componentRestrictions: { country: "pr" }` — the new
    // element doesn't honor that option. Restricting to a bounding
    // box also has the nice side effect of preventing users from
    // accidentally picking a non-PR result (e.g. "San Juan" in
    // Argentina or the Philippines).
    const el = new placesLib.PlaceAutocompleteElement({
      locationRestriction: PR_LOCATION_RESTRICTION,
    });

    // The element is itself a custom HTML element with its own input +
    // shadow-DOM dropdown. We set a couple of attributes on it to make
    // it fit our form (Spanish placeholder, full-width inside the
    // container, accessible label).
    el.setAttribute("placeholder", "Busca una calle o lugar en Puerto Rico…");
    el.classList.add(
      "w-full",
      "rounded-md",
      "border",
      "border-input",
      "bg-background",
      "px-3",
      "py-2",
      "text-sm",
      "shadow-sm",
      "focus-within:border-ring",
      "focus-within:ring-1",
      "focus-within:ring-ring/50",
    );
    el.setAttribute("aria-label", "Buscar dirección");

    // The new component fires `gmp-select` (a custom DOM event) when
    // the user picks a suggestion. The `place` is a Place object from
    // "Places API (New)" — to read location/address fields you have to
    // call `fetchFields()`, which makes a follow-up API call.
    //
    // Note: the official Google docs still say `gmp-placeselect`, but
    // inspecting the live places.js bundle shows the dispatched event
    // type is actually `gmp-select` (Event subclass `G8`). Docs lag.
    el.addEventListener("gmp-select", async (event) => {
      // The web component dispatches a custom DOM event with `place` as
      // a direct property (not in `.detail`). The ambient type
      // declaration in types/google-maps.d.ts only declares a class-
      // scoped `addEventListener` overload, which TS doesn't always
      // pick when calling through the inherited HTMLElement signature,
      // so we cast here.
      const { place } = event as unknown as { place: google.maps.places.Place };
      try {
        onStatusChange("searching");
        await place.fetchFields({
          fields: ["location", "formattedAddress", "displayName"],
        });
        const lat = place.location?.lat();
        const lng = place.location?.lng();
        if (lat == null || lng == null) {
          onError(
            "No encontramos esa dirección. Prueba con otra más específica.",
          );
          return;
        }
        const address = place.formattedAddress ?? place.displayName ?? "";
        onPick({ lat, lng, source: "places", address });
      } catch (err) {
        // Log the full error so DevTools shows the real cause. The
        // common ones are:
        //   - "Places API (New) has not been used in project … before
        //     or it is disabled." → enable Places API (New) in Google
        //     Cloud Console (Library → search "Places API (New)" → Enable)
        //   - "This API project is not authorized to use this API." →
        //     API key's "API restrictions" doesn't include Places API (New)
        //   - "REQUEST_DENIED" with referer block → key's HTTP referrer
        //     restrictions don't include the current domain
        const detail =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null
              ? JSON.stringify(err)
              : String(err);
        console.error("[places] fetchFields failed:", detail, err);
        onError(
          `No pudimos obtener los detalles de esa dirección (${detail}). Revisa la consola del navegador para más detalles.`,
        );
      }
    });

    // The element is itself a custom HTML element — append it into the
    // hidden mount point so the Places UI lives in the DOM but doesn't
    // affect our layout (it overlays its own dropdown via shadow DOM).
    containerRef.current.appendChild(el);
    elementRef.current = el;
    onStatusChange("idle");

    return () => {
      if (
        elementRef.current &&
        containerRef.current?.contains(elementRef.current)
      ) {
        containerRef.current.removeChild(elementRef.current);
      }
      elementRef.current = null;
    };
  }, [placesLib, containerRef, onPick, onError, onStatusChange]);

  // The web component renders itself when appended. We render a small
  // hint + an optional inline error / loading state here, beneath the
  // element's own UI.
  return (
    <div className="flex flex-col gap-1.5">
      {status === "searching" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Obteniendo coordenadas…
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Solo mostramos resultados en Puerto Rico.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual coords button
// ---------------------------------------------------------------------------

function ManualButton({
  lat,
  lng,
  onChange,
  disabled,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (loc: LocationValue) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manualLat, setManualLat] = useState<string>(
    lat != null ? String(lat) : "",
  );
  const [manualLng, setManualLng] = useState<string>(
    lng != null ? String(lng) : "",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function applyManual() {
    const latN = Number(manualLat);
    const lngN = Number(manualLng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setErrorMsg("Las coordenadas deben ser números válidos.");
      return;
    }
    setErrorMsg(null);
    onChange({ lat: latN, lng: lngN, source: "manual" });
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() => {
          setOpen((s) => !s);
          setErrorMsg(null);
        }}
        disabled={disabled}
        variant="ghost"
      >
        <Pencil className="mr-2 size-4" />
        {open ? "Ocultar coordenadas" : "Ingresar coordenadas"}
      </Button>

      {open && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
          <div className="col-span-2 text-xs text-muted-foreground">
            Para pruebas o si las otras opciones no funcionan.
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat" className="text-xs">
              Latitud
            </Label>
            <Input
              id="lat"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="18.4655"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lng" className="text-xs">
              Longitud
            </Label>
            <Input
              id="lng"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="-66.1057"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={applyManual}
              disabled={disabled}
              className="w-full"
            >
              Usar estas coordenadas
            </Button>
          </div>
          {errorMsg && (
            <p
              className={cn(
                "col-span-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive",
              )}
            >
              {errorMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Powered by Google" attribution — required by the Places API ToS.
// https://developers.google.com/maps/documentation/javascript/places
// ---------------------------------------------------------------------------

function PoweredByGoogle() {
  return (
    <p className="text-right text-[10px] text-muted-foreground/70">
      Búsqueda de direcciones:{" "}
      <span className="font-semibold">Powered by Google</span>
    </p>
  );
}
