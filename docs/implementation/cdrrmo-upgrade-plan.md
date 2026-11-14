# FIRE MEMORY — CDRRMO UI, Map, AI & Export Upgrade Implementation Plan

> **Purpose:** Shared context and execution blueprint for all subagents implementing the CDRRMO dashboard, map, Gemini Advisory AI, anomaly detection, CSV export, and CSS consistency upgrades.
> **Status:** Planned (awaiting user confirmation to execute)
> **Last audited against codebase:** `2026-11-15`

---

## 1. Current Codebase Context (Verified State)

### Key Files & Current Behavior
- **Routing & Shell:**
  - `src/app/page.tsx` -> `<DashboardShell activeFeature="map" />`
  - `src/app/calendar/page.tsx` -> `<DashboardShell activeFeature="calendar" />`
  - `src/app/anomaly/page.tsx` -> `<DashboardShell activeFeature="anomaly" />`
  - `src/app/assistant/page.tsx` -> `<DashboardShell activeFeature="assistant" />`
  - `src/app/export/page.tsx` -> `<DashboardShell activeFeature="export" />`
  - `src/components/dashboard/DashboardShell.tsx`:
    - `dashboardNavItems` (lines 128–159) currently includes a sidebar tab for `/assistant` (`"AI Assistant"`).
    - `.map-summary-cards` (lines 674–766) uses `position: absolute` in `globals.css` (lines 410–419) and technical phrasing (`"Raw active cell-days"`, `"VIIRS Active-Fire (375m)"`, `"MODIS Active-Fire (1km)"`, `"Live window is partial"`).
    - `.map-assistant-trigger` (lines 1057–1076) is currently a `<Link href="/assistant">` that navigates away from the map, even though `.map-assistant-dock` CSS already exists in `src/app/globals.css` (lines 631–650, 2423–2427).
    - `<ExportButton filters={hotspotFilters} metric={metric} />` (line 1327) omits `year` and `month`.
- **Map & Imagery:**
  - `src/components/map/MapView.tsx` & `src/components/map/LeafletCanvas.tsx`:
    - When `!useFirmsWms && imageryDate`, `LeafletCanvas.tsx` (lines 448–458) renders `VIIRS_SNPP_CorrectedReflectance_TrueColor`, which includes satellite cloud cover obscuring land.
    - `Reference_Features_15m` and `Reference_Labels_15m` are rendered on top (lines 459–477), leaving no land raster/terrain basemap when `useFirmsWms` is true or when `CorrectedReflectance` is removed.
    - `BUBBLE_COLORS` (lines 17–23) and `HotspotFootprintLayer` (lines 174–175) use emerald/teal (`#10b981`, `#14b8a6`) and amber (`#f59e0b`) instead of a unified orange-to-red hotspot scale matching `globals.css`.
- **AI Assistant:**
  - `src/lib/ai/prompt.ts`, `src/lib/ai/brief.ts`, `src/lib/ai/request.ts`, `src/lib/ai/config.ts`, `src/app/api/ai/brief/route.ts`, `src/components/assistant/AssistantPanel.tsx`.
  - Currently acts as a generic statistical explainer (`"You are an assistant interpreting a supplied AnalyticsSummary"`) rather than a **CDRRMO Advisory AI**.
  - Strict grounding checks in `brief.ts`: rejects invented numbers (`getAllowedNumbers`), requires `Computed values`, `Interpretation`, `Limitations`, and blocks unsafe evacuation/spread-prediction outputs.
  - Tests in `tests/ai/m4-t1.test.mjs` and `tests/ai/m4-t2.test.mjs` assert prompt rules, number grounding, and error handling. Note: running `node --test` directly on `m4-t1.test.mjs` / `m4-t2.test.mjs` currently fails on extensionless TS imports (`./config`) without a loader or TS test runner—check/fix test invocation or loader compatibility during verification.
- **Anomaly Detection UI:**
  - `src/components/charts/AnalyticsPanels.tsx` (`AnomalyPanel`, `HarmonizationPanel`, `OverlapChart`).
  - Currently displays raw `<dl>` key-value pairs and generic technical labels without CDRRMO risk-posture framing, visual current-vs-median comparison, or plain-language action cues.
