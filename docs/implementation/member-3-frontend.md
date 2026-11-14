# Member 3 implementation plan: Frontend and Mapping

## 1. Role summary

Member 3 owns the dashboard shell, filters, map, calendar, charts, hooks,
responsive behavior, and accessibility. The frontend must work entirely on
simulated contract data first, then switch to real API responses with only
`NEXT_PUBLIC_USE_MOCKS=false`.

## 2. Your files

Create or edit only:

```text
src/app/page.tsx
src/app/layout.tsx
src/app/globals.css
src/components/dashboard/**
src/components/map/**
src/components/calendar/**
src/components/charts/**
src/components/filters/**
src/components/common/**
src/hooks/**
src/lib/client/**
docs/implementation/member-3-*.md
```

Do not touch `src/contracts/**`, `src/mocks/**`, package files, configs,
`.env.example`, `README.md`, backend/data/AI/export files, or another plan.

## 3. What you provide to others

- Hooks: `useRegions`, `useHotspots`, `useSummary`, `useCalendar`,
  `useChildren`, with loading, empty, error, cancellation, and mock support.
- Dashboard slots for `<AssistantPanel summary={AnalyticsSummary} />` and
  `<ExportButton filters={HotspotFilters} metric={Metric} />`.
- Visible rendering of Member 1's `DATA_ATTRIBUTION`,
  `DATA_LIMITATIONS`, and `HARMONIZATION_NOTE`.
- UI clients for all Member 2 endpoints and the `NEXT_PUBLIC_USE_MOCKS`
  switch.

## 4. What you depend on

- Locked contract types and mock JSON; never alter them.
- Member 2 route shapes and Member 1 content strings; use stubs and mocks
  until integration.
- Member 4's component stubs; reserve slots and render a clear placeholder
  if they are not ready.

## 5. Environment variables

`NEXT_PUBLIC_USE_MOCKS`. Client requests use the public Supabase configuration
only through the approved client layer if the repository requires it; never
place service-role or Gemini keys in browser code.

## 6. Task list

### MVP scope

| Deliverable | Task | Working by |
|---|---|---|
| Dashboard, filters, summary cards | M3-T1 | Hour 3 |
| Client-only Leaflet map | M3-T2 | Hour 10 |
| Calendar, anomaly, harmonization panels | M3-T3 | Hour 16 |
| Drill-down, overlap chart, states, slots | M3-T4 | Hour 20 |
| Mock-to-real client switch | M3-T5 | Hour 20 |
| Custom area, accessibility polish | M3-T6 | Hour 24+ |

**First working slice:** one mock region and month showing map, calendar,
anomaly panel, simulated badge, and filter-driven updates.

### M3-T1 — Dashboard and client layer (MVP-MUST, hours 0–3)

**Objective:** create a contract-driven shell that can run without the
backend.

**Files:** `src/app/page.tsx`, `src/app/layout.tsx`,
`src/components/dashboard/**`, `src/components/filters/**`,
`src/lib/client/**`, `src/hooks/**`.

**Steps:**

1. Implement region, month/date, metric, and sensor controls.
2. Default to `metric=harmonized`; enable the sensor filter only for raw.
3. Build typed fetch helpers for regions, hotspots, summary, calendar, and
   children; select mock JSON when `NEXT_PUBLIC_USE_MOCKS=true`.
4. Use `AbortController` and debounce filter changes.
5. Add summary cards for current count, median, anomaly, and sensor values.
6. Add a visible “Simulated data” badge whenever mocks are enabled.

**Acceptance:** selecting a mock region/month updates all query state;
invalid/empty/loading/error states are visible and not confused with zero.

**Verify:** run the page with mocks and use keyboard-only filter changes.

### M3-T2 — Map and national-scale rendering (MVP-MUST, hours 3–10)

**Objective:** display filtered satellite detections without blocking the
browser.

**Files:** `src/components/map/**`, `src/components/dashboard/**`,
`src/app/globals.css`.

**Steps:**

1. Load Leaflet client-side only; import CSS and fix default marker icons.
2. Use clustering and canvas/aggregation where available.
3. Show individual points from `HotspotsResponse` within the bounded
   result; make truncation visible.
4. Use bbox-center child bubbles at national/province overview because
   `Region` has no polygon geometry.
5. Popup fields: latitude, longitude, UTC time, satellite, instrument,
   confidence, brightness, and source product.
6. Show `rawWindow` dates and explain that the map is a recent raw window.
7. Say “satellite detection” or “hotspot,” never unverified “fire.”

**Acceptance:** several thousand points remain usable; national view does
not attempt to render full historical aggregates as markers; truncation and
empty windows are explicit.

**Verify:** load mock dense data, zoom country/province, open a popup, and
check mobile width.

### M3-T3 — Calendar, anomaly, and harmonization UI (MVP-MUST, hours 10–16)

**Objective:** make coverage, estimates, counts, and comparisons legible.

**Files:** `src/components/calendar/**`, `src/components/charts/**`,
`src/components/dashboard/**`, `src/app/globals.css`.

**Steps:**

1. Build the calendar as a CSS grid with years by months; do not assume
   Recharts provides a calendar heatmap.
2. Use a colorblind-safe sequential ramp, a legend, and printed/focusable
   counts.
