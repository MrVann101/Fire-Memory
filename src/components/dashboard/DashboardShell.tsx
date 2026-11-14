"use client";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type {
  AnalyticsQuery,
  AnalyticsSummary,
  BBox,
  HarmonizationResponse,
  HotspotFilters,
  Region,
} from "@/contracts/types";
import ActivityCalendar from "@/components/calendar/ActivityCalendar";
import {
  AnomalyPanel,
  HarmonizationPanel,
  OverlapChart,
} from "@/components/charts/AnalyticsPanels";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ExportButton } from "@/components/export/ExportButton";
import MapView from "@/components/map/MapView";
import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
import {
  useCalendar,
  useChildren,
  useHarmonization,
  useHotspots,
  useHotspotWindow,
  useRegions,
  useSummary,
} from "@/hooks/useDashboardData";
import type { ClientResource } from "@/hooks/useClientResource";

function formatSummaryNumber(
  resource: ClientResource<AnalyticsSummary>,
  value: number | null | undefined
): string {
  if (resource.error) {
    return "Unavailable";
  }
  if (resource.isLoading) {
    return "Loading...";
  }
  return value == null ? "No data" : value.toLocaleString("en-US");
}

function formatAnomalyPercent(
  resource: ClientResource<AnalyticsSummary>,
  value: number | null | undefined
): string {
  if (resource.error) {
    return "Unavailable";
  }
  if (resource.isLoading) {
    return "Loading...";
  }
  if (value == null) {
    return "Not available";
  }
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}%`;
}

type CalendarQuery = Omit<AnalyticsQuery, "year" | "month">;
type ChildrenQuery = Pick<
  AnalyticsQuery,
  "regionId" | "year" | "month" | "metric"
>;
type BBoxDraft = {
  west: string;
  south: string;
  east: string;
  north: string;
};
type DashboardNavItem = {
  href: string;
  feature: DashboardFeature;
  icon: "map" | "calendar" | "analytics" | "assistant" | "export";
  label: string;
};
type DashboardFeature = "map" | "calendar" | "anomaly" | "assistant" | "export";
const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/",
    feature: "map",
    icon: "map",
    label: "MAP",
  },
  {
    href: "/calendar",
    feature: "calendar",
    icon: "calendar",
    label: "Calendar",
  },
  {
    href: "/anomaly",
    feature: "anomaly",
    icon: "analytics",
    label: "Anomaly Detection",
  },
  {
    href: "/assistant",
    feature: "assistant",
    icon: "assistant",
    label: "AI Assistant",
  },
  {
    href: "/export",
    feature: "export",
    icon: "export",
    label: "CSV Export",
  },
];
function DashboardIcon({
  name,
}: {
  name: DashboardNavItem["icon"];
}) {
  const iconContent = {
    map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18m-14 4h.01M11 14h.01M15 14h.01M7 18h.01M11 18h.01" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 4-4 3 2 6-7m-5 0h5v5" />
      </>
    ),
    assistant: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 3l.7 1.3L7 5l-1.3.7L5 7l-.7-1.3L3 5l1.3-.7L5 3Z" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </>
    ),
  }[name];
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconContent}
    </svg>
  );
}
const DATA_ATTRIBUTION =
  "Data: NASA Fire Information for Resource Management System (FIRMS), MODIS and VIIRS active-fire products. Product names, retrieval dates, and attribution requirements are listed in the data documentation.";
const DATA_LIMITATIONS =
  "These are satellite detections of thermal anomalies, not confirmed fires or a complete incident record. Coverage, sensor sensitivity, boundaries, and missing observations affect counts. MODIS-only values converted to the VIIRS target are estimates.";
const HARMONIZATION_NOTE =
  "The series uses UTC monthly active 0.01-degree cell-days and overlap-period calibration to a VIIRS-equivalent scale. The factor, validation error, overlap years, estimated years, and limitations are shown with the result.";
function parsePeriod(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  const monthText = String(month).padStart(2, "0");
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    start: `${year}-${monthText}-01`,
    end: `${year}-${monthText}-${String(finalDay).padStart(2, "0")}`,
  };
}
function formatLastUpdated(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Unavailable";
  }
  return `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp)} UTC`;
}
function validateBBox(bbox: BBox, countryBBox: BBox | undefined): string | null {
  const [west, south, east, north] = bbox;
  if (
    !bbox.every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    return "Enter valid coordinates with west < east and south < north.";
  }
  if (!countryBBox) {
    return "Philippines bounds are unavailable; the area cannot be validated.";
  }
  if (
    west < countryBBox[0] ||
    south < countryBBox[1] ||
    east > countryBBox[2] ||
    north > countryBBox[3]
  ) {
    return "The custom area must fit within the Philippines overview bounds.";
  }
  return null;
}
function subscribeCalendarTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("calendar-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("calendar-theme-change", onStoreChange);
  };
}
function getCalendarThemeSnapshot(): "dark" | "light" {
  try {
    return window.localStorage.getItem("fire-memory-calendar-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
function getCalendarThemeServerSnapshot(): "dark" | "light" {
  return "dark";
}
export default function DashboardShell({
  activeFeature,
}: {
  activeFeature: DashboardFeature;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCalendarFiltersOpen, setIsCalendarFiltersOpen] = useState(false);
  const calendarTheme = useSyncExternalStore(
    subscribeCalendarTheme,
    getCalendarThemeSnapshot,
    getCalendarThemeServerSnapshot
  );
  const toggleCalendarTheme = useCallback(() => {
    const next = calendarTheme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem("fire-memory-calendar-theme", next);
    } catch {
      // Ignore storage errors in private browsing modes.
    }
    window.dispatchEvent(new Event("calendar-theme-change"));
  }, [calendarTheme]);
  const {
    regionId,
    setRegionId,
    metric,
    setMetric,
    instrument,
    setInstrument,
    periodSelection,
    setPeriodSelection,
    customBbox,
    setCustomBbox,
  } = useDashboardFilters();
  const [bboxDraft, setBboxDraft] = useState<BBoxDraft>({
    west: "124.90",
    south: "7.80",
    east: "125.25",
    north: "8.20",
  });
  const [customAreaError, setCustomAreaError] = useState<string | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [isFilterPopoverPinned, setIsFilterPopoverPinned] = useState(false);
  const isFilterPopoverOpen = isFilterPopoverPinned;
  const regions = useRegions();
  const hotspotWindow = useHotspotWindow();
  const period =
    periodSelection ??
    hotspotWindow.data?.rawWindow?.end.slice(0, 7) ??
    "";
  const customRegion = useMemo<Region | null>(() => {
    if (!customBbox) {
      return null;
    }
    const [west, south, east, north] = customBbox;
    return {
      id: "custom",
      name: `Custom Area (${west.toFixed(2)}, ${south.toFixed(2)} to ${east.toFixed(2)}, ${north.toFixed(2)})`,
      level: "custom",
      parentId: "PH",
      bbox: customBbox,
    };
  }, [customBbox]);
  const selectedRegion =
    regionId === "custom"
      ? customRegion
      : regions.data?.find((region) => region.id === regionId) ?? null;
  const countryBBox = regions.data?.find((region) => region.id === "PH")?.bbox;
  const periodRange = useMemo(() => parsePeriod(period), [period]);
  const activateCustomArea = useCallback(
    (bbox: BBox) => {
      setBboxDraft({
        west: String(bbox[0]),
        south: String(bbox[1]),
        east: String(bbox[2]),
        north: String(bbox[3]),
      });
      const error = validateBBox(bbox, countryBBox);
      if (error) {
        setCustomAreaError(error);
        setIsDrawingArea(false);
        return;
      }
      setCustomBbox(bbox);
      setRegionId("custom");
      setCustomAreaError(null);
      setIsDrawingArea(false);
    },
    [countryBBox, setCustomBbox, setRegionId]
  );
  const applyCustomArea = useCallback(() => {
    if (
      !bboxDraft.west.trim() ||
      !bboxDraft.south.trim() ||
      !bboxDraft.east.trim() ||
      !bboxDraft.north.trim()
    ) {
      setCustomAreaError("Enter all four longitude and latitude values.");
      return;
    }
    const bbox: BBox = [
      Number(bboxDraft.west),
      Number(bboxDraft.south),
      Number(bboxDraft.east),
      Number(bboxDraft.north),
    ];
    activateCustomArea(bbox);
  }, [activateCustomArea, bboxDraft]);
  const analyticsQuery = useMemo<AnalyticsQuery | null>(() => {
    if (!selectedRegion || !periodRange) {
      return null;
    }
    const area = {
      regionId: selectedRegion.id,
      ...(selectedRegion.level === "custom"
        ? { bbox: selectedRegion.bbox }
        : {}),
      year: periodRange.year,
      month: periodRange.month,
      metric,
    };
    return metric === "raw"
      ? {
          ...area,
          instrument,
        }
      : area;
  }, [selectedRegion, periodRange, metric, instrument]);
  const calendarQuery = useMemo<CalendarQuery | null>(() => {
    if (!analyticsQuery) {
      return null;
    }
    const { regionId: queryRegionId, bbox, metric: queryMetric } =
      analyticsQuery;
    return queryMetric === "raw"
      ? {
          regionId: queryRegionId,
          bbox,
          metric: queryMetric,
          instrument: analyticsQuery.instrument,
        }
      : { regionId: queryRegionId, bbox, metric: queryMetric };
  }, [analyticsQuery]);
  const hotspotFilters = useMemo<HotspotFilters | null>(() => {
    if (!selectedRegion || !periodRange) {
      return null;
    }
    return {
      regionId: selectedRegion.id,
      ...(selectedRegion.level === "custom"
        ? { bbox: selectedRegion.bbox }
        : {}),
      start: periodRange.start,
      end: periodRange.end,
      instrument: metric === "raw" ? instrument : "ALL",
    };
  }, [selectedRegion, periodRange, metric, instrument]);
  const childrenQuery = useMemo<ChildrenQuery | null>(() => {
    if (
      !selectedRegion ||
      selectedRegion.level !== "country" ||
      !periodRange
    ) {
      return null;
    }
    return {
      regionId: selectedRegion.id,
      year: periodRange.year,
      month: periodRange.month,
      metric,
    };
  }, [selectedRegion, periodRange, metric]);
  const summary = useSummary(analyticsQuery, Boolean(analyticsQuery));
  const calendar = useCalendar(calendarQuery, Boolean(calendarQuery));
  const hotspots = useHotspots(
    hotspotFilters,
    2_000,
    Boolean(hotspotFilters)
  );
  const children = useChildren(childrenQuery, Boolean(childrenQuery));
  const harmonizationRequest = useHarmonization(
    selectedRegion?.level === "custom" ? null : selectedRegion?.id ?? null,
    Boolean(selectedRegion && selectedRegion.level !== "custom")
  );
  const harmonization = useMemo<ClientResource<HarmonizationResponse>>(() => {
    if (selectedRegion?.level !== "custom") {
      return harmonizationRequest;
    }
    const info = summary.data?.harmonization;
    if (!info) {
      return {
        data: null,
        isLoading: summary.isLoading,
        error: summary.error,
        retry: summary.retry,
      };
    }
    return {
      data: { regionId: selectedRegion.id, info, overlap: [] },
      isLoading: false,
      error: null,
      retry: summary.retry,
    };
  }, [
    selectedRegion,
    summary.data,
    summary.isLoading,
    summary.error,
    summary.retry,
    harmonizationRequest,
  ]);
  const handleSelectRegion = useCallback((selectedId: string) => {
    setRegionId(selectedId);
  }, [setRegionId]);
  const handleSelectMonth = useCallback((year: number, month: number) => {
    setPeriodSelection(`${year}-${String(month).padStart(2, "0")}`);
  }, [setPeriodSelection]);
  const dataErrors = [
    regions.error,
    hotspotWindow.error,
    summary.error,
    calendar.error,
    hotspots.error,
    children.error,
    harmonization.error,
  ].filter((error): error is Error => error !== null);
  const hasDataLoading =
    regions.isLoading ||
    hotspotWindow.isLoading ||
    summary.isLoading ||
    calendar.isLoading ||
    hotspots.isLoading ||
    children.isLoading ||
    harmonization.isLoading;
  const latestUpdate =
    summary.data?.lastUpdated ??
    hotspots.data?.lastUpdated ??
    hotspotWindow.data?.lastUpdated;
  const summaryMonth = periodRange
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(
        new Date(Date.UTC(periodRange.year, periodRange.month - 1, 1))
      )
    : "Selected month";
  const summaryRegion =
    summary.data?.region.name ?? selectedRegion?.name ?? "Selected area";
  const baselineYears = summary.data?.baselineYears ?? [];
  const baselineDetail = baselineYears.length
    ? `${baselineYears.length} years (${baselineYears[0]}-${baselineYears[baselineYears.length - 1]})`
    : "No comparable baseline";
  const activityMetricDetail =
    metric === "harmonized"
      ? "VIIRS-equivalent active cell-days"
      : `Raw ${instrument === "ALL" ? "all-sensor" : instrument} active cell-days`;
  const anomalyLabel = summary.data?.label
    ? summary.data.label.replace("_", " ").replace(/^\w/, (letter) =>
        letter.toUpperCase()
      )
    : summary.error
      ? "Unavailable"
      : summary.isLoading
        ? "Loading baseline"
        : "No comparison";
  const anomalyClass = summary.data?.label ?? "not_calculable";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to dashboard
      </a>
      <aside
        className={`dashboard-sidebar${isSidebarOpen ? " sidebar-open" : ""}`}
        aria-label="Dashboard sidebar"
      >
        <Link className="sidebar-brand" href="/" aria-label="FIRE MEMORY home">
          <span className="sidebar-brand-mark" aria-hidden="true">
            FM
          </span>
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-name">FIRE MEMORY</span>
            <span className="sidebar-brand-caption">Historical intelligence</span>
          </span>
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={isSidebarOpen}
          aria-controls="dashboard-nav"
          onClick={() => setIsSidebarOpen((open) => !open)}
        >
          <span aria-hidden="true">{isSidebarOpen ? "‹" : "›"}</span>
        </button>
        <p className="sidebar-heading">Main features</p>
        <nav className="sidebar-nav" id="dashboard-nav" aria-label="Dashboard sections">
          {dashboardNavItems.map((item) => (
            <Link
              className={`sidebar-nav-link${activeFeature === item.feature ? " is-active" : ""}`}
              href={item.href}
              key={item.href}
              title={item.label}
              aria-current={activeFeature === item.feature ? "page" : undefined}
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className="sidebar-icon">
                <DashboardIcon name={item.icon} />
              </span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="app-content">
      <main
        className={`dashboard-main${activeFeature === "map" ? " dashboard-map-page" : " dashboard-feature-page"}`}
        id="main-content"
      >
        {activeFeature === "map" && (
          <>
            <h1 className="sr-only" id="page-title">
              Satellite activity dashboard
            </h1>
            <section
              className="map-summary-cards"
              aria-label="Selected month fire activity summary"
            >
              <article className="map-summary-card">
                <p className="map-summary-card-label">{summaryMonth} Activity</p>
                <strong className="map-summary-card-value">
                  {formatSummaryNumber(summary, summary.data?.currentCount)}
                </strong>
                <span className="map-summary-card-detail">
                  {summaryRegion} · {activityMetricDetail}
                </span>
              </article>
              <article className="map-summary-card">
                <p className="map-summary-card-label">VIIRS Active-Fire (375m)</p>
                <strong className="map-summary-card-value">
                  {formatSummaryNumber(summary, summary.data?.byInstrument.VIIRS)}
                </strong>
                <span className="map-summary-card-detail">
                  Raw active cell-days
                </span>
              </article>
              <article className="map-summary-card">
                <p className="map-summary-card-label">MODIS Active-Fire (1km)</p>
                <strong className="map-summary-card-value">
                  {formatSummaryNumber(summary, summary.data?.byInstrument.MODIS)}
                </strong>
                <span className="map-summary-card-detail">
                  Raw active cell-days
                </span>
              </article>
              <article className="map-summary-card">
                <p className="map-summary-card-label">
                  {summaryMonth} Historical Median
                </p>
                <strong className="map-summary-card-value">
                  {formatSummaryNumber(summary, summary.data?.historicalMedian)}
                </strong>
                <span className="map-summary-card-detail">
                  Baseline: {baselineDetail}
                </span>
              </article>
              <article className="map-summary-card map-summary-card-anomaly">
                <p className="map-summary-card-label">Anomaly vs. Median</p>
                <strong className="map-summary-card-value">
                  {formatAnomalyPercent(summary, summary.data?.anomalyPercent)}
                </strong>
                <span
                  className={`map-summary-status map-summary-status-${anomalyClass}`}
                >
                  {anomalyLabel}
                </span>
              </article>
            </section>
            <section
              className="map-workspace"
              id="map-section"
              aria-label="Satellite fire map"
            >
          <MapView
            resource={hotspots}
            region={selectedRegion ?? null}
            childrenResource={children}
            regions={regions.data ?? []}
            imageryDate={periodRange?.end ?? null}
            onSelectRegion={handleSelectRegion}
            drawRectangle={isDrawingArea}
            onDrawComplete={activateCustomArea}
          />
          <div
            className={`map-filter-popover${isFilterPopoverOpen ? " is-open" : ""}`}
          >
            <section
              className="filter-panel map-controls"
              id="map-filter-panel"
              aria-hidden={!isFilterPopoverOpen}
              aria-labelledby="filter-title"
              inert={!isFilterPopoverOpen}
            >
              <div className="map-filter-heading">
                <h2 id="filter-title">Map filters</h2>
                <span className="filter-updated">
                  Updated {formatLastUpdated(latestUpdate)}
                </span>
              </div>
          <div className="filter-grid">
            <div className="filter-field">
              <label htmlFor="region">Region</label>
              <select
                id="region"
                value={regionId}
                disabled={regions.isLoading || Boolean(regions.error)}
                onChange={(event) => setRegionId(event.target.value)}
                aria-describedby="region-help"
              >
                {regions.isLoading && <option value="">Loading regions…</option>}
                {regions.error && (
                  <option value="">Region catalog unavailable</option>
                )}
                {regions.data?.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
                {customRegion && (
                  <option value="custom">Custom area · grid-approximated</option>
                )}
              </select>
              <span className="field-help" id="region-help">
                {regions.isLoading
                  ? "Loading available regions."
                  : regions.error
                    ? regions.error.message
                    : "Choose a national, province, or custom area view."}
              </span>
            </div>
            <div className="filter-field">
              <label htmlFor="period">Month</label>
              <input
                id="period"
                type="month"
                value={period}
                onChange={(event) => setPeriodSelection(event.target.value)}
              />
              <span className="field-help">Select a calendar month in UTC.</span>
            </div>
            <fieldset className="filter-field metric-field">
              <legend>Metric</legend>
              <div className="segmented-control">
                <label className={metric === "harmonized" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="metric"
                    value="harmonized"
                    checked={metric === "harmonized"}
                    onChange={() => {
                      setMetric("harmonized");
                      setInstrument("ALL");
                    }}
                  />
                  Harmonized
                </label>
                <label className={metric === "raw" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="metric"
                    value="raw"
                    checked={metric === "raw"}
                    onChange={() => {
                      setMetric("raw");
                      setInstrument("ALL");
                    }}
                  />
                  Raw
                </label>
              </div>
              <span className="field-help">
                Harmonized is the default view.
              </span>
            </fieldset>
            <div className="filter-field">
              <label htmlFor="instrument">Sensor</label>
              <select
                id="instrument"
                value={instrument}
                disabled={metric !== "raw"}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "MODIS" || value === "VIIRS" || value === "ALL") {
                    setInstrument(value);
                  }
                }}
                aria-describedby="instrument-help"
              >
                <option value="ALL">All instruments</option>
                <option value="MODIS">MODIS</option>
                <option value="VIIRS">VIIRS</option>
              </select>
              <span className="field-help" id="instrument-help">
                {metric === "raw"
                  ? "ALL includes MODIS and VIIRS."
                  : "Available when viewing raw detections."}
              </span>
            </div>
          </div>
          <details className="custom-area-tool">
            <summary>
              Custom area · grid-approximated
              {customRegion ? " · active" : " · optional"}
            </summary>
            <p className="custom-area-description">
              Enter longitude and latitude bounds or draw a rectangle on the
              map. The area must fit within the Philippines overview bounds.
            </p>
            <div className="custom-area-grid">
              <div className="filter-field">
                <label htmlFor="area-west">West longitude</label>
                <input
                  id="area-west"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={bboxDraft.west}
                  onChange={(event) => {
                    setBboxDraft((draft) => ({
                      ...draft,
                      west: event.target.value,
                    }));
                    setCustomAreaError(null);
                  }}
                />
              </div>
              <div className="filter-field">
                <label htmlFor="area-south">South latitude</label>
                <input
                  id="area-south"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={bboxDraft.south}
                  onChange={(event) => {
                    setBboxDraft((draft) => ({
                      ...draft,
                      south: event.target.value,
                    }));
                    setCustomAreaError(null);
                  }}
                />
              </div>
              <div className="filter-field">
                <label htmlFor="area-east">East longitude</label>
                <input
                  id="area-east"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={bboxDraft.east}
                  onChange={(event) => {
                    setBboxDraft((draft) => ({
                      ...draft,
                      east: event.target.value,
                    }));
                    setCustomAreaError(null);
                  }}
                />
              </div>
              <div className="filter-field">
                <label htmlFor="area-north">North latitude</label>
                <input
                  id="area-north"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={bboxDraft.north}
                  onChange={(event) => {
                    setBboxDraft((draft) => ({
                      ...draft,
                      north: event.target.value,
                    }));
                    setCustomAreaError(null);
                  }}
                />
              </div>
            </div>
            <div className="custom-area-actions">
              <button
                type="button"
                className="custom-area-primary"
                disabled={!countryBBox}
                onClick={applyCustomArea}
              >
                Use custom area
              </button>
              <button
                type="button"
                className="custom-area-secondary"
                disabled={!countryBBox}
                onClick={() => {
                  setIsDrawingArea((drawing) => !drawing);
                  setCustomAreaError(null);
                }}
              >
                {isDrawingArea ? "Cancel map drawing" : "Draw rectangle on map"}
              </button>
            </div>
            {customAreaError && (
              <p className="custom-area-error" role="alert">
                {customAreaError}
              </p>
            )}
            {customRegion && (
              <p className="custom-area-active">
                Active area: {customRegion.name} · bounds{" "}
                {customBbox?.map((coordinate) => String(coordinate)).join(", ")}{" "}
                · grid-approximated
              </p>
            )}
          </details>
            </section>
          </div>
          <button
            type="button"
            className="map-region-trigger"
            aria-label="Choose region"
            aria-controls="map-filter-panel"
            aria-expanded={isFilterPopoverOpen}
            title="Choose region"
            onClick={() => {
              setIsFilterPopoverPinned((isPinned) => !isPinned);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
          <Link
            className="map-assistant-trigger"
            href="/assistant"
            aria-label="Open Gemini AI assistant"
            title="Gemini AI assistant"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22c4.4 0 7.5-3.1 7.5-7.4 0-3.5-2-6.5-4.7-8.9-.2 2.3-1.1 3.8-2.8 5.2-.3-3.5-2.2-6.7-5.3-8.8.5 4.1-2.2 6.4-2.2 11.3C4.5 18.2 7.6 22 12 22Z" />
              <path d="M12 20c-1.6 0-2.8-1.2-2.8-2.9 0-1.5 1-2.4 2.5-3.8.5 1.4 1.3 2.1 2.1 2.8.9 1.6.1 3.9-1.8 3.9Z" />
            </svg>
            <span>Gemini AI</span>
          </Link>
        </section>
          </>
        )}
        {activeFeature !== "map" && (
          <section
            className={`dashboard-secondary feature-page${
              activeFeature === "calendar" ? " calendar-feature-page" : ""
            }`}
            data-calendar-theme={
              activeFeature === "calendar" ? calendarTheme : undefined
            }
          >
            {activeFeature === "calendar" ? (
              <header className="calendar-command-bar">
                <div className="calendar-command-title">
                  <h1 className="feature-page-title">Activity Calendar</h1>
                  <span className="calendar-command-scope">
                    {selectedRegion?.name ?? "Select region"} ·{" "}
                    {metric.toUpperCase()} · UTC
                  </span>
                  <div className="calendar-mobile-actions">
                    <button
                      type="button"
                      className="calendar-mobile-filter-chip"
                      aria-expanded={isCalendarFiltersOpen}
                      onClick={() =>
                        setIsCalendarFiltersOpen((open) => !open)
                      }
                    >
                      {selectedRegion?.name ?? "Filter"} ·{" "}
                      {metric === "harmonized" ? "Harm" : "Raw"}{" "}
                      {isCalendarFiltersOpen ? "▴" : "▾"}
                    </button>
                    <button
                      type="button"
                      className="calendar-theme-toggle"
                      aria-pressed={calendarTheme === "light"}
                      onClick={toggleCalendarTheme}
                    >
                      {calendarTheme === "light" ? "Dark" : "Warm"}
                    </button>
                    <Link href="/" className="calendar-map-link">
                      ← Map
                    </Link>
                  </div>
                </div>
                <div
                  className={`calendar-command-controls${
                    isCalendarFiltersOpen ? " is-open" : ""
                  }`}
                  aria-label="Dashboard filters"
                >
                  <label className="command-control">
                    <span>Region</span>
                    <select
                      id="feature-region"
                      value={regionId}
                      disabled={regions.isLoading || Boolean(regions.error)}
                      onChange={(event) => setRegionId(event.target.value)}
                    >
                      {regions.isLoading && (
                        <option value="">Loading regions…</option>
                      )}
                      {regions.error && (
                        <option value="">Region catalog unavailable</option>
                      )}
                      {regions.data?.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                      {customRegion && (
                        <option value="custom">
                          Custom area · grid-approximated
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="command-control">
                    <span>Month</span>
                    <input
                      id="feature-period"
                      type="month"
                      value={period}
                      onChange={(event) => setPeriodSelection(event.target.value)}
                    />
                  </label>
                  <label className="command-control">
                    <span>Metric</span>
                    <select
                      id="feature-metric"
                      value={metric}
                      onChange={(event) => {
                        if (event.target.value === "harmonized") {
                          setMetric("harmonized");
                          setInstrument("ALL");
                        } else if (event.target.value === "raw") {
                          setMetric("raw");
                          setInstrument("ALL");
                        }
                      }}
                    >
                      <option value="harmonized">Harmonized</option>
                      <option value="raw">Raw</option>
                    </select>
                  </label>
                  <label className="command-control">
                    <span>Sensor</span>
                    <select
                      id="feature-instrument"
                      value={instrument}
                      disabled={metric !== "raw"}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (
                          value === "MODIS" ||
                          value === "VIIRS" ||
                          value === "ALL"
                        ) {
                          setInstrument(value);
                        }
                      }}
                    >
                      <option value="ALL">All instruments</option>
                      <option value="MODIS">MODIS</option>
                      <option value="VIIRS">VIIRS</option>
                    </select>
                  </label>
                  <span className="command-divider desktop-only-control" aria-hidden="true" />
                  <button
                    type="button"
                    className="calendar-theme-toggle desktop-only-control"
                    aria-pressed={calendarTheme === "light"}
                    onClick={toggleCalendarTheme}
                  >
                    {calendarTheme === "light" ? "Dark Mode" : "Warm White"}
                  </button>
                  <Link href="/" className="calendar-map-link desktop-only-control">
                    ← Map
                  </Link>
                </div>
              </header>
            ) : (
              <>
                <h1 className="feature-page-title">
                  {
                    dashboardNavItems.find(
                      (item) => item.feature === activeFeature
                    )?.label
                  }
                </h1>
                <div className="feature-filter-bar" aria-label="Dashboard filters">
                  <div className="filter-field">
                    <label htmlFor="feature-region">Region</label>
                    <select
                      id="feature-region"
                      value={regionId}
                      disabled={regions.isLoading || Boolean(regions.error)}
                      onChange={(event) => setRegionId(event.target.value)}
                    >
                      {regions.isLoading && (
                        <option value="">Loading regions…</option>
                      )}
                      {regions.error && (
                        <option value="">Region catalog unavailable</option>
                      )}
                      {regions.data?.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                      {customRegion && (
                        <option value="custom">
                          Custom area · grid-approximated
                        </option>
                      )}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-period">Month</label>
                    <input
                      id="feature-period"
                      type="month"
                      value={period}
                      onChange={(event) => setPeriodSelection(event.target.value)}
                    />
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-metric">Metric</label>
                    <select
                      id="feature-metric"
                      value={metric}
                      onChange={(event) => {
                        if (event.target.value === "harmonized") {
                          setMetric("harmonized");
                          setInstrument("ALL");
                        } else if (event.target.value === "raw") {
                          setMetric("raw");
                          setInstrument("ALL");
                        }
                      }}
                    >
                      <option value="harmonized">Harmonized</option>
                      <option value="raw">Raw</option>
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-instrument">Sensor</label>
                    <select
                      id="feature-instrument"
                      value={instrument}
                      disabled={metric !== "raw"}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (
                          value === "MODIS" ||
                          value === "VIIRS" ||
                          value === "ALL"
                        ) {
                          setInstrument(value);
                        }
                      }}
                    >
                      <option value="ALL">All instruments</option>
                      <option value="MODIS">MODIS</option>
                      <option value="VIIRS">VIIRS</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {activeFeature === "calendar" && (
              <ActivityCalendar
                resource={calendar}
                selectedYear={periodRange?.year ?? null}
                selectedMonth={periodRange?.month ?? null}
                onSelectMonth={handleSelectMonth}
              />
            )}
            {activeFeature === "anomaly" && (
              <div className="analytics-stack">
                <AnomalyPanel resource={summary} />
                <HarmonizationPanel resource={harmonization} />
                <OverlapChart resource={harmonization} />
              </div>
            )}
            {activeFeature === "assistant" && (
              <AssistantPanel summary={summary.data ?? null} />
            )}
            {activeFeature === "export" &&
              (hotspotFilters ? (
                <ExportButton filters={hotspotFilters} metric={metric} />
              ) : (
                <section
                  className="export-unavailable-card"
                  aria-labelledby="export-controls-title"
                >
                  <p className="eyebrow">FEATURE 05 · DATA EXPORT</p>
                  <h2 id="export-controls-title">Export data</h2>
                  <p>Select a region and period to enable the data exports.</p>
                </section>
              ))}
            <footer className="page-footer">
              <p>FIRE MEMORY · Historical satellite detections</p>
              <p>{DATA_ATTRIBUTION}</p>
              <p>{DATA_LIMITATIONS}</p>
              <p>{HARMONIZATION_NOTE}</p>
              {summary.data?.notes[0] && (
                <p>Selected period: {summary.data.notes[0]}</p>
              )}
            </footer>
          </section>
        )}
        {activeFeature === "map" && (
        <div className="dashboard-secondary">
        <section
          className={`data-state-panel${dataErrors.length ? " data-state-error" : ""}`}
          aria-labelledby="data-state-title"
          aria-live="polite"
        >
          <span className="data-state-icon" aria-hidden="true">
            {dataErrors.length ? "!" : hasDataLoading ? "…" : "i"}
          </span>
          <div>
            <h2 id="data-state-title">
              {dataErrors.length
                ? "Some dashboard data could not be loaded"
                : hasDataLoading
                  ? "Loading selected dashboard data"
                  : summary.data
                    ? "Dashboard data loaded"
                    : "Choose a region and month"}
            </h2>
            {dataErrors.length ? (
              <>
                <ul className="data-error-list">
                  {dataErrors.map((error, index) => (
                    <li key={`${error.message}-${index}`}>{error.message}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="retry-button"
                  onClick={() => {
                    if (regions.error) regions.retry();
                    if (hotspotWindow.error) hotspotWindow.retry();
                    if (summary.error) summary.retry();
                    if (calendar.error) calendar.retry();
                    if (hotspots.error) hotspots.retry();
                    if (children.error) children.retry();
                    if (harmonization.error) harmonization.retry();
                  }}
                >
                  Retry failed requests
                </button>
              </>
            ) : (
              <p>
                {hasDataLoading
                  ? "Loading the selected region, period, and analytics responses."
                  : summary.data
                    ? "Satellite detections are observations, not confirmation of a fire incident."
                    : "Select a region and UTC month to load available satellite-detection summaries."}
              </p>
            )}
          </div>
        </section>
        <footer className="page-footer">
          <p>FIRE MEMORY · Historical satellite detections</p>
          <p>{DATA_ATTRIBUTION}</p>
          <p>{DATA_LIMITATIONS}</p>
          <p>{HARMONIZATION_NOTE}</p>
          {summary.data?.notes[0] && <p>Selected period: {summary.data.notes[0]}</p>}
        </footer>
        </div>
        )}
      </main>
      </div>
    </div>
  );
}
