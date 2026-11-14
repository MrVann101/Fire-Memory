# Member 1 implementation plan: Data and FIRMS

## 1. Role summary

Member 1 owns the FIRMS acquisition, normalization, boundaries, ingestion,
monthly aggregation, harmonization, validation, and data-attribution text.
This work supplies the only trustworthy historical series for the dashboard;
the central deliverable is a validated harmonized MODIS/VIIRS series, not a
simple concatenation of sensor rows.

## 2. Your files

Create or edit only:

```text
data/**
scripts/ingest/**
docs/DATA.md
docs/HARMONIZATION.md
docs/implementation/member-1-*.md
docs-presentation-data/**
src/content/**
```

Do not touch `src/contracts/**`, `src/mocks/**`, `package.json`, the lockfile,
configs, `.env.example`, `README.md`, `supabase/**`, `src/lib/**`,
`src/app/**`, `src/components/**`, `src/hooks/**`, or another member's plan.
Ask the owner using the request format if a change outside these paths is
needed.

## 3. What you provide to others

- Populate `regions`, `hotspots`, `monthly_counts`,
  `monthly_harmonized`, `monthly_grid_counts`, and
  `harmonization_factors` using Member 2's migration.
- Export `DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, and `HARMONIZATION_NOTE`
  from `src/content/data-notes.ts`.
- Provide `docs/DATA.md`, `docs/HARMONIZATION.md`, labeled samples, and
  validation numbers consumed by the backend, UI, AI, and presentation.
- Preserve the exact contract fields: `instrument`, original `confidence`,
  `acquisitionDatetime`, `sourceProduct`, coverage flags, estimated flags,
  and harmonization metadata.

## 4. What you depend on

- **Member 2 migration and database access:** use the Phase 0 migration
  stub or local sample writer until Supabase is available.
- **Locked types and mocks:** use `Hotspot`, `Region`, and table names from
  `src/contracts/types.ts`; do not edit them.
- **Member 2 service credentials:** read environment variables; never print
  service keys. If blocked, aggregate to reproducible files and continue.

## 5. Environment variables

`FIRMS_MAP_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Read them
from the environment. Never place values in logs, samples, plans, Git, or
client-side code.

## 6. Task list

### MVP scope

| Deliverable | Task | Working by |
|---|---|---|
| Official FIRMS access and verified fields | M1-T1 | Hour 3 |
| Common MODIS/VIIRS schema and samples | M1-T2 | Hour 7 |
| WGS84 country/province boundaries | M1-T3 | Hour 10 |
| Recent raw window with province assignment | M1-T4 | Hour 13 |
| Full-history monthly counts | M1-T5 | Hour 18 |
| Harmonized series and validation | M1-T6 | Hour 22 |
| Data notes and validation report | M1-T7 | Hour 24 |

**First working slice:** one province, both instruments, verified overlap
years, one monthly aggregate, one factor, and one independently checked
`active_cell_days` value.

### M1-T1 — Request archives and inspect FIRMS (MVP-MUST, hours 0–3)

**Objective:** start the slow archive requests immediately and verify facts
from current official FIRMS documentation rather than memory.

**Files:** `data/raw/**`, `data/sample/**`, `docs/DATA.md`.

**Steps:**

1. Read the official FIRMS product and archive documentation.
2. Verify product names, MODIS/VIIRS satellites, standard versus NRT
   products, CSV fields, country/bbox options, request day limits,
   `MAP_KEY`, attribution, and usage terms.
3. Request Philippines archive downloads for both instruments immediately.
4. Record each sensor's earliest date, coverage gaps, and overlap years as
   `VERIFY` until documentation and files agree.
5. Save small labeled samples with source URL, retrieval date, and
   `_simulated` absent; samples are real data and must not be mislabeled.

**Interfaces:** source rows must ultimately map to `Hotspot`; retain
instrument and satellite.

**Edge cases:** unavailable archive, rate limit, malformed CSV, missing
columns, and NRT-only coverage must be recorded in `docs/DATA.md`, not
silently replaced.

**Acceptance:** both requests exist or a documented access blocker exists;
the field list and earliest-date/overlap status are written; no key appears
in a file or log.

**Verify:** inspect download metadata and run a header/row-count check.

**Needs:** `FIRMS_MAP_KEY`; use a local sample and a stub database writer if
the archive request is still pending.

### M1-T2 — Normalize records and define keys (MVP-MUST, hours 3–7)

**Objective:** normalize MODIS and VIIRS rows without destroying
instrument-specific meaning.

**Files:** `scripts/ingest/normalize.ts`, `data/sample/**`, `docs/DATA.md`.

**Steps:**

1. Build a field mapping table: source date/time, latitude, longitude,
   satellite, confidence, brightness, source product, and source ID/key to
   `Hotspot` fields.
2. Preserve confidence exactly as supplied: numeric values remain numeric
   and categorical values remain strings.
3. Combine date and time into ISO 8601 UTC. Accept zero-padded and
   documented non-padded times; reject impossible values.
