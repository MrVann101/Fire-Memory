# Member 2 implementation plan: Backend and Analytics

## 1. Role summary

Member 2 owns the Supabase schema, server-side query layer, analytics
functions, API routes, validation, and analytics tests. This member turns
Member 1's aggregates into exact contract responses for the map, calendar,
anomaly panel, AI, and exports.

## 2. Your files

Create or edit only:

```text
supabase/**
src/lib/db/**
src/lib/analytics/**
src/app/api/regions/**
src/app/api/hotspots/**
src/app/api/analytics/**
tests/analytics/**
docs/implementation/member-2-*.md
```

Do not touch `src/contracts/**`, `src/mocks/**`, `package.json`, lockfile,
configs, `.env.example`, `README.md`, Member 1 data/scripts/content, Member 3
frontend files, or Member 4 AI/export files.

## 3. What you provide to others

- `listRegions(): Promise<Region[]>`
- `queryHotspots(filters: HotspotFilters, limit?: number): Promise<HotspotsResponse>`
- `getAnalyticsSummary(query: AnalyticsQuery): Promise<AnalyticsSummary>`
- `getCalendar(query: Omit<AnalyticsQuery, "year" | "month">): Promise<CalendarResponse>`
- `getHarmonization(regionId: string): Promise<HarmonizationResponse>`
- `GET /api/regions`, `/api/hotspots`, `/api/analytics/summary`,
  `/calendar`, `/children`, and `/harmonization`.

All responses must match the locked types exactly. Member 4 calls the
functions directly for exports; Member 3 calls the routes through its client
helpers.

## 4. What you depend on

- Member 1's migration inputs, region IDs, coverage flags, monthly tables,
  factors, and raw-window data.
- Locked contracts and mock responses during Phase 1.
- Member 3's UI does not require polygon geometry; return bbox data.
- Member 4 uses stubs until these functions and routes are real.

