import { NextResponse } from "next/server";
import { z } from "zod";

import { scorePothole } from "@/lib/openai/score-pothole";
import { encodeGeohash } from "@/lib/geo/geohash";
import { isWithinPR, wktPoint } from "@/lib/geo/pr-bbox";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Goal 4 — AI Severity Scoring.
 *
 * POST /api/reports now does the following in order:
 *   1. Auth check
 *   2. Rate limit (5 reports / 5 min per user) — quick win 1c
 *   3. Parse + zod-validate the body
 *   4. PR bounding box check
 *   5. Sanity-check the photo URL is on our Supabase
 *   6. Geohash + WKT
 *   7. INSERT the report with severity=5.0 placeholder + reason placeholder
 *      (counter trigger fires; client already paid the round-trip cost)
 *   8. Call OpenAI gpt-4o-mini with the photo URL → real score
 *   9. If scoring succeeded: UPDATE the row with real severity / reason /
 *      hazards / ai_model_version / ai_scored_at
 *  10. If scoring failed: keep the placeholder, log the error, return
 *      what we have (severity=5.0, reason="Pendiente de análisis con IA.")
 *  11. Return the final row to the client
 *
 * Why fold scoring into this route (vs a separate /api/score):
 *   - Single client code path
 *   - User pays the wait time once (the form is already a 3-step flow,
 *     an extra 5-8s for AI is acceptable)
 *   - We can fall back to the placeholder on scoring failure without
 *     a complex async/retry dance
 *
 * maxDuration=60s: Vercel hobby default is 10s, which is too tight for
 * the worst-case OpenAI Vision response. 60s is the max for the hobby
 * plan. If the call times out, the placeholder is returned and the row
 * is updated in the background by... well, nothing for v1, but the row
 * has ai_scored_at=NULL so a future re-score job could pick it up.
 */
export const maxDuration = 60;

/**
 * Per-user rate limit on POST /api/reports.
 *
 * The threshold is intentionally generous — a real user submitting the
 * one pothole they drove past today won't notice. The cap exists to
 * stop (a) accidental resubmit loops from the client, (b) someone
 * scripting a flood of reports, (c) someone trying to burn our OpenAI
 * quota by triggering the scoring endpoint rapidly.
 *
 * We back the limit with a count query against `reports` itself rather
 * than a separate `rate_limits` table — the data is already there, no
 * migration, no extra state to coordinate across Vercel serverless
 * instances, and the index `reports_user_id_idx` keeps it cheap at our
 * scale.
 *
 * Window: 5 minutes. The window slides naturally (we count rows with
 * `created_at > now() - 5 min`), so no cleanup is needed — old rows
 * just fall out of the count as time passes.
 */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REPORTS = 5;

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

  // 2. Rate limit (per user). Cheap count query; runs BEFORE body
  //    validation so an attacker can't spam malformed JSON to keep us
  //    busy. `Retry-After` is in seconds (RFC 7231 §7.1.3).
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount, error: countErr } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("created_at", windowStart);

  if (countErr) {
    // Fail OPEN: if the count query errors (transient DB blip), let the
    // submission through. We'd rather accept a borderline-spammy
    // submission than block legitimate users when the system hiccups.
    console.error("rate limit count query failed", countErr);
  } else if ((recentCount ?? 0) >= RATE_LIMIT_MAX_REPORTS) {
    return NextResponse.json(
      {
        error:
          "Demasiados reportes en poco tiempo. Espera un momento antes de enviar otro.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
        },
      },
    );
  }

  // 3. Parse + validate the body
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

  // 4. PR bounding box
  const bbox = isWithinPR(lat, lng);
  if (!bbox.ok) {
    return NextResponse.json({ error: bbox.reason }, { status: 400 });
  }

  // 5. Sanity-check the photo URL is on our Supabase
  if (!photo_url.includes("/storage/v1/object/public/photos/")) {
    return NextResponse.json(
      { error: "La foto no es válida. Vuelve a subirla." },
      { status: 400 },
    );
  }

  // 6. Geohash + WKT
  const geohash = encodeGeohash(lat, lng);
  const location = wktPoint(lat, lng);

  // 7. Insert the report with placeholder severity.
  //    We write lat/lng explicitly here (the trigger would derive them
  //    from `location` if we didn't, but being explicit is cheaper than
  //    relying on the trigger for every insert).
  const service = createServiceClient();
  const { data: inserted, error: insertErr } = await service
    .from("reports")
    .insert({
      user_id: user.id,
      location,
      geohash,
      lat,
      lng,
      photo_url,
      severity: 5.0,
      severity_reason: "Pendiente de análisis con IA.",
      hazards: [],
      user_comment: user_comment ?? null,
    })
    .select("id, geohash, lat, lng, created_at")
    .single();

  if (insertErr || !inserted) {
    console.error("insert report failed", insertErr);
    return NextResponse.json(
      { error: "No pudimos guardar el reporte. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // The mutable row we return at the end. Starts as the placeholder,
  // gets replaced with the AI-scored version if scoring succeeds.
  let result: {
    id: string;
    geohash: string;
    lat: number;
    lng: number;
    severity: number;
    severity_reason: string;
    hazards: string[];
    ai_model_version: string | null;
    ai_scored_at: string | null;
    created_at: string;
  } = {
    id: inserted.id,
    geohash: inserted.geohash,
    lat: inserted.lat,
    lng: inserted.lng,
    severity: 5.0,
    severity_reason: "Pendiente de análisis con IA.",
    hazards: [],
    ai_model_version: null,
    ai_scored_at: null,
    created_at: inserted.created_at,
  };

  // 8. Call OpenAI Vision to score the photo
  let scored = false;
  let scoreError: string | null = null;
  try {
    const score = await scorePothole({
      photoUrl: photo_url,
      lat,
      lng,
      userComment: user_comment ?? null,
    });

    // 9. Update the row with the real score
    const { data: updated, error: updateErr } = await service
      .from("reports")
      .update({
        severity: score.severity,
        severity_reason: score.reason,
        hazards: score.hazards,
        ai_model_version: score.modelVersion,
        ai_scored_at: new Date().toISOString(),
      })
      .eq("id", result.id)
      .select(
        "id, geohash, lat, lng, severity, severity_reason, hazards, ai_model_version, ai_scored_at, created_at",
      )
      .single();

    if (updateErr || !updated) {
      console.error("update with AI score failed", updateErr);
      scoreError = "update_failed";
      // scored stays false → client gets the placeholder
    } else {
      scored = true;
      result = {
        id: updated.id,
        geohash: updated.geohash,
        lat: updated.lat,
        lng: updated.lng,
        severity: updated.severity,
        severity_reason: updated.severity_reason,
        hazards: updated.hazards ?? [],
        ai_model_version: updated.ai_model_version,
        ai_scored_at: updated.ai_scored_at,
        created_at: updated.created_at,
      };
    }
  } catch (err) {
    // 10. OpenAI call failed — keep the placeholder, log, surface
    console.error("AI scoring failed", err);
    scoreError = err instanceof Error ? err.message : "unknown";
  }

  return NextResponse.json({
    id: result.id,
    geohash: result.geohash,
    lat: result.lat,
    lng: result.lng,
    severity: result.severity,
    severity_reason: result.severity_reason,
    hazards: result.hazards,
    ai_scored: scored,
    ai_model_version: result.ai_model_version,
    ai_scored_at: result.ai_scored_at,
    score_error: scoreError,
    created_at: result.created_at,
  });
}