3. Render `null` as patterned “No data,” distinct from zero.
4. Render estimated cells with a pattern and legend entry, never color alone.
5. Selecting a cell updates the month summary and map filters.
6. Give every `AnomalyLabel` a text label, icon, and plain-language line.
7. Show baseline years, median, anomaly percentage/null, notes, coverage,
   `currentIsEstimated`, `estimatedBaselineYears`, and harmonization info.
8. Show method, factor, overlap years, correlation, error, estimated years,
   and notes in a harmonization panel.

**Acceptance:** raw/harmonized toggle changes the calendar and summary;
estimated, no-data, zero, and ordinary cells are visually and textually
distinct; no meaning relies on color alone.

**Verify:** use every locked mock case, including zero baseline and custom
area, and inspect with a screen reader or text-only DOM review.

### M3-T4 — Drill-down and overlap chart (MVP-MUST, hours 16–20)

**Objective:** complete the national-to-province demo flow.

**Files:** `src/components/dashboard/**`, `src/components/charts/**`,
`src/components/common/**`.

**Steps:**

1. Load `useChildren` for country month views and allow province selection.
2. Render the MODIS raw, MODIS scaled, and VIIRS monthly series from
   `HarmonizationResponse.overlap`.
3. Reserve and type-check the AI and export slots.
4. Show attribution, limitations, last-updated timestamp, and UTC month
   boundary text.
5. Add retry/error/empty states that do not fabricate values.

**Acceptance:** the scripted Philippines-to-Bukidnon flow works on mocks;
the overlap chart uses the exact response values; slots render or show an
honest unavailable state.

**Verify:** click national -> province -> month -> harmonized/raw and
confirm every panel changes consistently.

### M3-T5 — Real-data switch and integration (MVP-MUST, hours 20–24)

**Objective:** replace mocks with API calls without changing UI code.

**Files:** `src/lib/client/**`, `src/hooks/**`, owned components only.

**Steps:** set the switch false; compare response parsing to locked types;
test null coverage, estimated years, large counts, truncation, slow queries,
and API errors; preserve cancellation and stale-response protection.

**Acceptance:** no component needs a code change when only the switch changes;
all response fields are rendered or intentionally ignored with no invented
fallbacks.

### M3-T6 — Custom area and accessibility (MVP-SHOULD, hours 20–24+)

**Objective:** add bounded custom-area selection and final usability polish
without delaying the core flow.

**Files:** `src/components/map/**`, `src/components/filters/**`,
`src/components/common/**`, `src/app/globals.css`.

Add rectangle drawing and latitude/longitude inputs with validation. Label
the result “grid-approximated,” show the validated bbox, and use the
custom-area contract. Add keyboard focus, contrast, readable mobile layout,
and text alternatives for map/calendar content.

## 7. Edge cases and honesty rules

- `null` is “No data,” never zero.
- Estimated values use pattern/text plus legend, never color alone.
- Partial current months display the backend note; do not calculate a
  client-side replacement.
- Raw sensor selection is disabled for harmonized mode.
- “ALL” is explained as both raw instruments.
- Simulated data is labeled everywhere mocks are active.
- Bbox-center bubbles are approximate because the contract lacks polygons.
- Satellite detections are never called confirmed fires.

## 8. Test plan

1. Hook tests with mock success, empty, error, cancellation, and stale
   response cases.
2. Component tests for metric/sensor dependency and filter synchronization.
3. Calendar tests for null, zero, estimated, selected, and focus states.
4. Anomaly tests for every label and zero/missing median.
5. Map tests for popup fields, truncation, raw window, clustering, and
   national child bubbles.
6. Manual keyboard, mobile, contrast, and screen-reader text review.
7. Integration test with `NEXT_PUBLIC_USE_MOCKS=false` against API stubs.

Expected result: UI never substitutes zero or fabricated text for unavailable
data.

## 9. Handoff checklist

- [ ] Mock end-to-end flow works for country and province.
- [ ] Raw/harmonized toggle updates map-related summary/calendar state.
- [x] Sensor filter is enabled only for raw.
- [ ] Null, zero, estimated, and ordinary cells have distinct text/patterns.
- [x] Color ramp is colorblind-safe with legend and printed/focusable counts.
- [x] Anomaly panel shows label, icon, text, median, years, and notes.
- [x] Harmonization panel shows method, factor, overlap, error, and estimates.
- [x] Overlap chart renders MODIS, scaled MODIS, and VIIRS.
- [ ] Map uses client-only Leaflet and remains usable with dense mock data.
- [x] Raw window, attribution, limitations, UTC note, and last-updated text
      are visible.
- [ ] `NEXT_PUBLIC_USE_MOCKS=false` is the only mode change needed for real
      responses.
- [ ] AI/export slots are ready for Member 4.

## 10. If you are blocked

Send: `@owner I need: [specific response field/component]. File: [path].
Why: [reason]. By hour: [hour].` Meanwhile use the locked mock, preserve
loading/error states, and keep the component contract typed.

## 11. If time runs short

Keep the dashboard, map, filters, calendar, harmonized/raw toggle, anomaly
panel, estimated/no-data labeling, and national-to-province flow. Cut custom
area drawing, advanced styling, and optional chart polish before any
accessibility or honesty rule.

## 12. Open questions and assumptions

- Assume bbox-center bubbles are the approved MVP replacement for polygons.
- `VERIFY`: exact Leaflet clustering/canvas package already installed.
- Assume map default/max limits follow backend integration values.
- Assume UTC is shown in filter help and calendar labels.
- Assume Member 4 components accept the exact prop signatures in the locked
  work plan.
