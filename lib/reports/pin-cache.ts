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

/**
 * Module-level stable empty array. Returned by `getServerSnapshot` (and
 * by `readCachedPins` when there's no cache yet) so that
 * `useSyncExternalStore` always sees the same reference and doesn't
 * trigger an infinite re-render loop.
 *
 * IMPORTANT: callers must not mutate this array. If you need to, copy
 * it first. (No one mutates it today — `readCachedPins` only returns
 * it as a fallback, and the component treats it as read-only.)
 */
export const EMPTY_PINS: readonly ReportPin[] = Object.freeze([]) as readonly ReportPin[];

export const PINS_CACHE_KEY = CACHE_KEY;

// Cache the last read so that repeated calls in the same render cycle
// (or in the React 19 useSyncExternalStore snapshot getter, which gets
// called on every render) get a stable reference. localStorage can
// only change via `writeCachedPins`, which sets `lastWrittenRaw` to
// invalidate this cache.
let lastReadRaw: string | null = null;
let lastReadResult: readonly ReportPin[] = EMPTY_PINS;

export function readCachedPins(): readonly ReportPin[] {
  if (!hasWindow()) return EMPTY_PINS;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    // Same raw value as last time → return the cached parsed result.
    if (raw === lastReadRaw) return lastReadResult;
    lastReadRaw = raw;
    if (!raw) {
      lastReadResult = EMPTY_PINS;
      return lastReadResult;
    }
    const parsed = JSON.parse(raw) as CacheShape;
    lastReadResult = parsed.v === 1 && Array.isArray(parsed.pins) ? parsed.pins : EMPTY_PINS;
    return lastReadResult;
  } catch {
    lastReadRaw = null;
    lastReadResult = EMPTY_PINS;
    return lastReadResult;
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
    const raw = JSON.stringify(payload);
    window.localStorage.setItem(CACHE_KEY, raw);
    // Invalidate the read cache so the next readCachedPins() call
    // re-parses the new value (and returns a new stable reference).
    lastReadRaw = raw;
    lastReadResult = trimmed;
    // Notify any useSyncExternalStore subscribers that the value
    // changed. We dispatch a storage event manually because the
    // browser only fires `storage` on OTHER tabs, not the one that
    // wrote.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CACHE_KEY,
        newValue: raw,
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