## 5. Environment variables

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and server-only
`SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never be imported into
browser code, logged, or returned in errors.

## 6. Task list

### MVP scope

| Deliverable | Task | Working by |
|---|---|---|
| Six-table migration and indexes | M2-T1 | Hour 2 |
| Regions and raw hotspot queries | M2-T2 | Hour 8 |
| Summary/calendar analytics | M2-T3 | Hour 16 |
| Core analytics routes | M2-T4 | Hour 20 |
| Validation, errors, and tests | M2-T5 | Hour 22+ |
| Custom-area aggregation | M2-T6 | MVP-SHOULD, hour 22+ |

**First working slice:** one province-month summary on the harmonized series,
with a hand-verified median and anomaly label.

### M2-T1 — Write the migration (MVP-MUST, hours 0–2)

**Objective:** create the tables and indexes required by ingestion and
analytics without changing the contract.

**Files:** `supabase/migrations/**`.

**Tables and required fields:**

- `regions`: `id`, `name`, `level`, `parent_id`, `bbox`, boundary metadata.
- `hotspots`: `id`, coordinates, acquisition timestamp, satellite,
  instrument, confidence, brightness, source ID/key, source product,
  ingested timestamp, nullable `province_id`.
- `monthly_counts`: region, year, month, instrument, `raw_count`,
  `active_cell_days`, `has_coverage`.
- `monthly_harmonized`: region, year, month, `harmonized_count`,
  `is_estimated`, `method_version`.
- `monthly_grid_counts`: cell ID/center, year/month, instrument,
  `raw_count`, `active_cell_days`.
- `harmonization_factors`: region scope, factor, method, overlap years,
  month count, correlation, error, computed time.

**Steps:** add uniqueness for source key and each aggregate's natural key;
index `hotspots` by `province_id`, acquisition time, and instrument;
index monthly tables by region/year/month/instrument; index grid cells by
cell and period. Explain each index in the migration comment or plan.

**Acceptance:** Member 1 can insert and rerun data without duplicate keys;
summary queries can filter by region and period without scanning raw history.

**Verify:** apply migration to a disposable database and insert one row per
table, including a duplicate source key.

### M2-T2 — Build region and hotspot query layer (MVP-MUST, hours 2–8)

**Objective:** provide validated region lookup and bounded raw-window
queries.

**Files:** `src/lib/db/**`, `src/app/api/regions/**`,
`src/app/api/hotspots/**`.

**Steps:**

1. Validate `regionId`, optional bbox, ISO dates, instrument, and limit with
   `zod`.
2. `listRegions` returns country/province records with exact `Region`
   fields.
3. `queryHotspots` filters by country or province, UTC start/end, and
   optional instrument. A country query includes assigned provinces plus
   unassigned rows inside the country boundary as defined by ingestion.
4. Use default limit 2,000 and maximum 10,000 unless integration changes
   this locked operational choice. When over limit, sample deterministically
   across the time window rather than returning only earliest rows.
5. Return `total`, `returned`, `truncated`, `rawWindow`, and `lastUpdated`.

**Acceptance:** bad inputs return 400; valid empty windows return a valid
empty response; large results are bounded and visibly marked truncated.

**Verify:** curl regions and hotspots with valid, invalid, empty, custom bbox,
instrument, and over-limit requests.

### M2-T3 — Implement analytics rules (MVP-MUST, hours 8–16)

**Objective:** calculate exact same-month historical comparisons from monthly
tables, never from raw hotspot history.

**Files:** `src/lib/analytics/**`, `tests/analytics/**`.

**Rules and interfaces:**

1. `metric=harmonized` reads `monthly_harmonized`; instrument is `ALL` in
   output and the request instrument is ignored.
2. `metric=raw` reads `monthly_counts`; `instrument=MODIS`, `VIIRS`, or
   `ALL` applies only here.
3. Group all periods in UTC.
4. Baseline uses the selected month across complete past years only.
   A year is complete when the selected monthly record has coverage true;
   missing coverage is excluded, never treated as zero. Exclude the current
   incomplete month.
5. Compute median in SQL, for example `percentile_cont(0.5)`, over the
   selected aggregate values. Do not load raw rows and calculate in
   JavaScript.
6. `anomalyPercent = (current - median) / median * 100`; if median is
   missing or zero, return `null` and `not_calculable`.
7. Keep a pure label function with setup thresholds: near baseline within
   +/-15%; unusually high at +50% or more; document the final threshold
   agreement before release.
8. Return `null` for missing coverage, `baselineYears`,
   `estimatedBaselineYears`, `currentIsEstimated`, `harmonization`,
   `dataCoverage`, and notes for small samples, mixed raw sensors, partial
   months, and estimated baselines.

**Acceptance:** two hand-calculated province-months match; zero median never
divides; missing values are null; current incomplete month is not scaled.

**Verify:** run pure-label unit tests and compare SQL output with a hand
worksheet.

### M2-T4 — Implement analytics routes (MVP-MUST, hours 16–20)

**Objective:** expose the full locked analytics contract.

**Files:** `src/app/api/analytics/**`, `src/lib/analytics/**`.

**Routes:**

- `/summary?regionId&bbox&year&month&metric&instrument` -> `AnalyticsSummary`
- `/calendar?regionId&bbox&metric&instrument` -> `CalendarResponse`
- `/children?regionId&year&month&metric` -> `ChildCount[]`
- `/harmonization?regionId` -> `HarmonizationResponse`

Use SQL `GROUP BY` and aggregate queries. Children returns province counts
for a country and an empty array for a province. Core routes must not depend
on custom-area support.

**Acceptance:** every core route validates inputs, returns exact field names,
and does not read `hotspots` for calendar, median, or anomaly calculations.

**Verify:** curl all four routes for country, province, raw, harmonized,
zero, missing, and estimated cases.

### M2-T5 — Errors, security, and verification (MVP-MUST, hours 20–22+)

**Objective:** make failures explicit and safe.

**Files:** `src/lib/db/**`, `src/lib/analytics/**`,
`src/app/api/**`, `tests/analytics/**`.

Return a consistent error body with a safe message and request context:
400 for validation, 404 where the selected region does not exist, and 500
for database/provider failures. Do not return stack traces or success-shaped
fallbacks. Add tests for malformed bbox, bad date/month, invalid metric,
database failure, empty results, zero baseline, missing coverage, estimated
years, custom approximation, and service-key isolation.

### M2-T6 — Add custom-area aggregation (MVP-SHOULD, hours 22+)

**Objective:** support approximate custom rectangles without making them a
dependency of the required country/province analytics.

**Files:** `src/lib/analytics/**`, `src/app/api/analytics/**`,
`tests/analytics/**`.

**Steps:** validate `bbox=minLon,minLat,maxLon,maxLat`; sum
`monthly_grid_counts` cells inside the bbox; use the national
harmonization factor; return `approximate=true`; add a limitation note.

**Edge cases:** reject reversed/out-of-range coordinates, empty cells, and
missing national factor; never return a precise-looking result.

**Acceptance:** a valid custom query returns the exact contract shape with
`approximate=true`; invalid bboxes return 400; the required flow still works
when this task is omitted.

**Verify:** run custom country-sized, small, reversed, out-of-range, and
empty-bbox tests.

**Needs:** Member 1's `monthly_grid_counts` and national factor; use a
documented unsupported response until those tables exist.

## 7. Edge cases and honesty rules

- Missing coverage is `null`, never zero.
- A partial current month is shown as partial and never scaled.
- A small baseline gets a note; it is not silently treated as reliable.
- `ALL` means both instruments only in raw mode.
- National totals and province totals may differ because unassigned points
  are reported separately.
- A harmonized value is not proof of sensor equivalence.
- Never leak service credentials, SQL details, or stack traces to clients.

## 8. Test plan

Use the repository's existing test runner; if none exists, request the
locked dependency/config change and do not add it alone. Tests must cover:

1. Pure label thresholds and all `AnomalyLabel` values.
2. SQL median with odd/even samples and zero baseline.
3. Complete versus missing years.
4. Raw instrument filtering versus harmonized instrument ignoring.
5. Estimated baseline/current flags and notes.
6. Custom bbox aggregation and `approximate=true`.
7. Route validation/status/error bodies.
8. Limit, truncation, raw-window, and last-updated behavior.

Expected result: a failed provider or invalid request is observable, and all
contract fields are present.

## 9. Handoff checklist

- [ ] Migration creates all six required tables and uniqueness constraints.
- [ ] Indexes cover region, period, instrument, and raw acquisition queries.
- [ ] `listRegions` and `queryHotspots` match exact signatures.
- [ ] Hotspot responses include limit, truncation, raw window, and timestamp.
- [ ] Median is same-month, complete-past-years only, and computed in SQL.
- [ ] Current incomplete month has a note and is not scaled.
- [ ] Zero/missing median returns `not_calculable` and null anomaly.
- [ ] Estimated years and harmonization metadata are returned.
- [ ] Raw versus harmonized metric semantics are tested.
- [ ] Children and harmonization routes match contract.
- [ ] Custom bbox validates and returns `approximate=true`.
- [ ] Curl smoke tests and unit tests pass without secrets in output.

## 10. If you are blocked

Send: `@owner I need: [specific table/field/contract clarification]. File:
[path]. Why: [reason]. By hour: [hour].` Meanwhile use the locked mocks,
seed a local disposable database, and test pure analytics functions.

## 11. If time runs short

Keep migration, raw/harmonized summary, calendar, median, anomaly labels,
coverage semantics, and smoke tests. Cut custom areas, performance tuning
beyond indexes, and optional region levels first. Never make raw hotspots the
source for historical analytics.

## 12. Open questions and assumptions

- `VERIFY`: the repository's test runner and actual Supabase/PostGIS
  capabilities.
- Assume SQL percentile support is available; use an equivalent SQL median
  only if the database version requires it.
- Assume the default/maximum hotspot limits are 2,000/10,000 until team
  integration confirms them.
- Assume missing selected-month coverage excludes a baseline year.
- Assume custom-area national-factor behavior follows the locked contract.
