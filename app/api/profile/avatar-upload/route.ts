import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/profile/avatar-upload
 *
 * Returns a Supabase Storage signed upload URL for the `avatars`
 * bucket, plus a public URL for the file once uploaded.
 *
 * The avatar lives at `{user_id}/avatar-{random}.{ext}` so the user's
 * folder is the first path segment (required by the
 * `avatars_insert_own` storage RLS policy). The first call to this
 * route also removes the user's previous avatar (if any), so replacing
 * an avatar doesn't leave orphaned files in the bucket.
 *
 * Why server-mediated:
 *   - We need to delete the user's old avatar before minting the new
 *     signed URL; we use the service role key (the client doesn't
 *     have DELETE permission on storage.objects by default).
 *   - We validate the content type and size limit server-side so a
 *     malicious client can't upload an arbitrary file.
 *   - The actual PUT is still gated by RLS (the signed URL only lets
 *     the user write to their own folder).
 *
 * Body: { filename: string, contentType: string }
 * Returns: { path, token, signedUrl, publicUrl, avatar_url }
 */
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches bucket's file_size_limit

export async function POST(request: Request) {
  // 1. Auth check (anon key + cookies)
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
  let body: { filename?: string; contentType?: string; size?: number };
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
  const size = body.size;

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Falta el nombre o tipo del archivo." },
      { status: 400 },
    );
  }

  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json(
      {
        error: `Tipo de archivo no permitido. Usa JPEG, PNG o WebP.`,
      },
      { status: 400 },
    );
  }

  if (typeof size === "number" && size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `La imagen es demasiado grande (máximo ${MAX_BYTES / 1024 / 1024} MB).`,
      },
      { status: 400 },
    );
  }

  // 3. Compute extension from MIME type — never trust the filename's extension.
  const ext = contentType === "image/jpeg" ? "jpg"
    : contentType === "image/png" ? "png"
    : "webp";

  // 4. Delete the user's old avatar (if any) so the bucket doesn't fill up
  //    with orphaned files on every replace. Storage RLS doesn't grant
  //    DELETE on avatars by default — service role bypasses RLS.
  const service = createServiceClient();
  const { data: existingFiles } = await service.storage
    .from("avatars")
    .list(user.id, { limit: 100 });
  if (existingFiles && existingFiles.length > 0) {
    const paths = existingFiles.map((f) => `${user.id}/${f.name}`);
    await service.storage.from("avatars").remove(paths);
  }

  // 5. Mint a signed upload URL for the new file. Random suffix so two
  //    concurrent uploads can't collide (the signed URL only lets the
  //    user write to their own folder, but the random suffix also
  //    makes the URL unguessable).
  const randomId = crypto.randomUUID().slice(0, 8);
  const path = `${user.id}/avatar-${randomId}-${Date.now()}.${ext}`;

  const { data, error } = await service.storage
    .from("avatars")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return NextResponse.json(
      { error: "No pudimos preparar la subida. Intenta de nuevo." },
      { status: 500 },
    );
  }

  // 6. Compute the public URL — what gets saved to profiles.avatar_url
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avatar_url = `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    avatar_url,
  });
}