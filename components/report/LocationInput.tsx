"use client";

import { Loader2, MapPin, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * LocationInput
 *
 * Primary: a "Usar mi ubicación" button that calls
 *   navigator.geolocation.getCurrentPosition()
 * Fallback: two number inputs (lat, lng) for desktop testing, denied
 * permission, or failed GPS. We defer Google Places autocomplete to
 * Goal 5 (we'll need the Google Maps key anyway for the public map).
 *
 * Props:
 *   - lat: number | null
 *   - lng: number | null
 *   - onChange: ({ lat, lng, source }: { lat: number; lng: number; source: "gps" | "manual" }) => void
 *   - disabled?: boolean
 */
export function LocationInput({
  lat,
  lng,
  onChange,
  disabled,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (loc: {
    lat: number;
    lng: number;
    source: "gps" | "manual";
  }) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "denied" | "unavailable" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState<string>(
    lat != null ? String(lat) : "",
  );
  const [manualLng, setManualLng] = useState<string>(
    lng != null ? String(lng) : "",
  );

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
        setManualLat(String(pos.coords.latitude));
        setManualLng(String(pos.coords.longitude));
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

  function applyManual() {
    const latN = Number(manualLat);
    const lngN = Number(manualLng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setErrorMsg("Las coordenadas deben ser números válidos.");
      return;
    }
    setErrorMsg(null);
    onChange({ lat: latN, lng: lngN, source: "manual" });
  }

  const hasLocation = lat != null && lng != null;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium leading-none">Ubicación</Label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={requestGps}
          disabled={disabled || status === "requesting"}
          variant={hasLocation && showManual === false ? "secondary" : "default"}
        >
          {status === "requesting" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <MapPin className="mr-2 size-4" />
          )}
          Usar mi ubicación
        </Button>

        <Button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          disabled={disabled}
          variant="ghost"
        >
          <Pencil className="mr-2 size-4" />
          {showManual ? "Ocultar coordenadas" : "Ingresar coordenadas"}
        </Button>
      </div>

      {hasLocation && !showManual && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {lat!.toFixed(5)}°, {lng!.toFixed(5)}°
          {lat !== null && lng !== null ? "" : ""}
        </p>
      )}

      {showManual && (
        <div className="grid grid-cols-2 gap-3">
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
        </div>
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
    </div>
  );
}
