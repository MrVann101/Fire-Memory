# FIRE MEMORY implementation overview

## Project summary

FIRE MEMORY is a Philippines-focused dashboard that turns NASA FIRMS MODIS
and VIIRS satellite detections into a historical monthly activity record.
The MVP combines a responsive map, a full-history calendar, a same-month
historical median, anomaly labels, and an explicitly validated
VIIRS-equivalent harmonized series. The product describes satellite
detections, not confirmed fires, forecasts, or emergency directives.

## Plan index

| Owner | Role | Plan |
|---|---|---|
| Member 1 | Data and FIRMS | `docs/implementation/member-1-data.md` |
| Member 2 | Backend and Analytics | `docs/implementation/member-2-backend.md` |
| Member 3 | Frontend and Mapping | `docs/implementation/member-3-frontend.md` |
| Member 4 | AI, Export, and Presentation | `docs/implementation/member-4-ai-export.md` |

Member 2 edits the locked overview and contract files only after all four
members agree to a contract change. The four implementation plans themselves
are owned by their named members.

## Dependency map

| Contract item | Provider | Consumers |
|---|---|---|
| `regions` table | Member 1 loader | Member 2 database/API |
| `hotspots` table | Member 1 loader | Member 2 query layer; Member 4 hotspot CSV |
| `monthly_counts` table | Member 1 aggregation | Member 2 raw analytics |
| `monthly_harmonized` table | Member 1 harmonization | Member 2 harmonized analytics |
| `monthly_grid_counts` table | Member 1 aggregation | Member 2 custom-area analytics |
| `harmonization_factors` table | Member 1 harmonization | Member 2 harmonization endpoint |
| `GET /api/regions` -> `Region[]` | Member 2 | Member 3 |
| `GET /api/hotspots?...` -> `HotspotsResponse` | Member 2 | Member 3, Member 4 |
| `GET /api/analytics/summary?...` -> `AnalyticsSummary` | Member 2 | Member 3, Member 4 |
| `GET /api/analytics/calendar?...` -> `CalendarResponse` | Member 2 | Member 3, Member 4 |
| `GET /api/analytics/children?...` -> `ChildCount[]` | Member 2 | Member 3 |
| `GET /api/analytics/harmonization?...` -> `HarmonizationResponse` | Member 2 | Member 3, Member 4 |
| `POST /api/ai/brief` -> `AiBriefResponse` | Member 4 | Member 3 |
| `GET /api/export/csv?...` -> CSV | Member 4 | Member 3 |
| `GET /api/export/analytics-csv?...` -> CSV | Member 4 | Member 3 |
| `queryHotspots(filters: HotspotFilters, limit?: number): Promise<HotspotsResponse>` | Member 2 | Member 4 |
| `getAnalyticsSummary(query: AnalyticsQuery): Promise<AnalyticsSummary>` | Member 2 | Member 4 |
| `getCalendar(query: Omit<AnalyticsQuery, "year" \| "month">): Promise<CalendarResponse>` | Member 2 | Member 4 |
| `getHarmonization(regionId: string): Promise<HarmonizationResponse>` | Member 2 | Member 4 |
| `<AssistantPanel summary={AnalyticsSummary} />` | Member 4 | Member 3 |
| `<ExportButton filters={HotspotFilters} metric={Metric} />` | Member 4 | Member 3 |
| `DATA_ATTRIBUTION`, `DATA_LIMITATIONS`, `HARMONIZATION_NOTE` | Member 1 | Member 3 |

The shared types and mock JSON are locked and are used by every provider and
consumer. No plan adds a second owner for any item.

## MVP critical path

| By hour | Priority | Link | Owner | Blocking check |
|---|---|---|---|---|
| 3 | MVP-MUST | FIRMS access, earliest dates, overlap request | Member 1 | Official documentation and archive request recorded |
| 7 | MVP-MUST | Normalized sample and database contract | Members 1-2 | MODIS and VIIRS map to `Hotspot` |
| 10 | MVP-MUST | Boundary files and region loader | Member 1 | WGS84 country/province data is licensed and loadable |
| 13 | MVP-MUST | Recent raw window and idempotent import | Member 1 | Second import adds zero rows |
| 16 | MVP-MUST | First analytics slice | Member 2 | One province-month median and label match hand calculation |
| 18 | MVP-MUST | Monthly aggregates and first harmonized values | Member 1 | Overlap province has both instruments and estimated flags |
| 20 | MVP-MUST | Summary/calendar/children routes | Member 2 | Responses validate against exact contract shapes |
| 20 | MVP-MUST | Mock map, filters, calendar, anomaly panel | Member 3 | One mock region flows end to end |
| 22 | MVP-MUST | Harmonization validation report | Member 1 | Correlation, error, leave-one-year-out, and consistency checks exist |
| 24 | MVP-MUST | Real data integration | Members 1-3 | `NEXT_PUBLIC_USE_MOCKS=false` renders real responses |
| 24+ | MVP-SHOULD | AI, CSV, attribution, presentation | Member 4 | Demo-critical extras work without blocking MVP |

The first working slice is one province, one month, both instruments, one
harmonization factor, one validation result, and a connected mock UI.

## Integration order

1. **Member 1:** confirm raw-window and aggregate row counts, coverage, and
   validation numbers in `docs/DATA.md` and `docs/HARMONIZATION.md`.
2. **Member 2:** point database/API stubs at the loaded tables and run
   smoke tests for regions, hotspots, and all analytics endpoints.
3. **Member 3:** switch mocks off and check loading, null coverage,
   estimated values, large counts, map limits, and mobile layout.
