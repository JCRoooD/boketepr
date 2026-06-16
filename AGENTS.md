<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BoketePR Project Context

A pothole-reporting web app for Puerto Rico. Residents photograph potholes, AI scores them 1.0–10.0 via OpenAI gpt-4o Vision, pins appear on a live map. v1 = submit + view only (authority communication deferred to v2).

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind + shadcn/ui · Supabase (Auth/Postgres+PostGIS/Storage/Realtime) · Vercel · OpenAI gpt-4o Vision (Goal 4+) · Google Maps JS API (Goal 5+) · Browser Geolocation API.

Note: the plan called for Next.js 15, but `create-next-app@latest` installed 16.2.9. Heed the framework warning at the top of this file.

## Key paths
- Plan (read first): `C:\Users\juanc\.hermes\plans\2026-06-12_115149-boketepr-web-app.md`
- Local working dir: `C:\Users\juanc\Projects\boketepr`
- GitHub: https://github.com/JCRoooD/boketepr
- Vercel: https://boketepr.vercel.app/ (team: jcrooods-projects)
- Supabase project: `dyeskzwmapznizwgpewa`

## Language: Spanish (es_PR dialect)
- All user-facing copy is Spanish, Caribbean dialect (es_PR).
- Use "hoyo" (not "bache") in product text — "bache" has a different colloquial meaning in PR.
- "Bokete" / "BoketePR" is acceptable as the brand name only.
- AI reason text is generated in Spanish (Goal 4+).

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
- `OPENAI_API_KEY` — server-only, Goal 4+
- `GOOGLE_MAPS_API_KEY` — public, Goal 5+, restrict to boketepr.vercel.app in Google Cloud
