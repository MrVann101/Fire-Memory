# MODIS-to-VIIRS harmonization

## Status and scope

The current result is a **provisional calibration from the supplied local
downloads**, not a verified Philippine sensor-overlap analysis. The source
files contain MODIS and VIIRS NOAA-20 detections for 2020-2025, but the
archive request manifest and Philippine availability/coverage metadata are
missing. Detection-bearing years are therefore labeled candidate overlap
years only; they do not prove complete coverage or a complete shared
observation period.

The global FIRMS product information documented in
[`DATA.md`](./DATA.md#products-and-published-date-coverage) lists
2018-04-01 as the start of VIIRS NOAA-20. The supplied MODIS files begin in
2020, so they contain no pre-start months to convert. The generated
`monthly-harmonized.json` has 4,084 rows, all direct VIIRS active-cell-day
values with `is_estimated=false`. It has no estimated rows. Another 247
MODIS-only province/month detections occur after the global NOAA-20 start;
they are omitted because a missing VIIRS province/month record does not
establish zero activity or absent VIIRS coverage. No missing month is
filled with zero.

The outputs are local files in the ignored `data/processed/` directory.
`databaseLoaded=false`; no rows were inserted into Supabase. The database
schema migration is present, but the Supabase URL and service-role key were
not available in the process environment during the latest check. Data
through 2025 is not a current window and does not provide the requested full
history reaching the early 2000s.

## Calibration method

Input values are monthly `active_cell_days` from
[`scripts/ingest/aggregate.ts`](../scripts/ingest/aggregate.ts), grouped in
UTC. Calibration uses only province/month observations where both
instruments have a positive detection-bearing row. Missing province/month
rows are not interpreted as zero. Special ADM2 regions and unassigned
detections are excluded from factors because the calibration is
province-based; the aggregate report separately records them.

For each matched province/month, the ratio is:

```text
VIIRS active_cell_days / MODIS active_cell_days
```

Each province factor is the median of its monthly ratios when it has at
least 12 matched months spanning at least 3 candidate overlap years.
Otherwise, that province uses the national fallback. The national factor
is the median of monthly VIIRS/MODIS ratios after summing only the
same-province pairs observed in both sensors for that month. This prevents
unmatched province rows from being silently treated as zeros. These
minimums are implementation defaults and remain **VERIFY until agreed**.

The current input yields 2,539 matched province/month pairs across 72
matched national months in candidate years 2020-2025. The national
VIIRS/MODIS factor is **4.09777677**. There are 65 province-specific
factors and 16 provinces using the national fallback; the factor file also
contains the national record.

For the harmonized series, direct VIIRS values are preferred whenever a
VIIRS province/month row exists. A MODIS row is converted and marked
`is_estimated=true` only before the NOAA-20 global start. Post-start
MODIS-only rows with unknown local VIIRS coverage are omitted. If earlier
MODIS history is later supplied, the conversion uses the province factor
or its explicitly recorded national fallback.

Factors are written to `harmonization-factors.json`. Rows record factor,
scope, method, candidate years, matched-month count, correlation, and error
metrics. The `method_version` is
`median-monthly-viirs-over-modis-v1`.

## Validation results

The validation compares scaled MODIS active-cell-days against observed
VIIRS active-cell-days. `MAE` and `RMSE` are in active-cell-day units;
`MAPE` is a percentage relative to observed VIIRS. The national comparison
uses matched province/month contributions only.

| Validation | Months | Correlation | MAE | RMSE | MAPE |
|---|---:|---:|---:|---:|---:|
| In-sample, national median factor | 72 | 0.99275409 | 409.89297858 | 884.77530422 | 28.67994074% |
| Leave-one-year-out, pooled predictions | 72 | 0.99224830 | 410.51844618 | 877.41025952 | 29.20323113% |

Leave-one-year-out recalibrates the median monthly national ratio on the
other candidate years, then predicts each held-out year's matched monthly
values:

| Held-out year | Training factor | Correlation | MAE | RMSE | MAPE |
|---:|---:|---:|---:|---:|---:|
| 2020 | 4.09777677 | 0.99554332 | 726.81815242 | 1,387.37573224 | 32.85941473% |
| 2021 | 3.97653235 | 0.99329814 | 302.07697687 | 581.35892988 | 14.11063312% |
| 2022 | 3.98810984 | 0.97999708 | 218.46525779 | 274.79501265 | 36.46644830% |
| 2023 | 4.21678938 | 0.99013695 | 342.00814926 | 558.81627259 | 40.85352298% |
| 2024 | 4.14115503 | 0.99368625 | 683.63468463 | 1,335.02614262 | 31.48071601% |
| 2025 | 4.09777677 | 0.98172259 | 190.10745612 | 431.53241630 | 19.44865164% |

Anomaly consistency compares national monthly values formed from the
province/month contributions observed in both sensors for that month. For
each calendar month, an anomaly is a value above the leave-one-year-out
median plus `2 x 1.4826 x MAD`; a month is compared only when at least two
reference years are available.

| Compared months | Both anomalous | MODIS only | VIIRS only | Neither | Label agreement | Positive Jaccard |
|---:|---:|---:|---:|---:|---:|---:|
| 72 | 13 | 3 | 3 | 53 | 91.666667% | 68.421053% |

The high national correlation does not remove the error or establish
equivalence. In-sample national MAPE is 28.68%, pooled leave-one-year-out
MAPE is 29.20%, and anomaly labels disagree in 6 of 72 months. Provincial
performance is weaker and variable: among the 65 province-specific
factors, correlation ranges from -0.16582088 to 0.98229412 and median
province MAPE is 88.92745563% (range 25.29513279%-304.50275035%). For
example, Surigao del Sur's factor is 3.66666667 with correlation 0.44769307
and MAPE 101.32279275%. The current results do not support describing the
two sensors as equivalent or treating province estimates as reliable
without additional coverage and validation.

## Independent checks

- Recomputed the Surigao del Sur factor from its 49 matched
  province/month ratios: the median is 3.6666666667, matching the published
  3.66666667 within `1e-8`.
- Recounted MODIS source points assigned to Surigao del Sur for January
  2020 and independently grouped their UTC date and 0.01-degree cell:
  `raw_count=3`, `active_cell_days=3`, matching the aggregate.
- The focused harmonization tests verify a separate 3-point / 2-cell-day
  case, sensor separation, national fallback, estimated flags before the
  NOAA-20 start, missing-coverage omission, leave-one-year-out, and anomaly
  agreement.

## Limitations and next steps

- Confirm the archive request's product and processing type and obtain
  Philippine availability/coverage metadata before accepting 2020-2025 as
  complete overlap years.
- Obtain the missing pre-2020 archives to build the full historical series
  and estimate MODIS-only periods before VIIRS operation.
- Agree the minimum matched months/years and anomaly threshold; the current
  values are documented implementation choices, not validated
  requirements.
- Re-run with complete data and independently compare against database
  counts once the required Supabase environment variables are available.
- Keep source confidence and platform provenance unchanged in raw records.
  Active-fire detections are thermal anomalies, not confirmed incidents.

Running the harmonizer twice on the current aggregate produced byte-for-byte
identical outputs:

- `monthly-harmonized.json` SHA-256:
  `0DE5B880B4B2D7DED2ED8EB9662D98EFABA2EE753E6BB9045823743973CA4AE4`
- `harmonization-factors.json` SHA-256:
  `6013804DCEB81546D04FBB1A01D3B7988C61614229277C634A1F77F54046DD08`
- `harmonization-report.json` SHA-256:
  `70F229B884CC94AF87203E30144A0410B3A14976F0410E63853E6201B5F4FCDF`
