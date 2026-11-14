# FIRE MEMORY timed demo script

**Target length:** 2 minutes 30 seconds for the product demo inside the
four-slide pitch. Add the separate 90-second backup recording only after
real data is loaded.

## Before starting

- Use the deployed URL, not a local-only route.
- Confirm `NEXT_PUBLIC_USE_MOCKS=false`, or clearly show the “Simulated data”
  badge if the fallback is being used.
- Select a month with current data, historical data, and a visible baseline.
- Confirm the raw-window dates shown by the map.
- Have the validation report open in a second tab.
- Do not claim a detection is a confirmed fire.

## Live demo: 2 minutes 30 seconds

### 0:00–0:15 — Set the context

“This is FIRE MEMORY for the Philippines. It uses NASA FIRMS MODIS and VIIRS
satellite detections. We will compare one selected month with the historical
pattern for that same month.”

Show the national Philippines view and the selected month.

### 0:15–0:35 — Show the raw map

“The map shows the recent raw observation window. Markers are satellite
detections, clustered at this scale. The popup preserves the observation
time, satellite, instrument, confidence, and brightness when supplied.”

Open one popup and point to the raw-window dates. Do not imply that every
marker is a verified incident.

### 0:35–0:55 — Show raw versus harmonized

“The raw calendar preserves the sensor-specific record. I’ll now switch to
the harmonized view. MODIS-only history is converted to a VIIRS-equivalent
scale using the overlap years, so estimated cells have a separate pattern
and legend entry.”

Toggle the metric and point to one estimated cell and one “No data” cell.
Explain that “No data” is not zero.

### 0:55–1:15 — Explain the baseline

“This panel compares the selected month with the historical median for the
same calendar month. It shows the baseline years, the current count, the
median, and a text label so color is not carrying the meaning by itself.”

Point to the anomaly label and notes. If the median is zero, show that the
percentage is not calculable rather than dividing by zero.

### 1:15–1:35 — Show harmonization evidence

“The harmonization panel gives the method, target sensor, factor, overlap
years, correlation, error, and estimated years. This is a calibrated series
with limits, not a claim that MODIS and VIIRS are identical.”

Open the overlap chart and identify MODIS raw, MODIS scaled, and VIIRS.

### 1:35–1:55 — Drill down

“From the national view, I’ll select Bukidnon. The same method applies at
the province level, so the local result can be compared without losing the
national context.”

Select Bukidnon and keep the same month. Point out any changed coverage or
small-baseline note.

### 1:55–2:15 — Ask the assistant

Ask exactly:

> Explain this month’s hotspot activity compared with previous years.

“The assistant receives the computed summary, not the raw database. Its
answer is labeled AI interpretation and must mention estimates and limits
when they are present. It does not predict spread or give evacuation
instructions.”

Show the disclaimer below the answer.

### 2:15–2:30 — Export and close

Download the hotspot CSV and analytics CSV.

“The exports preserve the selected filters. The final limitation is
important: these are satellite detections, not confirmed fires; MODIS-era
values are estimates; and this dashboard is not a prediction or a
replacement for official response systems.”

## 90-second backup video plan

Record only after Member 1 has loaded real data and the deployed app has
passed the end-to-end check.

| Time | Shot | Required message |
|---|---|---|
| 0:00–0:10 | Title and national map | Philippines scope and FIRMS source |
| 0:10–0:25 | Raw map popup | Satellite detection fields and raw-window limit |
| 0:25–0:42 | Raw -> harmonized toggle | Estimated months and no-data distinction |
| 0:42–0:57 | Baseline/anomaly panel | Same-month median and label |
| 0:57–1:10 | Harmonization panel/chart | Factor, overlap, validation error |
| 1:10–1:22 | Bukidnon + AI panel | Grounded interpretation and disclaimer |
| 1:22–1:30 | CSV + limitations | Export and honest non-prediction statement |

Recording checklist:

- [ ] Use real deployed data, or visibly label the fallback as simulated.
- [ ] Hide API keys, browser tokens, personal data, and private URLs.
- [ ] Keep the browser zoom readable and cursor movements deliberate.
- [ ] Include captions or a spoken explanation of every key visual.
- [ ] Verify the final file plays offline.
- [ ] Keep a second copy outside the repository.
