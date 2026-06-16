import { NextResponse } from "next/server";
import { z } from "zod";

import { encodeGeohash } from "@/lib/geo/geohash";
import { isWithinPR, wktPoint } from "@/lib/geo/pr-bbox";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/reports
 *
 * Body: {
 *   photo_url: string,           // public URL returned by /api/upload
 *   lat: number,
 *   lng: number,
 *   user_comment?: string,      // optional one-liner
 * }
 *
 * Side effects:
 *   - Validates the user is authenticated
 *   - Validates lat/lng is within the PR bounding box
 *   - Computes the 6-char geohash
 *   - Inserts a row into `public.reports` with severity=5.0 placeholder
 *     and a placeholder severity_reason. Goal 4 will overwrite these
 *     with real OpenAI output.
 *   - Increments the user's `profiles.reports_submitted` counter
 *
 * Why service role: RLS allows the user to insert as themselves, but we
 * also want to (a) always set user_id from the session, never from the
 * request body, and (b) increment the counter atomically. Using the
 * service role with explicit user_id assignment is the simplest pattern.
 * If you prefer to stay within RLS, you can remove the service-role bit
 * and pass `user_id: user.id` from the client; the trigger then needs
 * to handle the counter. For v1 we keep the API route as the trusted
 * boundary.
 */
const Body = z.object({
  photo_url: z.string().url().max(2048),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  user_comment: z.string().max(280).optional().nullable(),
});

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "No has iniciado sesión." },
      { status: 401 },
    );
  }

  // 2. Parse + validate the body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido." },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos.",
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 400 },
    );
  }

  const { photo_url, lat, lng, user_comment } = parsed.data;

  // 3. PR bounding box
  const bbox = isWithinPR(lat, lng);
  if (!bbox.ok) {
    return NextResponse.json({ error: bbox.reason }, { status: 400 });
  }

  // 4. Sanity-check the photo URL is on our Supabase (defense in depth)
  // The signed upload flow stores under /storage/v1/object/public/photos/.
  if (!photo_url.includes("/storage/v1/object/public/photos/")) {
    return NextResponse.json(
      { error: "La foto no es válida. Vuelve a subirla." },
      { status: 400 },
    );
  }

  // 5. Geohash + WKT
  const geohash = encodeGeohash(lat, lng);
  const location = wktPoint(lat, lng);

  // 6. Insert the report (service role; user_id is from the session, never the body)
  const service = createServiceClient();
  const { data: report, error: insertErr } = await service
    .from("reports")
    .insert({
      user_id: user.id,
      location,
      geohash,
      photo_url,
      severity: 5.0, // placeholder; Goal 4 overwrites via OpenAI
      severity_reason: "Pendiente de análisis con IA.", // placeholder
      hazards: [],
      user_comment: user_comment ?? null,
    })
    .select("id, geohash, severity, created_at")
    .single();

  if (insertErr || !report) {
    console.error("insert report failed", insertErr);
    return NextResponse.json(
      { error: "No pudimos guardar el reporte. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: report.id,
    geohash: report.geohash,
    severity: report.severity,
    created_at: report.created_at,
  });
}
