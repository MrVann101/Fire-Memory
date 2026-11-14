# Member 2 Actionable Task Plan — Backend, DB & Shared Contracts (`5d2b80c` Verified State)

> **Source of truth verified against:** `FIRE_MEMORY_Work_Plan.md`, `FIRE_MEMORY_Project_Documentation_Philippines.md`, `FIRE_MEMORY_Agent_Prompts.md`, `docs/implementation/00-overview.md`, `docs/implementation/member-2-backend.md`, `supabase/migrations/*.sql`, `src/lib/{db,analytics}/*.ts`, `src/app/api/{regions,hotspots,analytics}/**/*.ts`, `tests/analytics/*.test.ts`, `next.config.ts`, `scripts/check-owner.sh`, and `README.md`.

---

## 1. Current Verified State (`5d2b80c`)

| Area | Status | Exact Verified State |
|---|---|---|
| Core Analytics & DB Layer | `[x]` Built | `src/lib/db/{supabase,regions,hotspots,validation}.ts` and `src/lib/analytics/{summary,calendar,children,harmonization,labels}.ts` exist. |
| API Route Handlers | `[x]` Built | `/api/regions`, `/api/hotspots`, `/api/analytics/{summary,calendar,children,harmonization}` exist and validate inputs via `zod`. |
| Analytics Unit & Route Tests | `[x]` `17/17` Pass | `node --import ./tests/analytics/register-paths.mjs --test tests/analytics/*.test.ts` passes (`17/17`), plus `npm run lint` and `npx tsc --noEmit` exit `0`. |
| **Live Database State** | `[!]` **EMPTY (`0` rows)** | Migrations `20261114000000` and `20261114000001` are deployed on `btzknozwefsxzhdgyqzd`, **all 6 tables have `0` rows**. Member 2 checklist in `member-2-backend.md:263-274` was pre-checked prematurely before seeding. |
| **Supabase Advisory Warnings** | `[!]` **3 Security Warnings** | `get_harmonized_summary_metrics`, `get_raw_summary_metrics`, and `get_custom_bbox_calendar` trigger `0011_function_search_path_mutable` (no `SET search_path`). |
| **Schema Constraint Gap** | `[!]` **BUG** | `supabase/migrations/20261114000000_create_fire_memory_schema.sql:128` defines `CONSTRAINT uq_harmonization_factors_region UNIQUE (region_id)`. In PostgreSQL, standard `UNIQUE` allows duplicate `region_id IS NULL` national factor rows! |
| **Caching vs Live Data Risk** | `[!]` **HIGH RISK** | `next.config.ts:5-6` enables `cacheComponents: true` & `partialPrefetching: true`. Live `next start` probe returned `x-nextjs-cache: HIT` on `GET /api/regions`! Must ensure API routes never serve stale cached DB/mock results when live DB updates. |
| **Shared Lock Tooling Bugs** | `[!]` **BUG / INCOMPLETE** | `scripts/check-owner.sh:10` diffs `origin/main...HEAD` while repo remote uses `origin/master`. `README.md:1-36` is still stock `create-next-app` boilerplate. `.env.local` still has `NEXT_PUBLIC_USE_MOCKS=true`. |

---

## 2. Role Summary

