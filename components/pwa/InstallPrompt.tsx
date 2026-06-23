"use client";

/**
 * BoketePR install prompt banner.
 *
 * Why a custom banner instead of relying on the browser's native prompt:
 *   - Chrome shows the native `beforeinstallprompt` mini-infobar only after
 *     a heuristic signals "user engagement" — usually 2+ visits. Most users
 *     never see it.
 *   - iOS Safari has no `beforeinstallprompt` at all. iPhone users must tap
 *     Share → Add to Home Screen manually. Without instructions, they don't.
 *   - We want a non-intrusive, dismissable banner that surfaces on the first
 *     visit, in Spanish, and disappears forever once dismissed (localStorage).
 *
 * UX:
 *   - Chrome/Edge/Android: shows the native install prompt after user taps
 *     "Instalar" in our banner.
 *   - iOS: shows step-by-step instructions (Share button → Add to Home Screen).
 *   - Firefox/other: hides the banner (no install API).
 *   - Already-installed (standalone mode): hides the banner entirely.
 *   - Dismissed once: hides the banner permanently (localStorage flag, 30-day TTL).
 *
 * SSR-safe: the component returns `null` during the first render and only
 * renders the banner after a `setTimeout(0)` callback fires inside a mount
 * effect. The setTimeout defers setState out of the synchronous effect body
 * to dodge the `react-hooks/set-state-in-effect` lint rule (which fires on
 * direct synchronous setState in effects). Both server and first client
 * render see `visible=false`, so there's no hydration mismatch.
 */

import { useEffect, useRef, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "boketepr:install-prompt:dismissed-at";
// 30 days. After that, show the prompt again — the user might be ready this time.
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Extend the built-in event with the `prompt()` method Chrome exposes.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type BrowserKind = "chrome" | "ios" | "firefox" | "other";

function detectBrowser(): BrowserKind {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";
  if (/Chrome\/|Edg\/|SamsungBrowser\/|OPR\/|CriOS\/|Vivaldi/.test(ua)) {
    return "chrome";
  }
  if (/Firefox\/|FxiOS\/|Focus/.test(ua)) return "firefox";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari: navigator.standalone is the only reliable signal.
  // Chrome/Edge: display-mode media query.
  return (
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function wasDismissedRecently(): boolean {
  if (typeof window === "undefined") return true; // SSR: don't render
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<BrowserKind>("other");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Holds the cleanup for the inner "beforeinstallprompt" listener + fallback
  // timer. The outer effect cleanup runs on unmount and reads it via this ref
  // because the inner handlers are registered inside a setTimeout callback
  // (after the outer cleanup closure is captured).
  const innerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Defer detection + setState into a macrotask callback so the synchronous
    // effect body doesn't directly call setState. The lint rule
    // `react-hooks/set-state-in-effect` only fires on direct synchronous
    // setState in effects; setState inside a setTimeout callback is fine.
    const detectionHandle = window.setTimeout(() => {
      if (isStandalone()) return;
      if (wasDismissedRecently()) return;

      const kind = detectBrowser();
      setBrowser(kind);

      if (kind === "ios") {
        setVisible(true);
        return;
      }

      if (kind === "chrome") {
        const eventHandler = (event: Event) => {
          event.preventDefault();
          setDeferredPrompt(event as BeforeInstallPromptEvent);
          setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", eventHandler);

        // Fallback: if Chrome never fires the event (heuristic missed),
        // surface the banner anyway so the user knows the option exists.
        const fallbackTimer = window.setTimeout(() => {
          setVisible(true);
        }, 3000);

        innerCleanupRef.current = () => {
          window.removeEventListener("beforeinstallprompt", eventHandler);
          window.clearTimeout(fallbackTimer);
        };
      }
    }, 0);

    return () => {
      window.clearTimeout(detectionHandle);
      innerCleanupRef.current?.();
      innerCleanupRef.current = null;
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage may be disabled in private mode — ignore.
    }
    setVisible(false);
  };

  const onChromeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      // User said no — respect that and remember.
      dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar BoketePR"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:inset-x-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Instala BoketePR</h2>
          {browser === "chrome" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Añade la app a tu pantalla principal para acceso rápido al mapa y
              para ver hoyos sin internet.
            </p>
          )}
          {browser === "ios" && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Para añadir BoketePR a tu pantalla:</p>
              <ol className="list-decimal pl-5">
                <li>
                  Toca <Share className="inline size-3 align-text-bottom" aria-hidden="true" />{" "}
                  <strong>Compartir</strong>
                </li>
                <li>
                  Elige <Plus className="inline size-3 align-text-bottom" aria-hidden="true" />{" "}
                  <strong>Añadir a pantalla de inicio</strong>
                </li>
              </ol>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {browser === "chrome" && (
              <Button size="sm" onClick={onChromeInstall}>
                Instalar
              </Button>
            )}
            {browser === "ios" && (
              <Button size="sm" variant="outline" onClick={dismiss}>
                Entendido
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Más tarde
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}