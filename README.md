# FIRE MEMORY

**FIRE MEMORY** is a Philippines-focused historical satellite fire-activity analytics and CDRRMO situational monitoring dashboard built for the **2026 NASA Space Apps Challenge**. It combines multi-year **MODIS** and **VIIRS** thermal detection records from NASA LANCE FIRMS, calibrates MODIS observations to a VIIRS-equivalent scale across overlap years, compares selected months against same-month historical medians, and provides a safety-grounded **CDRRMO Advisory AI** alongside CSV exports.

> **Scientific & Operational Notice:** Satellite hotspots are thermal anomaly detections, **not** confirmed ground fires, fire-spread forecasts, or emergency evacuation directives. Missing coverage is kept distinct (`No data`) and is never silently converted to zero.

---

## Core Features

| Route | View | Purpose |
|---|---|---|
| `/` | **MAP** | Cloud-free multi-layer satellite map (CARTO Voyager underlay, Esri World Imagery scaled beyond native zoom `13`, Esri Boundaries & Labels), clustered hotspot pins, custom rectangle area selection, Hotspot Intensity Scale legend, and right-docked **CDRRMO Advisory AI** + **Priority Watchlist**. |
| `/calendar` | **Calendar** | Historical year-by-month detection matrix supporting raw (`MODIS`, `VIIRS`, `ALL`) and `harmonized` views, estimated-value indicators, and coverage-gap visibility. |
| `/anomaly` | **Anomaly Detection** | Same-month year-by-year bar graph, historical median comparison KPIs, MODIS Raw / MODIS Scaled / VIIRS Overlap Chart (`OverlapChart`), and cross-sensor calibration evidence (`HarmonizationPanel`). |
| `/export` | **CSV Export** | Scope preview, schema pill summary, and bounded CSV downloads for recent raw hotspots (`/api/export/csv`) and monthly analytics series (`/api/export/analytics-csv`). |

*(Visiting `/assistant` redirects to `/` where the Advisory AI drawer opens directly over the live map context.)*

---

## Tech Stack

