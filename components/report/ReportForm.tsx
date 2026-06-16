"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { LocationInput } from "@/components/report/LocationInput";
import { PhotoInput } from "@/components/report/PhotoInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * ReportForm — Goal 3 (submit, no AI yet).
 *
 * Flow:
 *   1. User picks a photo
 *   2. User confirms location (Browser Geolocation API or manual lat/lng)
 *   3. User optionally writes a one-line comment
 *   4. On submit:
 *      a. POST /api/upload → get signed URL + publicUrl
 *      b. supabase.storage.uploadToSignedUrl(...)
 *      c. POST /api/reports → server validates + inserts
 *   5. Show success state with link to /map
 *
 * Note: we deliberately don't use react-hook-form here. The form has 4
 * fields (photo, lat, lng, comment) and the photo + location are non-text
 * state that doesn't play well with RHF's Controller. Plain useState is
 * clearer for this size. If the form grows, swap in RHF + zod.
 */
const CommentSchema = z.string().max(280, "Máximo 280 caracteres.");

type SubmitState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "saving" }
  | { kind: "success"; reportId: string }
  | { kind: "error"; message: string };

export function ReportForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    source: "gps" | "manual";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submitting = state.kind === "uploading" || state.kind === "saving";
  const canSubmit =
    !submitting && photo != null && location != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !photo || !location) return;

    // Validate comment client-side (server re-validates too)
    const commentParse = CommentSchema.safeParse(comment);
    if (!commentParse.success) {
      setCommentError(commentParse.error.issues[0]?.message ?? "Inválido.");
      return;
    }
    setCommentError(null);

    try {
      // 1. Get a signed upload URL
      setState({ kind: "uploading" });
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: photo.name,
          contentType: photo.type,
        }),
      });

      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "No pudimos preparar la subida.");
      }

      const signed = (await uploadRes.json()) as {
        path: string;
        token: string;
        signedUrl: string;
        publicUrl: string;
      };

      // 2. Upload the file to Supabase Storage via the signed URL
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("photos")
        .uploadToSignedUrl(signed.path, signed.token, photo, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadErr) {
        console.error("uploadToSignedUrl failed", uploadErr);
        throw new Error("No pudimos subir la foto. Intenta de nuevo.");
      }

      // 3. Create the report row
      setState({ kind: "saving" });
      const reportRes = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photo_url: signed.publicUrl,
          lat: location.lat,
          lng: location.lng,
          user_comment: comment.trim() ? comment.trim() : null,
        }),
      });

      if (!reportRes.ok) {
        const body = (await reportRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "No pudimos guardar el reporte.");
      }

      const created = (await reportRes.json()) as { id: string };
      setState({ kind: "success", reportId: created.id });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.";
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            ¡Hoyo reportado!
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">
            Tu reporte fue enviado. Lo verás en el mapa en unos minutos.
          </p>
          <p className="text-xs text-muted-foreground">
            (El puntaje de severidad se asigna automáticamente cuando
            activemos el análisis con IA en la próxima versión.)
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => router.push("/map")}>Ver el mapa</Button>
            <Button
              variant="outline"
              onClick={() => {
                setState({ kind: "idle" });
                setPhoto(null);
                setLocation(null);
                setComment("");
              }}
            >
              Reportar otro hoyo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <PhotoInput
        value={photo}
        onChange={setPhoto}
        disabled={submitting}
      />

      <LocationInput
        lat={location?.lat ?? null}
        lng={location?.lng ?? null}
        onChange={setLocation}
        disabled={submitting}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user_comment" className="text-sm font-medium">
          Comentario (opcional)
        </Label>
        <Input
          id="user_comment"
          name="user_comment"
          type="text"
          maxLength={280}
          placeholder="Algo que ayude a identificar el hoyo…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={submitting}
        />
        {commentError && (
          <p className="text-xs text-destructive">{commentError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {comment.length}/280 caracteres
        </p>
      </div>

      {state.kind === "error" && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit}
        aria-busy={submitting}
      >
        {state.kind === "uploading"
          ? "Subiendo foto…"
          : state.kind === "saving"
            ? "Guardando reporte…"
            : "Enviar reporte"}
      </Button>

      {!canSubmit && state.kind === "idle" && (
        <p className="text-center text-xs text-muted-foreground">
          {!photo
            ? "Sube una foto para continuar."
            : !location
              ? "Confirma la ubicación para continuar."
              : ""}
        </p>
      )}
    </form>
  );
}
