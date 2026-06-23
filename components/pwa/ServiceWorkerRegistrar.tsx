"use client";

/**
 * Tiny client component that registers `/sw.js` once on mount.
 *
 * Why a separate component instead of an inline `<script>`:
 *   - We want strict-mode-safe registration (the effect runs twice in dev;
 *     registering twice is harmless but noisy).
 *   - We need to skip registration in dev (HMR + service workers fight each
 *     other and cache stale chunks — same complaint every Next.js project has).
 *
 * Production-only: import.meta.env.PROD is the same flag Vercel uses to decide
 * what to bundle.
 */

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => {
          console.warn("[boketepr] SW registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }
  }, []);

  return null;
}