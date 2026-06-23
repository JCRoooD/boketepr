"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Locate, MapPin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PinDetailPanel } from "@/components/map/PinDetailPanel";
import { SeverityLegend } from "@/components/map/SeverityLegend";
import {
  fixedPinElementProps,
  pinElementProps,
} from "@/components/map/SeverityPin";
import {
  isRecentlyFixed,
  ReportPin,
  subscribeToNewReports,
  subscribeToReportUpdates,
} from "@/lib/reports/queries";
import {
  EMPTY_PINS,
  readCachedPins,
  subscribeToPinsCache,
  writeCachedPins,
} from "@/lib/reports/pin-cache";

/**
 * MapView — the live Google Map for the public /map page.
 *
 * Renders a full-viewport Google Map of Puerto Rico with one pin per
 * visible report. Active pins are color-coded by severity bucket (Leve
 * / Moderado / Severo / Peligroso); recently-fixed pins render as
 * green checks (migration 0007).
 *
 * Data flow:
 *   1. The page (server component) fetches the most recent 500 visible
 *      reports and passes them in as `initialReports` (no flash of
 *      empty map).
 *   2. On mount, we read the localStorage cache (T5.10) and merge
 *      with initialReports so the offline user still sees something.
 *   3. We open two Realtime subscriptions (T5.5):
 *        - INSERT → animate in the new active pin
 *        - UPDATE → re-render the pin (now also handles fixed
 *          status — see below)
 *   4. On pin click, we set `selectedId` and the PinDetailPanel slides
 *      in from the right.
 *
 * Since migration 0007 the UPDATE handler does NOT drop fixed pins.
 * Instead it keeps the row visible (as a green check) for 30 days
 * after `fixed_at`, then drops it once the row ages out. This avoids
 * the "things disappear into a void" UX gap that was in the v1
 * deferred list.
 *
 * If the Google Maps API key is not set (T5.1 — clicky part), we show
 * a setup screen instead of a broken map.
 */

const SAN_JUAN = { lat: 18.4655, lng: -66.1057 };
const DEFAULT_ZOOM = 10;

export interface MapViewProps {
  initialReports: ReportPin[];
  currentUserId: string | null;
}

export function MapView({ initialReports, currentUserId }: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Missing API key → setup screen, no map.
  if (!apiKey) {
    return <MissingApiKeyScreen />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapInner
        initialReports={initialReports}
        currentUserId={currentUserId}
      />
    </APIProvider>
  );
}

/**
 * Inner map — separated so it can use `useMap()` (which requires being
 * a child of `<Map>`).
 */