4. Use a documented composite key or hash of instrument, satellite,
   coordinates, UTC date/time, source product, and stable source fields.
   Coordinates alone are not unique.
5. Validate latitude/longitude ranges, required fields, and source product.
6. Keep the original row fields available for audit where practical.

**Acceptance:** MODIS and VIIRS samples produce valid `Hotspot` records;
normalization is deterministic; duplicate source rows produce one key;
confidence is not converted.

**Verify:** run the normalizer on each sample and compare output counts and
keys with a fixture review.

**Needs:** locked contract types; no UI or backend edits.

### M1-T3 — Prepare boundaries and region loader (MVP-MUST, hours 7–10)

**Objective:** load licensed Philippines and province boundaries in WGS84
for reliable point assignment.

**Files:** `data/boundaries/**`, `scripts/ingest/load-regions.ts`,
`docs/DATA.md`.

**Steps:**

1. Evaluate candidate free sources such as GADM, geoBoundaries, OSM-derived
   administrative data, or another official/open source; mark the final
   source `VERIFY` until license and provenance are checked.
2. Keep EPSG:4326, simplify only after checking that province membership
   remains stable, and normalize names such as `Bukidnon`.
3. Produce the country and province records required by `Region`; store
   bbox and boundary data for the loader.
4. Record source, license, simplification tolerance, and boundary date.

**Edge cases:** disputed boundaries, multipolygons, coastal geometry, and
duplicate province names must be resolved by stable IDs and documented.

**Acceptance:** the Philippines boundary and all selected provinces load;
three known points assign to expected provinces; the license is recorded.

**Verify:** run a point-in-polygon fixture and compare bbox values.

**Needs:** Member 2 migration stub; use a local GeoJSON output first.

### M1-T4 — Ingest recent raw points (MVP-MUST, hours 10–13)

**Objective:** populate the recent `hotspots` window with idempotent,
province-assigned records.

**Files:** `scripts/ingest/ingest.ts`, `scripts/ingest/**`,
`docs/DATA.md`.

**Steps:**

1. Select and document a 12–24-month raw window after archive inspection;
   preserve `rawWindow` dates for the API.
2. Stream files in batches; reject invalid coordinates and count them.
3. Use bbox pre-filter, then point-in-polygon; assign `province_id`.
4. Keep coastal/outside points as unassigned, count them, and report them.
5. Insert by the documented unique source key with conflict-safe behavior.
6. Log file, year/month, read, accepted, rejected, assigned, unassigned,
   inserted, and duplicate counts without logging secrets.
7. Run the import twice and compare counts.

**Acceptance:** every accepted raw row has an instrument and stable key;
the second run adds zero records; unassigned rows are measurable.

**Verify:** query total rows and unique keys before and after the second
run; reconcile three source file counts.

**Needs:** Member 2's `hotspots` migration; use a local batch sink if
database access is not ready.

### M1-T5 — Aggregate full history (MVP-MUST, hours 13–18)

**Objective:** create monthly sensor aggregates from the earliest available
history without retaining all archive points.

**Files:** `scripts/ingest/aggregate.ts`, `data/**`, `docs/DATA.md`.

**Steps:**

1. Process one archive year at a time, overlap years first, then MODIS
   history and remaining VIIRS history.
2. Group by UTC year/month, province, and instrument.
3. Store `raw_count` and active 0.01-degree grid cell-days. A cell counts
   once per UTC day per sensor, regardless of repeated points that day.
4. Store `has_coverage=false` for known no-data months; never create a zero
   merely because no row was read.
5. Also aggregate 0.1-degree cells into `monthly_grid_counts`.
6. Batch writes, checkpoint progress, and discard raw rows after a year is
   safely written.

**Acceptance:** both instruments appear in `monthly_counts`; coverage gaps
are explicit; one hand-counted cell-day agrees with the aggregate.

**Verify:** query three province-months against source files and record
coverage by year/instrument.

**Needs:** Member 2 tables; a local aggregate file is the fallback.

### M1-T6 — Harmonize and validate (MVP-MUST, hours 18–22)

**Objective:** build a defensible VIIRS-equivalent monthly series and
measure where it is weak.

**Files:** `scripts/ingest/harmonize.ts`, `docs/HARMONIZATION.md`,
`data/**`.

**Steps:**

1. Select overlap years only after M1-T1 verification.
2. For each province with enough qualifying overlap months and MODIS
   activity, calculate the median monthly `VIIRS/MODIS` ratio; otherwise
   calculate and use the national factor. Record the exact minimums as
   `VERIFY` until agreed.
3. Use VIIRS values when VIIRS operates. Before VIIRS, multiply MODIS
   active cell-days by the factor and set `is_estimated=true`.
4. Write `HarmonizationInfo`: method, target `VIIRS`, overlap years, factor,
   scope, correlation, error, estimated years, and notes.
5. Validate scaled MODIS versus VIIRS with correlation and error,
   leave-one-year-out recalibration/prediction, and anomaly-label
   consistency between MODIS-only and VIIRS-only histories.
