# Member 3 Actionable Task Plan — Frontend & Mapping (`5d2b80c` Verified State)

> **Source of truth verified against:** `FIRE_MEMORY_Work_Plan.md`, `FIRE_MEMORY_Project_Documentation_Philippines.md`, `FIRE_MEMORY_Agent_Prompts.md`, `docs/implementation/00-overview.md`, `docs/implementation/member-3-frontend.md`, `src/components/dashboard/DashboardShell.tsx`, `src/components/map/{MapView,LeafletCanvas}.tsx`, `src/hooks/useDashboardData.ts`, `src/lib/client/api.ts`, `src/app/{layout,globals}.*`, `src/components/assistant/AssistantPanel.tsx`, and `src/components/export/ExportButton.tsx`.

---

## 1. Current Verified State (`5d2b80c`)

| Area | Status | Exact Verified State |
|---|---|---|
| Core Dashboard, Map & Calendar UI | `[x]` Built | `DashboardShell.tsx` (869 lines), `MapView.tsx`, `LeafletCanvas.tsx` (SSR-disabled dynamic Leaflet + `MarkerCluster` + province centroid bubbles + rectangle draw), CSS-grid calendar heatmap, anomaly panel, harmonization panel, `data-notes.ts` footer attribution all exist. |
| TypeScript & ESLint | `[x]` Clean | `npx tsc --noEmit` & `npm run lint` pass (`EXIT 0`). |
| **AI & Export Slots Unmounted** | `[!]` **CRITICAL MISSING** | `DashboardShell.tsx:846-857` still renders static text `"Assistant integration is not available in this build."` & `"Export integration is not available in this build."` instead of mounting `<AssistantPanel />` and `<ExportButton />`. |
| **Hardcoded `"PH"` Country ID Bug** | `[!]` **CRITICAL BLOCKER** | `DashboardShell.tsx:169, 193, 201` hardcodes `"PH"`, whereas Member 1's real `data/boundaries/regions.json` uses `"PHL-ADM0-24100683B85265433280220"` (`level: "country"`). With live DB enabled, `countryBBox` becomes `undefined` and initial state breaks unless DB maps to `"PH"`. |
| **Mock Client Crashes on Switches** | `[!]` **HIGH BUG** | `src/lib/client/api.ts:98-166` throws errors whenever the user selects `"PH"`, `"PH-DAV"`, `"PH-NUE"`, `"PH-PAL"`, any `raw` instrument other than `"VIIRS"`, or any period other than `2026-11` while `NEXT_PUBLIC_USE_MOCKS=true`. |
| **Empty Default Live Period** | `[!]` **HIGH UX BUG** | `DashboardShell.tsx:172` sets `period = isSimulated ? "2026-11" : ""`. When `NEXT_PUBLIC_USE_MOCKS=false`, the page lands with no active period selected (`summary`/`hotspots` stay disabled) until the user manually discovers and clicks a calendar cell. |
| **Tailwind Layering vs M4 Components** | `[!]` **STYLING BUG** | `src/app/globals.css:1-43` uses `@import "tailwindcss";` alongside unlayered element resets (`*`, `body`, `button`), while Member 4's `AssistantPanel.tsx` & `ExportButton.tsx` rely on Tailwind utility classes (`rounded-2xl`, `p-5`, `px-4`, `py-2`). |
| **Touch Target & Accessibility Polish** | `[!]` **MEDIUM** | `.calendar-cell`, `.chip`, and `.retry-button` (`globals.css:134, 368, 1044`) have `min-height: 32px–36px` (below 44px mobile touch comfort); `LeafletCanvas.tsx:249-258` draw mode should ignore `.leaflet-interactive` clicks cleanly and add `Escape` cancel + keyboard fallback clarity. |

---

## 2. Role Summary

Member 3 builds the entire Next.js client dashboard, interactive Leaflet map (markers, clusters, province bubbles, custom rectangle draw + lat/lon bbox input), historical CSS-grid calendar heatmap, anomaly/harmonization visualizations, and client data hooks. Right now the UI shell exists, **but Member 4's AI and Export components are still unmounted, mock switching throws errors, and switching to live Supabase will break without dynamic country ID & default period handling**.