Member 2 owns the Supabase PostgreSQL schema, RPC analytics engine, `/api/{regions,hotspots,analytics}` endpoints, analytics unit tests, and **acts as gatekeeper for locked shared files** (with all 4 members' agreement). Your immediate priority is hardening the DB migration security/constraints, aligning schemas with Member 1 so Supabase loads cleanly, preventing Next.js 16 route caching bugs, and verifying every endpoint live with `NEXT_PUBLIC_USE_MOCKS=false`.

---

## 3. Your Files & Ownership Boundaries

**Allowed paths (`FIRE_MEMORY_Work_Plan.md:107` & `scripts/check-owner.sh:5`):**
- `supabase/**`
- `src/lib/db/**`
- `src/lib/analytics/**`
- `src/app/api/regions/**`
- `src/app/api/hotspots/**`
- `src/app/api/analytics/**`
- `tests/analytics/**`
- `docs/implementation/member-2-*.md`

**Locked Shared Files (Require all-4 team agreement; Member 2 applies edits):**
- `src/contracts/**`, `src/mocks/**`, `package.json`, `package-lock.json`, `next.config.ts`, `.env.example`, `README.md`, `scripts/check-owner.sh`, `docs/implementation/00-overview.md`

**DO NOT TOUCH:**
- `data/**`, `scripts/ingest/**`, `src/content/**`, `src/components/**`, `src/hooks/**`, `src/lib/client/**`, `src/lib/{ai,export}/**`, `src/app/api/{ai,export}/**`, `tests/ai/**`, `docs/presentation/**`

---

## 4. What You Provide & What You Depend On

**You provide to Member 3 (`@frontend`) & Member 4 (`@ai`):**
- Clean, non-cached live JSON responses from:
  - `GET /api/regions` -> `Region[]`
  - `GET /api/hotspots` -> `HotspotsResponse`
  - `GET /api/analytics/summary` -> `AnalyticsSummary`
  - `GET /api/analytics/calendar` -> `CalendarResponse`
  - `GET /api/analytics/children` -> `ChildCount[]`
  - `GET /api/analytics/harmonization` -> `HarmonizationResponse`
- Server functions (`queryHotspots`, `getCalendar`, `getAnalyticsSummary`) that Member 4's export routes should call directly in-process instead of HTTP self-fetching.

**You depend on:**
- **Member 1 (`@data`):** Seeded Supabase tables (`regions`, `hotspots`, `monthly_counts`, `monthly_harmonized`, `monthly_grid_counts`, `harmonization_factors`).
- **Member 3 (`@frontend`):** Fix hardcoded `"PH"` IDs if `regions.id` uses `"PHL-ADM0-..."`, OR agree with Member 1 + Member 3 on canonical `"PH"`/`"PH-BUK"` IDs.

---

## 5. Environment Variables You Use

| Variable | Status in `.env.local` | Purpose |
|---|---|---|
| `SUPABASE_URL` | `[x]` Present | Server Supabase URL. |
| `SUPABASE_ANON_KEY` | `[x]` Present | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | `[x]` Present | Server-only Postgres/RPC key (never expose to client). |
| `NEXT_PUBLIC_USE_MOCKS` | `[!]` Set to `"true"` | Flip to `"false"` once Supabase is populated and verified. |

---

## 6. MVP Scope & Execution Priority (`MVP-MUST` First)

| Priority | Task ID | Status | Target Deliverable |
|---|---|---|---|
| `MVP-MUST` | **M2-T1** | `[!]` Fix | Add migration fixing `0011_function_search_path_mutable` (`SET search_path`) on all 3 RPCs + partial unique index for `harmonization_factors (region_id IS NULL)` so national factor upserts cannot duplicate. |
| `MVP-MUST` | **M2-T2** | `[!]` Coordination | Coordinate schema/ID alignment (`regions.id`, ADM2 `"region"` entries, `hotspots.province_id`, `hotspots.id` UUID vs `source_key`) with Member 1 (`@data`) and Member 3 (`@frontend`). |
| `MVP-MUST` | **M2-T3** | `[!]` Fix (Locked) | Audit `next.config.ts` (`cacheComponents: true`) & Route Handlers so API endpoints are never statically cached across DB updates, and fix `scripts/check-owner.sh` (`origin/master`). |
| `MVP-MUST` | **M2-T4** | `[ ]` Verify Live | Flip `NEXT_PUBLIC_USE_MOCKS=false` after M1-T3 load, verify all 6 `/api/*` endpoints + SQL RPC median hand-check against live Supabase data. |
| `MVP-SHOULD` | **M2-T5** | `[!]` Contract/Export | Confirm `/api/analytics/harmonization` + custom-bbox grid RPC work on live DB, and explicitly authorize/verify in-process calls (`queryHotspots`, `getCalendar`, `getAnalyticsSummary`) for Member 4 exports. |
| `MVP-SHOULD` | **M2-T6** | `[ ]` Missing | Rewrite `README.md` with accurate setup, env vars, test commands, and ownership rules; deploy Next.js app to Vercel with server env vars and verify production endpoints. |

---

## 7. Actionable Task List

### M2-T1 (`MVP-MUST`) `[!]` New Supabase Migration: Fix RPC `search_path` & National Factor Uniqueness
- **Objective:** Eliminate all 3 Supabase Security Advisor `0011_function_search_path_mutable` warnings and enforce single-row uniqueness for the `region_id IS NULL` national harmonization factor.
- **Files:** `supabase/migrations/20261114000002_harden_rpc_and_constraints.sql` (new)
- **Steps:**
  1. Alter `get_harmonized_summary_metrics`, `get_raw_summary_metrics`, and `get_custom_bbox_calendar` (from `20261114000001_analytics_rpc_functions.sql`) to include `SET search_path = public, pg_temp` (or `SET search_path = ''` with fully qualified `public.<table_name>` inside each query — verify table qualification if choosing `''`!).
  2. Add a partial unique index on `harmonization_factors`:
     `CREATE UNIQUE INDEX IF NOT EXISTS uq_harmonization_factors_national ON public.harmonization_factors ((1)) WHERE region_id IS NULL;`
  3. Apply the migration to Supabase project `btzknozwefsxzhdgyqzd`.
- **Edge cases:** Verify Postgres does not reject existing empty/null state; verify `SELECT *` permissions (`SECURITY INVOKER` + RLS `SELECT USING (true)`) still return rows cleanly.
- **Acceptance criteria:** Supabase advisor check reports `0` `function_search_path_mutable` warnings; inserting two `region_id IS NULL` rows into `harmonization_factors` fails with unique constraint violation.
- **How to verify:** Re-run Supabase security advisor check and inspect `\d harmonization_factors` / constraint behavior.
- **Needs from others:** Coordinate before Member 1 runs `M1-T3` (`load-supabase.ts`).

### M2-T2 (`MVP-MUST`) `[!]` Coordinate `regions.id` & `hotspots` Unassigned Policy Across M1/M2/M3
- **Objective:** Lock a single unambiguous convention for `regions.id` and `hotspots` schema mapping across ingest, database, API, and UI.
- **Files:** `src/lib/db/regions.ts`, `src/lib/db/hotspots.ts`, `src/lib/analytics/{summary,calendar,children}.ts` (if logic adjustment needed).
- **Steps:**
  1. Confirm with `@data` and `@frontend`: either (A) Member 1 stores `"PHL-ADM0-..."` in DB `regions.id` and Member 3 detects `level === "country"` dynamically (recommended minimal diff!), OR (B) Member 1 maps `"PH"` / `"PH-BUK"` codes.
  2. Verify `src/lib/db/hotspots.ts:180-224`: when `region.level === "country"`, it builds an `.or()` query across `countryChildIds` plus `province_id.is.null` inside `region.bbox`. Test that PostgREST accepts up to 87 quoted IDs inside `.in.(...)` cleanly without URL length errors!
  3. Verify `getChildProvinces` (`src/lib/db/regions.ts:63-66`): checks `r.parentId === parentId && r.level === "province"`. Confirm what happens to the `6` ADM2 `"region"` records in `regions.json` (excluded from province bubbles cleanly if `level === "region"`).
- **Acceptance criteria:** Zero 404/400 `REGION_NOT_FOUND` or PostgREST `.or()` syntax errors when querying country or any of 81 provinces.
- **How to verify:** Smoke-test `requireRegion` and `queryHotspots` for national region, Bukidnon, one ADM2 `"region"`, and `custom` bbox once seeded.

### M2-T3 (`MVP-MUST`) `[!]` Prevent API Route Caching (`next.config.ts`) & Fix `scripts/check-owner.sh`
- **Objective:** Fix stale response caching seen on `next start` (`x-nextjs-cache: HIT` on `/api/regions`) and update repo ownership script to check `origin/master`.
- **Files:** `next.config.ts` (locked — team notice), `scripts/check-owner.sh` (locked — team notice), `src/app/api/{regions,hotspots,analytics/**}/route.ts`.
- **Steps:**
  1. Inspect why `next.config.ts:5-6` (`cacheComponents: true`, `partialPrefetching: true`) caused `/api/regions` to serve `x-nextjs-cache: HIT`. Note: under `cacheComponents: true` in Next.js 16, read `node_modules/next/dist/docs/` (`AGENTS.md:3-8`) before changing config or marking dynamic routes (e.g., verify whether `connection()` from `next/server` or disabling `cacheComponents` for API routes prevents stale DB reads). Also check `src/components/export/ExportButton.tsx` + `src/components/assistant/AssistantPanel.tsx` compatibility with Next build.
  2. Update `scripts/check-owner.sh:10` to diff `origin/master...HEAD` (falling back to `origin/main` if present) instead of failing on missing `origin/main`.
- **Acceptance criteria:** `GET /api/regions`, `/api/hotspots`, and `/api/analytics/*` always execute against live DB when `NEXT_PUBLIC_USE_MOCKS=false` (`cache-control: no-store` or fresh dynamic render); `bash scripts/check-owner.sh <member>` runs cleanly.
- **How to verify:** Build (`npm run build`), start `next start`, query `/api/regions` twice and confirm fresh dynamic execution / correct live DB rows; run `bash scripts/check-owner.sh backend`.

### M2-T4 (`MVP-MUST`) `[ ]` Live End-to-End API & Median Math Verification (`NEXT_PUBLIC_USE_MOCKS=false`)
- **Objective:** Verify all 6 backend endpoints and SQL median/anomaly calculations against real Supabase rows after Member 1 seeds the DB.
- **Files:** `tests/analytics/*.test.ts` (add any regression test cases needed for empty/null/custom edge cases).
- **Steps:**
  1. Ensure `M1-T3` loaded all 6 tables cleanly.
  2. Test `GET /api/regions` (`88` rows including 1 `country`), `GET /api/hotspots` (`rawWindow`, `truncated`, region filtering), `GET /api/analytics/summary` (national, Bukidnon, Batanes/zero-median province, `custom` bbox, `harmonized` vs `raw`), `GET /api/analytics/calendar`, `GET /api/analytics/children`, and `GET /api/analytics/harmonization`.
  3. Hand-check one province's same-month historical median (excluding `currentUtcYear` incomplete year and `null` coverage) against `get_harmonized_summary_metrics` RPC SQL output.
- **Acceptance criteria:** All 6 endpoints return HTTP `200` matching `src/contracts/types.ts`; zero stack traces on bad params (`400`/`404`).
- **How to verify:** Run `tests/analytics/*.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and curl smoke checks across all 6 routes on `next start`.

### M2-T5 (`MVP-SHOULD`) `[!]` Support In-Process Export Queries for Member 4
- **Objective:** Ensure Member 4's CSV export routes can call `queryHotspots`, `getCalendar`, and `getAnalyticsSummary` cleanly in-process without fragile HTTP self-fetches.
- **Files:** Read/verify `src/lib/db/hotspots.ts`, `src/lib/analytics/{calendar,summary}.ts` (no breaking signature changes; export clean error classes).
- **Steps:**
  1. Confirm with `@ai` that `csv/route.ts` and `analytics-csv/route.ts` can import `queryHotspots`, `getCalendar`, `getAnalyticsSummary`, and validation helpers from `@/lib/db/*` and `@/lib/analytics/*`.
  2. Verify `queryHotspots(filters, 10_000)` returns `truncated: true` cleanly when matching rows exceed `10_000`.
- **Acceptance criteria:** Member 4 can replace `fetch(new URL("/api/...", request.url))` with direct calls without contract changes.

### M2-T6 (`MVP-SHOULD`) `[ ]` Update `README.md` & Deploy Live to Vercel
- **Objective:** Replace boilerplate `README.md` with project truth and deploy FIRE MEMORY to Vercel with verified production environment variables.
- **Files:** `README.md` (locked — announce to team), `.env.example` (if missing any documented var — verify before touching).
- **Steps:**
  1. Replace `README.md` template text with accurate project overview, data scope, local setup, `.env.local` variable names (no values!), exact test commands (`node --import ./tests/analytics/register-paths.mjs --test ...`), and architecture overview.
  2. Configure Vercel environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_USE_MOCKS=false`).
  3. Deploy production build to Vercel and verify all 6 API routes + `/api/ai/brief` + `/api/export/*` against production URL.
- **Acceptance criteria:** `README.md` has zero `create-next-app` boilerplate; Vercel production URL loads dashboard cleanly with live Supabase data and zero 500 errors.

---

## 8. Edge Cases & Honesty Rules

- **Service-role protection:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components or `NEXT_PUBLIC_*` vars.
- **No zero-padding missing months:** Absent `monthly_harmonized`/`monthly_counts` months remain `null` and are excluded from historical medians.
- **No current incomplete month in baseline:** `p_target_year < p_current_utc_year` / complete-year filter must never pollute baseline medians.
- **No stack traces in HTTP errors:** Every error route passes through `errorToHttpResponse` returning structured JSON only.

---

## 9. Verification Commands

```bash
npm run lint
npx tsc --noEmit
node --import ./tests/analytics/register-paths.mjs --test tests/analytics/*.test.ts
npm run build
```

---

## 10. Handoff Checklist

- [ ] `M2-T1`: Migration `20261114000002` applied; `0` Supabase `search_path` warnings; national `region_id IS NULL` uniqueness enforced.
- [ ] `M2-T2`: Schema & `regions.id` agreement finalized with Member 1 & Member 3.
- [ ] `M2-T3`: `next.config.ts` caching verified harmless (or fixed for dynamic APIs) & `scripts/check-owner.sh` works on `origin/master`.
- [ ] `M2-T4`: Live Supabase `NEXT_PUBLIC_USE_MOCKS=false` verified across all 6 endpoints; hand-calculated median matches RPC.
- [ ] `M2-T5`: Export direct-call path confirmed for Member 4.
- [ ] `M2-T6`: `README.md` updated and Vercel production deployment verified.

---

## 11. Blocked Template & Cut Order

**If blocked on DB seeding, post in team chat:**
> `@data I need: seeded rows in regions, harmonization_factors, monthly_counts, monthly_harmonized, monthly_grid_counts, and recent hotspots. File: scripts/ingest/load-supabase.ts. Why: all 6 live API routes return empty states until Supabase has data. By hour: ASAP.`

**If time runs short:**
1. Cut advanced optimization / extra child rollups before cutting core `/api/regions`, `/api/hotspots`, `/api/analytics/summary`, `/api/analytics/calendar`.
2. Never cut: `search_path` security fix, exact median SQL/null rules, `zod` input validation, or server-only service key hygiene.
