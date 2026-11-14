# FIRE MEMORY likely judge questions

## What makes MODIS and VIIRS comparable?

They are not assumed to be equivalent. FIRE MEMORY normalizes each record,
counts active 0.01-degree cell-days by UTC day and month, calibrates MODIS
to a VIIRS-equivalent target over overlap years, and reports the factor,
correlation, error, and limitations. MODIS-only values remain labeled
estimates.

## Why use a historical median?

The same-month median is resistant to unusually high or low historical years
and answers a concrete question: how does this month compare with previous
instances of the same month? The number of baseline years and any coverage
limitations are shown.

## Is an above-baseline label a fire-risk prediction?

No. It means the observed satellite-detection count is above the selected
historical baseline. It does not establish fire size, severity, danger,
spread, or future activity.

## Why are some values estimated?

MODIS supplies earlier history while VIIRS is the forward target. The
calibration converts MODIS active cell-days using overlap evidence. Those
converted values are estimates and are marked in the calendar and AI
interpretation.

## How was harmonization validated?

The team compares scaled MODIS and VIIRS during overlap years using
correlation and error, runs leave-one-year-out validation, and checks whether
MODIS-only and VIIRS-only histories produce consistent anomaly labels. The
measured results are published; weak validation is reported as a limitation.

## Why not store every historical hotspot on the map?

The map uses a recent raw window so it remains responsive and exports remain
bounded. Full history is stored as monthly aggregates for the calendar,
median, anomaly, and custom-area summaries.

## What does “No data” mean?

It means the relevant source coverage is missing or incomplete. It is not
zero activity and is never silently converted to zero.

## Why is the custom-area result approximate?

Custom areas use monthly counts from coarser 0.1-degree grid cells. The
result is labeled “grid-approximated” and uses the national harmonization
factor.

## Can responders use this to order an evacuation?

No. The product is supplementary historical information. It does not issue
evacuation instructions or replace official emergency systems and field
verification.

## What happens if FIRMS access fails during the demo?

Use the prepared, clearly labeled fallback dataset and screenshots. Do not
present simulated data as NASA data. Explain the fallback and retain the
source-attribution and limitation text.

## What is the next step after the hackathon?

Improve coverage monitoring, verify factors as the record grows, evaluate
additional environmental context, and validate the workflow with local
disaster-risk and research users before making operational claims.

## Submission facts to verify

- [ ] Exact official challenge title.
- [ ] Current global judging criteria and project-submission fields.
- [ ] Team registration and event requirements.
- [ ] Current submission deadline and local timezone.
- [ ] Whether the demo/video has a current duration or format limit.