---

## 3. Your Files & Ownership Boundaries

**Allowed paths (`FIRE_MEMORY_Work_Plan.md:108` & `scripts/check-owner.sh:6`):**
- `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css` (note: also any UI component css inside your paths)
- `src/components/dashboard/**`
- `src/components/map/**`
- `src/components/calendar/**`
- `src/components/charts/**`
- `src/components/filters/**`
- `src/components/common/**`
- `src/hooks/**`
- `src/lib/client/**`
- `docs/implementation/member-3-*.md`

**DO NOT TOUCH:**
- `src/components/assistant/**`, `src/components/export/**` (Member 4 owns these!)
- `src/app/api/**`, `src/lib/{db,analytics,ai,export}/**`, `supabase/**`, `scripts/ingest/**`, `data/**`, `src/content/**`
- `src/contracts/**`, `src/mocks/**`, `package.json`, `next.config.ts` (locked shared files).

---

## 4. What You Provide & What You Depend On

**You provide to others (`FIRE_MEMORY_Work_Plan.md` & `DashboardShell.tsx`):**
- Mounted integration slots for `<AssistantPanel summary={...} />` (`src/components/assistant/AssistantPanel.tsx:17-19`) and `<ExportButton filters={...} metric={...} />` (`src/components/export/ExportButton.tsx:10-13`).
- End-to-end interactive demo screens matching `docs/DEMO_SCRIPT.md` (national Philippines -> Bukidnon drill-down -> Raw vs Harmonized toggle -> overlap chart -> custom area draw -> AI brief -> CSV downloads).

