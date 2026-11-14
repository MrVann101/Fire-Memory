# FIRMS data acquisition and coverage

## Status (checked 2026-11-14)

The user supplied NASA FIRMS CSV downloads in the workspace on 2026-11-14.
They are stored locally under `data/raw/` and excluded from Git. The original
archive request confirmation, exact product selection, retrieval URL, and
standard-versus-NRT designation were not included, so those details remain
**VERIFY**. The archive download page requires Earthdata or email-code
authentication. The country API is currently marked by FIRMS as unavailable;
do not treat that API as a working Philippines download path.

The local files have been inspected for CSV headers, row counts, date ranges,
satellite values, and version values. They contain data for 2020-2025 from
both MODIS Terra/Aqua and VIIRS NOAA-20 (N20). These files do not establish
the earliest available Philippine observations, daily/monthly coverage, or
the complete sensor overlap. In particular, a date absent from a detection
CSV is not proof of missing sensor coverage. Philippine coverage gaps and
actual calibration periods remain **VERIFY** until compared with FIRMS
availability metadata and complete archive coverage.

For ongoing recent-window retrieval, obtain a `FIRMS_MAP_KEY` through NASA
FIRMS and provide it to scripts only through the environment. Never copy a
key into a file, terminal output, or Git.

## Local downloads inspected

The original CSVs are retained outside the repository. The following
workspace copies were checked on 2026-11-14; row counts exclude the header.
The VIIRS `jpss1` filenames and `N20` field identify NOAA-20. `version`
values are recorded verbatim and are not used here to infer standard/NRT.

| File group | Files | Rows | Earliest and latest detection dates in files | `satellite` values | `version` values |
|---|---:|---:|---|---|---|
| MODIS | 6 (2020-2025) | 24,310 | 2020-01-01 to 2025-12-31 | Aqua, Terra | `6.03`, `61.03` |
| VIIRS JPSS-1 / NOAA-20 | 6 (2020-2025) | 153,533 | 2020-01-01 to 2025-12-31 | `N20` | `2` |
| **Total** | **12** | **177,843** | | | |

Per-file rows and observed detection-date ranges:

| File | Rows | First detection | Last detection |
|---|---:|---|---|
| `modis_2020_Philippines.csv` | 5,941 | 2020-01-01 | 2020-12-31 |
| `modis_2021_Philippines.csv` | 3,227 | 2021-01-01 | 2021-12-31 |
| `modis_2022_Philippines.csv` | 2,569 | 2022-01-01 | 2022-12-30 |
| `modis_2023_Philippines.csv` | 4,267 | 2023-01-01 | 2023-12-31 |
| `modis_2024_Philippines.csv` | 6,318 | 2024-01-01 | 2024-12-31 |
| `modis_2025_Philippines.csv` | 1,988 | 2025-01-02 | 2025-12-31 |
| `viirs-jpss1_2020_Philippines.csv` | 38,502 | 2020-01-01 | 2020-12-31 |
| `viirs-jpss1_2021_Philippines.csv` | 20,100 | 2021-01-01 | 2021-12-31 |
| `viirs-jpss1_2022_Philippines.csv` | 15,291 | 2022-01-01 | 2022-12-31 |
| `viirs-jpss1_2023_Philippines.csv` | 24,560 | 2023-01-01 | 2023-12-31 |
| `viirs-jpss1_2024_Philippines.csv` | 41,652 | 2024-01-01 | 2024-12-31 |
| `viirs-jpss1_2025_Philippines.csv` | 13,428 | 2025-01-01 | 2025-12-31 |

The MODIS CSV header is
`latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type`.
The VIIRS CSV header is
`latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type`.
The filenames and row fields are evidence about these local files only; they
do not replace the missing archive manifest or FIRMS coverage metadata.
Small real-row fixtures and their source/field mapping are provided in
[`data/sample/README.md`](../data/sample/README.md).