function MapInner({ initialReports, currentUserId }: MapViewProps) {
  const [pins, setPins] = useState<ReportPin[]>(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const map = useMap();

  /*
   * Hydrate the pin set from the localStorage cache (T5.10) using
   * useSyncExternalStore — the React 19-recommended way to subscribe
   * to external mutable state (localStorage) without triggering the
   * "setState in effect" anti-pattern.
   *
   * On the server (and the initial client render before hydration
   * finishes) cachedPins is `[]`. The first paint matches the SSR
   * HTML, so no hydration mismatch. After hydration, React re-renders
   * with the actual cached pins and the merge happens in the
   * useMemo below.
   */
  const cachedPins = useSyncExternalStore(
    subscribeToPinsCache,
    readCachedPins,
    () => EMPTY_PINS,
  );

  // Merge: server-provided pins first, then any cached pins we don't
  // have yet. Dedupe by id. This runs on every render but is cheap
  // (500 pins × 2 array scans is sub-millisecond).
  const mergedPins = useMemo<ReportPin[]>(() => {
    if (cachedPins.length === 0) return pins;
    const seen = new Set(pins.map((p) => p.id));
    const merged = [...pins];
    for (const c of cachedPins) {
      if (!seen.has(c.id)) merged.push(c);
    }
    return merged;
  }, [pins, cachedPins]);

  // Tick `now` every minute so the 30-day fixed-pin window stays
  // accurate while the tab is open (a pin fixed in this session can
  // become stale, or the inverse for a pin that's been on the map a
  // while). Cheap; one state set per 60s.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Persist the current pin set to localStorage whenever it changes.
  // (T5.10)
  useEffect(() => {
    writeCachedPins(mergedPins);
  }, [mergedPins]);

  // Realtime: animate in new reports (T5.5).
  useEffect(() => {
    const sub = subscribeToNewReports((row) => {
      setPins((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev;
        return [row, ...prev];
      });
    });
    return () => sub.unsubscribe();
  }, []);

  // Realtime: re-render pins when their row updates.
  //
  // Migration 0007 changed this handler:
  //   - Active → Active: replace the row (e.g. severity correction)
  //   - Active → Fixed: replace the row; PinDetailPanel + SeverityPin
  //     will render the green-check variant because `status` is now
  //     'fixed'. We no longer drop the pin.
  //   - Fixed → ...: replace the row
  // The pin falls off the map via the in-session filter below (after
  // 30 days since fixed_at) OR on the next page load (via the server
  // query filter).
  useEffect(() => {
    const sub = subscribeToReportUpdates((row) => {
      setPins((prev) => prev.map((p) => (p.id === row.id ? row : p)));
    });
    return () => sub.unsubscribe();
  }, []);

  // Visible pins: drop rows whose 30-day fixed-pin window has aged out
  // while the tab was open. This is the in-session analogue of the
  // server-side `fixed_at > now()-30d` filter.
  const visiblePins = useMemo(
    () => mergedPins.filter((p) => isRecentlyFixed(p, now) || p.status !== "fixed"),
    [mergedPins, now],
  );

  const selectedReport = useMemo(
    () => visiblePins.find((p) => p.id === selectedId) ?? null,
    [visiblePins, selectedId],
  );

  function recenter() {
    if (!map) return;
    map.panTo(SAN_JUAN);
    map.setZoom(DEFAULT_ZOOM);
  }

  /*
   * Called after the owner successfully marks a pin as fixed. We
   * update the local row so it re-renders as a green check
   * immediately (no flash of empty). The Realtime subscription above
   * will also receive the UPDATE and call this same path — `map`
   * keeps the row idempotent.
   */
  function handleFixed(reportId: string) {
    const nowIso = new Date().toISOString();
    setPins((prev) =>
      prev.map((p) =>
        p.id === reportId ? { ...p, status: "fixed", fixed_at: nowIso } : p,
      ),
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-muted">
      <Map
        mapId="boketepr-main-map"
        defaultCenter={SAN_JUAN}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        className="h-full w-full"
      >
        {visiblePins.map((p) => {
          const isFixed = isRecentlyFixed(p, now);
          return (
            <AdvancedMarker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              onClick={() => setSelectedId(p.id)}
              title={isFixed ? "Reparado" : `Severidad ${p.severity.toFixed(1)}`}
            >
              <Pin
                {...(isFixed
                  ? fixedPinElementProps()
                  : pinElementProps(p.severity))}
              />
            </AdvancedMarker>
          );
        })}
      </Map>

      <SeverityLegend />

      {/* Recenter button (bottom-right) */}
      <div className="absolute bottom-4 right-4 z-10">
        <Button
          size="icon"
          variant="secondary"
          onClick={recenter}
          aria-label="Recentrar mapa en San Juan"
          className="shadow-md"
        >
          <Locate className="size-4" />
        </Button>
      </div>

      {/* Report CTA (top-right, below topnav) */}
      <div className="absolute right-4 top-4 z-10">
        <Button
          size="default"
          render={<Link href="/submit" />}
          className="shadow-md"
        >
          <Plus className="mr-2 size-4" />
          Reportar un hoyo
        </Button>
      </div>

      {/* Empty state (no visible pins) */}
      {visiblePins.length === 0 && <EmptyStateOverlay />}

      {/* Detail panel */}
      {selectedReport && (
        <PinDetailPanel
          report={selectedReport}
          currentUserId={currentUserId}
          onClose={() => setSelectedId(null)}
          onFixed={handleFixed}
        />
      )}
    </div>
  );
}

function EmptyStateOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
      <div className="rounded-lg border border-border/50 bg-background/90 px-4 py-3 text-center shadow-md backdrop-blur">
        <MapPin className="mx-auto mb-1 size-6 text-muted-foreground" />
        <p className="text-sm text-foreground">
          Aún no hay hoyos reportados.
        </p>
        <p className="text-xs text-muted-foreground">
          Sé el primero en reportar uno.
        </p>
      </div>
    </div>
  );
}

function MissingApiKeyScreen() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-20 sm:px-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <MapPin className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Falta la clave de Google Maps
        </h1>
        <p className="mt-2 text-muted-foreground">
          Para mostrar el mapa necesitamos una clave de la API de Google
          Maps JavaScript. Agrégala a tu archivo <code>.env.local</code>{" "}
          como <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> y a las
          variables de entorno de Vercel.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Créala en{" "}
          <a
            href="https://console.cloud.google.com/google/maps-apis/credentials"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2"
          >
            Google Cloud Console
          </a>{" "}
          y restríngela al dominio <code>boketepr.vercel.app</code>.
        </p>
      </div>
    </div>
  );
}