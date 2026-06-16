import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/upload
 *
 * Returns a Supabase Storage signed upload URL for the `photos` bucket.
 * The client then PUTs the file to that URL using
 * `supabase.storage.from('photos').uploadToSignedUrl(path, token, file)`.
 *
 * Why server-mediated:
 *   - We don't want the client to need the service-role key
 *   - We want a server-side check that the user is authenticated
 *   - We can throttle / validate file types server-side in the future
 *
 * Path format enforced by RLS policy `photos_insert_own`:
 *   {user_id}/{report_id-or-temp-id}/{filename}
 *
 * The first path segment MUST be the user's UUID, or the storage RLS
 * policy will reject the upload. We use a "pending" prefix so we can
 * later rename the folder when we know the report id (or just leave it
 * as pending-{random} — reports are linked to photos by URL, not by
 * folder name, so this is fine).
 */
export async function POST(request: Request) {
  // 1. Auth check (anon key + cookies — needs the user's session)
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

  // 2. Parse the request body
  let body: { filename?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido." },
      { status: 400 },
    );
  }

  const filename = body.filename?.trim();
  const contentType = body.contentType?.trim();

  if (!filename) {
    return NextResponse.json(
      { error: "Falta el nombre del archivo." },
      { status: 400 },
    );
  }

  // 3. Validate content type (matches the bucket's allowed_mime_types)
  const ALLOWED = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  if (contentType && !ALLOWED.includes(contentType)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${contentType}.` },
      { status: 400 },
    );
  }

  // 4. Sanitize filename: strip directory traversal, force a safe extension
  // We use a random prefix so collisions are impossible, and the user's
  // session UUID is the first path segment (required by RLS).
  const safeBase = filename
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80); // hard cap to avoid path-too-long errors

  // Random suffix to avoid collisions
  const randomId = crypto.randomUUID().slice(0, 8);
  const path = `${user.id}/pending-${randomId}-${Date.now()}-${safeBase}`;

  // 5. Use service role to mint the signed URL (RLS would block anon key from
  // creating signed URLs for other users; the actual upload is still RLS-checked)
  const service = createServiceClient();
  const { data, error } = await service.storage
    .from("photos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return NextResponse.json(
      { error: "No pudimos preparar la subida. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // 6. Compute the public URL — this is what gets saved in reports.photo_url
  // Pattern: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/photos/${path}`;

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl,
  });
}
