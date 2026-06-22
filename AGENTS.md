<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BoketePR Project Context

A pothole-reporting web app for Puerto Rico. Residents photograph potholes, AI scores them 1.0–10.0 via OpenAI gpt-4o Vision, pins appear on a live map. v1 = submit + view only (authority communication deferred to v2).

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind + shadcn/ui · Supabase (Auth/Postgres+PostGIS/Storage/Realtime) · Vercel · OpenAI gpt-4o-mini Vision · Google Maps JS API (`@vis.gl/react-google-maps`) · Browser Geolocation API · React 19.

Note: the plan called for Next.js 15, but `create-next-app@latest` installed 16.2.9. Heed the framework warning at the top of this file.

## Key paths
- Plan: `C:\Users\juanc\.hermes\plans\2026-06-12_115149-boketepr-web-app.md`
- Local working dir: `C:\Users\juanc\Projects\boketepr`
- GitHub: https://github.com/JCRoooD/boketepr
- Vercel: https://boketepr.vercel.app/ (team: jcrooods-projects)
- Supabase project: `dyeskzwmapznizwgpewa`

## Shipped (v1)

| # | Goal | Status | Highlights |
|---|---|---|---|
| 1 | Auth | done | signup/login/callback via Supabase Auth, Google OAuth |
| 2 | Profiles + RLS | done | `public.profiles` row mirrors each auth user |
| 3 | Submit a hoyo | done | `/submit` → upload to Storage → `reports` row |
| 4 | AI severity scoring | done | gpt-4o-mini, 1-10 score, Spanish reason + hazards, ~2s per call |
| 5 | Public live map | done | `/map` with Google Maps, color-coded pins, real-time updates, "mark as fixed" for owner, shareable `/report/[id]` URLs with OG tags |
| 6 | Places autocomplete | done | "Buscar dirección" on `/submit` — Google Places, PR-only, third option alongside GPS and manual coords |
| 7 | Duplicate detection | done | After location is picked on `/submit`, nearby active reports within 50 m are shown (PostGIS `ST_DWithin` via `find_nearby_reports` RPC). Informative only — submission is never blocked. |

## Key files (Goal 4 + 5 + 6)

Map UI (client):
- `app/(public)/map/page.tsx` — server component, fetches initial 500 active reports
- `components/map/MapView.tsx` — `@vis.gl/react-google-maps`, real-time subs, localStorage cache, `MissingApiKeyScreen` fallback
- `components/map/PinDetailPanel.tsx` — slide-in detail, "Reportar como reparado" (owner only), share button
- `components/map/SeverityPin.tsx` — colored glyph props for `<Pin>`
- `components/map/SeverityLegend.tsx` — bottom-left 4-bucket legend

Map data (shared):
- `lib/reports/queries.ts` — `fetchActiveReports`, `subscribeToNewReports`, `subscribeToReportUpdates`
- `lib/reports/pin-cache.ts` — localStorage cache (versioned, SSR-safe, stable refs for `useSyncExternalStore`)
- `lib/reports/severity.ts` — `bucketFor`, `severityStyle`, `ALL_BUCKETS` (Leve/Moderado/Severo/Peligroso)
- `lib/reports/geohash-decoder.ts` — ngeohash → {lat, lng}
- `lib/geo/pr-bbox.ts`, `lib/geo/geohash.ts` — geo utilities

Goal 4 (AI):
- `lib/openai/{client,prompts,score-pothole,prompts.test}.ts` — gpt-4o-mini wrapper
- `app/api/reports/route.ts` — inserts placeholder, calls `scorePothole()`, updates row

Goal 5 (API):
- `app/api/reports/[id]/fix/route.ts` — mark as fixed (RLS-enforced owner check)
- `app/report/[id]/page.tsx` — shareable standalone URL with OG/Twitter meta

Goal 6 (Places):
- `components/report/LocationInput.tsx` — three modes: GPS / Places / Manual. `LocationValue` type exported.
- `app/globals.css` — `.pac-container` / `.pac-item` styled to match the app, z-index 9999

Goal 7 (Duplicate detection):
- `lib/db/migrations/0005_add_find_nearby_reports_rpc.sql` — `find_nearby_reports(lat, lng, radius_m, max_results)` RPC, `security invoker` so RLS applies, PostGIS `ST_DWithin` + `ST_Distance` on the geography column
- `lib/reports/queries.ts` — `fetchNearbyReports(lat, lng, radiusMeters = DEFAULT_NEARBY_RADIUS_M)` + `NearbyReport` type
- `components/report/NearbyReports.tsx` — debounced fetch (250 ms), amber-tinted card with thumbnails + severity badges + distance + relative date, links to `/report/[id]`

Tests:
- `scripts/e2e-submit.mjs` — full e2e (signup → upload → report → DB check → AI scoring assert)
- `scripts/cleanup-e2e.mjs` — purges e2e test users + rows + storage files
- `scripts/test-score.mjs` — manual smoke test for `scorePothole()`

## Language: Spanish (es_PR dialect)
- All user-facing copy is Spanish, Caribbean dialect (es_PR).
- Use "hoyo" (not "bache") in product text — "bache" has a different colloquial meaning in PR.
- "Bokete" / "BoketePR" is acceptable as the brand name only.
- AI reason text is generated in Spanish.

## Commands
- `npm run dev` — dev server (port 3000)
- `npm run type-check` — `tsc --noEmit`
- `npm run lint`
- `npm run build` — Vercel runs this on every push

## Git workflow
- Commit to `main` → Vercel auto-deploys.
- Never commit `.env.local` (gitignored).
- Commit message format: `type: short description` (feat / chore / fix / test / refactor / docs).

## Env vars
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, in `.env.local` + Vercel
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS. **Never** prefix with `NEXT_PUBLIC_`.
- `OPENAI_API_KEY` — server-only
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — public, used by the map's `APIProvider`. **Must** be prefixed `NEXT_PUBLIC_` (the old `GOOGLE_MAPS_API_KEY` name in old docs is wrong). Restrict the key in Google Cloud Console to `boketepr.vercel.app` + `localhost:3000` for dev. **Goal 6 requires the Places API to be enabled in the same project** — if autocomplete silently fails, that's almost always why.

## Current state (as of last session)
- Build: clean (`tsc --noEmit` passes, `next build` registers all 12 routes)
- Live site: https://boketepr.vercel.app/map returns 200, renders the map (no `MissingApiKeyScreen`)
- DB: **0 reports** in `public.reports` (all e2e test data was cleaned up after the last goal). First real submission via `/submit` will populate the map.
- Storage: 3 public buckets — `photos`, `thumbnails`, `avatars`
- Realtime: enabled for `public.reports` (postgres_changes on INSERT + UPDATE)
- DB RPC: `public.find_nearby_reports(lat, lng, radius_m, max_results)` — added in migration 0005, granted to `anon` + `authenticated`

## Open follow-ups (deferred, not bugs)
- Marking a report "as fixed" via UI is done, but pins don't show a "fixed" badge — they just disappear. Could show a "reparado hace X días" pin in a different color if the user re-opens the report.
- No email confirmation on signup (Supabase Auth default behavior, but no custom email template yet).
- No rate limiting on `/api/reports` — relies on Supabase Storage signed URL TTL + RLS only.