## Products and published date coverage

FIRMS identifies the following Area API source names. The archive page reports
these product periods as of the check date; these are global published
temporal limits, not confirmation of Philippine file availability.

| Instrument group | FIRMS standard source | FIRMS NRT source | Published temporal coverage |
|---|---|---|---|
| MODIS (Terra/Aqua) | `MODIS_SP` | `MODIS_NRT` | Collection 6.1: 2000-11-01 to present |
| VIIRS Suomi-NPP | `VIIRS_SNPP_SP` | `VIIRS_SNPP_NRT` | 2012-01-20 to 2026-11-02 |
| VIIRS NOAA-20 | `VIIRS_NOAA20_SP` | `VIIRS_NOAA20_NRT` | 2018-04-01 to present |
| VIIRS NOAA-21 | `VIIRS_NOAA21_SP` | `VIIRS_NOAA21_NRT` | 2023-03-01 to present |

Based on those global limits, the candidate complete calendar-year MODIS /
VIIRS overlap for Suomi-NPP is 2013-2025. 2012 and 2026 are partial years.
Other VIIRS platforms overlap MODIS from their listed start dates. These are
candidate calibration years only: include a year in the actual calibration
only after checking the Philippine archive files and per-sensor coverage.
FIRMS documents standard processing as science-quality data and says NRT is
replaced as standard data becomes available; the Archive Download page gives
an approximate five-month lag for that replacement.

The archive page offers CSV, shapefile, and JSON downloads older than the
latest seven days. It requires Earthdata or email-code authentication and
sends download instructions after processing. The Area API is a separate
service: it returns CSV for a bounding box, requires a `MAP_KEY`, and accepts
1-5 days per query. The API documentation currently says the country and
countries endpoints are unavailable. Do not infer the archive request
workflow from the Area API's day limit.

## Fields verified from NASA's active-fire attribute reference

The field reference below describes FIRMS NRT active-fire CSV attributes.
Field names exposed by web services can differ from the column names shown
for source data; inspect the actual downloaded file header before writing a
parser. Standard-processing fields must also be checked against their own
file header and user guide.

| Meaning | MODIS field(s) | VIIRS field(s) | Notes |
|---|---|---|---|
| Coordinates | `Latitude`, `Longitude` | `Latitude`, `Longitude` | Center of the flagged pixel; not necessarily the exact thermal source location |
| Acquisition time | `Acq_Date`, `Acq_Time` | `Acq_Date`, `Acq_Time` | Time is UTC |
| Satellite | `Satellite` | `Satellite` | MODIS codes: `A` Aqua, `T` Terra. VIIRS codes: `N` Suomi-NPP, `N20` NOAA-20, `N21` NOAA-21 |
| Confidence | `Confidence` | `Confidence` | MODIS is 0-100%; VIIRS is categorical (`low`, `nominal`, `high`). Preserve the original value and type |
| Brightness | `Brightness`, `Bright_T31` | `Bright_ti4` / web-service `Brightness`; `Bright_ti5` / web-service `Brightness_2` | Brightness temperatures are in Kelvin |
| Product/version | `Version` | `Version` | Processing collection and processing source/version |
| Fire radiative power | `FRP` | `FRP` | MW |
| Additional attributes | `Scan`, `Track`, `Type`, `DayNight` | `Scan`, `Track`, `DayNight` | `Type` is only available for standard MCD14ML data |

The common-contract mapping is limited to verified shared fields:
`Latitude`/`Longitude` to coordinates; `Acq_Date` + `Acq_Time` to an ISO
8601 UTC timestamp; `Satellite` to the original platform code;
`Confidence` unchanged; `Brightness` (with the verified product-specific
field selection) to brightness; and the actual source product name to
`sourceProduct`. Do not guess missing columns or silently coerce confidence.
The normalizer keeps the original row alongside the contract-shaped record
for audit and retains a product name when one is verified.

## Normalization

