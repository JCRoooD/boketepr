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
| 8 | Fixed-pin visibility | done | Migration 0007 adds `reports.fixed_at`. The /map fetches `status='active' OR fixed_at > now()-30d`. Fixed pins render as a green check (SeverityPin.fixedPinElementProps) instead of vanishing. PinDetailPanel shows "Reparado hace X días" and hides severity/hazards/mark-fixed for fixed pins. |
| 9 | Rate limit on submit | done | POST /api/reports allows 5 submissions per 5-minute window per user. Counted against the `reports` table itself (no separate rate_limits table). Returns 429 + `Retry-After: 300` + Spanish message. Fails open on count-query errors. |
| 10 | User Profile full | done | `/profile` rewrite: avatar upload (`avatars` bucket, deletes old on replace), edit display name (inline form), stats card (total + active vs fixed + severity buckets), report history list (most recent 20, with thumbnails + status badges + links to `/report/[id]`). New routes: `PATCH /api/profile`, `POST /api/profile/avatar-upload`. |
| 11 | PWA (install + offline) | done | Installable on Android/Chrome (via `beforeinstallprompt`) and iOS Safari (manual Share → Add to Home Screen, with Spanish instructions). Service worker caches the app shell + `/offline` fallback page. Network-first for navigations, stale-while-revalidate for `/_next/*` + `/icons/*`. No offline-submit queue (v1 explicitly didn't promise one). |
| 12 | OG image for /report/[id] | done | Dynamic `opengraph-image.tsx` (Next.js 16 file convention) generates a 1200x630 PNG per report via `next/og` ImageResponse. Single-column typographic card (Geist Regular + Satori): BoketePR brand + optional "Reparado hace X" pill + colored severity badge (score + bucket label) + Spanish reason (truncated to 180 chars) + lat/lng + relative time. The page's `generateMetadata` no longer sets `images` (the colocal file generates the OG tags automatically). Fallback card for missing/deleted IDs. |
| 13 | Spanish copy review | done | Hazards render as Spanish phrases ("Tráfico alto"), not snake_case tokens — `lib/reports/hazard-labels.ts` maps canonical tokens to user-facing labels with accents, with a Spanish-title-case prettify fallback for unknown tokens. AI prompt (`HAZARD_VOCABULARY_HINT`) suggests Spanish phrases instead of snake_case. Code-side guardrail at `lib/copy/invariants.test.ts` bans `bache`/`hueco` in user-facing source and asserts canonical labels stay in sync. The user (native `es_PR` speaker) reviewed the live app and signed off — the guardrails are the safety net, not a substitute for review. 25 node:test assertions across `hazard-labels.test.ts`, `invariants.test.ts`, `prompts.test.ts`. |

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
- `lib/db/migrations/0006_fix_find_nearby_reports_param_shadow.sql` — **important**: renames the IN params to `in_lat`/`in_lng`/`in_radius_m`/`in_max_results` to avoid the Postgres RETURNS TABLE shadow trap (OUT columns of the same name shadow IN params inside the function body). Without this, migration 0005 was broken: `distance_m` always returned 0 and `ST_DWithin` ignored the radius. **Postgres refuses to rename IN params via `CREATE OR REPLACE`** (it preserves `proargnames` for callers that reference params by name), so this migration starts with `DROP FUNCTION IF EXISTS` followed by a fresh `CREATE OR REPLACE`.
- `lib/reports/queries.ts` — `fetchNearbyReports(lat, lng, radiusMeters = DEFAULT_NEARBY_RADIUS_M)` + `NearbyReport` type
- `components/report/NearbyReports.tsx` — debounced fetch (250 ms), amber-tinted card with thumbnails + severity badges + distance + relative date, links to `/report/[id]`

Goal 8 (Fixed-pin visibility — migration 0007):
- `lib/db/migrations/0007_add_reports_fixed_at.sql` — `reports.fixed_at timestamptz NULL`, backfills existing fixed rows from `updated_at`, partial index `reports_fixed_at_idx` (DESC, WHERE status='fixed') for the recent-fixed fetch branch
- `lib/reports/queries.ts` — adds `fixed_at` to `ReportPin`, `isRecentlyFixed(pin)` helper, `FIXED_PIN_LIFETIME_MS = 30 days`. `fetchActiveReports` switches from `status=active` to `.or("status.eq.active,fixed_at.gt.<cutoff>")` so recently-fixed pins show up
- `components/map/SeverityPin.tsx` — `fixedPinElementProps()` returns a green pin with a `✓` glyph instead of the severity number
- `components/map/MapView.tsx` — `visiblePins` filter drops fixed pins past the 30-day window (in-session analogue of the server filter). `setNow()` ticks every 60s so the window stays accurate while the tab is open. Realtime UPDATE handler keeps the row instead of dropping it.
- `components/map/PinDetailPanel.tsx` — fixed-pin banner ("Reparado hace X días"), hides severity badge / hazards / mark-fixed action
- `app/api/reports/[id]/fix/route.ts` — sets `fixed_at = now()` in the same UPDATE that flips status
- `lib/reports/relative-time.ts` — pure helper for "hace X min/h/días/meses/años" used in the panel banner
- `lib/reports/pin-cache.ts` — bumped `boketepr:pins:v1` → `:v2` (ReportPin shape includes `fixed_at`; old caches discarded cleanly)

Goal 9 (Rate limit on submit):
- `app/api/reports/route.ts` — step 2 of POST is a count query (`select count(*) where user_id = :user and created_at > now() - 5 min`), `>= 5` → 429 + `Retry-After: 300`. Fails open on count-query errors.

Goal 10 (User Profile full):
- `app/(auth)/profile/page.tsx` — server component, composes AvatarUpload + ProfileForm + StatsCard + report history list (most recent 20 reports). Loads profile row + stats + history in parallel via `Promise.all`.
- `app/api/profile/route.ts` — PATCH `/api/profile`, validates display_name (≤60 chars) + avatar_url (must be on our `avatars` bucket via a `isOurAvatarUrl` check — defense against off-bucket URL injection). RLS owner-only via `profiles_update_self` policy.
- `app/api/profile/avatar-upload/route.ts` — POST `/api/profile/avatar-upload`, returns a signed upload URL for the `avatars` bucket and deletes the user's old avatar (via service role) so the bucket doesn't fill up with orphans. Validates content type + size server-side.
- `components/profile/AvatarUpload.tsx` — client component, file picker + camera icon button + local preview via `URL.createObjectURL` + upload progress. 2 MB / JPEG/PNG/WebP limits enforced both client and server side.
- `components/profile/ProfileForm.tsx` — client component, inline edit-in-place for display name. Calls PATCH `/api/profile` and updates local state on success.
- `components/profile/StatsCard.tsx` — server component, renders total + active/fixed/reparado counts + a per-bucket severity breakdown that hides empty rows.
- `components/profile/ReportListItem.tsx` — server component, one row in the history list. Thumbnail + severity + status badge + date + link to `/report/[id]`. Fixed rows show a green ✓ in the corner.
- `lib/profile/stats.ts` — server-side aggregation, single SELECT that pulls `(status, severity)` for the user's reports and folds them into counts client-side. RLS lets the user read their own rows via `reports_read_all` + `user_id = :me` filter.

Goal 11 (PWA):
- `app/manifest.ts` — `MetadataRoute.Manifest` for BoketePR, `start_url: "/map"`, `display: standalone`, `lang: "es-PR"`, three icons (192/512/maskable). Next.js 16 emits `<link rel="manifest">` automatically and serves at `/manifest.webmanifest`.
- `public/sw.js` — service worker. Caches `boketepr-shell-v1` shell assets (root + `/map` + manifest + icons + `/offline`). Network-first for navigations (falls back to cached shell, then `/offline`). Stale-while-revalidate for `/_next/*` + `/icons/*`. Pass-through for `/api/*` and cross-origin (Supabase, Google Maps, OpenAI). Activation deletes any other cache version so old deploys don't haunt users.
- `app/offline/page.tsx` — static fallback page (Spanish). Cached by the SW and served when a navigation request fails AND the requested URL isn't in cache.
- `components/pwa/InstallPrompt.tsx` — client component. Detects Chrome (listens for `beforeinstallprompt`, fires `prompt()` on tap) vs iOS (renders Share → Add to Home Screen instructions). 30-day localStorage dismissal TTL (`boketepr:install-prompt:dismissed-at`). Hides in standalone mode. Returns null on first render + uses a `setTimeout(0)` deferral to dodge the `react-hooks/set-state-in-effect` lint rule.
- `components/pwa/ServiceWorkerRegistrar.tsx` — production-only SW registration (`/sw.js`, scope `/`). Skipped in dev to avoid HMR-vs-SW cache fights.
- `app/layout.tsx` — adds `viewport.themeColor: "#0a0a0a"`, `metadata.appleWebApp` (capable + title + status-bar-style), `metadata.icons` (192 + 512 + apple-touch). Mounts `InstallPrompt` + `ServiceWorkerRegistrar` in `<body>`.
- `scripts/generate-pwa-icons.mjs` — renders SVG sources (`scripts/icon-source.svg`, `scripts/icon-maskable.svg`) into `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`, plus a `app/favicon.ico` (32x32 placeholder) using `sharp` (already a transitive dep). Run once after a logo change.
- `public/icons/*` — generated PNGs. Sunburst glyph (matches the TopNav logo) on a black rounded-square background.

Goal 12 (Dynamic OG image):
- `app/report/[id]/opengraph-image.tsx` — Next.js 16 file convention. `ImageResponse` from `next/og`, 1200x630 PNG, Geist Regular font (only font bundled with `next/dist/compiled/@vercel/og/`; Geist-SemiBold doesn't ship). Single-column stacked layout (Satori is strict about flex containers with multiple children needing explicit `display` and refuses arbitrary `position: absolute` overlays — earlier attempts with a two-column photo-on-left + overlay tripped an error). Card shows BoketePR brand mark (CSS square, no glyph) + optional "Reparado hace X" pill (white dot + green pill, for fixed reports) + colored severity badge (bucket color from `severity.ts`, large score + bucket label) + Spanish reason (`severity_reason`, truncated to 180 chars at word boundary) + lat/lng + relative time. Falls back to a neutral BoketePR card if the report row is missing.
- `app/report/[id]/page.tsx` — `generateMetadata` no longer sets `images` directly; the colocal `opengraph-image.tsx` emits `<meta property="og:image">` + `<meta name="twitter:image">` tags automatically with the richer 1200x630 card.
- Why `dynamic = "force-dynamic"`: report IDs are unique, can't be pre-enumerated at build time. Why `runtime = "nodejs"`: `ImageResponse` + `readFile` for the bundled font.
- Why no decorative glyphs (`✦`, `✓`): Geist Regular doesn't ship them and Satori's dynamic font fetcher 400s on rare codepoints. Pure CSS brand mark + filled-circle status dot.

Goal 13 (Spanish copy + ally pass):
- `lib/reports/hazard-labels.ts` — maps canonical hazard tokens (`trafico_alto`, `carretera_principal`, `cerca_escuela`, …) to user-facing Spanish labels with accents (`Tráfico alto`, `Carretera principal`, `Cerca de escuela`, …). 12 canonical entries; `prettifyToken()` fallback for unknown tokens / free-form phrases (Spanish title-case, only first word capitalized). `hazardLabels()` is what render sites call.
- 3 render sites wired through `hazardLabels()`: `components/report/ReportForm.tsx` (submit success card), `components/map/PinDetailPanel.tsx` (slide-in detail), `app/report/[id]/page.tsx` (share page). All previously showed raw snake_case tokens.
- `lib/openai/prompts.ts` — `HAZARD_VOCABULARY_HINT` now lists Spanish phrases (with accents) instead of snake_case tokens. Added explicit instruction: "Usa frases cortas en español natural … no palabras en snake_case". Forward-compatible: legacy rows with snake_case still render correctly via the label map.
- `lib/copy/invariants.test.ts` — ally-pass guardrail. Scans `app/` + `components/` (comments stripped) and asserts: (1) `bache` / `hueco` never appear, (2) `hoyo` is used in ≥5 files, (3) `severityStyle()` exposes the canonical 4 labels, (4) `HAZARD_VOCABULARY_HINT` includes 5 representative canonical Spanish phrases. Catches dialect drift early; cheap to run (`node --test lib/copy/invariants.test.ts`).

Tests:
- `scripts/e2e-submit.mjs` — full e2e (signup → upload → report → DB check → AI scoring assert)
- `scripts/cleanup-e2e.mjs` — purges e2e test users + rows + storage files
- `scripts/test-score.mjs` — manual smoke test for `scorePothole()`
- `scripts/test-nearby.mjs` — smoke test for `find_nearby_reports`: seeds 5 active reports at known distances, asserts radius filtering + max_results + ordering + anon-key auth + status='fixed' exclusion + cleanup
- `scripts/test-fixed-pin.mjs` — submits a report, marks it fixed, verifies DB state, verifies the /map query filter includes it; backdates fixed_at to 31 days ago and verifies the filter excludes it
- `scripts/test-rate-limit.mjs` — submits 5 reports (all succeed), submits a 6th (expects 429 + Spanish error + Retry-After), confirms a second user is unaffected
- `scripts/test-profile.mjs` — creates a user, reads `/profile` (200 + stats card + email), PATCHes display_name + avatar_url, expects 400 on off-bucket URL + empty PATCH, verifies final DB state

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
- DB schema: `public.reports` has `fixed_at timestamptz NULL` (migration 0007). Status='fixed' rows have it set; active rows have NULL.
- DB RPC: `public.find_nearby_reports(in_lat, in_lng, in_radius_m, in_max_results)` — added in migration 0005, param names fixed in migration 0006 (renamed to break Postgres RETURNS TABLE shadow), granted to `anon` + `authenticated`
- LocalStorage pin cache: `boketepr:pins:v2` (was `:v1` before migration 0007; old caches discarded on first load)
- PWA: `/manifest.webmanifest` returns valid JSON (verified locally with `curl`). `/sw.js` served at root scope. Install prompt surfaces on `/` after first paint via `components/pwa/InstallPrompt`. SW is registered production-only (dev mode skips it).
- Install prompt dismissal flag: `boketepr:install-prompt:dismissed-at` in localStorage, 30-day TTL.
- OG image endpoint: `/report/[id]/opengraph-image` serves a dynamic 1200x630 PNG (verified locally: 55 KB for a real fixed report, 31 KB for the missing-ID fallback; verified live on Vercel after manual redeploy: 200 OK + `image/png`, ~31 KB fallback card, share page emits `og:image` + `og:image:type` + `og:image:width=1200` + `twitter:image` tags pointing at `/report/[id]/opengraph-image`). Next.js emits those tags automatically from the colocal file convention.
- Vercel auto-deploy status: **OK** — verified by pushing a noop commit (`6b8fb61`, "docs(agents): note manual Vercel deploy + questionable webhook status"). The noop appeared in `GET /repos/JCRoooD/boketepr/deployments` within ~1 minute and the deploy reached `state: success`. The earlier `f9bfd9b` push was a one-off webhook miss; no disconnect/reconnect was needed. Diagnostic pattern: when Vercel seems stale, check the GitHub public deployments API (`GET /repos/{owner}/{repo}/deployments?per_page=5`) before assuming the build is broken — if your SHA isn't there, it's a webhook miss, not a code bug.

## Open follow-ups (deferred, not bugs)
- No email confirmation on signup (Supabase Auth default behavior, but no custom email template yet).
- No PWA install UX tests — InstallPrompt relies on the browser's `beforeinstallprompt` event which is hard to assert in CI. Manual verification: open `boketepr.vercel.app` in Chrome desktop → "Install" icon should appear in the URL bar; on Android Chrome → install banner appears after 2–3 visits. On iOS Safari → Share → Add to Home Screen works with the icon we ship.
- No automated screenshot test of the PWA icons in the install dialog (Chromium's installer doesn't expose this via Playwright without manual flag).
- No offline-submit queue — v1 explicitly didn't promise this; the plan said "If a user submits with no internet, the form shows an error and they retry." If we ever add this, the SW would need to capture the POST in a `Background Sync` registration and replay it.
- OG image is text-only (no photo). Satori (the OG renderer) is strict about absolute-positioned overlays and the only font it bundles doesn't ship the rare-codepoint glyphs we'd want for the photo overlay. The share page itself still shows the full photo; only the preview is typographic. If we want a photo in the preview, we'd need to either (a) bundle a custom font with the glyphs and write a more constrained layout, or (b) move to a static-rendered PNG pipeline (sharp + canvas) instead of Satori.
- No `generateImageMetadata` for multiple images per report (Twitter prefers one large image; not a current need).

## Security audit (2026-06-26)

Full audit report + remediation plan: `C:\Users\juanc\.hermes\plans\2026-06-26_150000-boketepr-security-audit.md`.

**Fixed in this batch** (commit hashes pending push): SEC-001 (critical — service-role bypass in POST /api/reports), SEC-002, SEC-003, SEC-004, SEC-006, SEC-013, SEC-014, SEC-016, SEC-017. Two migrations (0008, 0009) need to be run manually in the Supabase SQL Editor — they don't auto-apply because this repo uses ad-hoc migrations, not `supabase db push`.

**Deferred:** SEC-005 (upload magic-byte validation), SEC-007/008 (rate limits beyond per-user), SEC-011/012 (avatar upload trust), SEC-009 (npm audit deps), SEC-015/018/019.

**Key invariant after this batch:** the only paths that use the service-role key are `lib/supabase/service.ts` and `scripts/*.mjs` (operational). Every other server route runs under the anon key so RLS is enforced. `node scripts/check-secret-leaks.mjs` fails CI if a new file outside the allowlist starts referencing the key.

## Migrations applied (for reference)
- 0001 — initial schema + RLS policies
- 0002 — profiles.updated_at
- 0003 — reports.ai_scored_at
- 0004 — reports.lat / reports.lng columns
- 0005 — find_nearby_reports() RPC
- 0006 — fixed find_nearby_reports RETURNS TABLE shadow
- 0007 — reports.fixed_at
- 0008 — hardened find_nearby_reports (revoke anon grant, add bound checks). **Patched post-apply** with explicit `REVOKE FROM anon / authenticated` so fresh-DB applies self-correct.
- 0008b — explicit REVOKE FROM anon for find_nearby_reports. Corrective for the partial apply of 0008. **Applied 2026-06-26.** Verified: anon RPC now gets `permission denied for function find_nearby_reports`. Service-role still works. `routine_privileges` shows exactly `authenticated` + `postgres` + `service_role` (no `anon`).
- 0009 — restricted profiles_read_all (require `auth.uid() IS NOT NULL`). **Applied 2026-06-26.** Verified: anon SELECT FROM profiles returns 0 rows.
