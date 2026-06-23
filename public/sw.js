/* BoketePR service worker — v1
 *
 * What it does:
 *   1. Caches the app shell (root HTML, manifest, icons, offline fallback)
 *   2. Network-first for navigations with cache fallback so the map page loads
 *      when the network is flaky
 *   3. Stale-while-revalidate for same-origin static assets (Next.js chunks,
 *      images under /_next/image) so repeat visits feel instant
 *   4. Pass-through for everything else (Supabase API, Google Maps, OpenAI) —
 *      we don't want to serve stale auth/data responses
 *
 * What it deliberately does NOT do:
 *   - Cache the /api/reports POST or anything auth-sensitive
 *   - Cache the live map data feed (Supabase Realtime over WS is bypassed; the
 *     /map page does its own client-side subscribeToNewReports on top of the
 *     server-rendered initial fetch, which we don't cache anyway)
 *   - Background-sync a queued report. v1 has no offline-submit queue.
 *
 * Update model:
 *   On activation we delete the previous cache version so old assets don't
 *   haunt users between deploys. The CACHE_VERSION constant is what you bump
 *   when you want to force a full reset (e.g. shell redesign).
 */

const CACHE_VERSION = "boketepr-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/map",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.png",
  "/icons/apple-touch-icon.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Add each individually so one 404 doesn't fail the whole install.
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[sw] failed to pre-cache", url, err);
          }),
        ),
      );
      // Activate the new SW immediately, don't wait for old tabs to close.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) return caches.delete(key);
          return null;
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass: Supabase, Google Maps, OpenAI, Vercel Analytics, anything cross-origin
  // we don't want to interfere with.
  if (url.origin !== self.location.origin) return;

  // Bypass: API routes. Never cache auth/data responses.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first, fall back to cached shell, fall back to
  // /offline page if even the cache misses.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          // Update the cache with the fresh response so the offline fallback
          // stays current with the next deploy's HTML.
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, network.clone()).catch(() => {});
          return network;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })(),
    );
    return;
  }

  // Everything else: just pass through.
});