- **CSV Export:**
  - `src/components/export/ExportButton.tsx`, `src/lib/export/csv.ts`, `src/lib/export/types.ts`, `src/app/api/export/csv/route.ts`, `src/app/api/export/analytics-csv/route.ts`.
  - Client currently hardcodes `fire-memory-${kind}.csv` (`ExportButton.tsx` line 88), ignoring descriptive server filenames and offering no preview/context summary of active filters or exported columns.
  - `tests/ai/m4-t4.test.mjs` tests `toCsv` and `toAnalyticsCsv` column order, escaping, and formula-injection protection.
- **Global CSS:**
  - `src/app/globals.css` (3,950 lines) contains earlier light-mode rules overridden later by dark-mode rules (`#0b1326`, `#0b132b`, `--accent: #f97316`, `--secondary: #ef4444`), plus `.telemetry-cluster--low` (`#10b981` green) / `--moderate` (`#f59e0b`) / `--high` (`#f97316`) / `--very-high` (`#dc2626`) at lines 3131–3166, and duplicate `.hotspot-marker-dot` rules (lines 1391 & 2834).

---

## 2. Locked Contracts & Guardrails (Do Not Break)

1. **`src/contracts/types.ts`:** Keep existing API contracts (`AnalyticsSummary`, `HotspotsResponse`, `CalendarResponse`, `HarmonizationResponse`, `AiBriefRequest`, `AiBriefResponse`, `Region`) intact so backend routes (`/api/regions`, `/api/hotspots`, `/api/analytics/*`) remain 100% compatible.
2. **Backend Analytics Tests:** `node --import ./tests/analytics/register-paths.mjs --test tests/analytics/*.test.ts` (17/17 passing) must remain green.
3. **AI Safety & Grounding:** Even as a **CDRRMO Advisory AI**, Gemini must NEVER invent counts/dates/locations, NEVER claim satellite detections are confirmed ground fires, NEVER predict fire spread, and NEVER issue forced evacuation directives. All numbers cited must come strictly from the supplied `AnalyticsSummary`.
4. **CSV Security:** Preserve spreadsheet formula-injection protection (`protectSpreadsheetFormula`) and UTF-8 BOM handling in `src/lib/export/csv.ts` and API routes.

---

## 3. Implementation Plan & Subagent Workstreams

To avoid file conflicts when running subagents in parallel, **each file is owned by exactly one workstream** during the build phase, followed by an integration & CSS polish pass.

### Workstream 1 — Map: Cloud-Free Land-Only Basemap & Orange-to-Red Hotspots
- **Owned files:** `src/components/map/LeafletCanvas.tsx`, `src/components/map/MapView.tsx`
- **Tasks:**
  1. **Remove clouds / land-only basemap:**
     - Remove `VIIRS_SNPP_CorrectedReflectance_TrueColor` from `LeafletCanvas.tsx` (lines 448–458).
     - Render a **cloud-free land basemap** underneath `Reference_Features_15m` and `Reference_Labels_15m` (and underneath live FIRMS WMS / hotspot clusters) in BOTH historical and live modes.
     - Use a cloud-free land source that fits the dark tactical theme (e.g., NASA GIBS `BlueMarble_NextGeneration` / `BlueMarble_ShadedRelief` styled cleanly, or CARTO DarkMatter No-Labels / OSM land vector tile paired with NASA GIBS `Reference_Features_15m` & `Reference_Labels_15m`—verifying CORS/availability and crisp land/coastline contrast at zoom levels 4–18).
     - Update attribution copy in `MapView.tsx` and `LeafletCanvas.tsx` to accurately state cloud-free land basemap + NASA reference overlays (and NASA FIRMS for live mode).
  2. **Consistent Orange-to-Red Hotspot Palette:**
     - Replace `BUBBLE_COLORS` green/teal (`#10b981`, `#f59e0b`) and `HotspotFootprintLayer` teal (`#14b8a6` / `#0f766e`) with an **orange-to-red gradient ramp** anchored to CSS variables/tokens in `globals.css`:
       - Low: `#fb923c` (light orange, stroke `#ea580c`)
       - Moderate: `#f97316` (`--accent` orange, stroke `#c2410c`)
       - High: `#ea580c` / `#f94d16` (deep orange-red, stroke `#9a3412`)
       - Very High: `#ef4444` / `#dc2626` (`--secondary` red, stroke `#991b1b`)
       - No Data: neutral slate (`#64748b`, stroke `#475569`)
     - Color individual `.hotspot-marker-dot` markers across the same orange-to-red spectrum based on instrument/confidence/brightness when available (defaulting to `--hotspot-moderate` `#f97316` → `--hotspot-very-high` `#ef4444`), and keep sensor footprints (`MODIS` 1km vs `VIIRS` 375m) within the same orange-to-red palette (differentiated by shade + dashed/solid stroke so sensor distinction stays clear without introducing green/teal).