`scripts/ingest/normalize.ts` implements the documented `Hotspot` shape
without changing the locked contract. It reads a CSV, validates required
fields and coordinate/time ranges, retains numeric confidence as a number
and categorical confidence as its original string, and maps MODIS
`brightness` or VIIRS `bright_ti4` to `brightness`. UTC acquisition times
accept one- through four-digit `HHMM` values and are emitted as ISO 8601.

The deterministic `id` is a SHA-256 hash of instrument, source satellite,
normalized coordinates and timestamp, `sourceProduct`, and all original
source fields in sorted-name order. Exact duplicate source rows produce one
normalized record. The JSONL output wraps the contract-shaped `hotspot` with
its original `sourceRow` for audit; insert only the nested `hotspot` into a
contract table. `sourceProduct` stays null unless explicitly supplied or
present in the source row. The current downloads lack an archive manifest,
so no standard/NRT product name is inferred from filenames or `version`.

Run one source file at a time:

```powershell
node --experimental-strip-types scripts/ingest/normalize.ts `
  --input data/raw/modis/modis_2020_Philippines.csv `
  --output "$env:TEMP\fire-memory\modis_2020_normalized.jsonl" `
  --instrument MODIS
```

Supply `--source-product` only when verified from the archive metadata.
Equivalent commands apply to VIIRS using its CSV and `--instrument VIIRS`.
The checked real-row sample outputs each contain three contract-shaped
hotspots; numeric MODIS confidence and categorical VIIRS confidence remain
different JSON types. Three focused tests cover UTC conversion, duplicate
rows, confidence types, invalid coordinates, and impossible times.

The shared `src/contracts/types.ts` file is absent from this checkout. The
normalizer mirrors the `Hotspot` definition in the locked work-plan contract
and does not edit or create a shared contract file; integration should check
the type against the contract when that file is supplied.

## Recent raw window

`scripts/ingest/ingest.ts` filters normalized source records to an explicit
date window, assigns ADM2 regions with bbox pre-filtering followed by
point-in-polygon checks, preserves the original instrument/confidence and
source row, and writes deterministic JSONL in batches plus a count report.
The chosen window is 2024-01-01 through 2025-12-31, the two latest calendar
years represented in the supplied downloads. This is a local fallback, not
a current FIRMS window: the files contain no 2026 detections and end on
2025-12-31. The Member 2 schema migration is present. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are present in the ignored `.env.local`; a
standalone Node command must load that file (for example with
`--env-file=.env.local`). No raw-window rows have been inserted.

Compile and run from the repository root in PowerShell:

```powershell
npx tsc --target es2022 --module commonjs --moduleResolution node `
  --strict --esModuleInterop --skipLibCheck --types node `
  --outDir data/processed/.compiled `
  scripts/ingest/ingest.ts scripts/ingest/normalize.ts `
  scripts/ingest/load-regions.ts
node data/processed/.compiled/ingest.js `
  --modis data/raw/modis/modis_2024_Philippines.csv `
  --modis data/raw/modis/modis_2025_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2024_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2025_Philippines.csv `
  --start 2024-01-01 --end 2025-12-31 `
  --output data/processed/raw-window-2024-01-01-to-2025-12-31.jsonl
