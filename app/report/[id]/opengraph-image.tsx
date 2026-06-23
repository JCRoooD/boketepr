import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createClient } from "@/lib/supabase/server";
import { severityStyle } from "@/lib/reports/severity";
import { relativeTimeEs } from "@/lib/reports/relative-time";

/**
 * Dynamic Open Graph image for `/report/[id]`.
 *
 * Why this exists:
 *   The /report/[id] page already sets OG + Twitter meta tags, but the
 *   `images` field points at the raw photo_url. WhatsApp and Twitter prefer
 *   a 1200x630 OG card with structured info (severity score, bucket label,
 *   reason text) — the raw photo is too narrow and lacks the score, which
 *   is the whole point of a pothole report.
 *
 *   This file is colocal with the route. Next.js 16 reads `opengraph-image.tsx`
 *   as a special Route Handler, generates the PNG at request time, emits the
 *   `<meta property="og:image">` + `<meta name="twitter:image">` tags, and
 *   serves the binary at `/report/[id]/opengraph-image`.
 *
 * Why force-dynamic:
 *   Each report ID is unique. There are no static IDs to enumerate, so the
 *   image can't be pre-generated at build time. `force-dynamic` opts out of
 *   the default static optimization.
 *
 * Why Geist Regular:
 *   It's bundled with `next/og` and supports Latin Extended (Spanish accents,
 *   ñ, ¿, ¡) — confirmed by the OG playground defaults.
 *
 * Satori/CSS constraints:
 *   Satori (the rendering engine under next/og) only supports flexbox + a
 *   subset of CSS. No grid, no `display: block` outside flex containers, no
 *   box-shadow. Layouts must be hand-built.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Reporte de hoyo en Puerto Rico — BoketePR";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Color palette — kept in sync with `lib/reports/severity.ts` bucket colors
// but as hex strings (Satori can't read CSS variables).
const BUCKET_COLORS = {
  leve: "#16a34a", // green-600
  moderado: "#ca8a04", // yellow-600
  severo: "#ea580c", // orange-600
  peligroso: "#dc2626", // red-600
} as const;

const BUCKET_LABELS = {
  leve: "LEVE",
  moderado: "MODERADO",
  severo: "SEVERO",
  peligroso: "PELIGROSO",
} as const;

const CHAR_LIMIT_REASON = 180;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // Cut at the last word boundary before the limit so we don't end on a fragment.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : limit).trimEnd()}…`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Load the font. Geist Regular is bundled with Next.js and supports Latin
  // Extended (Spanish accents + ñ + inverted punctuation). We use the
  // Regular weight only because Next.js doesn't ship Geist-SemiBold in its
  // compiled @vercel/og bundle, and visual hierarchy comes from fontSize +
  // letterSpacing + opacity rather than fontWeight.
  const fontRegular = await readFile(
    join(
      process.cwd(),
      "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
    ),
  );

  // Fetch the report. Public read (RLS), so the server client works without
  // user auth — important because the OG crawler is anonymous.
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select(
      "id, lat, lng, severity, severity_reason, hazards, photo_url, thumbnail_url, status, fixed_at, created_at",
    )
    .eq("id", id)
    .single();

  // Fallback card: missing or deleted report. A neutral BoketePR card with no
  // severity so the link isn't broken.
  if (!report) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafafa",
            fontFamily: '"Geist"',
            padding: 60,
          }}
        >
          <div style={{ fontSize: 72, color: "#0a0a0a" }}>
            BoketePR
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#525252",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Reporte no encontrado
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#737373",
              marginTop: 32,
            }}
          >
            boketepr.vercel.app
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [
          { name: "Geist", data: fontRegular, style: "normal", weight: 400 },
        ],
      },
    );
  }

  const style = severityStyle(report.severity);
  const bucketColor = BUCKET_COLORS[style.bucket];
  const bucketLabel = BUCKET_LABELS[style.bucket];
  const reason = truncate(
    report.severity_reason || "Hoyo reportado en Puerto Rico.",
    CHAR_LIMIT_REASON,
  );
  const isFixed = report.status === "fixed" && report.fixed_at;
  const fixedLabel = isFixed
    ? `Reparado ${relativeTimeEs(report.fixed_at!)}`
    : null;

  // Photo URL — prefer the thumbnail (smaller, faster fetch by Satori).
  // Both buckets are public; Satori fetches them directly.
  const photoSrc = report.thumbnail_url ?? report.photo_url;

  return new ImageResponse(
    (
      // Single-column stacked layout. Satori (the renderer under next/og)
      // is strict about flex containers with multiple children needing
      // explicit `display` and refuses arbitrary `position: absolute` overlays
      // — every earlier attempt with a two-column "photo on the left" layout
      // tripped the constraint. A pure typographic card reads great as a
      // share preview and renders reliably.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          fontFamily: '"Geist"',
          padding: "60px 70px",
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 36,
            color: "#0a0a0a",
          }}
        >
          {/* Black square brand mark — no glyph (Geist Regular doesn't ship ✦) */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#0a0a0a",
              display: "flex",
            }}
          />
          <div style={{ display: "flex" }}>BoketePR</div>
          {isFixed && (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 999,
                background: "#16a34a",
                color: "#ffffff",
                fontSize: 24,
              }}
            >
              {/* Filled white dot — single element, no children */}
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: "#ffffff",
                  display: "flex",
                }}
              />
              <div style={{ display: "flex" }}>{fixedLabel}</div>
            </div>
          )}
        </div>

        {/* Severity badge — colored block with the score + bucket label */}
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 44px",
            borderRadius: 28,
            background: bucketColor,
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, opacity: 0.85, display: "flex" }}>
              Severidad
            </div>
            <div
              style={{
                fontSize: 140,
                lineHeight: 1,
                letterSpacing: -5,
                display: "flex",
                marginTop: 8,
              }}
            >
              {report.severity.toFixed(1)}
              <div
                style={{
                  fontSize: 56,
                  opacity: 0.7,
                  marginLeft: 12,
                  display: "flex",
                  alignItems: "flex-end",
                  paddingBottom: 18,
                }}
              >
                / 10
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "14px 24px",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.18)",
              fontSize: 32,
              letterSpacing: 2,
            }}
          >
            {bucketLabel}
          </div>
        </div>

        {/* Reason — the AI's Spanish description of why this score */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            fontSize: 32,
            lineHeight: 1.35,
            color: "#171717",
            flex: 1,
          }}
        >
          {reason}
        </div>

        {/* Footer: location + report age */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#737373",
            marginTop: 32,
          }}
        >
          <div style={{ display: "flex" }}>
            {report.lat.toFixed(4)}, {report.lng.toFixed(4)} · Puerto Rico
          </div>
          <div style={{ display: "flex" }}>{relativeTimeEs(report.created_at)}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: fontRegular, style: "normal", weight: 400 },
      ],
    },
  );
}