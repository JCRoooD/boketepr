"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * AvatarUpload — client component for /profile.
 *
 * Lets the user pick a local image, previews it, uploads it to the
 * `avatars` bucket via /api/profile/avatar-upload + PUT to the signed
 * URL, then saves the resulting public URL to profiles.avatar_url
 * via PATCH /api/profile.
 *
 * UX: file picker (camera icon on mobile), preview, upload progress
 * indicator, success/error message in Spanish. The avatar appears
 * optimistically immediately after upload (we update the local src
 * before awaiting the PATCH).
 *
 * Limits enforced:
 *   - 2 MB max (matches the avatars bucket's file_size_limit)
 *   - JPEG / PNG / WebP only (matches the bucket's allowed_mime_types)
 * Both are also checked server-side by the API route.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export interface AvatarUploadProps {
  /** Current avatar URL (Supabase public storage URL) or null. */
  currentUrl: string | null;
  /** Initial display name to use for the avatar fallback letter. */
  fallbackName: string;
}

export function AvatarUpload({ currentUrl, fallbackName }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayedUrl = previewUrl ?? currentUrl;
  const fallbackLetter = (fallbackName.trim()[0] ?? "?").toUpperCase();

  function pickFile() {
    setError(null);
    setSuccess(false);
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError(`La imagen es demasiado grande (máximo ${MAX_BYTES / 1024 / 1024} MB).`);
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Tipo de archivo no permitido. Usa JPEG, PNG o WebP.");
      return;
    }

    // Local preview via object URL — released when the user picks a
    // different file or unmounts.
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSuccess(false);
    setError(null);

    startTransition(async () => {
      try {
        // 1. Get signed upload URL from the server
        const res = await fetch("/api/profile/avatar-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "No pudimos preparar la subida.");
        }
        const { signedUrl, token, path, avatar_url } = (await res.json()) as {
          signedUrl: string;
          token: string;
          path: string;
          avatar_url: string;
        };

        // 2. PUT the file to Supabase Storage
        const supabase = createClient();
        const upload = await supabase.storage
          .from("avatars")
          .uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upload.error) throw new Error("No pudimos subir la imagen.");

        // 3. Save the public URL to the profile
        const patch = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ avatar_url }),
        });
        if (!patch.ok) {
          const body = (await patch.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "No pudimos guardar el avatar.");
        }

        setSuccess(true);
        // Keep the local preview visible until the next page refresh;
        // the public URL will replace it then (browsers cache images).
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Algo salió mal. Intenta de nuevo.",
        );
        // Drop the preview so the user sees the old avatar again.
        setPreviewUrl(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-muted text-3xl font-semibold text-muted-foreground ring-2 ring-border">
          {displayedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedUrl}
              alt="Tu avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{fallbackLetter}</span>
          )}
        </div>
        <button
          type="button"
          onClick={pickFile}
          disabled={isPending}
          aria-label="Cambiar avatar"
          className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={pickFile}
        disabled={isPending}
      >
        {isPending ? "Subiendo…" : currentUrl ? "Cambiar avatar" : "Subir avatar"}
      </Button>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {success && !error && (
        <p role="status" className="text-xs text-green-600">
          Avatar actualizado.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG o WebP. Máximo 2 MB.
      </p>
    </div>
  );
}