6. If validation is weak, publish the measured result, warning, and
   fallback recommendation; do not call the series equivalent.
7. Recompute one province factor and one cell-day value independently.

**Acceptance:** `monthly_harmonized` and `harmonization_factors` are filled;
MODIS-only months are estimated; all four validation outputs are recorded;
the independent recomputation matches within documented numeric tolerance.

**Verify:** run the harmonizer twice and compare factor/version/output
checksums; inspect one province manually.

**Needs:** complete monthly tables; use one national factor and overlap
years only as the documented fallback.

### M1-T7 — Publish data notes and handoff material (MVP-MUST, hours 22–24)

**Objective:** make provenance, limits, and method visible in the product.

**Files:** `docs/DATA.md`, `docs/HARMONIZATION.md`,
`src/content/data-notes.ts`, `docs-presentation-data/**`.

**Required text exports:**

- `DATA_ATTRIBUTION`: “Data: NASA Fire Information for Resource
  Management System (FIRMS), MODIS and VIIRS active-fire products.
  Product names, retrieval dates, and attribution requirements are listed
  in the data documentation.”
- `DATA_LIMITATIONS`: “These are satellite detections of thermal
  anomalies, not confirmed fires or a complete incident record. Coverage,
  sensor sensitivity, boundaries, and missing observations affect counts.
  MODIS-only values converted to the VIIRS target are estimates.”
- `HARMONIZATION_NOTE`: “The series uses UTC monthly active 0.01-degree
  cell-days and overlap-period calibration to a VIIRS-equivalent scale.
  The factor, validation error, overlap years, estimated years, and
  limitations are shown with the result.”

**Acceptance:** the report has source, coverage, method, factors,
correlation, error, leave-one-year-out, consistency results, and limits;
the three exports compile against their consumers.

**Verify:** review the text in the UI integration branch and compare report
numbers with database queries.

## 7. Edge cases and honesty rules

- Never call a detection a confirmed fire.
- Never deduplicate nearby points across instruments unless a reversible,
  documented rule is approved.
- Missing coverage is not zero.
- Preserve MODIS Terra/Aqua and VIIRS satellite provenance even when
  instrument-level aggregates combine them.
- Treat unassigned coastal/outside points as data to report, not silently
  discard.
- Never claim MODIS and VIIRS are equivalent; state factor and error.
- Never print credentials or include them in samples.

## 8. Test plan

1. Normalize fixtures for both instruments, malformed timestamps,
   categorical/numeric confidence, and invalid coordinates.
2. Run point-in-polygon fixtures for country, province, border, and
   unassigned points.
3. Run ingestion twice and assert identical row and unique-key counts.
4. Compare three source files with database raw counts.
5. Recompute one 0.01-degree cell-day by hand.
6. Test factor fallback, zero MODIS denominator, missing coverage, and
   estimated flags.
7. Re-run validation and compare the published report values.

Expected result: failures identify the file, period, and rule; no test turns
missing data into zero.

## 9. Handoff checklist

- [ ] Archive requests, earliest dates, and overlap years are documented or
      explicitly marked `VERIFY`.
- [ ] `data/sample/` contains labeled real sample files and field mapping.
- [ ] Boundaries are WGS84, licensed, simplified, and loadable.
- [ ] Recent raw import assigns province IDs or reports unassigned rows.
- [ ] Two identical imports produce no duplicate rows.
- [ ] `monthly_counts` contains both instruments and coverage flags.
- [ ] `monthly_harmonized` flags all MODIS-converted months.
- [ ] Factors contain method, scope, overlap years, correlation, and error.
- [ ] Correlation, error, leave-one-year-out, and anomaly-consistency
      results are in `docs/HARMONIZATION.md`.
- [ ] Three source counts and one cell-day have been independently checked.
- [ ] `DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, and `HARMONIZATION_NOTE` exist.

## 10. If you are blocked

Send: `@owner I need: [specific migration/field/access change]. File:
[path]. Why: [reason]. By hour: [hour].` Meanwhile, continue with samples,
local aggregates, validation fixtures, and documentation. Do not edit the
other member's file.

## 11. If time runs short

Cut optional boundary polishing, 0.1-degree custom-area aggregates, and
presentation support first. Keep real MODIS/VIIRS samples, recent raw
window, full available monthly aggregates, one national factor, overlap
validation, estimated flags, and limitation text. The raw view is the
honest fallback if province factors are not reliable.

## 12. Open questions and assumptions

- `VERIFY`: final FIRMS product names, field variants, access limits,
  earliest dates, overlap years, and attribution language.
- `VERIFY`: minimum overlap months and MODIS activity for province factors.
- Assume active-cell grid indexing uses integerized 0.01-degree UTC cells.
- Assume national factor fallback is acceptable when provincial data are
  sparse, with the scope shown in `HarmonizationInfo`.
- Assume the raw window is selected after access inspection and disclosed
  through `rawWindow`.
