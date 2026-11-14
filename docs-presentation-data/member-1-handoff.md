# Member 1 data handoff

Checked 2026-11-14. These figures describe the supplied local files and
processed artifacts only; they are not a claim of complete FIRMS coverage.

## Source and coverage

- Available source files cover 2020-01-01 through 2025-12-31.
- Total source detections: 177,843 (24,310 MODIS; 153,533 VIIRS NOAA-20).
- No 2026 records or pre-2020 records are available in this workspace.
- The archive request manifest, product processing designation, and
  Philippine month-by-month coverage metadata remain unverified.

## Processed data

- Local raw-window artifact (2024-01-01 through 2025-12-31; not current as of
  2026-11-14): 63,386 records (8,306 MODIS; 55,080 VIIRS).
- Raw-window assignment: 62,999 province IDs, 223 special ADM2 regions,
  and 164 unassigned or ambiguous records.
- Monthly province aggregates: 6,870 positive rows; their `raw_count` sum is
  176,355. The remaining detections are 933 special ADM2 and 555 unassigned.
- Monthly grid aggregates: 48,321 rows; `raw_count` sums to 177,843.
- Harmonized output: 4,084 direct VIIRS rows, zero estimated rows. Another
  247 MODIS-only province/month rows were omitted because VIIRS coverage is
  unknown, not treated as zero.

## Provisional calibration and validation

- Candidate years: 2020-2025; completeness and actual Philippine overlap are
  not verified.
- National median VIIRS/MODIS factor: 4.09777677; 65 province-specific
  factors and 16 national fallbacks.
- In-sample national validation: 72 matched months, correlation 0.99275409,
  MAPE 28.67994074%.
- Pooled leave-one-year-out validation: 72 predictions, correlation
  0.99224830, MAPE 29.20323113%.
- Anomaly-label agreement: 91.666667%; positive Jaccard: 68.421053%.
- These results are provisional and do not establish sensor equivalence or
  reliable province-level estimates.

## Database and presentation guidance

The schema migration is present, and the local loader dry run validates
payloads for all six tables. No Supabase rows were loaded because
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were absent from the process
environment.

For slides, call these **supplied local 2020-2025 downloads** and state that
coverage is provisional. Do not claim a complete early-2000s-to-present
calendar, current 2026 detections, or converted MODIS estimates from this
dataset. Keep the validation metrics and uncertainty visible.