```

The local run read 63,386 rows from the four source files (8,306 MODIS and
55,080 VIIRS), accepted 63,386 unique records, and found zero invalid rows,
duplicate rows, or records outside the requested window. Of the accepted
points, 62,999 received a province ID, 223 received a retained non-province
ADM2 region ID (city/NCR district), and 164 were unassigned because no
unique ADM2 polygon matched. Thus, unassigned includes ambiguous boundary
matches as well as points outside the selected ADM2 polygons; it is not
limited to coastal detections. The report includes per-file counts and
per-month/instrument, assignment, and duplicate counts. A month absent from
the detection counts is not evidence that the instrument had no coverage.
Re-running the same import produced byte-for-byte identical JSONL and
report files (JSONL SHA-256
`AB39DE54CD7548B05798DC5144C6FE304220CF560F8DAC63D4AD7E347D3123E7`).
The local output and compiled scripts are ignored under `data/processed/`;
`databaseRowsInserted` is zero until the database migration and access are
available. A failed parse or invalid normalized record stops the run with
an error instead of being silently dropped.

## Monthly aggregates

`scripts/ingest/aggregate.ts` processes one source CSV at a time, normalizes
and deduplicates exact source rows, assigns province boundaries, and writes
local `monthly-counts.json`, `monthly-grid-counts.json`, and
`aggregate-report.json` files under the ignored `data/processed/` directory.
The aggregate covers all supplied detections from 2020 through 2025; it is
not the complete FIRMS history and does not reach the early 2000s. No
monthly rows were inserted. The latest read-only Supabase check found
`monthly_counts=0` and `monthly_grid_counts=0`; loading is paused until the
existing country row is reconciled with the UI's `PH` country ID. The schema
migration is available in the repository.

Province `raw_count` is the count of unique normalized detections.
`active_cell_days` counts distinct UTC date / 0.01-degree cell combinations
per province, month, and instrument; MODIS Terra and Aqua are combined at
the instrument level for that metric. The 0.1-degree
`monthly_grid_counts` includes every unique source detection, including
points assigned to special city/NCR ADM2 units or left unassigned. Sensor
identity remains distinct, so coincident MODIS and VIIRS detections are not
deduplicated against each other.

An aggregate row with `has_coverage=true` has at least one detection in the
downloaded file. There are no `has_coverage=false` rows: absent province /
month rows are omitted and remain unknown because a missing detection is not
proof of missing sensor coverage. The per-year/instrument report uses
`detections-present; completeness-unknown`; its detection-month list is not
a coverage certification.

Compile and run from the repository root in PowerShell:

```powershell
npx tsc --target es2022 --module commonjs --moduleResolution node `
  --strict --esModuleInterop --skipLibCheck --types node `
  --outDir data/processed/.compiled `
  scripts/ingest/aggregate.ts scripts/ingest/normalize.ts `
  scripts/ingest/load-regions.ts
node data/processed/.compiled/aggregate.js `
  --modis data/raw/modis/modis_2020_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2020_Philippines.csv `
  --modis data/raw/modis/modis_2021_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2021_Philippines.csv `
  --modis data/raw/modis/modis_2022_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2022_Philippines.csv `
  --modis data/raw/modis/modis_2023_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2023_Philippines.csv `
  --modis data/raw/modis/modis_2024_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2024_Philippines.csv `
  --modis data/raw/modis/modis_2025_Philippines.csv `
  --viirs data/raw/viirs-noaa20/viirs-jpss1_2025_Philippines.csv `
  --output-dir data/processed