- **Framework:** Next.js `16.4.6` (App Router, Turbopack), React `19.3.0`, TypeScript `5`
- **Mapping:** Leaflet `1.9.4`, `react-leaflet` `5.0.0`, `leaflet.markercluster` `1.5.3`, `@turf/turf` `7.4.0`
- **Visualization & Export:** Recharts `3.10.1`, `papaparse` `5.7.1`, `jspdf` `4.2.1`
- **Database:** Supabase PostgreSQL (`@supabase/supabase-js` `2.119.0`) with RLS read policies and hardened RPC rollups
- **AI Layer:** Google Gemini (`@google/genai` `3.3.0`, `gemini-2.5-flash` primary with `gemini-2.0-flash` fallback) guarded by `zod` validation and strict numeric grounding
- **Styling & Brand:** Global design system in `src/app/globals.css`, Inter & JetBrains Mono fonts, vector emblem at `public/fire-memory-logo.svg`

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Scope | Description |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Server | Supabase project URL (`SUPABASE_URL` takes precedence server-side). |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server | Public/anon key when service role is omitted. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Elevated server key used by ingestion and server queries. |
| `FIRMS_MAP_KEY` | Server-only | NASA FIRMS `MAP_KEY` for live NRT `/api/firms/area` and `/api/firms/wms` requests. |
| `GEMINI_API_KEY` | Server-only | Google Gemini API key for `POST /api/ai/brief`. |
| `NEXT_PUBLIC_USE_MOCKS` | Client/Server | Set to `"true"` to run offline against mock/sample data without Supabase credentials. |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Production build & lint

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run start
```

---

## Verification & Test Suites

Run the Node.js TypeScript test suite (analytics, validation, API routes, map zoom/tile checks, and CDRRMO Advisory AI safety tests):

```bash
node --import ./tests/analytics/register-paths.mjs --test \
  tests/ai/cdrrmo-advisory-watchlist.test.mjs \
  tests/ai/map-zoom-api.test.mjs \
  tests/analytics/*.test.ts \
  tests/ai/m4-t1.test.mjs \
  tests/ai/m4-t2.test.mjs \
  tests/ai/m4-t3.test.mjs \
  tests/ai/m4-t4.test.mjs
```

Data ingestion unit tests also live under `scripts/ingest/*.test.ts` (`normalize.test.ts`, `aggregate.test.ts`, `harmonize.test.ts`, `load-regions.test.ts`, `load-supabase.test.ts`).

---

## Repository Structure

```text
src/
  app/
    page.tsx, calendar/page.tsx, anomaly/page.tsx, export/page.tsx, assistant/page.tsx
    api/
      regions/, hotspots/, hotspots/window/
      firms/area/, firms/wms/
      analytics/{summary,calendar,children,harmonization}/
      ai/brief/
      export/{csv,analytics-csv}/
  components/
    assistant/        # CDRRMO Fire Advisory AI + Priority Watchlist tabs
    brand/            # FireMemoryLogo vector component
    calendar/         # Monthly heatmap / historical cell matrix
    charts/           # AnomalyPanel, OverlapChart, HarmonizationPanel
    dashboard/        # DashboardShell + shared URL/filter state provider
    export/           # ExportButton preview & CSV downloads
    map/              # MapView + cloud-free multi-layer LeafletCanvas
  contracts/          # Shared TypeScript domain contracts
  hooks/              # Client data hooks & SWR/fetch wrappers
  lib/
    ai/               # Gemini client, prompt rules, numeric verifier & fallback
    analytics/        # Anomaly labels, summary/calendar/children/harmonization, liveCounts
    db/               # Supabase client, SQL queries, Zod parameter validation
    export/           # Formula-safe CSV builders and filenames
    firms/            # Live NASA FIRMS NRT area fetcher & bounded chunking
    mocks/            # Offline development fixtures
scripts/ingest/       # MODIS/VIIRS normalization, 0.01°/0.1° aggregation, harmonization & Supabase loader
supabase/migrations/  # PostgreSQL schema, RLS policies, and hardened analytics RPCs
data/
  boundaries/         # Simplified geoBoundaries PHL ADM0/ADM2 GeoJSON & regions catalog
  raw/                # Local NASA FIRMS MODIS/VIIRS CSVs (ignored in Git except .gitignore)
  sample/             # Verified sample fixtures and field mapping docs
docs/                 # Full architecture, data provenance, harmonization, demo script & pitch decks
tests/                # Unit, route, AI grounding, map tile, and UI regression suites
```

---

## Documentation Index

- [**Official Project Documentation (PDF)**](./docs/FIRE_MEMORY_Documentation.pdf) and [**Printable HTML Report**](./docs/FIRE_MEMORY_Documentation.html) — NASA Space Apps judge/submission documentation combining executive summary, MODIS-to-VIIRS harmonization evidence, system architecture, and CDRRMO user guide.
- [**CDRRMO User Guide & Handbook**](./docs/USER_GUIDE.md) — step-by-step operational walkthrough for Map, Advisory AI & Watchlist, Calendar, Anomaly Detection, and CSV Export.
- [**System Architecture & Developer Reference**](./docs/ARCHITECTURE.md) — end-to-end data flow, component breakdown, 12-route API reference, database schema/RPCs, and AI safety guardrails.
- [**FIRMS Data Provenance & Coverage**](./docs/DATA.md) — audited local MODIS (`24,310` rows) & VIIRS (`153,533` rows) inventory (`177,843` total source rows across 2020–2025), NRT endpoint behavior, and Supabase validation checks.
- [**MODIS-to-VIIRS Harmonization Methodology**](./docs/HARMONIZATION.md) — UTC monthly `0.01°` cell-day normalization, `median-monthly-viirs-over-modis-v1` calibration (`4.09777677` national factor), province fallback rules, and LOYO validation metrics.
- [**Demo & Presentation Guides**](./docs/DEMO_SCRIPT.md) — timed product walkthrough, [4-slide pitch](./docs/presentation/4-slide-pitch.md), [7-slide pitch](./docs/presentation/7-slide-pitch.md), and [judge Q&A](./docs/presentation/judge-questions.md).
- [**Implementation & Upgrade Plans**](./docs/implementation/00-overview.md) — architecture contracts, [CDRRMO upgrade plan](./docs/implementation/cdrrmo-upgrade-plan.md), and [map black-tile & zoom fix plan](./docs/implementation/map-black-zoom-fix-plan.md).

---

## Attribution & Data Policy

- Satellite detections: [NASA LANCE FIRMS](https://earthdata.nasa.gov/firms) (MODIS Collection 6/6.1 and VIIRS NOAA-20 / SNPP active-fire products).
- Administrative boundaries: [geoBoundaries](https://www.geoboundaries.org/) Philippines `ADM0` / `ADM2` simplified geometries.
- Map tiles: OpenStreetMap / CARTO Voyager underlay, Esri World Imagery, and Esri World Boundaries & Places reference tiles.
