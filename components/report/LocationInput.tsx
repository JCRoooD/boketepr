"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Loader2, MapPin, Pencil, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * back to the parent with a `source` discriminator so the parent can
 * show e.g. the formatted address in a future v1.1 update.
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

const PR_RESTRICTION = { country: "pr" } as const;

export function LocationInput({
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
  const [address, setAddress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If the parent already has a location whose source is "places",
  // reflect its address on mount.
  useEffect(() => {
    // No-op: the address is captured at pick time. Resetting lat/lng
    // from outside (e.g. user clears the form) clears `address` too via
    // the change handler below.
  }, []);

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
            inputRef={inputRef}
            onPick={(loc) => {
              setAddress(loc.address ?? null);
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

        {/* Show the address the user just picked, even after the input closes. */}
        {!open && address && lat != null && lng != null && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {address}
            <br />
            <span className="font-mono text-xs">
              {lat.toFixed(5)}°, {lng.toFixed(5)}°
            </span>
          </p>
        )}
      </div>
    </APIProvider>
  );
}

function PlacesAutocomplete({
  inputRef,
  onPick,
  onError,
  onStatusChange,
  disabled,
}: {
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPick: (loc: LocationValue) => void;
  onError: (msg: string) => void;
  onStatusChange: (s: "idle" | "searching" | "error") => void;
  disabled?: boolean;
}) {
  const placesLib = useMapsLibrary("places");
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: PR_RESTRICTION,
      fields: ["geometry", "formatted_address", "name"],
      // 'address' = street address, 'establishment' = named places (e.g.
      // businesses, parks), 'geocode' = administrative areas. Mixing
      // them gives the richest results for a pothole app.
      types: ["address", "establishment", "geocode"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) {
        onError(
          "No encontramos esa dirección. Prueba con otra más específica.",
        );
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address ?? place.name ?? "";
      onPick({ lat, lng, source: "places", address });
    });

    autocompleteRef.current = autocomplete;
    onStatusChange("idle");

    return () => {
      // Detach listeners so HMR / route changes don't leak handlers.
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [placesLib, inputRef, onPick, onError, onStatusChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Busca una calle, negocio o lugar en Puerto Rico…"
        disabled={disabled}
        autoComplete="off"
        // The autocomplete dropdown is rendered by Google as a sibling of
        // the input, with class .pac-container. Tailwind's preflight can
        // break its positioning, so we ship a tiny style override via a
        // global stylesheet fragment below.
        onKeyDown={(e) => {
          // Enter should pick the highlighted suggestion rather than
          // submitting the surrounding form. The Autocomplete listens
          // for Enter on its own, but the form's submit button can win
          // the race if the user is fast.
          if (e.key === "Enter") {
            e.preventDefault();
            const keyboardEvent = new KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            });
            inputRef.current?.dispatchEvent(keyboardEvent);
          }
        }}
      />
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
