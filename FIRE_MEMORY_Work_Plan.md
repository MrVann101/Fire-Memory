# FIRE MEMORY: Team Work Plan

**Event:** NASA Space Apps Challenge 2026 (Nov 14--15)\
**Scope:** Philippines (national view with province drill-down)\
**Team size:** 4 members, working at the same time\
**Challenge focus:** A harmonized MODIS + VIIRS burning-activity calendar
(early 2000s to present) with historical-median comparison

------------------------------------------------------------------------

## 1. How We Work (the Big Idea)

We build in **four phases**. Members work separately in Phase 1 and only
connect their work in Phase 2.

| Phase | Name | Who | What happens |
|---|---|---|---|
| 0 | Setup | Everyone together | Create the repo, lock the contract, create stub files and mock data |
| 1 | Parallel build | Each member alone | Everyone builds **only inside their own files**, using stubs and mock data |
| 2 | Integration | Everyone together | Replace mocks with real data, connect all parts, fix bugs |
| 3 | Test, deploy, demo | Everyone together | Verify counts, deploy to Vercel, rehearse |

**Why this avoids conflicts:**

1.  Every file belongs to exactly one member (section 3).
2.  Parts talk to each other only through a **locked contract** (section
    4): shared types, API response shapes, and function signatures.
3.  Every function other people depend on already exists as a **stub**
    returning mock data from minute one, so nobody waits for anyone.

------------------------------------------------------------------------

## 2. Roles

| # | Role | Name | Owns |
|---|---|---|---|
| 1 | Data and FIRMS | ________ | Getting, cleaning, and loading data; region boundaries |
| 2 | Backend and Analytics | ________ | Database, API routes, historical median and anomaly logic |
| 3 | Frontend and Mapping | ________ | Dashboard, map, calendar, charts, filters |
| 4 | AI, Export, and Presentation | ________ | Gemini assistant, CSV/PDF export, slides, demo script |

If we have fewer than 4 people, merge roles 1 + 2 or 3 + 4, but keep the
file boundaries below.

------------------------------------------------------------------------

## 3. File Ownership (Who Can Edit What)

> **Rule:** You may only create or edit files in your own area. If you
> need a change somewhere else, ask the owner (see section 7).

### Project layout

```
fire-memory/
├── .github/CODEOWNERS            LOCKED
├── README.md                     LOCKED
├── package.json / lockfile       LOCKED
├── .env.example                  LOCKED
├── scripts/check-owner.sh        LOCKED
├── data/                         MEMBER 1
│   ├── raw/                      (git-ignored if large)
│   ├── sample/                   small labeled samples
│   └── boundaries/               Philippines + province GeoJSON
├── scripts/ingest/               MEMBER 1
├── docs/DATA.md                  MEMBER 1
├── docs/HARMONIZATION.md         MEMBER 1
├── docs/implementation/          each member owns their own plan file
├── docs-presentation-data/       MEMBER 1
├── supabase/                     MEMBER 2
├── tests/analytics/              MEMBER 2
├── src/
│   ├── contracts/                LOCKED (types.ts, endpoints)
│   ├── mocks/                    LOCKED (simulated sample JSON)
│   ├── content/                  MEMBER 1 (attribution, limitations text)
│   ├── lib/
│   │   ├── db/                   MEMBER 2
│   │   ├── analytics/            MEMBER 2
│   │   ├── client/               MEMBER 3 (fetch helpers, mock switch)
│   │   ├── ai/                   MEMBER 4
│   │   └── export/               MEMBER 4
│   ├── hooks/                    MEMBER 3
│   ├── components/
│   │   ├── dashboard/            MEMBER 3
│   │   ├── map/                  MEMBER 3
│   │   ├── calendar/             MEMBER 3
│   │   ├── charts/               MEMBER 3
│   │   ├── filters/              MEMBER 3
│   │   ├── common/               MEMBER 3
│   │   ├── assistant/            MEMBER 4
│   │   └── export/               MEMBER 4
│   └── app/
│       ├── page.tsx, layout.tsx, globals.css    MEMBER 3
│       └── api/
│           ├── regions/          MEMBER 2
│           ├── hotspots/         MEMBER 2
│           ├── analytics/        MEMBER 2
│           ├── ai/               MEMBER 4
│           └── export/           MEMBER 4
├── tests/ai/                     MEMBER 4
└── docs/presentation/, docs/DEMO_SCRIPT.md      MEMBER 4
```

### Ownership matrix

