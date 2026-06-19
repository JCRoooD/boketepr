"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, MapPin, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { severityStyle } from "@/lib/reports/severity";
import type { ReportPin } from "@/lib/reports/queries";

/**
 * PinDetailPanel — slide-in side panel shown when a user clicks a pin
 * on the /map page.
 *
 * Shows: photo, severity badge, Spanish reason, hazard tags, the
 * geohash decoded to ~coordinates, and a "Reportar como reparado"
 * button if the current user owns this report.
 *
 * The "mark as fixed" action:
 *   - Calls POST /api/reports/{id}/fix (Goal 5, T5.8)
 *   - On success, the parent (MapView) updates local state to remove
 *     the pin (and Supabase Realtime will broadcast the UPDATE so other
 *     clients see the same).
 *   - On error, shows an inline error message in Spanish.
 */

export interface PinDetailPanelProps {
  report: ReportPin;
  /** The currently signed-in user id, or null if not signed in. */
  currentUserId: string | null;
  onClose: () => void;
  /** Called after a successful mark-as-fixed so the parent can update its pin list. */
  onFixed: (reportId: string) => void;
}

export function PinDetailPanel({
  report,
  currentUserId,
  onClose,
  onFixed,
}: PinDetailPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const style = severityStyle(report.severity);
  const isOwner = currentUserId != null && currentUserId === report.user_id;
  const submittedDate = new Date(report.created_at);
  const dateLabel = submittedDate.toLocaleDateString("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function handleMarkFixed() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/reports/${report.id}/fix`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Ensure the user is signed in (anon key won't bypass RLS, but
          // the route also calls getUser() server-side).
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "No pudimos marcar el hoyo como reparado.");
        }
        // Optimistically remove the pin from local state. The Realtime
        // subscription will also receive the UPDATE; the parent handles
        // dedup.
        onFixed(report.id);
        onClose();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Algo salió mal. Intenta de nuevo.",
        );
      }
    });
  }

  return (
    <div
      className="absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl sm:w-96"
      role="dialog"
      aria-label="Detalle del hoyo reportado"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          Detalle del hoyo
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Cerrar"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Photo */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {/*
            Using <img> (not next/image) for two reasons:
              1. The photo is a Supabase public URL (not local to /public),
                 and configuring next.config to allow it adds a build step.
              2. We don't need optimization on a 400x225 thumbnail.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.thumbnail_url ?? report.photo_url}
            alt="Foto del hoyo reportado"
            className="h-full w-full object-cover"
          />
        </div>

        <CardContent className="flex flex-col gap-4 p-4">
          {/* Severity badge */}
          <div
            className={`flex flex-col items-center gap-1 rounded-lg px-4 py-3 ${style.badgeBg}`}
          >
            <div className={`text-3xl font-bold ${style.badgeText}`}>
              {report.severity.toFixed(1)}{" "}
              <span className="text-xl">/ 10</span>
            </div>
            <div
              className={`text-xs font-semibold uppercase tracking-wide ${style.badgeText}`}
            >
              {style.label}
            </div>
          </div>

          {/* Reason */}
          {report.severity_reason && (
            <p className="text-sm text-foreground">{report.severity_reason}</p>
          )}

          {/* Hazards */}
          {report.hazards.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {report.hazards.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* User comment */}
          {report.user_comment && (
            <Card>
              <CardContent className="p-3 text-sm italic text-foreground">
                “{report.user_comment}”
              </CardContent>
            </Card>
          )}

          {/* Location + date */}
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              <span className="font-mono">
                {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
              </span>
            </div>
            <div>Reportado el {dateLabel}</div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {isOwner && (
              <Button
                onClick={handleMarkFixed}
                disabled={isPending}
                variant="default"
              >
                <Wrench className="mr-2 size-4" />
                {isPending ? "Marcando…" : "Reportar como reparado"}
              </Button>
            )}

            {/*
              Shareable URL — for now points to /report/{id}, which is
              the standalone shareable page (T5.9). The link opens in
              a new tab so the user doesn't lose the map view.
            */}
            <Button
              variant="outline"
              render={<Link href={`/report/${report.id}`} target="_blank" />}
            >
              <ExternalLink className="mr-2 size-4" />
              Compartir este reporte
            </Button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}
