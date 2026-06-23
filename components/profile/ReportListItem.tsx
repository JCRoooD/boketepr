import Link from "next/link";
import { MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { severityStyle } from "@/lib/reports/severity";

/**
 * ReportListItem — one row in the user's report history.
 *
 * Server component. Shows thumbnail, severity badge, status badge,
 * short reason, and links to /report/{id} (the shareable page).
 *
 * The thumbnail uses <img> (not next/image) because it points to
 * Supabase Storage (not /public), and configuring next.config for
 * remote optimization adds build complexity we don't need.
 */

export interface ReportListItemData {
  id: string;
  severity: number;
  severity_reason: string;
  status: "active" | "fixed" | "disputed";
  created_at: string;
  photo_url: string;
  thumbnail_url: string | null;
  user_comment: string | null;
  lat: number;
  lng: number;
}

export interface ReportListItemProps {
  report: ReportListItemData;
}

export function ReportListItem({ report }: ReportListItemProps) {
  const style = severityStyle(report.severity);
  const isFixed = report.status === "fixed";

  const submittedDate = new Date(report.created_at).toLocaleDateString(
    "es-PR",
    { day: "numeric", month: "short", year: "numeric" },
  );

  return (
    <Link
      href={`/report/${report.id}`}
      className="group block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
    >
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.thumbnail_url ?? report.photo_url}
              alt={`Foto del hoyo reportado el ${submittedDate}`}
              className={`h-full w-full object-cover ${isFixed ? "opacity-80" : ""}`}
            />
            {isFixed && (
              <div className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow">
                ✓
              </div>
            )}
          </div>

          {/* Right column: severity + reason + meta */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${style.badgeBg} ${style.badgeText}`}
              >
                {isFixed ? "Reparado" : style.label} ·{" "}
                {report.severity.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                {submittedDate}
              </span>
            </div>

            {report.severity_reason && !isFixed && (
              <p className="line-clamp-2 text-sm text-foreground">
                {report.severity_reason}
              </p>
            )}

            {report.user_comment && (
              <p className="line-clamp-1 text-xs italic text-muted-foreground">
                “{report.user_comment}”
              </p>
            )}

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              <span className="font-mono">
                {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}