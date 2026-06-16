"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PhotoInput
 *
 * Hidden <input type="file" accept="image/*" capture="environment"> driven
 * by a visible button. The `capture` attribute hints mobile browsers to
 * open the rear camera directly (vs the photo library).
 *
 * Props:
 *   - value: File | null
 *   - onChange: (file: File | null) => void
 *   - disabled?: boolean
 *
 * The parent owns the File — PhotoInput is a controlled component.
 */
export function PhotoInput({
  value,
  onChange,
  disabled,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive the preview URL from the current File. useMemo recomputes only
  // when `value` changes; the cleanup useEffect revokes the previous URL
  // before the next render. (useMemo for object URLs is the recommended
  // pattern — see https://react.dev/reference/react/useMemo)
  const previewUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium leading-none">
        Foto del hoyo
      </label>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista previa de la foto del hoyo"
            className="aspect-[4/3] w-full object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute right-2 top-2 rounded-full"
            aria-label="Quitar foto"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Camera className="size-8" aria-hidden="true" />
          <span className="text-sm font-medium">Toma una foto o sube una imagen</span>
          <span className="text-xs">JPG, PNG, WebP, HEIC · hasta 10 MB</span>
        </button>
      )}

      {previewUrl && (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Camera className="mr-2 size-4" />
          Cambiar foto
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          // Allow re-selecting the same file: clear the input value first
          e.target.value = "";
          onChange(file);
        }}
      />
    </div>
  );
}
