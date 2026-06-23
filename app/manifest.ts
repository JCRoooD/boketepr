import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest for BoketePR.
 *
 * Why this lives at `app/manifest.ts` (not `public/manifest.json`):
 *   Next.js 16 App Router treats `app/manifest.{ts,js,json,webmanifest}` as a
 *   special metadata file convention. The framework emits a `<link rel="manifest">`
 *   tag automatically and serves the file at `/manifest.webmanifest` with the
 *   correct content-type. Static `public/manifest.json` works too, but the
 *   generated-from-code version lets us reference icon paths that survive
 *   move/rename refactors.
 *
 * Why `start_url: "/map"`:
 *   The map is the v1 primary destination. If a user installs the app and then
 *   opens it from their home screen, sending them to `/map` (not the landing
 *   page) is what they actually want — they already know what the app does.
 *
 * Why `scope: "/"`:
 *   We want every route (`/map`, `/submit`, `/profile`, `/report/[id]`) to be
 *   reachable inside the installed PWA. A narrower scope would break deep links.
 *
 * Icons:
 *   - icon-192 + icon-512:  Chrome's install dialog, "Add to Home screen" prompt
 *   - icon-maskable:        Android launcher (circle/squircle masked variants)
 *   - apple-touch-icon:     iOS Safari "Add to Home Screen" — referenced via
 *                           `<link rel="apple-touch-icon">` in layout.tsx
 *                           (Apple doesn't read the manifest for this)
 *
 * `lang: "es-PR"` matches `app/layout.tsx` (`<html lang="es-PR">`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BoketePR — Reporta los hoyos de Puerto Rico",
    short_name: "BoketePR",
    description:
      "Reporta los hoyos de Puerto Rico con una foto y tu ubicación. Nuestra IA los clasifica para que las autoridades sepan cuáles arreglar primero.",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es-PR",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    categories: ["utilities", "government", "navigation"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}