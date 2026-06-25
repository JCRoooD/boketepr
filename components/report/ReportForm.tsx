"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { LocationInput, type LocationValue } from "@/components/report/LocationInput";
import { NearbyReports } from "@/components/report/NearbyReports";
import { PhotoInput } from "@/components/report/PhotoInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { severityStyle } from "@/lib/reports/severity";
import { hazardLabels } from "@/lib/reports/hazard-labels";
import { createClient } from "@/lib/supabase/client";

/**
 * ReportForm — Goal 3 (submit) + Goal 4 (AI severity scoring).
 *
 * Flow:
 *   1. User picks a photo
 *   2. User confirms location (Browser Geolocation API or manual lat/lng)
 *   3. User optionally writes a one-line comment
 *   4. On submit:
 *      a. POST /api/upload → get signed URL + publicUrl
 *      b. supabase.storage.uploadToSignedUrl(...)
 *      c. POST /api/reports → server validates, inserts, calls OpenAI Vision,
 *         updates the row. Client gets the FINAL row back (real severity)
 *         or the placeholder if scoring failed.
 *   5. Show success state with the AI's severity + reason + hazards
 *
 * The button label cycles through "uploading" → "scoring" → success,
 * giving the user feedback during the ~5-10s OpenAI call.
 */
const CommentSchema = z.string().max(280, "Máximo 280 caracteres.");

type SubmitState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "scoring" }
  | { kind: "success"; report: ReportResult }
  | { kind: "error"; message: string };

interface ReportResult {
  id: string;
  severity: number;
  severity_reason: string;
  hazards: string[];
  ai_scored: boolean;
  ai_model_version: string | null;
  score_error: string | null;
}

function severityColor(s: number): {
  bg: string;
  text: string;
  label: string;
} {
  const style = severityStyle(s);
  return {
    bg: style.badgeBg,
    text: style.badgeText,
    label: style.label,
  };
}

export function ReportForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submitting =
    state.kind === "uploading" || state.kind === "scoring";
  const canSubmit =
    !submitting && photo != null && location != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !photo || !location) return;

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

      // 3. Create the report row + run AI scoring on the server.
      //    This call takes ~5-10s while the server talks to OpenAI.
      setState({ kind: "scoring" });
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

      const created = (await reportRes.json()) as ReportResult;
      setState({ kind: "success", report: created });
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.";
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "success") {
    const r = state.report;
    const scored = r.ai_scored;
    const sev = severityColor(r.severity);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            ¡Hoyo reportado!
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {/* Severity badge — the AI's main output */}
          <div
            className={`flex flex-col items-center gap-1 rounded-lg px-6 py-4 ${sev.bg}`}
          >
            <div className={`text-4xl font-bold ${sev.text}`}>
              {r.severity.toFixed(1)} <span className="text-2xl">/ 10</span>
            </div>
            <div className={`text-sm font-semibold uppercase tracking-wide ${sev.text}`}>
              {sev.label}
            </div>
          </div>

          {/* Reason text — the AI's explanation */}
          {scored && r.severity_reason && (
            <p className="text-sm text-foreground">{r.severity_reason}</p>
          )}

          {/* Hazards as tags — prettified from snake_case tokens to Spanish phrases */}
          {scored && r.hazards.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {hazardLabels(r.hazards).map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Model attribution + error fallback */}
          {scored ? (
            <p className="text-xs text-muted-foreground">
              Puntaje asignado por{" "}
              <span className="font-mono">{r.ai_model_version ?? "OpenAI"}</span>
            </p>
          ) : (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
              No pudimos calcular el puntaje con IA en este momento.
              Tu reporte fue guardado y aparecerá en el mapa con un puntaje provisional.
            </div>
          )}

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
        address={location?.address ?? null}
        source={location?.source ?? null}
        onChange={setLocation}
        disabled={submitting}
      />

      <NearbyReports
        lat={location?.lat ?? null}
        lng={location?.lng ?? null}
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
          : state.kind === "scoring"
            ? "Analizando con IA…"
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
