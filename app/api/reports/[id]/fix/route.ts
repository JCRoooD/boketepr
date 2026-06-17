import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Goal 5 — T5.8: mark a report as fixed.
 *
 * POST /api/reports/[id]/fix
 *
 * Auth model:
 *   - Must be signed in.
 *   - The signed-in user must be the original reporter of this report.
 *     This is enforced by the RLS policy "reports_update_owner" on
 *     the reports table (auth.uid() = user_id), so we can let the
 *     database do the check.
 *
 * Body: none (the id is in the URL).
 *
 * Side effect: a Realtime UPDATE event fires (Goal 5, T5.5), and the
 * /map page's UPDATE subscription will drop the pin from the live map
 * for everyone who's currently looking at it.
 */
const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = ParamsSchema.parse(await params);

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

  // First read the row to confirm ownership and get the current state.
  // RLS allows anyone to read reports, but for the "is this mine" check
  // we need a single round-trip. (The RLS on UPDATE will still be the
  // final guard.)
  const { data: existing, error: readErr } = await supabase
    .from("reports")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (readErr || !existing) {
    return NextResponse.json(
      { error: "Reporte no encontrado." },
      { status: 404 },
    );
  }

  if (existing.user_id !== user.id) {
    // Be deliberately generic — don't leak whether a different user
    // owns the report.
    return NextResponse.json(
      { error: "Solo quien reportó este hoyo puede marcarlo como reparado." },
      { status: 403 },
    );
  }

  if (existing.status === "fixed") {
    return NextResponse.json(
      { error: "Este hoyo ya fue marcado como reparado." },
      { status: 409 },
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("reports")
    .update({ status: "fixed" })
    .eq("id", id)
    .select("id, status, updated_at")
    .single();

  if (updateErr || !updated) {
    console.error("fix update failed", updateErr);
    return NextResponse.json(
      { error: "No pudimos marcar el hoyo como reparado. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    updated_at: updated.updated_at,
  });
}
