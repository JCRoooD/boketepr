import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/profile
 *
 * Update the signed-in user's `public.profiles` row. Owner-only —
 * enforced by the `profiles_update_self` RLS policy
 * (`auth.uid() = id`).
 *
 * Body: { display_name?: string, avatar_url?: string|null }
 *
 * Returns: the updated profile row.
 *
 * Validation:
 *   - display_name: 1–60 chars, trimmed. Empty string is treated as
 *     "clear it" → NULL.
 *   - avatar_url: must be a Supabase Storage URL pointing to our
 *     `avatars` bucket. This prevents a user from saving a phishing
 *     URL or a URL to a maliciously crafted photo.
 *
 * Why not a Server Action: the avatar upload flow goes client →
 * /api/profile/avatar-upload → PUT to signed URL → PATCH here. Using
 * a Route Handler keeps the same fetch pattern as the rest of the
 * app's API.
 */
const Body = z.object({
  display_name: z
    .string()
    .max(60)
    .transform((s) => s.trim())
    .optional(),
  avatar_url: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional(),
});

function isOurAvatarUrl(url: string): boolean {
  // Must be {NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/{user_id}/...
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/`;
  if (!url.startsWith(prefix)) return false;
  // Path must be the user's own folder — defense in depth.
  const rest = url.slice(prefix.length);
  // {user_id}/... — user_id is a UUID (36 chars with dashes)
  return /^[0-9a-f-]{36}\//.test(rest);
}

export async function PATCH(request: Request) {
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

  // Build the UPDATE object — only include fields the client actually
  // sent. An empty display_name becomes NULL (clear it).
  const update: { display_name?: string | null; avatar_url?: string | null } = {};
  if ("display_name" in parsed.data) {
    const dn = parsed.data.display_name?.trim() ?? "";
    update.display_name = dn === "" ? null : dn;
  }
  if ("avatar_url" in parsed.data) {
    const url = parsed.data.avatar_url ?? null;
    if (url !== null && !isOurAvatarUrl(url)) {
      return NextResponse.json(
        {
          error:
            "La URL del avatar no es válida. Solo se permiten imágenes del bucket de avatares.",
        },
        { status: 400 },
      );
    }
    update.avatar_url = url;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No se envió ningún campo para actualizar." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id, display_name, avatar_url, reports_submitted, created_at")
    .single();

  if (error || !data) {
    console.error("profile update failed", error);
    return NextResponse.json(
      { error: "No pudimos actualizar tu perfil. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}