| Path | Owner |
|---|---|
| `data/**`, `scripts/ingest/**`, `docs/DATA.md`, `docs/HARMONIZATION.md`, `docs/implementation/member-1-*.md`, `docs-presentation-data/**`, `src/content/**` | **Member 1** |
| `supabase/**`, `src/lib/db/**`, `src/lib/analytics/**`, `src/app/api/regions/**`, `src/app/api/hotspots/**`, `src/app/api/analytics/**`, `tests/analytics/**`, `docs/implementation/member-2-*.md` | **Member 2** |
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/{dashboard,map,calendar,charts,filters,common}/**`, `src/hooks/**`, `src/lib/client/**`, `docs/implementation/member-3-*.md` | **Member 3** |
| `src/app/api/ai/**`, `src/app/api/export/**`, `src/lib/ai/**`, `src/lib/export/**`, `src/components/assistant/**`, `src/components/export/**`, `tests/ai/**`, `docs/presentation/**`, `docs/DEMO_SCRIPT.md`, `docs/implementation/member-4-*.md` | **Member 4** |
| `src/contracts/**`, `src/mocks/**`, `package.json`, lockfile, configs, `.env.example`, `README.md`, `.github/**`, `scripts/check-owner.sh`, `docs/implementation/00-overview.md` | **LOCKED** (changes need all 4 to agree; Member 2 makes the edit) |

### Automatic check

Before every push, run this from the repo root (commit first):

```bash
#!/usr/bin/env bash
# usage: bash scripts/check-owner.sh data|backend|frontend|ai
role=$1
case $role in
  data)     allowed='^(data/|scripts/ingest/|docs/(DATA|HARMONIZATION)\.md|docs/implementation/member-1-|docs-presentation-data/|src/content/)' ;;
  backend)  allowed='^(supabase/|src/app/api/(regions|hotspots|analytics)/|src/lib/(db|analytics)/|tests/analytics/|docs/implementation/member-2-)' ;;
  frontend) allowed='^(src/app/(page|layout|globals)\.|src/components/(dashboard|map|calendar|charts|filters|common)/|src/hooks/|src/lib/client/|docs/implementation/member-3-)' ;;
  ai)       allowed='^(src/app/api/(ai|export)/|src/lib/(ai|export)/|src/components/(assistant|export)/|tests/ai/|docs/presentation/|docs/DEMO_SCRIPT\.md|docs/implementation/member-4-)' ;;
  *) echo "usage: $0 data|backend|frontend|ai"; exit 1 ;;
esac
bad=$(git diff --name-only origin/main...HEAD | grep -Ev "$allowed")
if [ -n "$bad" ]; then echo "Files outside your area:"; echo "$bad"; exit 1; fi
echo "OK: only your files changed"
```

Also add `.github/CODEOWNERS` with each path mapped to its owner's GitHub
username so pull requests auto-request the right reviewer.

------------------------------------------------------------------------

## 4. The Locked Contract

Agreed and frozen in **Phase 0**. This is the only thing the four parts
share. Do not change it alone. If something must change, all four agree,
then Member 2 edits `src/contracts/` and everyone pulls.

### 4.1 Shared types (`src/contracts/types.ts`)

```ts
export type Instrument = "MODIS" | "VIIRS";
export type RegionLevel = "country" | "region" | "province" | "custom";
export type Metric = "harmonized" | "raw";
export type BBox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

export interface Region {
  id: string;
  name: string;
  level: RegionLevel;
  parentId: string | null;
  bbox: BBox;
}

export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  acquisitionDatetime: string;      // ISO 8601, UTC
  satellite: string;
  instrument: Instrument;
  confidence: string | number | null; // original value, not converted
  brightness: number | null;
  sourceProduct: string | null;
}

export interface HotspotFilters {
  regionId: string;                 // a region id, or "custom"
  bbox?: BBox;                      // required when regionId = "custom"
  start: string;                    // YYYY-MM-DD (UTC)
  end: string;                      // YYYY-MM-DD (UTC)
  instrument?: Instrument | "ALL";  // default "ALL"
}

export interface HotspotsResponse {
  filters: HotspotFilters;
  total: number;        // all matching records in the raw window
  returned: number;     // records in this response
  truncated: boolean;   // true if total > returned
  hotspots: Hotspot[];
  rawWindow: { start: string; end: string } | null; // dates with raw points
  lastUpdated: string | null;
}

export type AnomalyLabel =
  | "below_baseline"
  | "near_baseline"
  | "above_baseline"
  | "unusually_high"
  | "not_calculable";   // zero or missing baseline

export interface HarmonizationInfo {
  method: string;                   // e.g. "median ratio of active cell-days"
  targetSensor: "VIIRS";
  overlapYears: number[];
  factor: number | null;            // MODIS to VIIRS-equivalent
  factorScope: "province" | "national";
  correlation: number | null;       // scaled MODIS vs VIIRS in the overlap
  errorPercent: number | null;
  estimatedYears: number[];         // years converted from MODIS
  notes: string[];
}

export interface AnalyticsQuery {
  regionId: string;                 // a region id, or "custom"
  bbox?: BBox;                      // required when regionId = "custom"
  year: number;
  month: number;
  metric: Metric;                   // default "harmonized"
  instrument?: Instrument | "ALL";  // used only when metric = "raw"
}

export interface AnalyticsSummary {
  region: { id: string; name: string; level: RegionLevel };
  period: { year: number; month: number };
  metric: Metric;
  instrument: Instrument | "ALL";   // "ALL" when metric = "harmonized"
  currentCount: number | null;      // null = no data coverage
  currentIsEstimated: boolean;
  byInstrument: { MODIS: number | null; VIIRS: number | null }; // raw counts
  baselineYears: number[];          // complete years used in the median
  estimatedBaselineYears: number[]; // baseline years that are estimated
  historicalMedian: number | null;
  anomalyPercent: number | null;    // null when baseline is 0 or missing
  label: AnomalyLabel;
  approximate: boolean;             // true for custom areas (grid-approximated)
  notes: string[];                  // limitations, e.g. "Only 3 baseline years"
  dataCoverage: { firstDate: string; lastDate: string } | null;
  harmonization: HarmonizationInfo | null;
  lastUpdated: string | null;
}

export interface CalendarCell {
  year: number;
  month: number;
  count: number | null;             // null = no data coverage (NOT zero)
  estimated: boolean;               // true when converted from MODIS
}
export interface CalendarResponse {
  regionId: string;
  metric: Metric;
  instrument: Instrument | "ALL";
  approximate: boolean;
  cells: CalendarCell[];
  harmonization: HarmonizationInfo | null;
}

export interface OverlapPoint {     // for the MODIS vs VIIRS comparison chart
  year: number;
  month: number;
  modis: number | null;             // raw MODIS active cell-days
  modisScaled: number | null;       // MODIS after the factor
  viirs: number | null;
}
export interface HarmonizationResponse {
  regionId: string;
  info: HarmonizationInfo;
  overlap: OverlapPoint[];
}

export interface ChildCount {       // used for national to province view
  regionId: string;
  name: string;
  count: number | null;
}

export interface AiBriefRequest {
  summary: AnalyticsSummary;        // computed analytics only
  question: string;
}
export interface AiBriefResponse {
  answer: string;                   // always shown as "AI interpretation"
  disclaimer: string;
}
```

### 4.2 API endpoints

Custom areas pass `regionId=custom` and `bbox=minLon,minLat,maxLon,maxLat`.
The `instrument` parameter applies only when `metric=raw`.

| Endpoint | Owner (builds it) | Used by | Returns |
|---|---|---|---|
| `GET /api/regions` | Member 2 | Member 3 | `Region[]` |
| `GET /api/hotspots?regionId&bbox&start&end&instrument&limit` | Member 2 | Member 3 | `HotspotsResponse` (raw window only) |
| `GET /api/analytics/summary?regionId&bbox&year&month&metric&instrument` | Member 2 | Member 3, 4 | `AnalyticsSummary` |
| `GET /api/analytics/calendar?regionId&bbox&metric&instrument` | Member 2 | Member 3 | `CalendarResponse` |
| `GET /api/analytics/children?regionId&year&month&metric` | Member 2 | Member 3 | `ChildCount[]` |
| `GET /api/analytics/harmonization?regionId` | Member 2 | Member 3, 4 | `HarmonizationResponse` |
| `POST /api/ai/brief` | Member 4 | Member 3 (via component) | `AiBriefResponse` |
| `GET /api/export/csv?regionId&bbox&start&end&instrument` | Member 4 | Member 3 (button) | CSV file (hotspots) |
| `GET /api/export/analytics-csv?regionId&bbox&metric&instrument` | Member 4 | Member 3 (button) | CSV file (monthly counts, medians, anomalies) |

### 4.3 Function signatures other members rely on

| Function | File (owner) | Used by |
|---|---|---|
| `queryHotspots(filters: HotspotFilters, limit?: number): Promise<HotspotsResponse>` | `src/lib/db/hotspots.ts` (Member 2) | Member 4 (CSV export) |
| `getAnalyticsSummary(query: AnalyticsQuery): Promise<AnalyticsSummary>` | `src/lib/analytics/summary.ts` (Member 2) | Member 4 (analytics CSV) |
| `getCalendar(query: Omit<AnalyticsQuery, "year" \| "month">): Promise<CalendarResponse>` | `src/lib/analytics/calendar.ts` (Member 2) | Member 4 (analytics CSV) |
| `getHarmonization(regionId: string): Promise<HarmonizationResponse>` | `src/lib/analytics/harmonization.ts` (Member 2) | Member 4 (optional) |
| `<AssistantPanel summary={AnalyticsSummary} />` | `src/components/assistant/` (Member 4) | Member 3 (dashboard slot) |
| `<ExportButton filters={HotspotFilters} metric={Metric} />` | `src/components/export/` (Member 4) | Member 3 (dashboard slot) |
| `DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, `HARMONIZATION_NOTE` (strings) | `src/content/data-notes.ts` (Member 1) | Member 3 |

### 4.4 Rules for mock data

-   Files in `src/mocks/` are **simulated** and must say so in a
    `"_simulated": true` field and in the UI.
-   Mocks follow the contract types exactly, so swapping to real data
    changes nothing in the UI code.
-   Member 3's `src/lib/client/` has one switch:
    `NEXT_PUBLIC_USE_MOCKS=true|false`.
-   Mocks must include examples for: a harmonized summary with estimated
    baseline years, a raw summary, a zero-baseline summary
    (`not_calculable`), a custom-area summary (`approximate: true`), a
    calendar with `null` cells and `estimated` cells, and one
    `HarmonizationResponse`.

### 4.5 Database tables shared by Member 1 (writes) and Member 2 (reads)

Member 2 writes the migration in Phase 1. Member 1 loads data into it.
Field details are in section 9 of the project document.

| Table | Written by | Read by | Contents |
|---|---|---|---|
| `regions` | Member 1 (boundaries loader) | Member 2 | Country and province regions, bbox, boundary |
| `hotspots` | Member 1 | Member 2 | Raw points for a **recent window only**, with `province_id` |
| `monthly_counts` | Member 1 | Member 2 | Per region, month, and sensor: `raw_count`, `active_cell_days`, `has_coverage` |
| `monthly_harmonized` | Member 1 | Member 2 | Per region and month: `harmonized_count`, `is_estimated` |
| `monthly_grid_counts` | Member 1 | Member 2 | Per 0.1 degree cell, month, and sensor (for custom areas) |
| `harmonization_factors` | Member 1 | Member 2 | Factor, method, overlap years, correlation, error |

Member 2's analytics read the monthly tables, never the raw `hotspots`
table, for the calendar, the median, and the anomaly.

------------------------------------------------------------------------

## 5. Phase 0: Setup (Everyone Together, about 1 hour)

Do this on one call so nobody works from different assumptions.

**Steps**

1.  Create the GitHub repo. One person runs `create-next-app` (TypeScript,
    Tailwind, App Router), then commits to `main`.
2.  Install **all** dependencies once so nobody edits `package.json`
    later: `@supabase/supabase-js`, `leaflet`, `react-leaflet`,
    `leaflet.markercluster`, `recharts`, `zod`, `jspdf`, `papaparse`,
    `@turf/turf`, `vitest`, the Gemini SDK (check Google's current docs for the
    package name), and `shadcn/ui` components.
3.  Create the folder layout from section 3.
4.  Write `src/contracts/types.ts` (section 4.1).
5.  Create **stub files** for every item in sections 4.2 and 4.3. Each
    stub returns mock data or a placeholder component.
6.  Create `src/mocks/*.json` (clearly marked simulated): a few regions,
    about 50 hotspots, and the mock set listed in section 4.4.
7.  Add `.env.example`, `.gitignore` (include `.env.local`, `data/raw`),
    `CODEOWNERS`, and `scripts/check-owner.sh`.
8.  Everyone clones and creates their branch: `feat/data`,
    `feat/backend`, `feat/frontend`, `feat/ai-export`.

**Decisions to make together in this hour (write them in README.md)**

| Decision | Proposed default |
|---|---|
| Label thresholds | Near baseline = within +/-15% of the median; Unusually high = +50% or more |
| Minimum baseline years before showing a warning | Fewer than 3 years shows a "small sample" note |
| History and storage | Raw points for a recent window only (last 12 to 24 months plus demo months); **monthly aggregates for the full available history** (early 2000s onward, verify the earliest dates in the FIRMS docs) |
| Harmonization grid | 0.01 degree (about 1 km) for active cell-days; 0.1 degree cells for custom areas |
| Harmonization target | VIIRS-equivalent counts (MODIS is converted) |
| Factor method | Median of monthly VIIRS/MODIS ratios over the overlap; one factor per province if enough overlap months, otherwise a national factor |
| Default metric | `harmonized`; `raw` is the toggle |
| Overlap years | Confirm from the FIRMS documentation during Member 1's first 3 hours, then write them in README.md |
| Region levels | `country` (Philippines) and `province` for MVP; `region` only if time permits |
| Province assignment | Member 1 assigns `province_id` on each hotspot during ingestion (point-in-polygon). This **adds** a `province_id` column to the `hotspots` table beyond the original doc schema, to keep nationwide queries fast |
| Time zone | Store UTC; display Philippine time (UTC+8) only in the UI |
| Environment keys | See table below |

**Environment variables (never commit `.env.local`)**

| Variable | Used by | Where it lives |
|---|---|---|
| `FIRMS_MAP_KEY` | Member 1 (scripts only) | Member 1's `.env.local` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Member 2, 3 | Everyone's `.env.local`; Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Member 1 (ingestion), Member 2 (server) | Server side only; never in browser code |
| `GEMINI_API_KEY` | Member 4 | Member 4's `.env.local`; Vercel |
| `NEXT_PUBLIC_USE_MOCKS` | Member 3 | Everyone's `.env.local` |

------------------------------------------------------------------------

## 6. Phase 1: Parallel Build (Each Member Alone)

Hours are counted from the end of Phase 0. They are targets, not strict
deadlines. Phase 1 lasts about 20 to 24 hours. Member 1 has the longest
list because harmonization is the core of the challenge.

**Priority tags:** `MUST` = needed for the MVP, `SHOULD` = should-have,
`NICE` = optional. Finish every `MUST` before starting a `SHOULD`. Each
member first reaches a **first working slice** (the smallest version of
their work that can be connected), then widens it.

### Member 1: Data and FIRMS

**First working slice:** one province, the overlap years, both sensors,
aggregated, one factor, one validation number.

| Hours | Priority | Task | Output |
|---|---|---|---|
| 0--3 | MUST | Get a FIRMS MAP_KEY. **Request the Philippines archive downloads for both sensors immediately** (large requests take time). Confirm each sensor's earliest date and the overlap years from the FIRMS docs. Inspect real field names, timestamps, confidence values, and missing data | `docs/DATA.md`, `data/sample/` |
| 3--7 | MUST | Normalization script: common schema, preserve the instrument, convert timestamps to UTC, build a documented unique record key | `scripts/ingest/normalize.ts` |
| 7--10 | MUST | Find a free Philippines country and province boundary dataset, check the license, simplify it, save as GeoJSON. Write the region loader | `data/boundaries/`, `scripts/ingest/load-regions.ts` |
| 10--13 | MUST | Ingest the **recent raw window** into `hotspots` (needs Member 2's migration), assign `province_id`, skip invalid coordinates, **run the import twice to prove no duplicates** | `scripts/ingest/ingest.ts` |
| 13--18 | MUST | Aggregation: process the archive one year at a time (overlap years first). For each province, month, and sensor write `raw_count` and `active_cell_days` (0.01 degree grid) to `monthly_counts`. Mark months without coverage with `has_coverage = false` | `scripts/ingest/aggregate.ts` |
| 18--22 | MUST | Harmonization: calculate the factor (per province or national), validate (correlation, error, leave-one-year-out, anomaly-consistency), build `monthly_harmonized` with estimated months flagged, fill `harmonization_factors`. Write the method and results | `scripts/ingest/harmonize.ts`, `docs/HARMONIZATION.md` |
| 22--24 | MUST | Validation report: database counts vs source counts, coverage by year and sensor, gaps. Write the UI text | `docs/DATA.md` (final), `src/content/data-notes.ts` |
| 20--24 | SHOULD | 0.1 degree grid counts for custom areas | `monthly_grid_counts` |
| 24+ | NICE | Help the team without touching their files: data and harmonization slide content | `docs-presentation-data/` |

**Handoff checklist (Member 1)**

-   [ ] Overlap years and each sensor's earliest date confirmed from the
    FIRMS docs and written down
-   [ ] Both sensors are in `monthly_counts`, with the instrument
    preserved and gaps marked `has_coverage = false`
-   [ ] History starts at the earliest available date (or the gap is
    documented)
-   [ ] Recent raw window is in `hotspots`; re-running ingestion creates
    no duplicates
-   [ ] Every raw hotspot has `province_id`, or is counted as unassigned
    and reported
-   [ ] `monthly_harmonized` and `harmonization_factors` are filled;
    MODIS-converted months are flagged as estimated
-   [ ] Validation numbers (correlation, error, leave-one-year-out,
    anomaly consistency) are written in `docs/HARMONIZATION.md`
-   [ ] Raw counts match the source files for 3 sample province-months,
    and one `active_cell_days` value was recomputed by hand
-   [ ] `src/content/data-notes.ts` exports the attribution, limitations,
    and harmonization text

### Member 2: Backend and Analytics

**First working slice:** one province, one month, correct median and
label verified by hand, on the harmonized series.

| Hours | Priority | Task | Output |
|---|---|---|---|
| 0--2 | MUST | Create the Supabase project. Write the migration for `hotspots` (with `province_id`, unique source key), `regions`, `monthly_counts`, `monthly_harmonized`, `monthly_grid_counts`, `harmonization_factors`, with indexes. Share keys privately | `supabase/migrations/` |
| 2--8 | MUST | `listRegions` and `queryHotspots` with `zod` validation. `/api/regions` and `/api/hotspots` with a result limit, the `truncated` flag, and `rawWindow` | `src/lib/db/`, routes |
| 8--16 | MUST | Analytics on the monthly tables: **same-month historical median** across complete past years only (never the current incomplete month), default `harmonized` series, `raw` metric respects the instrument filter, anomaly percent, labels, `not_calculable` when the median is 0 or missing, `null` for no coverage, estimated years listed, notes for small samples | `src/lib/analytics/` |
| 16--20 | MUST | Routes for summary, calendar, children, and harmonization. Aggregate **in SQL (GROUP BY)**, not in JavaScript. Check speed on national queries | `/api/analytics/*` |
| 20--22 | SHOULD | Custom areas: sum `monthly_grid_counts` inside `bbox`, return `approximate: true`, use the national factor, validate the bbox | `src/lib/analytics/`, routes |
| 22+ | MUST | Unit tests, error responses (400 for bad input, 500 for failures), curl smoke test list | `tests/analytics/` |

**Handoff checklist (Member 2)**

-   [ ] All endpoints return exactly the contract shapes
-   [ ] Median verified by hand for at least 2 province-months on the
    harmonized series
-   [ ] Zero baseline returns `not_calculable` and `anomalyPercent: null`
-   [ ] Current incomplete month is excluded from the baseline, and a
    note appears when the selected month is in progress
-   [ ] Missing years appear as `null`, not 0
-   [ ] Estimated baseline years are listed in `estimatedBaselineYears`
-   [ ] `metric=raw` respects the instrument filter; `metric=harmonized`
    ignores it
-   [ ] National count, the sum of provinces, and the unassigned count
    relate as documented
-   [ ] Harmonization endpoint returns the info and overlap points
-   [ ] Custom area returns `approximate: true` (if built)
-   [ ] National summary responds fast enough for a live demo
-   [ ] Unit tests pass

### Member 3: Frontend and Mapping

Works entirely from `src/mocks/` using the mock switch.

**First working slice:** one region, one month, map plus calendar plus
anomaly panel on mock data.

| Hours | Priority | Task | Output |
|---|---|---|---|
| 0--3 | MUST | Dashboard layout, header, filter bar (region, month or date range, **raw / harmonized toggle**, sensor filter enabled only for raw), summary cards | `dashboard/`, `filters/` |
| 3--10 | MUST | Leaflet map (client-side only). Markers with popups (lat/lon, time, sensor, confidence, brightness). Clustering. Province bubbles from the children endpoint. Show the `rawWindow` dates so users know which dates have points | `map/` |
| 10--16 | MUST | Calendar heatmap with a **colorblind-safe sequential ramp**, legend, and printed counts. `null` cells show "No data". **Estimated cells** are marked with a pattern and a legend entry. Anomaly panel: label **plus** icon **plus** text (never color alone), baseline years, median, `notes`. Harmonization info panel (method, factor, overlap years, correlation, error, estimated years) | `calendar/`, `charts/` |
| 16--20 | MUST | MODIS vs VIIRS overlap chart from `/api/analytics/harmonization`. National-to-province drill-down, loading, empty, and error states, mobile and laptop layout, attribution and "last updated" footer, slots for `<AssistantPanel />` and `<ExportButton />` | `charts/`, `dashboard/`, `common/` |
| 20--24 | SHOULD | Custom area tool: rectangle draw plus latitude and longitude inputs, labeled "grid-approximated" | `map/`, `filters/` |
| 24+ | NICE | Polish, accessibility, keyboard focus, readable fonts | all own files |

**Handoff checklist (Member 3)**

-   [ ] Whole flow works on mocks: select region, see map, calendar, and
    anomaly panel
-   [ ] Raw and harmonized toggle changes the calendar and the summary
-   [ ] Estimated months and "No data" months are visibly different from
    normal and zero months, with a legend
-   [ ] The color ramp is colorblind-safe, has a legend, and never carries
    meaning alone
-   [ ] Changing any filter updates the map, cards, and calendar together
-   [ ] Map stays smooth with several thousand points
-   [ ] "Satellite detection" wording used instead of "fire" where
    unconfirmed
-   [ ] Simulated data is labeled whenever mocks are on
-   [ ] Switching `NEXT_PUBLIC_USE_MOCKS=false` is the only change needed
    for real data

### Member 4: AI, Export, and Presentation

Works from mock summaries.

**First working slice:** one mock summary in, one safe, data-grounded
answer out.

| Hours | Priority | Task | Output |
|---|---|---|---|
| 0--4 | SHOULD | Set up Gemini on the server only. Write the system prompt from the doc's safety rules: use only supplied numbers, no invented data, never call a hotspot a confirmed fire, no predictions, no evacuation instructions, state limitations, **say when values are estimated and mention the harmonization error**, separate computed values from interpretation. Validate the request with `zod` | `src/lib/ai/` |
| 4--10 | SHOULD | Build `POST /api/ai/brief`. Test with mock summaries: normal, zero baseline, small baseline years, estimated months, custom area, low coverage. Test unsafe questions ("Should we evacuate?", "Will it spread?") and confirm it refuses politely | `src/app/api/ai/`, `tests/ai/` |
| 10--14 | SHOULD | `<AssistantPanel />`: suggested questions, loading and error states, label the answer "AI interpretation", always show the disclaimer | `src/components/assistant/` |
| 14--18 | SHOULD | Hotspot CSV: `toCsv` plus `GET /api/export/csv` using `queryHotspots`, with a `truncated` warning. Analytics CSV: `GET /api/export/analytics-csv` from `getCalendar` and `getAnalyticsSummary` (year, month, metric, count, estimated, historical median). `<ExportButton />` | `src/lib/export/`, `src/components/export/` |
| Throughout | MUST (submission) | **4-slide pitch** (challenge and problem, solution, demo, team), timed demo script that includes the raw vs harmonized toggle, **90-second backup demo video**, test matrix | `docs/presentation/`, `docs/DEMO_SCRIPT.md` |
| 18+ | NICE | PDF with jsPDF, only if everything above is done | `src/lib/export/` |

**Handoff checklist (Member 4)**

-   [ ] AI answers mention region, period, count, median, and limitations
-   [ ] AI says when a value is estimated and never invents numbers
    (checked against 6 test cases)
-   [ ] AI refuses evacuation and prediction requests
-   [ ] `GEMINI_API_KEY` is only used server-side
-   [ ] Hotspot CSV and analytics CSV match the contract fields
-   [ ] Demo script follows the national-to-Bukidnon flow, with the
    raw / harmonized toggle
-   [ ] 4-slide pitch ready, and the backup demo video recorded after the
    data is loaded

------------------------------------------------------------------------

## 7. Working Rules During Phase 1

1.  **Stay in your lane.** Only edit files in your area. Run
    `bash scripts/check-owner.sh <your-role>` before every push.
2.  **One branch each.** Push only to your own branch. Do not push to
    `main` in Phase 1.
3.  **Commit small and often.** Use messages like
    `data: add normalize script` (prefix with your role).
4.  **Never change the contract alone.** Post in the group chat, get all
    4 thumbs-up, then Member 2 edits.
5.  **Need something from another member?** Use this format in the chat:

    > `@owner` I need: ______ . File: ______ . Why: ______ . By hour: ______

    The owner makes the change in their own file.
6.  **Found a bug in someone else's code?** Tell the owner with the exact
    steps. Do not fix it yourself.
7.  **Secrets stay out of Git.** Never commit API keys or `.env.local`.
8.  **Check-in every 4 hours (5 minutes).** Each person says: done,
    doing next, blocked by.
9.  **Label everything honestly.** Simulated data must be marked simulated
    and never shown as NASA data.

------------------------------------------------------------------------

## 8. Phase 2: Integration (Everyone Together)

Start when **at least Members 1, 2, and 3 have passed their handoff
checklists**. Member 4 can finish their last items during this phase.

During integration, the ownership rule relaxes slightly: join one call,
and **only one person edits at a time**. The owner of a file still makes
changes to it. Use this order, because each step depends on the one
before it.

| Step | Who | Action | Done when |
|---|---|---|---|
| 1 | Member 1 | Confirm the raw window and all monthly tables are in Supabase; share the validation numbers with Member 2 | Row counts agree; validation recorded |
| 2 | Member 2 | Point the stubs at the real database; run the curl smoke tests for all 6 GET analytics, hotspot, and region endpoints | Real responses match the contract |
| 3 | Member 3 | Set `NEXT_PUBLIC_USE_MOCKS=false`; fix any UI problems caused by real data (large numbers, missing years, slow queries) | Dashboard works on real data |
| 4 | Member 4 | Confirm `queryHotspots` returns real rows for CSV; confirm the AI receives a real summary; confirm the analytics CSV uses real calendar data | CSV, analytics CSV, and AI use real data |
| 5 | Member 3 (with Member 4) | Place `<AssistantPanel />` and `<ExportButton />` into the dashboard slots; render `src/content/data-notes.ts` text in the footer | All features visible in one page |
| 6 | Everyone | Merge branches into `main` one at a time in this order: data, backend, frontend, ai-export. Run the app after each merge | `main` builds and runs |

**Integration rules**

-   Merge with pull requests, one branch at a time.
-   If a merge conflict appears, it means someone edited outside their
    area. Stop and sort it out together.
-   After each merge, one person runs the app and checks the whole flow.

------------------------------------------------------------------------

## 9. Phase 3: Test, Deploy, Demo

| Task | Lead | Check |
|---|---|---|
| Verify 3 sample counts against the source records | Member 1 | Counts match |
| Verify median and anomaly for 3 province-months by hand | Member 2 | Values match |
| Test missing data, zero median, small baseline, and mobile layout | Member 3 | No crashes, clear messages |
| Test AI with 5 different regions and months, plus unsafe questions | Member 4 | No invented values |
| Recompute the factor and one validation number for one province, and compare with `docs/HARMONIZATION.md` | Member 1 | Numbers match |
| Check that estimated and "No data" months are marked in the calendar, the AI answer, and the analytics CSV | Member 3 and 4 | Marked everywhere |
| Deploy to Vercel; set all environment variables | Member 2 | Deployed URL works |
| Test the **deployed** app end to end | Everyone | Full demo works |
| Attribution and "last updated" visible on screen | Member 3 | Visible |
| Prepare fallback: labeled sample data and screenshots in case live data fails | Member 1 and 4 | Fallback ready |
| Record the 90-second backup demo video | Member 4 | Video plays offline |
| Rehearse the 4-slide pitch and demo twice, with timing | Member 4 | Under the time limit |

------------------------------------------------------------------------

## 10. Pitch and Demo Flow (Reference)

### 4-slide pitch (about 5 minutes; check the real time limit)

| Slide | Content | Time |
|---|---|---|
| 1. Challenge and problem | Name the official challenge. Fire maps show where, not whether it is unusual. MODIS is aging out and VIIRS is replacing it, and their records cannot be compared directly. Add one real number from our data | 45 s |
| 2. Solution | Harmonized MODIS + VIIRS monthly calendar, same-month median, anomaly label, AI explanation. A small before and after. "Not confirmed fires, not a prediction" | 60 s |
| 3. Demo | See below | 2.5 min |
| 4. Team | Names, roles, what's next, NASA FIRMS credit, project link | 25 s |

Check the official 2026 Judging and Awards Guide for the criteria. The
2025 criteria were Impact, Creativity, Validity, Relevance, and
Presentation.

### Demo flow

1.  Open the dashboard on the national (Philippines) view.
2.  Pick a month with current and historical data.
3.  Show MODIS and VIIRS hotspots, clustered, across the country.
4.  Show the **raw** calendar, then toggle to **harmonized** and point
    out the estimated months and the harmonization panel (factor,
    overlap years, error).
5.  Show the MODIS vs VIIRS overlap chart.
6.  Show the national current count, historical median, and label.
7.  Drill down to Bukidnon and compare the local picture.
8.  Ask the AI: "Explain this month's fire activity compared with
    previous years."
9.  Download the CSV (and the analytics CSV).
10. Close with the limitations: satellite detections, not confirmed
    fires; not a prediction; MODIS-era values are estimates.

------------------------------------------------------------------------

## 11. If Time Runs Short

Cut in this order (item 1 goes first):

1.  PDF report
2.  Custom area drawing (keep it simple or drop it)
3.  Province bubbles on the national map (keep markers and clustering)
4.  Region-level (between country and province)
5.  AI chat history (keep a single question and answer)
6.  Sensor breakdown chart (keep the summary cards)
7.  Analytics CSV (keep the hotspot CSV)

**Simplify harmonization before cutting it:** use one national factor and
only the overlap years. The raw view stays as the honest fallback.

**Never cut:** real data, the harmonized monthly series with its
validation numbers, the historical calendar, the same-month median
comparison, honest labeling (estimated and "No data" months), and the
data limitations text.

------------------------------------------------------------------------

## 12. Quick Reference Card

| Question | Answer |
|---|---|
| Can I edit someone else's file? | No. Ask the owner. |
| Can I change a type in the contract? | Not alone. All 4 must agree. |
| Can I push to `main` during Phase 1? | No. Push to your own branch. |
| What do I use before the real data is ready? | The stubs and `src/mocks/`. |
| How do I check I stayed in my lane? | `bash scripts/check-owner.sh <role>` |
| When do we connect everything? | Phase 2, after the handoff checklists pass. |
| What is the heart of the project? | The validated harmonized MODIS + VIIRS calendar with the same-month median comparison. |