4. **Member 4:** test AI with a real `AnalyticsSummary`, hotspot CSV with
   a real `HotspotsResponse`, and analytics CSV with real calendar data.
5. **Members 3-4:** place `AssistantPanel` and `ExportButton` in the
   dashboard; render Member 1's attribution and limitation strings.
6. **Everyone:** merge data, backend, frontend, then AI/export branches.
   Run the full flow after every merge.

## Environment variables

| Variable | Use | Exposure |
|---|---|---|
| `FIRMS_MAP_KEY` | Member 1 FIRMS scripts | Server/script only |
| `SUPABASE_URL` | Members 1-3 database access | Server/client as configured |
| `SUPABASE_ANON_KEY` | Members 2-3 application access | Client-safe public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingestion and server-side database work | Server only |
| `GEMINI_API_KEY` | Member 4 Gemini calls | Server only |
| `NEXT_PUBLIC_USE_MOCKS` | Member 3 mock switch | Public boolean |

Values are never written in these plans or committed to the repository.

## Assumptions

1. The repository will contain the locked contract and mock files before
   Phase 1 starts.
2. Member 1 will verify FIRMS products, fields, access limits, earliest
   dates, overlap years, and attribution before coding against them.
3. Stored timestamps and month grouping use UTC; Philippine UTC+8 is display
   context only.
4. The dashboard MVP supports country and province; region-level support is
   deferred unless time permits.
5. Raw points cover only a recent, documented window; full history is
   represented by monthly aggregates.
6. A valid response shape is more important than a feature that cannot be
   validated with the available data.

## Contract issues

| Issue | Why it matters | Affected | Proposed fix |
|---|---|---|---|
| `Region` has `bbox` but no polygon | Frontend cannot render exact province geometry | Members 1, 2, 3 | Use bbox centers/bubbles for MVP; add polygon only by team agreement |
| National totals may include unassigned points | Province sum may not equal national total | Members 1, 2, 3 | Return national total separately and disclose `unassigned` in `notes` |
| “Complete year/month” is undefined | Baseline membership can change silently | Members 1, 2 | Use explicit coverage metadata and document the rule in backend plan |
| Current month may be incomplete | Comparing partial data as complete misleads users | Members 2, 3, 4 | Do not scale; set note and preserve current value |
| Map result limit is unspecified | Large national responses can bias the map | Members 2, 3 | Default 2,000, maximum 10,000, deterministic spread sampling; verify in integration |
| Test runner is not named | Unit tests cannot be run consistently | All | Request locked dependency/config decision; do not edit package files alone |
| UTC versus Philippine month display | A local date can cross a UTC boundary | Members 1, 3 | Group and filter in UTC; label this visibly in the UI |
| `ALL` applies only to raw metric | A sensor filter on harmonized data is ambiguous | Members 2, 3 | Disable it for harmonized and explain `ALL` in raw-view help text |
| Factor thresholds and statistic are open | Harmonization may vary by province | Members 1, 2 | Use median ratio, record minimums and fallback in `HarmonizationInfo`; mark VERIFY |
| Earliest dates and overlap years are unconfirmed | Historical coverage cannot be honestly promised | Member 1 and all consumers | Keep `VERIFY` until official FIRMS documentation and files confirm them |
| Multiple VIIRS/MODIS satellites | Grouping can double-count or hide coverage changes | Members 1, 2 | Preserve satellite, group by instrument, report start/stop coverage |
| Weak validation threshold is undefined | UI/AI wording could overstate reliability | Members 1, 3, 4 | Report values and add a warning; agree on threshold before final demo |
| Raw-window length is open | Map and CSV expectations differ from history | Members 1, 3, 4 | Record exact window and show `rawWindow` in responses/UI |
| Estimated baseline share is open | Anomaly confidence may be misunderstood | Members 2, 3, 4 | Return estimated years and notes; never hide estimated status |

## Known-gap decisions

1. **Unassigned points:** national counts include all points in the national
   boundary; province totals exclude points without `province_id`; the
   unassigned count is reported in `notes`.
2. **Complete baseline year:** a year is eligible only when the selected
   month has `has_coverage=true` for the relevant harmonized series; a
   missing month is excluded, not treated as zero. Member 2 must align this
   with actual coverage metadata.
3. **In-progress month:** show the current count as partial, do not scale it,
   and add a note. The historical baseline remains complete past years only.
4. **Map scale:** use clusters and bbox-center child bubbles nationally;
   individual points are limited and sampled across the query window.
5. **Test runner:** use the repository's existing runner; if absent, record a
   locked package/config request rather than editing it in a member branch.
6. **Month boundary:** UTC for storage, queries, and analytics; display
   “months grouped in UTC”.
7. **Raw `ALL`:** it means both MODIS and VIIRS only for `metric=raw`;
   harmonized always returns the VIIRS-equivalent series.
8. **Factor:** default to median monthly VIIRS/MODIS ratio over qualifying
   overlap months; province factor when sufficient, otherwise national.
   Exact minimums remain `VERIFY` until the data inspection.
9. **Dates and overlap:** `VERIFY` from official FIRMS documentation and
   archive metadata before writing final claims.
10. **Grid computation:** stream one archive year at a time; key each fine
    cell by integerized 0.01-degree coordinates and UTC day.
11. **Satellites:** preserve satellite source fields, aggregate MODIS and
    VIIRS as instrument groups, and expose coverage changes in notes.
12. **Weak validation:** publish measured correlation/error and a warning;
    never silently substitute “validated” for a weak result.
13. **Raw window:** choose the documented recent 12–24-month window after
    access inspection and return it as `rawWindow`.
14. **Estimated years:** include them in `estimatedBaselineYears`, notes, and
    AI wording; they remain usable but are not presented as observations.