### Workstream 2 — Gemini AI: CDRRMO Advisory AI (Map-Only)
- **Owned files:** `src/lib/ai/prompt.ts`, `src/lib/ai/brief.ts`, `src/components/assistant/AssistantPanel.tsx`, `src/app/assistant/page.tsx`, `tests/ai/m4-t1.test.mjs`, `tests/ai/m4-t2.test.mjs`
- **Tasks:**
  1. **CDRRMO Advisory Persona & Prompt (`src/lib/ai/prompt.ts`, `src/lib/ai/brief.ts`):**
     - Update `AI_SYSTEM_INSTRUCTION` so Gemini acts as a **CDRRMO (City/Municipal Disaster Risk Reduction and Management Office) Advisory AI** helping local DRRMO officers interpret satellite thermal data.
     - Frame guidance around CDRRMO operational readiness: summarizing anomaly severity vs. historical baseline, explaining sensor confidence/harmonization caveats in plain language, and offering data-grounded preparedness/monitoring considerations (e.g., prioritizing ground verification with BFP/barangay DRRMCs, monitoring repeat thermal detections, noting incomplete/estimated coverage) while strictly enforcing:
       - Only numbers from `AnalyticsSummary` may be cited.
       - Never claim detections are confirmed fires, never predict spread, and never issue evacuation orders.
     - Update `UNSAFE_QUESTION_RESPONSE` and `DISCLAIMER` to reflect CDRRMO advisory support (directing urgent life-safety/evacuation decisions to official BFP, OCD, and LGU incident command protocols).
     - Preserve or cleanly update the section structure (`Computed values`, `Interpretation`, `Advisory & Limitations` or `Computed values`, `Interpretation`, `Limitations`—keeping `validateBriefOutput` and AI tests 100% aligned).
  2. **Assistant Panel UX (`src/components/assistant/AssistantPanel.tsx`):**
     - Tailor title, eyebrow, intro, placeholder, and `SUGGESTED_QUESTIONS` specifically for CDRRMO officers (e.g., *"What does this month's anomaly mean for CDRRMO monitoring?"*, *"Should our office treat these detections as unusual compared to past years?"*, *"What data limits should we report to the Local Chief Executive?"*).
     - Support an optional `onClose?: () => void` prop so the panel can be cleanly closed when docked on the map.
     - Render structured advisory sections cleanly (bold section labels, clear visual disclaimer banner).
  3. **Retire Standalone AI Tab Route (`src/app/assistant/page.tsx`):**
     - Redirect `/assistant` to `/` (using Next.js `redirect("/")`) so direct visits don't 404 while ensuring the AI lives exclusively on the map.

### Workstream 3 — Anomaly Detection UI Redesign for CDRRMO
- **Owned files:** `src/components/charts/AnalyticsPanels.tsx`
- **Tasks:**
  1. **CDRRMO Operational Anomaly Assessment (`AnomalyPanel`):**
     - Add a clear **CDRRMO Monitoring Posture** badge & banner mapped to `AnomalyLabel` (`Normal Monitoring`, `Baseline Watch`, `Elevated Monitoring`, `Priority Ground Verification`, `Insufficient Baseline`).
     - Add a visual **Current vs. Historical Median Comparison Meter** showing current detections relative to the historical baseline at a glance.
     - Rewrite technical field labels (`"Current detections"`, `"Historical median"`, `"Difference from median"`, `"Estimated baseline years"`) with plain-language sublabels so CDRRMO staff understand *what* is being compared and *why* it matters.
     - Add a concise **Recommended CDRRMO Action Context** box derived strictly from `summary.label` and `summary.notes` (e.g., verifying hotspots with Barangay DRRMC/BFP, noting partial month or estimated MODIS data).
  2. **Plain-Language Harmonization & Overlap Panels (`HarmonizationPanel`, `OverlapChart`):**
     - Add brief 1-sentence explanations above `HarmonizationPanel` and `OverlapChart` explaining in non-technical terms why MODIS and VIIRS are calibrated together and how accurate the overlap calibration is.

