# Member 1 Actionable Task Plan — Data & FIRMS (Second Implementation)

> **Source of truth:** Local source files, generated artifacts, ingestion code and tests, project plans, checked-in Supabase schema migration, and live database validation on 2026-11-14.

---

## 1. Current Verified State

| Area | Status | Exact Verified State |
|---|---|---|
| Region Boundaries & Assignment | `[x]` Done locally | `scripts/ingest/load-regions.ts` loads `88` records in `data/boundaries/regions.json` (`1` `country`, `6` special ADM2 `"region"`, `81` `"province"`). `load-regions.test.ts` passes. |
| Normalization & Deduplication | `[x]` Done locally | `scripts/ingest/normalize.ts` & `scripts/ingest/ingest.ts` run locally (`sink: "local-jsonl"`). `normalize.test.ts` passes. |
| Aggregation & Harmonization | `[x]` Provisional | `scripts/ingest/aggregate.ts` & `scripts/ingest/harmonize.ts` ran on supplied local `2020–2025` CSVs (`24,310` MODIS + `153,533` VIIRS = `177,843` rows; `4,084` `monthly-harmonized.json` rows; national factor `4.09777677`). All ingestion tests pass. |
| Attribution UI Copy | `[x]` Done | `src/content/data-notes.ts` exports `DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, `HARMONIZATION_NOTE`. |
| **Database Loading** | `[x]` **Seeded and idempotency verified** | All six tables have the expected payload counts; a full repeat run inserted zero rows. |
| **Schema & ID Alignment** | `[!]` **Mapping verified; sign-off pending** | The field mapping matches the checked-in migration and the UI expects country ID `PH`. The legacy country row was reconciled and its 87 ADM2 children now reference `PH`; Member 2/3 sign-off remains outstanding. |
| **Historical Window & Keys** | `[!]` **Data gap remains** | The available local CSVs cover only `2020–2025`; no pre-2020 or 2026 records are available. `FIRMS_MAP_KEY` is present in `.env.local`, but the archive request and Philippine coverage metadata remain unverified. The local harmonized output has `4,084` direct VIIRS rows and no estimated rows. |
| **Node 24 Test Runner** | `[x]` Fixed | Replaced the constructor parameter property in `aggregate.ts`; all 16 ingestion tests pass without `--experimental-transform-types`. |

---

## 2. Role Summary

Member 1 delivers the verified NASA FIRMS MODIS + VIIRS ingestion pipeline, grid-based harmonization (`0.01°` active cell-days and `0.1°` custom-area grid), validation metrics, `src/content/data-notes.ts` UI copy, and **populated Supabase tables**. Without loaded and schema-aligned Supabase data, Member 2's APIs and Member 3's live dashboard render empty states.

---

## 3. Your Files & Ownership Boundaries

**Allowed paths (`FIRE_MEMORY_Work_Plan.md:106` & `scripts/check-owner.sh:4`):**
- `data/**`
- `scripts/ingest/**`
- `docs/DATA.md`
- `docs/HARMONIZATION.md`
- `docs/implementation/member-1-*.md`
- `docs/implementation/second implementation/member-1-data-tasks.md` (second-phase checklist requested by the user)
- `docs-presentation-data/**`
- `src/content/**`

**DO NOT TOUCH:**
- `supabase/**`, `src/lib/**`, `src/app/**`, `src/components/**`, `src/hooks/**`, `tests/**`
- `src/contracts/**`, `src/mocks/**`, `package.json`, `package-lock.json`, `next.config.ts`, `.env.example`, `README.md`, `scripts/check-owner.sh`, `docs/implementation/00-overview.md` (locked shared files — request via Member 2).

---

## 4. What You Provide & What You Depend On

**You provide to Member 2 (`@backend`):**
- Loaded rows (or schema-aligned loader output) for all 6 Supabase tables: `regions`, `hotspots`, `monthly_counts`, `monthly_harmonized`, `monthly_grid_counts`, `harmonization_factors`.
- Documented sensor earliest dates, overlap years, national/province calibration factors, validation (`correlation`, `MAE`, `RMSE`, `MAPE`), and unassigned coastal/offshore rules in `docs/DATA.md` & `docs/HARMONIZATION.md`.

**You provide to Member 3 (`@frontend`) & Member 4 (`@ai`):**
- `src/content/data-notes.ts` (`DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, `HARMONIZATION_NOTE`) — already exported (`[x]`).
- Real counts & validation stats for `docs/presentation/4-slide-pitch.md` & `judge-questions.md`.

**You depend on (`@backend`):**
- Confirmation that the loader's `PH` country alias, source-derived ADM2 IDs, table columns, and conflict keys match the migration; Member 3 must confirm the country-ID convention works with the UI.
- Service-role credentials via environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) to execute seeding.

---

## 5. Environment Variables You Use

| Variable | Availability (values never printed) | Purpose |
|---|---|---|
| `SUPABASE_URL` | Present in ignored `.env.local`; load with `node --env-file=.env.local` | Server target for database seeding (`scripts/ingest/`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Present in ignored `.env.local`; value never printed | Server-only write key for seeding Supabase tables (never expose client-side or commit). |
| `FIRMS_MAP_KEY` | Present in ignored `.env.local`; value never printed | Needed only if fetching live FIRMS NRT/Area API beyond supplied CSVs. |

---

## 6. MVP Scope & Execution Priority (`MVP-MUST` First)

| Priority | Task ID | Status | Target Deliverable |
|---|---|---|---|
| `MVP-MUST` | **M1-T1** | `[x]` Done | Removed the Node 24 parameter-property syntax blocker; all 16 ingest tests pass. |
| `MVP-MUST` | **M1-T2** | `[!]` Mapping verified; sign-off pending | Migration fields and UI country lookup match the loader mapping; the live database country ID is reconciled to `PH`; Member 2/3 sign-off remains outstanding. |
| `MVP-MUST` | **M1-T3** | `[x]` Seeded and idempotent | All six Supabase tables are populated; the second full run inserted zero rows and produced identical counts. |
| `MVP-MUST` | **M1-T4** | `[x]` Scope fallback documented | The 2020–2025 local subset and its limits are documented in data, harmonization, and presentation materials; no early-2000s or 2026 records are claimed. |
| `MVP-SHOULD` | **M1-T5** | `[!]` Partially verified | Post-load counts and source comparisons match; complete Philippine coverage, historical data, and actual overlap remain unverified. |
| `MVP-SHOULD` | **M1-T6** | `[!]` Handoff updated; confirmation pending | The handoff includes verified database counts and provisional metrics; Member 4 confirmation remains outstanding. |

---

## 7. Actionable Task List

### M1-T1 (`MVP-MUST`) `[x]` Fix `aggregate.ts` Node 24 Syntax Error
- **Objective:** Make `scripts/ingest/*.test.ts` pass cleanly under default Node 24 execution without needing `--experimental-transform-types`.
- **Files:** `scripts/ingest/aggregate.ts`
- **Steps:**
  1. Open `scripts/ingest/aggregate.ts` around line `140`.
  2. Replace any TypeScript constructor parameter property (`private`/`public`/`readonly` in `constructor(...)`) with an explicit class field declaration and assignment inside the constructor body.
- **Interfaces:** Preserve all exported types and function signatures in `aggregate.ts`.
- **Edge cases:** Ensure no enum or runtime TS-transform-only feature remains anywhere in `scripts/ingest/*.ts`.
- **Acceptance criteria:** All current tests across `scripts/ingest/*.test.ts` pass under Node 24 without `--experimental-transform-types`.
- **How to verify:** Run the ingestion test files through `tests/analytics/register-paths.mjs`; current result is `16/16` passing, exit code `0`.
- **Needs from others:** None.

### M1-T2 (`MVP-MUST`) `[!]` Confirm Schema & Region ID Alignment
- **Objective:** Eliminate structural mismatches with the checked-in migration and obtain Member 2/3 sign-off. The loader maps the country to `PH`, and the live database is reconciled; team sign-off is still outstanding.
- **Files:** `scripts/ingest/load-regions.ts`, `scripts/ingest/aggregate.ts`, `scripts/ingest/harmonize.ts` (read `supabase/migrations/20261114000000_create_fire_memory_schema.sql` — DO NOT edit SQL).
- **Steps:**
  1. Country ID is `PH` because `DashboardShell.tsx` uses it for the live default and country bounds; source-derived ADM2 IDs are retained and their parent IDs are mapped to `PH`. The live legacy country row was reparented and reconciled.
  2. The six non-province ADM2 `"region"` rows (`City of Isabela`, `Cotabato City`, NCR Districts 1–4) retain `level = 'region'` and `parent_id = 'PH'`; confirm Member 2's API and Member 3's UI accept them.
  3. Align **`hotspots` columns (`schema.sql:30-45` vs `ingest.ts:33-48`)**: Map `hotspot.id` (`"sha256:..."`) -> `source_key`, generate deterministic/random UUID for `id` (or omit to use `DEFAULT gen_random_uuid()`), populate `source_id` cleanly (non-null unique), convert camelCase (`acquisitionDatetime`, `sourceProduct`) to snake_case (`acquisition_datetime`, `source_product`), and serialize numeric/string `confidence` as `TEXT`.
  4. Align **`monthly_grid_counts` (`schema.sql:95-107` vs `aggregate.ts:19-28`)**: Map `latitude`/`longitude` -> `cell_lat`/`cell_lon`.
  5. `harmonization_factors` maps `month_count` to `n_months`, MAPE to `error_percent`, and estimated years/metrics to their migration fields. The national row uses its existing or stable ID.
- **Acceptance criteria:** The mapping is field-checked against the migration and tested; Member 2/3 sign-off on the region convention and API/UI behavior remains required.
- **How to verify:** Loader tests pass; live database contains one `PH` country, 87 child regions, and all six seeded tables.
- **Needs from others:** `@backend` confirmation of migration columns and conflict keys; `@frontend` confirmation of the country ID convention.

### M1-T3 (`MVP-MUST`) `[x]` Create Idempotent Supabase Loader (`scripts/ingest/load-supabase.ts`) & Seed Live DB
- **Objective:** Load all 6 Supabase tables idempotently from processed ingest JSON/JSONL artifacts using server-side `SUPABASE_SERVICE_ROLE_KEY`.
- **Files:** `scripts/ingest/load-supabase.ts` (new), `docs/DATA.md` (update counts).
- **Steps:**
  1. Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env (never print or commit keys). Use `@supabase/supabase-js` already installed in `package.json`.
  2. Insert/upsert in strict foreign-key order:
     - Step 1: `regions` (`onConflict: "id"`).
     - Step 2: `harmonization_factors` (`onConflict: "region_id"` for provinces; national row reuses its existing ID or uses a stable ID).
     - Step 3: `monthly_counts` (batches of 500–1000, `onConflict: "region_id,year,month,instrument"`).
     - Step 4: `monthly_harmonized` (batches of 500–1000, `onConflict: "region_id,year,month"`).
     - Step 5: `monthly_grid_counts` (batches of 500–1000, `onConflict: "cell_id,year,month,instrument"`).
     - Step 6: `hotspots` (recent 12–24 months window only, `onConflict: "source_key"`).
  3. Support `--dry-run`, `--apply`, `--limit`, and progress logging (`inserted`, `updated`, `skipped`, `durationMs`), then re-run once to confirm idempotency (zero duplicate rows).
  4. Verify via SQL/API count that `regions`, `monthly_counts`, `monthly_harmonized`, `monthly_grid_counts`, `harmonization_factors`, and `hotspots` are populated.
- **Edge cases:** Coastal points outside every province (`province_id = null`) must still load to `hotspots` and national aggregates per `@backend` contract without FK failure. Never insert `0` for missing-coverage months (`has_coverage = false` or omit missing cell).
- **Acceptance criteria:** Re-running `load-supabase.ts` produces identical row counts; `SELECT COUNT(*)` in all 6 Supabase tables is `> 0`; zero credentials appear in logs or repo files.
- **How to verify:** `node --env-file=.env.local --import ./tests/analytics/register-paths.mjs scripts/ingest/load-supabase.ts --apply` completed repeatedly; the repeat inserted zero rows. Live counts: `regions=88`, `hotspots=63386`, `monthly_counts=6870`, `monthly_harmonized=4084`, `monthly_grid_counts=48321`, `harmonization_factors=82`.
- **Needs from others:** None for the completed seed; schema/UI sign-off is tracked under M1-T2.

### M1-T4 (`MVP-MUST`) `[x]` Resolve Data Horizon Gap (Archive or Documented Scope Fallback)
- **Objective:** Obtain pre-2018 MODIS archive (2001/2003–2019) and current `2026` FIRMS observations so the harmonized calendar delivers the early-2000s-to-present scope.
- **Files:** `data/**` (gitignored raw/processed files), `docs/DATA.md`, `docs/HARMONIZATION.md`.
- **Steps:**
  1. `FIRMS_MAP_KEY` is present in `.env.local`; use it only through the process environment. Submit NASA FIRMS Archive Download requests for Philippines `MODIS_SP` (2000-11 / 2003-01 through 2019-12) and `2026` `MODIS_NRT` / `VIIRS_NOAA20_NRT` / `VIIRS_SNPP_SP`; the key does not establish archive coverage or replace the request manifest.
  2. Process year-by-year through `ingest.ts` -> `aggregate.ts` -> `harmonize.ts` -> `load-supabase.ts` (keep raw points only for recent 12–24 months in `hotspots`; aggregates-only for early 2000s–2023).
  3. Confirm `monthly-harmonized.json` now generates real `is_estimated=true` rows for pre-VIIRS months (`< 2018-04` for NOAA-20 or `< 2012-01` if Suomi-NPP VIIRS is added!).
  4. If NASA FIRMS Archive turnaround misses hackathon deadline, explicitly document exact downloaded range (`2020–2025` provisional vs expanded) in `docs/DATA.md` & `docs/HARMONIZATION.md` and notify Member 4 so slide claims stay 100% honest.
- **Edge cases:** Do not mix Suomi-NPP (`2012-01`) and NOAA-20 (`2018-04`) calibration targets silently without updating `docs/HARMONIZATION.md` cutoff rules (`harmonize.ts` currently anchors to NOAA-20 `2018-04-01`).
- **Acceptance criteria:** Either pre-2018 `is_estimated=true` rows and `2026` recent `hotspots` exist in Supabase, OR scope boundary (`2020–2025`) is explicitly confirmed across `DATA.md`, `HARMONIZATION.md`, and pitch deck.
- **How to verify:** Query `SELECT MIN(year), MAX(year), BOOL_OR(is_estimated) FROM monthly_harmonized;` in Supabase.

### M1-T5 (`MVP-SHOULD`) `[!]` Re-Run Validation & Complete `docs/DATA.md` + `docs/HARMONIZATION.md`
- **Objective:** Finalize verified counts, sensor earliest dates, overlap statistics, leave-one-year-out results, and anomaly consistency after final data load. Database payload comparisons are complete; geographic coverage and overlap certainty remain unverified.
- **Files:** `docs/DATA.md`, `docs/HARMONIZATION.md`.
- **Steps:**
  1. Keep coverage and overlap `VERIFY` notes where archive metadata is unavailable; state why they cannot be confirmed rather than treating detection months as coverage.
  2. Document exact Supabase counts and source comparisons, including `databaseLoaded=false` in the local aggregate report as a description of that local-only step.
- **Acceptance criteria:** Database counts and local/database comparisons are documented; unresolved coverage, overlap, and history gaps remain explicit and are not represented as verified.
- **How to verify:** `docs/DATA.md` reports the live counts and matching year/instrument totals; `docs/HARMONIZATION.md` links the provisional validation and coverage limits.

### M1-T6 (`MVP-SHOULD`) `[!]` Post-Load Reconciliation & Handoff Metrics to Member 4
- **Objective:** Supply exact source-traceable production metrics (`regions`, `hotspots`, date range, national factor, correlation, MAPE) to Member 4 for Slide 1, Demo Script, and Judge Q&A.
- **Files:** `docs/DATA.md` (and post numbers to team board / Member 4).
- **Steps:** Database counts and raw-window totals have been reconciled. Confirm the summary with Member 4 and ensure the pitch keeps the provisional coverage caveats (`total MODIS rows`, `total VIIRS rows`, `national factor`, `LOYO correlation`, `LOYO MAPE`, `rawWindow`).
- **Acceptance criteria:** Numbers in `docs/HARMONIZATION.md`, Supabase DB, and Member 4's `docs/presentation/4-slide-pitch.md` match identically.

---

## 8. Edge Cases & Honesty Rules

- **Satellite detections ≠ confirmed fires:** Never label FIRMS thermal anomalies as verified ground fire incidents.
- **Missing data ≠ zero:** Absent sensor/month combinations remain `null` or `has_coverage = false`; never backfill zeros.
- **UTC boundaries:** All acquisition timestamps and monthly buckets (`year`, `month`) are UTC.
- **Secret hygiene:** Read `FIRMS_MAP_KEY` and `SUPABASE_SERVICE_ROLE_KEY` exclusively from env; never commit keys or raw `data/raw/*.csv` files.

---

## 9. Verification Commands

```bash
# Ingest & region unit tests (current result: 16 passing)
node --import ./tests/analytics/register-paths.mjs --test scripts/ingest/*.test.ts

# Inspect local pipeline type safety
npx tsc --noEmit
```

---

## 10. Handoff Checklist

- [x] `M1-T1`: `scripts/ingest/aggregate.ts` fixed; all 16 current ingest tests pass natively.
- [ ] `M1-T2`: Schema & `regions.id` mapping signed off with `@backend` and `@frontend`.
- [x] `M1-T3`: `scripts/ingest/load-supabase.ts` runs idempotently; all 6 Supabase tables populated (`> 0` rows), with zero inserts on the repeat run.
- [x] `M1-T4`: Verified `2020–2025` supplied-file scope and limitations documented across data, harmonization, and presentation materials; deck claims remain provisional.
- [ ] `M1-T5`: Post-load database/source counts are reconciled in `docs/DATA.md`; historical coverage, overlap verification, and early MODIS estimates remain incomplete.
- [ ] `M1-T6`: Post-load figures are in `docs-presentation-data/member-1-handoff.md`; Member 4 (`@ai`) confirmation and pitch updates remain.
- [!] Member 1 changes are scoped; an unrelated `.env.example` edit is present in the worktree and was left untouched.

---

## 11. Blocked Template & Cut Order

**If blocked, post in team chat:**
> `@Member-2 I need: confirmation that the loader's PH country alias, source-derived ADM2 IDs, and schema conflict keys match the migration. @Member-3 I need: confirmation that the PH country ID is compatible with the UI. File: supabase/migrations/20261114000000_create_fire_memory_schema.sql and the frontend country lookup. Why: confirm the chosen convention for ongoing UI/API integration and future loads. By hour: ASAP.`

**If time runs short:**
1. Cut expanding pre-2010 MODIS beyond already-downloaded years first (load `2020–2025` cleanly + one recent `hotspots` slice into Supabase so live DB works end-to-end!).
2. Never cut: accurate harmonization validation metrics, UTC grouping, `null` for missing months, and honest `docs/HARMONIZATION.md` limits.