**You depend on:**
- **Member 2 (`@backend`):** `/api/regions`, `/api/hotspots`, `/api/analytics/{summary,calendar,children,harmonization}`. (Fallback: `src/mocks/*.json` via `src/lib/client/api.ts` when `NEXT_PUBLIC_USE_MOCKS=true`).
- **Member 4 (`@ai`):** `<AssistantPanel />`, `<ExportButton />` (plus optional `year`/`month` prop coordination on `ExportButton` for accurate Analytics CSV).
- **Member 1 (`@data`):** `src/content/data-notes.ts` (`DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, `HARMONIZATION_NOTE`) — already imported!

---

## 5. Environment Variables You Use

| Variable | Status in `.env.local` | Purpose |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCKS` | `[!]` Currently `"true"` | Controls mock switch in `src/lib/client/api.ts:25` and `src/app/page.tsx`. Must test **both** `"true"` and `"false"`. |

*(Notice: Never read `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `FIRMS_MAP_KEY` anywhere in `src/components/` or `src/hooks/`.)*

---

## 6. MVP Scope & Execution Priority (`MVP-MUST` First)

| Priority | Task ID | Status | Target Deliverable |
|---|---|---|---|
| `MVP-MUST` | **M3-T1** | `[!]` Fix | Replace hardcoded `"PH"` country lookup (`DashboardShell.tsx:169,193,201`) with dynamic `level === "country"` lookup & auto-select an initial live period when `NEXT_PUBLIC_USE_MOCKS=false`. |
| `MVP-MUST` | **M3-T2** | `[!]` Fix | Harden mock resolution in `src/lib/client/api.ts:98-166` so switching regions (`PH`, `PH-DAV`, `PH-BUK`, etc.), instruments (`ALL`, `MODIS`, `VIIRS`), and calendar months in mock mode degrades cleanly instead of throwing errors. |
| `MVP-SHOULD` | **M3-T3** | `[ ]` Integration | Mount `<AssistantPanel />` & `<ExportButton />` into `DashboardShell.tsx:846-857` replacing both placeholder cards, with safe guards when `summary.data` or `hotspotFilters` is null. |
| `MVP-SHOULD` | **M3-T4** | `[!]` Styling Fix | Wrap unlayered base element resets in `src/app/globals.css:22-43` inside `@layer base { ... }` so Tailwind utility classes inside Member 4's `<AssistantPanel />` & `<ExportButton />` render with intended spacing/padding/colors. |
| `MVP-SHOULD` | **M3-T5** | `[!]` UX & A11y Polish | Improve `LeafletCanvas.tsx` rectangle-draw Escape cancel + marker/bubble click isolation + mobile touch targets (`>= 44px` where cramped) and responsive visual verification at desktop (`1280px`) & mobile (`375px`). |
| `MVP-SHOULD` | **M3-T6** | `[ ]` End-to-End Check | Verify complete `docs/DEMO_SCRIPT.md` user journey in Chrome with `NEXT_PUBLIC_USE_MOCKS=false` once Member 1 + Member 2 seed Supabase. |

---

## 7. Actionable Task List

### M3-T1 (`MVP-MUST`) `[!]` Dynamic Country Lookup & Live Initial Period (`DashboardShell.tsx`)
- **Objective:** Prevent empty national selection when live Supabase returns `regions.id = "PHL-ADM0-..."` and avoid landing on a blank unpopulated dashboard when `isSimulated === false`.
- **Files:** `src/components/dashboard/DashboardShell.tsx`
- **Steps:**
  1. Derive `countryRegion = regions.data?.find((region) => region.level === "country") ?? null`.
  2. Replace `useState(isSimulated ? "PH-BUK" : "PH")` (`DashboardShell.tsx:169`) and `countryBBox` (`line 201`) so when `!isSimulated` and `regions.data` loads, `regionId` initializes cleanly to `countryRegion?.id` (unless already changed by user) and `customRegion.parentId` (`line 193`) uses `countryRegion?.id ?? "PH"`.
  3. Initialize live `period` cleanly when `!isSimulated && !period`: pick the latest non-null month from `hotspots.data?.rawWindow?.end.slice(0, 7)` or from `calendar` cells once loaded (e.g., `2025-11` / latest available data month) rather than staying `""` forever.
  4. Verify `childrenQuery` (`lines 296-310`) works seamlessly with `countryRegion.id`.
- **Edge cases:** Handle `regions.isLoading` / empty `regions.data` gracefully (`null` safe, zero race condition overriding user selection if user selects a province before effect runs).
- **Acceptance criteria:** Booting with `NEXT_PUBLIC_USE_MOCKS=false` automatically selects the Philippines `country` region (`PH` or `PHL-ADM0-...`) and a valid month showing live summary + calendar + map detections.
- **How to verify:** Load `/` with live DB data (`NEXT_PUBLIC_USE_MOCKS=false`) and confirm zero `REGION_NOT_FOUND` errors in Network/Console.
- **Needs from others:** `@backend` & `@data` confirmation on live `regions` rows.

### M3-T2 (`MVP-MUST`) `[!]` Fix Crashes in `src/lib/client/api.ts` Mock Handlers
- **Objective:** Stop UI error banners when users click other mock provinces (`PH-DAV`, `PH-NUE`, `PH-PAL`), click calendar months other than `2026-11`, or toggle `MODIS`/`ALL` under `metric="raw"` in mock mode.
- **Files:** `src/lib/client/api.ts` (DO NOT edit locked `src/mocks/**`).
- **Steps:**
  1. In `resolveMockSummary` (`api.ts:98-136`): instead of throwing for unsupported mock `(regionId, instrument, year, month)`, match `custom`, `PH-BAT`, `raw`, or fallback to `harmonizedWithEstimated` overridden with the requested `region` metadata (`id`, `name`, `level` from `getMockRegions()`), `period: { year, month }`, `metric`, and `instrument`, updating `currentCount` from the matching mock `calendar.cells` if available.
  2. In `resolveMockCalendar` (`api.ts:138-153`): adapt `regionId`, `metric`, `instrument`, and `harmonization` (`null` when `metric === "raw"`) dynamically without throwing on `PH` or `PH-DAV`, matching how `src/lib/analytics/calendar.ts:46-57` already does it!
  3. In `resolveMockHarmonization` (`api.ts:155-166`): adapt `regionId` dynamically instead of throwing when selecting `"PH"`, `"PH-PAL"`, etc.
- **Acceptance criteria:** Clicking every region in the dropdown, every calendar month, and switching `Harmonized` <-> `Raw` (`ALL`/`MODIS`/`VIIRS`) in mock mode renders valid simulated responses without any error banner.
- **How to verify:** Run `npm run dev` with `NEXT_PUBLIC_USE_MOCKS=true`; test every filter combination on `/` and verify zero unhandled errors.

### M3-T3 (`MVP-SHOULD`) `[ ]` Mount `<AssistantPanel />` & `<ExportButton />` in `DashboardShell.tsx`
- **Objective:** Wire Member 4's finished `<AssistantPanel />` and `<ExportButton />` components into the live dashboard layout.
- **Files:** `src/components/dashboard/DashboardShell.tsx`
- **Steps:**
  1. Import `{ AssistantPanel } from "@/components/assistant/AssistantPanel"` and `{ ExportButton } from "@/components/export/ExportButton"`.
  2. Replace the `<section className="integration-slots">` placeholders (`DashboardShell.tsx:846-857`):
     - Render `<AssistantPanel summary={summary.data} />` when `summary.data` is present; render an accessible loading/empty card (`"Select a region and period to ask the AI assistant."`) when `summary.data` is null.
     - Render `<ExportButton filters={hotspotFilters} metric={metric} />` (passing active `regionId`, `bbox`, `start`, `end`, `instrument`, and `year`/`month` once `@ai` adds optional `year`/`month` props!) when `hotspotFilters` is non-null, or disabled prompt card when null.
  3. Confirm simulated badge visibility and verify `"Simulated data"` remains visible if `isSimulated` is true.
- **Edge cases:** `AssistantPanel` must receive a strict `AnalyticsSummary` matching `analyticsSummarySchema` (no extra ad-hoc UI fields, or strict Zod parser in `/api/ai/brief` will return `400`!). Verify `summary.data` object matches contract cleanly.
- **Acceptance criteria:** Asking a suggested question inside the dashboard posts to `/api/ai/brief`; clicking `Hotspot CSV` and `Analytics CSV` downloads valid `.csv` files matching active filters.
- **How to verify:** Inspect rendered DOM on `/` — zero occurrences of `"Assistant integration is not available in this build."` or `"Export integration is not available in this build."`.
- **Needs from others:** Coordinate optional `year` / `month` props on `<ExportButton />` with `@ai` (`M4-T3`).

### M3-T4 (`MVP-SHOULD`) `[!]` Fix Tailwind v4 CSS Layer Ordering in `globals.css`
- **Objective:** Ensure unlayered base selectors in `src/app/globals.css:22-43` do not override Tailwind v4 utility classes used by `<AssistantPanel />` and `<ExportButton />`.
- **Files:** `src/app/globals.css`
- **Steps:**
  1. Wrap `* { box-sizing: border-box; }`, `body { ... }`, `button, input, select { font: inherit; }`, and `a { color: inherit; }` (`lines 22-43`) inside `@layer base { ... }`.
  2. Inspect mounted `<AssistantPanel />` and `<ExportButton />` visuals in browser (`padding`, `border-radius`, button contrast, focus rings) and tune `.integration-slots` / wrapper layout if needed (mobile single column, desktop two-column balance).
- **Acceptance criteria:** `<AssistantPanel />` & `<ExportButton />` utilities (`p-5`, `px-4`, `py-2`, `rounded-xl`, `bg-slate-950`) apply cleanly without being stripped or overridden.
- **How to verify:** `npm run build` succeeds and DevTools computed styles confirm utility padding/background apply on both components.

### M3-T5 (`MVP-SHOULD`) `[!]` Accessibility, Touch Targets & Leaflet Draw Polish
- **Objective:** Eliminate interaction glitches in map rectangle drawing and ensure mobile touch comfort + accessible contrast across interactive controls.
- **Files:** `src/components/map/LeafletCanvas.tsx`, `src/app/globals.css`, `src/components/dashboard/DashboardShell.tsx`
- **Steps:**
  1. In `LeafletCanvas.tsx:249-258`: extend the `target.closest(...)` guard in `RectangleDrawControl` to ignore `.leaflet-interactive` markers/province bubbles when appropriate, add an `Escape` keydown listener to cancel drawing cleanly, and clear drag cursor/handlers reliably on unmount or window `mouseup`.
  2. Review `.chip`, `.calendar-cell`, `.retry-button` (`globals.css:134, 368, 1044`) — increase interactive control `min-height` to `44px` on coarse pointers/mobile (`@media (pointer: coarse)` or responsive rules) where layout allows, and verify `--muted` (`#627377`) contrast stays `>= 4.5:1` on all surfaces (`4.53:1` on `#f3f5f4` is right on the AA edge — darkening slightly to `#58696d` guarantees comfortable headroom).
  3. Confirm `skip-link` (`globals.css:49-63`) focuses visibly above header and `LeafletMap` never traps keyboard tab focus.
- **Acceptance criteria:** Pressing `Escape` cancels rectangle draw cleanly; mobile viewport (`375px`) has zero horizontal page overflow and comfortable tap targets.
- **How to verify:** Browser test at `1280x800` and `375x812` viewports + keyboard-only Tab navigation check.

### M3-T6 (`MVP-SHOULD`) `[ ]` Full Live Browser Verification (`docs/DEMO_SCRIPT.md` Walkthrough)
- **Objective:** Verify every screen in `docs/DEMO_SCRIPT.md` runs smoothly against live Supabase and Gemini responses before presentation recording.
- **Files:** Any bugfix inside Member 3 paths only.
- **Steps:** Set `NEXT_PUBLIC_USE_MOCKS=false`, load `/` -> confirm National view -> click Bukidnon bubble -> toggle `Harmonized` <-> `Raw` -> check MODIS/VIIRS overlap chart -> click historical calendar month -> draw custom area -> test AI Assistant -> click Hotspot CSV + Analytics CSV.
- **Acceptance criteria:** Zero console errors, zero uncaught promise rejections, and clear `"satellite detections"` + `"Simulated data"` / `"grid-approximated"` honest labels throughout.

---

## 8. Edge Cases & Honesty Rules

- **Terminology:** Always write `"satellite detections"` or `"hotspots"`, NEVER `"confirmed fires"`.
- **UTC labeling:** State `"UTC"` visibly near calendar and raw-window date controls.
- **No color-only status:** Calendar (`null` dashed/diagonal + `"No data"`, estimated `double` border + legend), anomaly labels (icon + text + plain-language explanation), and colorblind-safe ramp must all remain readable without color.
- **Simulated banner:** Keep simulated-data indicator active whenever `isSimulated` is true.

---

## 9. Verification Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

---

## 10. Handoff Checklist

- [ ] `M3-T1`: Dynamic `level === "country"` lookup & initial live period implemented (`DashboardShell.tsx`).
- [ ] `M3-T2`: Mock fallback in `src/lib/client/api.ts` works across all regions, instruments, and months without throwing.
- [ ] `M3-T3`: `<AssistantPanel />` & `<ExportButton />` mounted in `DashboardShell.tsx` (placeholders removed).
- [ ] `M3-T4`: Unlayered base styles wrapped in `@layer base` in `globals.css`.
- [ ] `M3-T5`: Escape-to-cancel rectangle draw + touch targets + contrast margin verified.
- [ ] `M3-T6`: Full `DEMO_SCRIPT.md` user journey passes in browser with `NEXT_PUBLIC_USE_MOCKS=false` and zero console errors.

---

## 11. Blocked Template & Cut Order

**If blocked on `ExportButton` period props, post in team chat:**
> `@ai I need: optional year and month props (or fallback to filters.start) on ExportButtonProps. File: src/components/export/ExportButton.tsx. Why: clicking Analytics CSV from DashboardShell for historical month 2024-03 currently defaults to current UTC year/month in analytics-csv/route.ts. By hour: ASAP.`

**If time runs short:**
1. Cut advanced chart animations or secondary polish; keep desktop clean & mobile usable.
2. Never cut: mounting `<AssistantPanel />` + `<ExportButton />`, Raw vs Harmonized toggle, estimated-cell patterns/`"No data"` distinction, `src/content/data-notes.ts` attribution, or live-DB region lookup fix.