### Workstream 4 — CSV Export Improvements
- **Owned files:** `src/components/export/ExportButton.tsx`, `src/app/export/page.tsx`, `src/app/api/export/csv/route.ts`, `src/app/api/export/analytics-csv/route.ts`, `src/lib/export/csv.ts`, `src/lib/export/types.ts`, `tests/ai/m4-t4.test.mjs`
- **Tasks:**
  1. **Context-Aware Filenames & Filter Summary:**
     - Update `ExportButton.tsx` to display the active CDRRMO export scope before downloading: selected region name, date window / month, metric (`Harmonized` vs `Raw`), and sensor (`ALL` / `MODIS` / `VIIRS`).
     - Use descriptive filenames on download instead of generic `fire-memory-hotspots.csv` / `fire-memory-analytics.csv` (e.g., `fire-memory-hotspots-${regionId}-${start}-to-${end}.csv` and `fire-memory-analytics-${regionId}-${year}-${month}-${metric}.csv`), matching server `Content-Disposition`.
  2. **Better Export Content & UX:**
     - Clarify what each CSV contains (`Raw Hotspot Points CSV` for GIS/mapping vs `Monthly Historical Analytics CSV` for CDRRMO situation reports & baseline comparisons).
     - Improve `analytics-csv/route.ts` so every row includes clear region/metric context or clean summary columns without breaking existing contract tests (`tests/ai/m4-t4.test.mjs` must pass; update tests if new fields are added).
     - Add clear success, truncation warning, and error states with download feedback.

### Workstream 5 — Dashboard Shell: Fixed Top Cards, Plain Language, Remove AI Tab & Wire Map AI Dock
- **Owned files:** `src/components/dashboard/DashboardShell.tsx`
- **Tasks:**
  1. **Remove AI Tab from Navigation:**
     - Remove `{ href: "/assistant", feature: "assistant", icon: "assistant", label: "AI Assistant" }` from `dashboardNavItems` and remove the `activeFeature === "assistant"` branch (or narrow `DashboardFeature` to `"map" | "calendar" | "anomaly" | "export"`).
  2. **Map-Only AI Dock Integration:**
     - Replace `<Link className="map-assistant-trigger" href="/assistant">` with a `<button type="button">` that toggles `isAssistantOpen` state.
     - Render `<div className={...map-assistant-dock...}>` directly inside `.map-workspace` containing `<AssistantPanel summary={summary.data ?? null} onClose={() => setIsAssistantOpen(false)} />` so the Gemini CDRRMO Advisory AI stays exclusively on the map without navigating away.
     - Update button label/aria-label to `"CDRRMO Advisory AI"` / `"Gemini Advisory AI"`.
  3. **Sticky/Fixed Top Summary Cards + Plain-Language Copy:**
     - Structure `.map-summary-cards` inside a fixed/sticky top header container so when the user scrolls on the map page (e.g., down to status/footer or on narrower screens), the 5 summary cards stay fixed in position at the top.
     - Rewrite card titles and helper captions so non-technical CDRRMO users immediately understand every number:
       1. **Total Fire Hotspots ({summaryMonth})** — *"Active thermal hotspots detected in {summaryRegion} (combined sensor scale)"*
       2. **High-Resolution Detections (VIIRS)** — *"Smaller-area satellite sensor (375m grid); spots smaller fires"*
       3. **Wide-Area Detections (MODIS)** — *"Long-running satellite sensor (1km grid); used for 20+ year history"*
       4. **Typical {summaryMonth} Average (Median)** — *"Normal activity level for {summaryMonth} across {years} past years"*
       5. **Comparison vs. Typical Month** — Plain-language status (*"Normal for this month"*, *"Higher than normal — monitor closely"*, *"Much higher than normal — verify area"*, etc.) + concise explanation.
  4. **Export Props Fix:**
     - Pass `regionName={selectedRegion?.name}`, `year={periodRange?.year}`, and `month={periodRange?.month}` to `<ExportButton>` in `DashboardShell.tsx`.

