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
The source row and selected product name should remain available for audit
when normalization is implemented.

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
