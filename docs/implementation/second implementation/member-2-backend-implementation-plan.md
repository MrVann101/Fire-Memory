# Member 2 (Backend, DB & Shared Contracts) — Zero-Guesswork Root-Cause & Implementation Plan

> **Verified against commit:** `edef27b` (`5d2b80c` code baseline)
> **Tools & evidence used:** `systematic-debugging` Phase 1 root-cause trace, Next.js 16 embedded documentation (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` & `02-guides/migrating-to-cache-components.md`), live Supabase MCP inspection (`btzknozwefsxzhdgyqzd`), `data/boundaries/regions.json` inspection, and live Node 24 / `next start` test runs.

---

## 1. Root-Cause Diagnosis: The 7 Exact Problems in Member 2's Backend

### Problem 1 — `tests/analytics/register-paths.mjs:39-63` Breaks Member 4's AI Test (`m4-t2.test.mjs`)
- **Symptom:** Running `node --import ./tests/analytics/register-paths.mjs --test tests/ai/m4-t2.test.mjs` crashes with `SyntaxError: Unexpected token 'export'` inside `node_modules/gaxios/package.json`.
- **Verified Root Cause (Member 2 File):**
  1. `register-paths.mjs:39-49` intercepts `./` and `../` specifiers even when `context.parentURL` is inside `node_modules/`.
  2. `register-paths.mjs:18` checks `existsSync(c)` without `statSync(c).isFile()`, matching directories as files.
  3. `register-paths.mjs:55-63` intercepts **every** `.json` file (including `node_modules/gaxios/package.json` loaded by CommonJS `require()`) and forces `{ format: "module", source: "export default ..." }`, crashing Node 24's CommonJS loader.
- **Exact Fix:** Skip `node_modules` in both `resolve()` and `load()`, and check `statSync(c).isFile()` in `resolveFileCandidate()`.

---

### Problem 2 — National (`level === "country"`) & Special ADM2 (`level === "region"`) Queries Return `null` / `[]` on Live Data
- **Symptom:** Once Member 1's processed data is loaded into Supabase, selecting **The Philippines (National)** or any of the **6 special ADM2 regions** (`City of Isabela`, `Cotabato City`, `NCR Districts 1–4`) returns `currentCount: null`, `historicalMedian: null`, `cells: []`, and `overlap: []`.
- **Verified Root Cause:**
  1. Member 1's `scripts/ingest/aggregate.ts:221` (`if (matchedRegion?.level === "province")`) and `scripts/ingest/harmonize.ts:448-483` only emit rows for the `81` provinces (`PHL-ADM2-...`) into `monthly_counts` and `monthly_harmonized`. They **never** emit a pre-aggregated national row (`region_id = country.id`) or ADM2 `region` rows.
  2. Member 2's SQL RPCs (`supabase/migrations/20261114000001_analytics_rpc_functions.sql:42, 54, 67, 120, 130, 155, 176`) and TypeScript queries (`src/lib/analytics/summary.ts:297`, `calendar.ts:122, 160`, `harmonization.ts:166`) filter strictly by `WHERE region_id = p_region_id`.
- **Exact Fix:**
  1. In SQL RPCs (`get_harmonized_summary_metrics` and `get_raw_summary_metrics`): detect when `p_region_id` is a `country`-level region without direct rows in `monthly_harmonized` / `monthly_counts`, and automatically aggregate (`SUM`) across all province rows per `(year, month)`.
  2. In `src/lib/analytics/{summary,calendar,harmonization}.ts`:
     - When `region.level === "country"` and direct country rows are absent, sum province rows per `(year, month)` for `byInstrument`, `cells`, and `overlap` (matching `harmonize.ts:361-373`).
     - When `region.level === "region"` (the 6 ADM2 non-province regions excluded from `monthly_counts` by `aggregate.ts:242` but present in `monthly_grid_counts`), fall back to `get_custom_bbox_calendar` over `region.bbox` with `approximate: true`.

---

### Problem 3 — Region ID Split (`"PH"` / `"PH-BUK"` vs `"PHL-ADM0-..."` / `"PHL-ADM2-..."`)
- **Symptom:**
  - `data/boundaries/regions.json` uses `id: "PHL-ADM0-24100683B85265433280220"` for the Philippines and `id: "PHL-ADM2-..."` for provinces (e.g., Bukidnon is `PHL-ADM2-2640588B97736443103823`, Batanes is `PHL-ADM2-2640588B23864872837062`).
  - Member 3's `src/components/dashboard/DashboardShell.tsx:169, 193, 201` hardcodes `"PH"` (`useState(isSimulated ? "PH-BUK" : "PH")` and `regions.data?.find((region) => region.id === "PH")?.bbox`).
  - Smoke tests and curl examples use `PH`, `PH-BUK`, `PH-BAT`, `PH-DAV`, `PH-NUE`, `PH-PAL`.
- **Verified Root Cause:** Neither `aggregate.ts` nor `harmonize.ts` ever writes `PHL-ADM0-24100683B85265433280220` into `monthly_counts`, `monthly_harmonized`, `harmonization_factors`, or `hotspots.province_id` — only `regions.json` uses it as `country.id` and `parentId`.
- **Exact Fix in `src/lib/db/regions.ts` (Zero changes needed from Member 1 or Member 3):**
  1. In `listRegions()`: normalize the `level === "country"` region's exposed `id` to `"PH"` and normalize child `parentId` values pointing to the country row to `"PH"` so `DashboardShell.tsx` works out of the box.
  2. In `requireRegion(regionId)` and a new helper `resolveRegionWithDbId(regionId)`: accept `"PH"`, `"PHL-ADM0-24100683B85265433280220"`, any `PHL-ADM2-...`, and short codes (`"PH-BUK"`, `"PH-BAT"`, `"PH-DAV"`, `"PH-NUE"`, `"PH-PAL"`), returning both the public `Region` and the underlying database primary key (`dbId`) for SQL queries.

---

### Problem 4 — Supabase Security Advisor Warnings (`0011_function_search_path_mutable`) & Duplicate National Factor Constraint Bug
- **Symptom:**
  1. Live Supabase advisor check on `btzknozwefsxzhdgyqzd` flags `get_harmonized_summary_metrics`, `get_raw_summary_metrics`, and `get_custom_bbox_calendar` for mutable `search_path`.
  2. `supabase/migrations/20261114000000_create_fire_memory_schema.sql:128` uses `UNIQUE (region_id)` on `harmonization_factors`. In PostgreSQL, `NULL != NULL`, allowing multiple `region_id IS NULL` national rows. If seeded twice, `.is("region_id", null).maybeSingle()` in `src/lib/analytics/harmonization.ts:83-84` throws `DatabaseProviderError` (`500`).
- **Exact Fix:** Create and apply `supabase/migrations/20261114000002_harden_rpc_and_national_rollup.sql`:
  - Add `SET search_path = public, pg_temp` and explicit `public.` table qualification to all 3 RPC functions.
  - Add `CREATE UNIQUE INDEX IF NOT EXISTS uq_harmonization_factors_national_null ON public.harmonization_factors ((1)) WHERE region_id IS NULL;`.

---

### Problem 5 — Custom Area Throws HTTP `500` When National Factor Row Is Missing (`summary.ts:105-112` & `calendar.ts:74-80`)
- **Symptom:** Querying `/api/analytics/summary?regionId=custom&bbox=...&metric=harmonized` or `/api/analytics/calendar?regionId=custom&bbox=...&metric=harmonized` when `harmonization_factors` has no national row throws `500 DatabaseProviderError` instead of returning a graceful `200` empty-coverage response.
- **Verified Root Cause:** `summary.ts:109` and `calendar.ts:77` throw `DatabaseProviderError`, whereas `harmonization.ts:136-152` gracefully returns `factor: null` with a note.
- **Exact Fix:** When `query.metric === "harmonized"` and `harmonization?.factor == null` on a custom area (or when RPC returns empty rows), return a valid `200` `AnalyticsSummary` (`currentCount: null`, `historicalMedian: null`, `label: "not_calculable"`, `approximate: true`, with note) and `CalendarResponse` (`cells: []`, `approximate: true`) instead of throwing `500`.

---

### Problem 6 — National Hotspot Query (`src/lib/db/hotspots.ts:181-224`) Builds 2.9KB PostgREST `.or()` URL & Drops ADM2 `region` Hotspots
- **Symptom:** When `region.level === "country"`, `hotspots.ts:184, 213-216` fetches 81 province IDs (`getChildProvinces`) and interpolates all 81 32-char IDs into a 2,900-byte `.or(province_id.in.(...),and(province_id.is.null,...))` URL across up to 21 parallel range queries, while excluding the 6 ADM2 `level === "region"` IDs (`NCR`, `Cotabato City`, `City of Isabela`).
- **Exact Fix:** In `src/lib/db/hotspots.ts:180-234`:
  - For `region.level === "country"`: filter by the Philippine `bboxFilter` (`.gte("longitude", minLon).lte("longitude", maxLon).gte("latitude", minLat).lte("latitude", maxLat)`), which is `O(1)` query length, uses `idx_hotspots_lat_lon`, and includes all 81 provinces, all 6 ADM2 regions, and coastal points inside the country bounds.
  - For `region.level === "region"`: filter by `province_id = dbId` OR inside `region.bbox`.

---

### Problem 7 — Next.js 16 `cacheComponents: true` Prerenders `GET /api/regions` at Build Time (`x-nextjs-cache: HIT`)
- **Symptom:** Live `next start` probe returned `x-nextjs-cache: HIT` on `GET /api/regions`.
- **Verified Root Cause (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:89-99, 124`):**
  With `cacheComponents: true` in `next.config.ts:5`, any `GET` Route Handler that does not read `request` properties, call `connection()`, or perform network I/O during `next build` is prerendered into a static file at build time. Because `src/app/api/regions/route.ts:5` takes no `request` argument and `NEXT_PUBLIC_USE_MOCKS=true` during build, Next.js bakes `/api/regions` statically.
