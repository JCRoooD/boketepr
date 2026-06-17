import type { ReportPin } from "@/lib/reports/queries";

/**
 * LocalStorage-backed pin cache for the public map (T5.10).
 *
 * Why: v1 has no offline submit queue, but the plan calls for the
 * last-viewed pins to be readable when the network is down (e.g. on
 * a phone with spotty signal in a remote part of PR). Caching the
 * 500 most recent active reports in localStorage gives us a useful
 * "you've seen these before" offline experience for cheap.
 *
 * Storage shape: { v: 1, pins: ReportPin[] } so we can break the
 * schema later without crashing on stale caches.
 *
 * Size budget: 500 pins × ~500 bytes each ≈ 250 KB. localStorage
 * usually allows 5 MB so we're well under.
 *
 * SSR safety: every read/write is guarded by a `typeof window`
 * check, so importing this from a Server Component is safe.
 *
 * The `subscribe` function lets us use `useSyncExternalStore` to
 * read this cache from a Client Component without triggering the
 * "setState in effect" lint rule.
 */

const CACHE_KEY = "boketepr:pins:v1";
const MAX_CACHED_PINS = 500;

interface CacheShape {
  v: 1;
  pins: ReportPin[];
  /** ISO timestamp of the last write. Useful for the "last updated" UI later. */
  savedAt: string;
}

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const PINS_CACHE_KEY = CACHE_KEY;

export function readCachedPins(): ReportPin[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CacheShape;
    if (parsed.v !== 1 || !Array.isArray(parsed.pins)) return [];
    return parsed.pins;
  } catch {
    return [];
  }
}

export function writeCachedPins(pins: ReportPin[]): void {
  if (!hasWindow()) return;
  try {
    const trimmed = pins.slice(0, MAX_CACHED_PINS);
    const payload: CacheShape = {
      v: 1,
      pins: trimmed,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    // Notify any useSyncExternalStore subscribers that the value
    // changed. We dispatch a storage event manually because the
    // browser only fires `storage` on OTHER tabs, not the one that
    // wrote.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CACHE_KEY,
        newValue: JSON.stringify(payload),
      }),
    );
  } catch {
    // localStorage full, quota exceeded, or private mode — silently
    // skip. We don't want a cache write failure to break the map.
  }
}

export function clearCachedPins(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
    window.dispatchEvent(
      new StorageEvent("storage", { key: CACHE_KEY, newValue: null }),
    );
  } catch {
    // ignore
  }
}

/**
 * Subscribe to changes in the pin cache. Used with
 * useSyncExternalStore so the consuming component re-renders
 * whenever the cache is written (by the same tab, via the manual
 * dispatchEvent above, or by another tab via the native storage
 * event).
 */
export function subscribeToPinsCache(onChange: () => void): () => void {
  if (!hasWindow()) return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === CACHE_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
