"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchNearbyReports,
  type NearbyReport,
} from "@/lib/reports/queries";
import { severityStyle } from "@/lib/reports/severity";

/**
 * NearbyReports — duplicate-detection card on /submit.
 *
 * After the user picks a location (any of the three modes in
 * LocationInput), this component debounces a PostGIS `ST_DWithin`
 * query via the `find_nearby_reports` RPC and shows up to 5 active
 * reports within ~50 m. Each row links to `/report/[id]` so the user
 * can decide whether their hoyo is the same, similar, or different.
 *
 * This is INFORMATIVE — submission is never blocked. People may have
 * legitimately new info about an existing hoyo (e.g. "está peor"), or
 * the GPS / Places pick may be far enough off that the proximity is
 * coincidental. The card gives the user the chance to choose without
 * creating friction.
 *
 * Edge cases handled:
 *   - lat/lng null → render nothing (no fetch)
 *   - lat/lng change → debounce 250 ms (covers rapid manual edits)
 *   - fetch error → log + render nothing (the submit flow shouldn't
 *     break if the duplicate lookup fails)
 *   - 0 results → render nothing (the prompt only shows when there's
 *     something to point at)
 *
 * Implementation note: we deliberately avoid a separate "loading"
 * status. Old results stay visible while a new fetch is in flight —
 * the `cancelled` flag prevents a stale response from overwriting
 * newer ones. The component renders null until the first successful
 * response arrives, which is a brief invisibility, not a flicker.
 */
const DEBOUNCE_MS = 250;

type Status =
  | { kind: "ready"; results: NearbyReport[] }
  | { kind: "error" };

export function NearbyReports({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const [status, setStatus] = useState<Status>({ kind: "error" });

  useEffect(() => {
    if (lat == null || lng == null) {
      // No location → no fetch. The render returns null for this case
      // without ever needing to setState.
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchNearbyReports(lat, lng);
        if (cancelled) return;
        setStatus({ kind: "ready", results });
      } catch (err) {
        if (cancelled) return;
        console.error("NearbyReports fetch failed", err);
        setStatus({ kind: "error" });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [lat, lng]);

  // No location, still on first fetch (initial state is "error" so we
  // render nothing until results land), errored out, or zero nearby
  // reports — all return null. The submit flow shouldn't feel
  // cluttered when there's nothing actionable.
  if (lat == null || lng == null) return null;
  if (status.kind !== "ready") return null;
  if (status.results.length === 0) return null;

  const count = status.results.length;
  const heading =
    count === 1
      ? "Ya hay 1 reporte cerca de aquí"
      : `Ya hay ${count} reportes cerca de aquí`;

  return (
    <Card
      role="region"
      aria-label="Reportes cercanos"
      className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {heading}
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            Revisa si alguno es el mismo hoyo antes de reportar.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {status.results.map((r) => (
            <NearbyReportRow key={r.id} report={r} />
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Si tu hoyo es diferente o tiene nueva información, puedes
          reportarlo de todas formas.
        </p>
      </CardContent>
    </Card>
  );
}

function NearbyReportRow({ report }: { report: NearbyReport }) {
  const style = severityStyle(report.severity);
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-background p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={report.thumbnail_url ?? report.photo_url}
        alt=""
        className="size-14 shrink-0 rounded object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-bold ${style.badgeBg} ${style.badgeText}`}
          >
            {report.severity.toFixed(1)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {formatDistance(report.distance_m)} · {formatRelativeDate(report.created_at)}
          </span>
        </div>
        {report.severity_reason && (
          <p className="line-clamp-2 text-xs text-foreground/80">
            {report.severity_reason}
          </p>
        )}
        <Button
          variant="link"
          size="sm"
          render={<Link href={`/report/${report.id}`} />}
          className="-ml-2 -mt-1 h-auto justify-start p-0 text-xs"
        >
          Ver este reporte →
        </Button>
      </div>
    </li>
  );
}

/** "a 23 metros" / "a menos de 1 metro" / "a 1.2 km" */
function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 1) {
    return "a menos de 1 metro";
  }
  if (meters < 1000) {
    return `a ${Math.round(meters)} metros`;
  }
  return `a ${(meters / 1000).toFixed(1)} km`;
}

/** "hace 2 días" / "hace 5 horas" / "hoy" — via Intl.RelativeTimeFormat(es-PR) */
function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "fecha desconocida";
  }
  const rtf = new Intl.RelativeTimeFormat("es-PR", { numeric: "auto" });
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  const years = Math.round(months / 12);
  return rtf.format(-years, "year");
}