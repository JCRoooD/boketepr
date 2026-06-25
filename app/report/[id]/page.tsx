import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { severityStyle } from "@/lib/reports/severity";
import { hazardLabels } from "@/lib/reports/hazard-labels";
import { createClient } from "@/lib/supabase/server";

/**
 * /report/[id] — Goal 5, T5.9: shareable standalone URL for one report.
 *
 * Use case: a user wants to send a specific pothole to a friend, a
 * neighborhood group, or report it on social media. The /map page is
 * too noisy for sharing; this page is one report, big photo, full
 * details, OG meta tags so the link preview looks good on WhatsApp /
 * Twitter / iMessage.
 *
 * Server component: this is a static-ish page (the report data
 * doesn't change often), so we render it on the server with no
 * client-side JS. Cache headers could be tuned later for performance.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("severity, severity_reason, hazards, photo_url")
    .eq("id", id)
    .single();

  if (!data) {
    return {
      title: "Reporte no encontrado",
      description: "Este reporte de hoyo no existe o fue eliminado.",
    };
  }

  const style = severityStyle(data.severity);
  const title = `Hoyo ${style.label.toLowerCase()} (${data.severity.toFixed(1)}/10) · BoketePR`;
  const description =
    data.severity_reason ||
    "Un hoyo reportado en Puerto Rico a través de BoketePR.";

  return {
    title,
    description,
    openGraph: {
      // `images` is intentionally omitted — the colocal
      // `app/report/[id]/opengraph-image.tsx` file convention generates the
      // `<meta property="og:image">` tags automatically with a richer
      // 1200x630 card (severity badge + bucket + reason). Adding a plain
      // `images` here would either shadow or duplicate that, depending on
      // the order Next.js merges them.
      type: "article",
      title,
      description,
    },
    twitter: {
      // Same reasoning — the `twitter-image.tsx` colocal file would
      // duplicate this if added; we let `opengraph-image.tsx` cover both
      // because Twitter `summary_large_image` reads any `og:image` first.
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ReportSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select(
      "id, lat, lng, severity, severity_reason, hazards, user_comment, photo_url, status, created_at",
    )
    .eq("id", id)
    .single();

  if (error || !report) {
    notFound();
  }

  const style = severityStyle(report.severity);
  const submittedDate = new Date(report.created_at);
  const dateLabel = submittedDate.toLocaleDateString("es-PR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/map" />}>
          <ArrowLeft className="mr-2 size-4" />
          Volver al mapa
        </Button>
      </div>

      <Card>
        {/* Photo */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.photo_url}
            alt="Foto del hoyo reportado"
            className="h-full w-full object-cover"
          />
        </div>

        <CardContent className="flex flex-col gap-4 p-5">
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
            <p className="text-base text-foreground">
              {report.severity_reason}
            </p>
          )}

          {/* Hazards — prettified snake_case tokens to Spanish phrases */}
          {report.hazards.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hazardLabels(report.hazards).map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {label}
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
          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              <span className="font-mono">
                {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
              </span>
            </div>
            <div>Reportado el {dateLabel}</div>
          </div>

          {report.status === "fixed" && (
            <div className="rounded-md border border-green-500/50 bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">
              Este hoyo fue marcado como reparado.
            </div>
          )}

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              ¿Viste este hoyo?{" "}
              <Link
                href="/map"
                className="text-primary underline underline-offset-2"
              >
                Ver todos los hoyos en el mapa
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
