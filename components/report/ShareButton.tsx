"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  /** The shareable path (e.g. "/report/abc123"). We prepend `window.location.origin` at click time so the absolute URL is always correct for the current host (prod, preview, localhost). */
  path: string;
  /** Title for the share sheet (becomes WhatsApp message subject on Android, etc.). */
  title: string;
  /** Body text for the share sheet (pre-fills WhatsApp/Twitter/etc. message). */
  text: string;
}

/**
 * Share button for the /report/[id] standalone page.
 *
 * UX:
 *  - On mobile: opens the native share sheet (Web Share API) so the user can
 *    pick WhatsApp / Messages / Instagram / Twitter / etc. in one tap.
 *  - On desktop (or browsers without `navigator.share`): copies the URL to
 *    the clipboard and flashes a "¡Copiado!" confirmation.
 *  - Insecure-context fallback (`navigator.clipboard` requires HTTPS or
 *    localhost): uses a hidden `<textarea>` + `document.execCommand("copy")`
 *    so it still works on local dev over plain HTTP.
 *
 * State:
 *  - "idle"      → label "Compartir", Share2 icon
 *  - "copied"    → label "¡Copiado!", Check icon (reverts after 2s)
 *  - "error"     → label "No se pudo copiar", Share2 icon (reverts after 2s)
 */
export function ShareButton({ path, title, text }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleClick() {
    // Derive the absolute URL at click time so it works on any host
    // (prod, Vercel preview, localhost, custom domain).
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;

    // 1. Try native share first — works on Android Chrome, iOS Safari,
    //    and recent desktop browsers (Chrome 89+, Edge 93+, Safari 12.1+).
    if (
      typeof navigator !== "undefined" &&
      "share" in navigator &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ url, title, text });
        return; // user picked an app or cancelled — either way, done
      } catch (err) {
        // AbortError = user dismissed the sheet. That's not an error worth
        // showing — just bail out, keep the button in idle state.
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }
        // Any other share failure (e.g. NotAllowedError, browser bug) →
        // fall through to clipboard.
      }
    }

    // 2. Clipboard fallback.
    const ok = await copyToClipboard(url);
    setStatus(ok ? "copied" : "error");
    setTimeout(() => setStatus("idle"), 2000);
  }

  const label =
    status === "copied"
      ? "¡Copiado!"
      : status === "error"
        ? "No se pudo copiar"
        : "Compartir";

  const Icon = status === "copied" ? Check : Share2;

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={handleClick}
      className="w-full sm:w-auto"
      aria-live="polite"
    >
      <Icon className="mr-2 size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

/**
 * Write `text` to the clipboard. Returns true on success, false on failure.
 *
 * Two paths:
 *  - Modern: `navigator.clipboard.writeText` (async, requires HTTPS or
 *    localhost, requires user gesture — which we have via the click).
 *  - Legacy: hidden `<textarea>` + `document.execCommand("copy")`. Works
 *    on plain HTTP and in older browsers. Deprecated but still the only
 *    option for `localhost` dev without TLS.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Hide off-screen so it doesn't flicker. `readonly` keeps mobile
    // keyboards from popping up when the textarea is briefly focused.
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}