```

### Local aggregate validation

The 12 files contained 177,843 rows (24,310 MODIS and 153,533 VIIRS).
Normalization found no exact duplicates. The province aggregates account
for 176,355 detections; 933 were assigned to the retained non-province
ADM2 units and excluded from province counts, and 555 had no unique ADM2
match. The output contains 6,870 positive province/month/instrument rows
with summed `raw_count` 176,355, plus 48,321 0.1-degree grid/month rows
with summed `raw_count` 177,843. No zero-count months were synthesized.
Summed province `active_cell_days` are 23,337 MODIS and 123,248 VIIRS;
the corresponding 0.1-degree grid totals are 18,019 and 89,278. A focused
hand-count fixture verified that three MODIS points in two 0.01-degree
cell-days count as `raw_count=3` and `active_cell_days=2`, while the
coincident VIIRS detection remains a separate instrument aggregate.

| Year | Instrument | Source detections | Province rows | Non-province ADM2 | Unassigned | Months with detections |
|---:|---|---:|---:|---:|---:|---:|
| 2020 | MODIS | 5,941 | 5,921 | 20 | 0 | 12 |
| 2020 | VIIRS NOAA-20 | 38,502 | 38,268 | 166 | 68 | 12 |
| 2021 | MODIS | 3,227 | 3,209 | 17 | 1 | 12 |
| 2021 | VIIRS NOAA-20 | 20,100 | 19,772 | 182 | 146 | 12 |
| 2022 | MODIS | 2,569 | 2,550 | 17 | 2 | 12 |
| 2022 | VIIRS NOAA-20 | 15,291 | 15,042 | 146 | 103 | 12 |
| 2023 | MODIS | 4,267 | 4,244 | 23 | 0 | 12 |
| 2023 | VIIRS NOAA-20 | 24,560 | 24,350 | 139 | 71 | 12 |
| 2024 | MODIS | 6,318 | 6,261 | 20 | 37 | 12 |
| 2024 | VIIRS NOAA-20 | 41,652 | 41,445 | 121 | 86 | 12 |
| 2025 | MODIS | 1,988 | 1,965 | 5 | 18 | 12 |
| 2025 | VIIRS NOAA-20 | 13,428 | 13,328 | 77 | 23 | 12 |

These are source detections and detection-bearing months, not verified
coverage. Re-running aggregation produced byte-for-byte identical output
files (monthly counts SHA-256
`E5672758EA0AFDFE67B44BF43353B3CBF3DE3814BFD636248B3B2FCF22B834C6`,
grid counts SHA-256
`2B803516B34911451B3273DCD15D4A9492DEB0E02847095BAD69475E93DF603C`).
The `aggregate-report.json` explicitly records
`databaseLoaded=false` and `databaseRowsInserted=0`.
The aggregate report SHA-256 is
`59494856FB7659A593C46704156EF1BED3BBFB4FCCE81741757B311F1BA8C783`.
Provisional factors, validation measurements, and the limited direct-VIIRS
series are described in [HARMONIZATION.md](HARMONIZATION.md); the current
data does not support estimated historical rows without making an
unsupported coverage assumption.

## Supabase schema mapping and loader

[`scripts/ingest/load-supabase.ts`](../scripts/ingest/load-supabase.ts)
validates the local artifacts and maps them to the Member 2 migration without
changing the shared contract or schema:

| Local field | Database field / rule |
|---|---|
| `Region.parentId` | `parent_id`; the country row is stored as `PH` to match the live UI default, while source-derived ADM2 IDs are retained and their parent is mapped to `PH` |
| `hotspot.id` | Both `source_id` and the unique `source_key`; this is the deterministic normalized source key |
| `hotspot.acquisitionDatetime` | `acquisition_datetime` |
| Numeric or categorical `confidence` | `confidence TEXT`; stringified only because the database column is text |
| `hotspot.sourceProduct` | `source_product` |
| Grid `latitude` / `longitude` | `cell_lat` / `cell_lon` |
| Factor `month_count` | `n_months` |
| Factor MAPE | `error_percent`; MAE, RMSE, fallback reason, and scope are retained in `notes` |
| Estimated harmonized years | `estimated_years`, derived from rows where `is_estimated=true` |

Rows are upserted in foreign-key order using the schema's natural keys.
Province factors use `region_id`; the national factor uses a stable row ID,
because a unique constraint does not make multiple `NULL` region IDs conflict.
The loader maps only known database columns and checks row keys and region
references before any write. The country alias and field mappings are covered
by focused tests.

Run local validation without opening a database connection:

```powershell
$register = [System.Uri]::new((Resolve-Path '.\tests\analytics\register-paths.mjs').Path).AbsoluteUri
node --import $register scripts\ingest\load-supabase.ts --dry-run
```

The dry run validated 88 regions, 82 factors, 6,870 monthly-count rows,
4,084 harmonized rows, 48,321 grid rows, and 63,386 raw-window records. It
does not report database inserts or updates. A live write requires the
explicit `--apply` flag plus `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in the process environment (the ignored
`.env.local` can be loaded with Node's `--env-file` option); no credential
values are written or printed.

A read-only database check on 2026-11-14 found 88 regions and one
harmonization factor, with zero rows in `monthly_counts`,
`monthly_harmonized`, `monthly_grid_counts`, and `hotspots`. The existing
country row does not use `PH`, and all 87 ADM2 rows reference that legacy
country ID. Running the loader without reconciling it would add a second
country row; no live seed has been attempted.

## Administrative boundaries

The country and ADM2 GeoJSON inputs are documented in
[`data/boundaries/README.md`](../data/boundaries/README.md). They are
geoBoundaries provider-simplified files pinned to the releases listed there;
the source-specific license is CC BY 3.0 IGO, with original boundary data
credited to OCHA Philippines, NAMRIA, and PSA. The ADM2 layer has 87 units:
81 provinces and six city/NCR district units retained as `region` because
the locked region-level contract has no city/district level. IDs use source
`shapeID`, not names. Three known points matched the same province in the
full and provider-simplified geometry. The simplification tolerance is not
published by the provider. This is a 2020 boundary vintage, not a current
administrative gazetteer; it contains the pre-2022 single Maguindanao unit,
so assignments there cannot distinguish Maguindanao del Norte from
Maguindanao del Sur.

## Attribution and use

NASA FIRMS says it promotes full and open sharing of data and encourages
attribution. For image captions, NASA asks users to cite **“NASA FIRMS”** and
encourages linking to the FIRMS imagery. NASA's suggested acknowledgment for
scientific journals is:

> We acknowledge the use of imagery from the NASA LANCE FIRMS
> (https://earthdata.nasa.gov/firms), part of the NASA Earth Science Data and
> Information System (ESDIS).

For this project, identify NASA FIRMS, the instrument/platform, the product
and processing type, and retrieval date when those details are known. Check
the current FIRMS disclaimer and product guide before publication.

## Known limitations and unresolved checks

- FIRMS detections mark thermal anomalies in satellite pixels, not confirmed
  incidents or exact fire boundaries.
- Pixel size, view geometry, observation timing, confidence definitions, and
  processing differ between MODIS and VIIRS; do not combine point records as
  if they were interchangeable.
- Active-fire point products do not themselves describe cloud cover or all
  missing observations. Check FIRMS' missing-data information and the
  downloaded product's coverage before treating a month as observed.
- Global start/end dates above do not establish Philippine coverage or
  guarantee every month has data.
- The archive request metadata and product processing type, earliest
  Philippine detections, data gaps/coverage, complete-history source counts,
  and actual overlap years remain **VERIFY** until the downloaded subset is
  reconciled with FIRMS archive and availability metadata.

## Official sources

All sources below were checked on 2026-11-14:

- [FIRMS Archive Download](https://firms.modaps.eosdis.nasa.gov/download/) —
  formats, authentication, reported temporal coverage, and archive workflow.
- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) — source
  names, bounding-box format, 1-5 day range, key requirement, and transaction
  limit.
- [FIRMS API overview](https://firms.modaps.eosdis.nasa.gov/api/) — notes
  country and countries endpoints are unavailable.
- [FIRMS data availability API](https://firms.modaps.eosdis.nasa.gov/api/data_availability/)
  — per-source availability service; querying it requires a MAP_KEY.
- [NASA FIRMS active-fire attributes](https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs)
  — NRT MODIS and VIIRS field names and definitions.
- [NASA FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq) —
  standard/NRT distinctions, caveats, and attribution guidance.
- [geoBoundaries current PHL ADM0 metadata](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM0/)
  — country release, original source, and product-specific license.
- [geoBoundaries current PHL ADM2 metadata](https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/)
  — province-level release, unit count, original source, and
  product-specific license.
