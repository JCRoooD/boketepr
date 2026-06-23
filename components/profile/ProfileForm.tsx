"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * ProfileForm — client component for /profile.
 *
 * Inline edit for the display name. Click "Editar" → input + Save/Cancel
 * buttons → on save, PATCH /api/profile and reload the page so the
 * new name appears everywhere.
 *
 * We use a Route Handler (not a Server Action) because the avatar
 * upload flow already uses /api/profile/avatar-upload, so it's
 * consistent for both fields to share the same /api/profile PATCH.
 */
export interface ProfileFormProps {
  initialDisplayName: string;
}

export function ProfileForm({ initialDisplayName }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialDisplayName);
  const [savedName, setSavedName] = useState(initialDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setError(null);
    setSuccess(false);
    setName(savedName);
    setIsEditing(true);
  }

  function cancel() {
    setIsEditing(false);
    setName(savedName);
    setError(null);
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (trimmed.length > 60) {
      setError("El nombre es demasiado largo (máximo 60 caracteres).");
      return;
    }
    if (trimmed === savedName) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ display_name: trimmed }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "No pudimos guardar el nombre.");
        }
        setSavedName(trimmed);
        setIsEditing(false);
        setSuccess(true);
        // Update the browser tab title + the auth cookie via a server
        // revalidation isn't needed (display name is read on each page
        // load, not from cookie). The topnav reads from getUser()
        // server-side and will pick up the change on next navigation.
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Algo salió mal. Intenta de nuevo.",
        );
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Nombre
          </div>
          <div className="text-base font-medium text-foreground break-words">
            {savedName}
          </div>
          {success && (
            <div className="mt-1 text-xs text-green-600">
              Guardado.
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startEditing}
          disabled={isPending}
        >
          <Pencil className="mr-1.5 size-3.5" />
          Editar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
      <label
        htmlFor="display-name"
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        Nombre
      </label>
      <Input
        id="display-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus
        disabled={isPending}
        aria-invalid={error != null}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1.5 size-3.5" />
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={isPending}
        >
          <X className="mr-1.5 size-3.5" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}