### Workstream 6 — Global CSS Consistency & Theme Unification
- **Owned files:** `src/app/globals.css`
- **Tasks:**
  1. **Canonical Orange-to-Red Hotspot Palette Tokens:**
     - Add explicit hotspot ramp variables in `:root`:
       - `--hotspot-low: #fb923c`
       - `--hotspot-moderate: #f97316` (`--accent`)
       - `--hotspot-high: #ea580c`
       - `--hotspot-very-high: #ef4444` (`--secondary`)
       - `--hotspot-deep: #dc2626`
     - Update `.hotspot-marker-dot`, `.detection-popup-title::before`, and `.telemetry-cluster--low | --moderate | --high | --very-high` to use ONLY this orange-to-red ramp (removing green/teal `#10b981` and `#bd4e2f` inconsistencies).
  2. **Fixed Top Summary Cards Layout:**
     - Ensure `.map-summary-cards` stays fixed/sticky cleanly on scroll (`position: fixed` or `position: sticky` with proper `top`, `left` offset accounting for the `72px` sidebar on desktop and `0` on mobile, and `z-index` layered properly above map tiles and below modals/popovers).
     - Ensure `.map-filter-popover`, `.map-region-trigger`, `.map-assistant-trigger`, and `.map-assistant-dock` align cleanly below the fixed cards across desktop, tablet, and mobile viewports without overlapping card text.
  3. **Global Consistency Audit:**
     - Reconcile duplicate selectors and legacy light-theme rules in `src/app/globals.css` so all pages (`/`, `/calendar`, `/anomaly`, `/export`) share consistent surface containers, borders, focus rings, font families (`--font-inter`, `--font-jetbrains-mono`), and CDRRMO anomaly severity colors.
     - Style the new CDRRMO Anomaly Panel components, Map Advisory AI dock header/sections, and Export summary preview consistently.

---

## 4. Iterative Loop Engineering & Verification Protocol

After all workstreams finish, execute this verification loop until every check passes with 0 errors:

1. **Static & Type Checks:**
   - `npx tsc --noEmit`
   - `npm run lint`
2. **Unit & Contract Tests:**
   - `node --import ./tests/analytics/register-paths.mjs --test tests/analytics/*.test.ts`
   - `node --import ./tests/analytics/register-paths.mjs --test tests/ai/m4-t1.test.mjs tests/ai/m4-t2.test.mjs tests/ai/m4-t4.test.mjs` (or verify/fix the Node ESM TypeScript test runner command so all AI + CSV tests run and pass cleanly).
3. **Production Build:**
   - `npm run build`
4. **Live UI & Visual Verification (Subagent / Browser Inspection):**
   - Start local Next.js server (`npm run dev` / `npm run start`) with `NEXT_PUBLIC_USE_MOCKS=true`.
   - Verify `/` (Map):
     - Confirm basemap shows cloud-free land with borders/labels (zero clouds).
     - Confirm hotspot markers/clusters/bubbles strictly use orange-to-red colors matching `globals.css`.
     - Scroll down and confirm top summary cards remain fixed in position and display clear, plain-language text.
     - Click the Map AI button and confirm Gemini CDRRMO Advisory AI opens inline on the map, while no AI tab exists in the left sidebar.
   - Verify `/anomaly`: confirm CDRRMO-tailored anomaly UI renders cleanly and responsively.
   - Verify `/export`: confirm active filter summary, descriptive CSV filenames, and working Hotspot + Analytics CSV downloads.
   - Verify `/calendar` and `/assistant` (redirects to `/`) for CSS consistency and zero console/runtime errors.
5. **Fix & Re-Verify:**
   - Any defect found in steps 1–4 triggers a targeted fix and a full re-run of steps 1–4 until all checks pass cleanly.