- **Exact Fix:**
  - In `src/app/api/regions/route.ts` (and all 6 Member 2 route handlers): call `try { await connection(); } catch {}` from `"next/server"` (using `try/catch` so direct `node:test` calls outside a Next.js request store continue to work!) and return `headers: { "Cache-Control": "no-store" }`.

---

## 2. Step-by-Step Implementation Order (Strict Member 2 File Scope)

| Step | File(s) (All Owned by Member 2) | Action |
|---|---|---|
| **Step 1** | `tests/analytics/register-paths.mjs` | Fix `resolveFileCandidate()` (`statSync(c).isFile()`) and bypass `node_modules` in `resolve()` and `load()` so both `tests/analytics/*.test.ts` and `tests/ai/m4-t2.test.mjs` pass under Node 24. |
| **Step 2** | `supabase/migrations/20261114000002_harden_rpc_and_national_rollup.sql` | Create and apply migration to live Supabase (`btzknozwefsxzhdgyqzd`): add `uq_harmonization_factors_national_null` partial unique index, set `search_path = public, pg_temp` on all 3 RPCs, and add automatic country-level SQL `SUM` rollup when `p_region_id` has `level = 'country'`. |
| **Step 3** | `src/lib/db/regions.ts` | Add canonical alias & ID resolution (`"PH"` <-> `"PHL-ADM0-..."`, `"PH-BUK"` -> Bukidnon, `"PH-BAT"` -> Batanes, `"PH-DAV"` -> Davao del Sur, `"PH-NUE"` -> Nueva Ecija, `"PH-PAL"` -> Palawan), normalize country `id: "PH"` and `parentId: "PH"` in `listRegions()`, and export `requireRegionWithDbId()`. |
| **Step 4** | `src/lib/db/hotspots.ts` | Replace the 81-ID `.or()` string for `country` with clean bbox filtering + support `region.level === "region"` and `requireRegionWithDbId()`. |
| **Step 5** | `src/lib/analytics/{summary,calendar,harmonization,children}.ts` | Add country-level province-sum fallback when direct country rows are absent, ADM2 `level === "region"` grid fallback (`approximate: true`), graceful `200` empty-state when custom area harmonization factor is missing (no `500`), and `requireRegionWithDbId()` support. |
| **Step 6** | `src/app/api/{regions,hotspots,analytics/**}/route.ts` | Add `try { await connection(); } catch {}` + `Cache-Control: no-store` on `/api/regions` and Member 2 routes so Next.js 16 `cacheComponents` never freezes stale API responses. |
| **Step 7** | Live Supabase (`btzknozwefsxzhdgyqzd`) + `tests/analytics/*.test.ts` | Seed the `88` verified regions from `data/boundaries/regions.json` and the documented national factor (`4.09777677` from `docs/HARMONIZATION.md`) into live Supabase, add unit/integration tests for all 7 fixes, and run full verification (`tsc`, `lint`, `analytics` tests, `ai` tests, Supabase security advisor). |

---

## 3. Verification Gate (Must Be 100% Green Before Completion)

1. `node --import ./tests/analytics/register-paths.mjs --test tests/analytics/*.test.ts` -> `100% PASS` (including new tests for ID aliases, national rollup, ADM2 region fallback, and missing-factor custom bbox).
2. `node --import ./tests/analytics/register-paths.mjs --test tests/ai/*.test.mjs` -> `100% PASS` across `m4-t1.test.mjs`, `m4-t2.test.mjs`, and `m4-t4.test.mjs` (proving `register-paths.mjs` fix resolved `gaxios/package.json`).
3. `npm run lint` & `npx tsc --noEmit` -> `EXIT 0`.
4. Supabase Security Advisor (`get_advisors` on `btzknozwefsxzhdgyqzd`) -> `0` `function_search_path_mutable` warnings; `regions` count = `88`; `harmonization_factors` national row = `1`.
5. `git status` -> Only Member 2 owned files modified (`supabase/**`, `src/lib/db/**`, `src/lib/analytics/**`, `src/app/api/{regions,hotspots,analytics}/**`, `tests/analytics/**`, `docs/implementation/**`).
