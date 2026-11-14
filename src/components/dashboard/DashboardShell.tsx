"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type {
  AnalyticsQuery,
  AnomalyLabel,
  BBox,
  HarmonizationResponse,
  Instrument,
  Metric,
  HotspotFilters,
  Region,
} from "@/contracts/types";
import ActivityCalendar from "@/components/calendar/ActivityCalendar";
import {
  AnomalyPanel,
  HarmonizationPanel,
  OverlapChart,
} from "@/components/charts/AnalyticsPanels";
import MapView from "@/components/map/MapView";
import {
  useCalendar,
  useChildren,
  useHarmonization,
  useHotspots,
  useRegions,
  useSummary,
} from "@/hooks/useDashboardData";
import type { ClientResource } from "@/hooks/useClientResource";

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

const DATA_ATTRIBUTION =
  "Data: NASA Fire Information for Resource Management System (FIRMS), MODIS and VIIRS active-fire products. Product names, retrieval dates, and attribution requirements are listed in the data documentation.";
const DATA_LIMITATIONS =
  "These are satellite detections of thermal anomalies, not confirmed fires or a complete incident record. Coverage, sensor sensitivity, boundaries, and missing observations affect counts. MODIS-only values converted to the VIIRS target are estimates.";
const HARMONIZATION_NOTE =
  "The series uses UTC monthly active 0.01-degree cell-days and overlap-period calibration to a VIIRS-equivalent scale. The factor, validation error, overlap years, estimated years, and limitations are shown with the result.";

const anomalyPresentation: Record<
  AnomalyLabel,
  { icon: string; label: string; description: string }
> = {
  below_baseline: {
    icon: "↓",
    label: "Below baseline",
    description: "Fewer detections than the historical median.",
  },
  near_baseline: {
    icon: "≈",
    label: "Near baseline",
    description: "Close to the historical median.",
  },
  above_baseline: {
    icon: "↑",
    label: "Above baseline",
    description: "More detections than the historical median.",
  },
  unusually_high: {
    icon: "!",
    label: "Unusually high",
    description: "Substantially above the historical baseline.",
  },
  not_calculable: {
    icon: "—",
    label: "Not calculable",
    description: "A percentage comparison is unavailable for this baseline.",
  },
};

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

function formatCount(value: number | null): string {
  return value === null ? "No data" : value.toLocaleString("en-US");
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

function formatPeriod(value: string): string {
  const period = parsePeriod(value);
  if (!period) {
    return "Select a month";
  }
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(period.year, period.month - 1, 1)));
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

export default function DashboardShell({
  isSimulated,
}: {
  isSimulated: boolean;
}) {
  const [regionId, setRegionId] = useState(isSimulated ? "PH-BUK" : "PH");
  const [metric, setMetric] = useState<Metric>("harmonized");
  const [instrument, setInstrument] = useState<Instrument | "ALL">("ALL");
  const [period, setPeriod] = useState(isSimulated ? "2026-11" : "");
  const [customBbox, setCustomBbox] = useState<BBox | null>(null);
  const [bboxDraft, setBboxDraft] = useState<BBoxDraft>({
    west: "124.90",
    south: "7.80",
    east: "125.25",
    north: "8.20",
  });
  const [customAreaError, setCustomAreaError] = useState<string | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);

  const regions = useRegions();
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
    [countryBBox]
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
  }, []);
  const handleSelectMonth = useCallback((year: number, month: number) => {
    setPeriod(`${year}-${String(month).padStart(2, "0")}`);
  }, []);

  const anomaly = summary.data
    ? anomalyPresentation[summary.data.label]
    : null;
  const summaryCount =
    summary.isLoading
      ? "Loading…"
      : summary.error
        ? "Unavailable"
        : summary.data
          ? formatCount(summary.data.currentCount)
          : "Select a region and month";
  const median =
    summary.isLoading
      ? "Loading…"
      : summary.error
        ? "Unavailable"
        : summary.data
          ? formatCount(summary.data.historicalMedian)
          : "Select a region and month";
  const anomalyValue =
    summary.isLoading
      ? "Loading…"
      : summary.error
        ? "Unavailable"
        : anomaly
          ? anomaly.label
          : "Select a region and month";
  const instrumentCounts = summary.data
    ? `MODIS ${formatCount(summary.data.byInstrument.MODIS)} · VIIRS ${formatCount(summary.data.byInstrument.VIIRS)}`
    : summary.isLoading
      ? "Loading…"
      : summary.error
        ? "Unavailable"
        : "Select a region and month";

  const dataErrors = [
    regions.error,
    summary.error,
    calendar.error,
    hotspots.error,
    children.error,
    harmonization.error,
  ].filter((error): error is Error => error !== null);
  const hasDataLoading =
    regions.isLoading ||
    summary.isLoading ||
    calendar.isLoading ||
    hotspots.isLoading ||
    children.isLoading ||
    harmonization.isLoading;
  const latestUpdate = summary.data?.lastUpdated ?? hotspots.data?.lastUpdated;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to dashboard
      </a>

      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="FIRE MEMORY home">
            <span className="brand-mark" aria-hidden="true">
              FM
            </span>
            <span className="brand-copy">
              <span className="brand-name">FIRE MEMORY</span>
              <span className="brand-caption">Historical satellite intelligence</span>
            </span>
          </Link>
          <div className="header-status">
            {isSimulated && (
              <span className="simulated-badge">
                <span aria-hidden="true">●</span> Simulated data
              </span>
            )}
            <span className="connection-status">
              <span className="status-dot" aria-hidden="true" />
              {isSimulated ? "Mock data active" : "API data mode"}
            </span>
          </div>
        </div>
      </header>

      <main className="dashboard-main" id="main-content">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">PHILIPPINES · HISTORICAL VIEW</p>
            <h1 id="page-title">Satellite activity dashboard</h1>
            <p className="page-description">
              Explore monthly satellite detections and compare activity with
              historical patterns.
            </p>
          </div>
          <div className="freshness-card">
            <span className="freshness-label">Last updated</span>
            <span className="freshness-value">
              {formatLastUpdated(latestUpdate)}
            </span>
          </div>
        </section>

        <section className="filter-panel" aria-labelledby="filter-title">
          <div className="section-heading filter-heading">
            <div>
              <p className="eyebrow">EXPLORE</p>
              <h2 id="filter-title">Choose an area and period</h2>
            </div>
            <span className="utc-note">Month boundaries use UTC</span>
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
                onChange={(event) => setPeriod(event.target.value)}
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

          <fieldset className="custom-area-tool">
            <legend>Custom area · grid-approximated</legend>
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
          </fieldset>
        </section>

        <section className="summary-section" aria-labelledby="summary-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AT A GLANCE</p>
              <h2 id="summary-title">Period summary</h2>
            </div>
            <span className="summary-context">
              {selectedRegion?.name ?? "Select an area"} · {formatPeriod(period)}
              {selectedRegion?.level === "custom" && (
                <span className="approximation-badge">
                  grid-approximated
                </span>
              )}
            </span>
          </div>
          <div className="summary-grid">
            <article className="summary-card">
              <div className="summary-card-top">
                <span className="summary-index" aria-hidden="true">
                  01
                </span>
                <span className="summary-detail">Selected period</span>
              </div>
              <h3>Current detections</h3>
              <p className="summary-value">{summaryCount}</p>
              <p className="summary-note">
                {summary.data?.currentIsEstimated
                  ? "Estimated value"
                  : summary.data?.currentCount === null
                    ? "No data coverage"
                    : summary.error?.message ?? "Selected period count"}
              </p>
            </article>
            <article className="summary-card">
              <div className="summary-card-top">
                <span className="summary-index" aria-hidden="true">
                  02
                </span>
                <span className="summary-detail">Same calendar month</span>
              </div>
              <h3>Historical median</h3>
              <p className="summary-value">{median}</p>
              <p className="summary-note">
                {summary.data?.historicalMedian === null
                  ? "No baseline data"
                  : summary.error?.message ?? "Baseline years only"}
              </p>
            </article>
            <article className="summary-card">
              <div className="summary-card-top">
                <span className="summary-index" aria-hidden="true">
                  03
                </span>
                <span className="summary-detail">Compared with baseline</span>
              </div>
              <h3>Anomaly assessment</h3>
              <p className="summary-value">
                {anomaly && <span aria-hidden="true">{anomaly.icon} </span>}
                {anomalyValue}
              </p>
              <p className="summary-note">
                {anomaly?.description ?? summary.error?.message ?? "No comparison loaded"}
              </p>
            </article>
            <article className="summary-card">
              <div className="summary-card-top">
                <span className="summary-index" aria-hidden="true">
                  04
                </span>
                <span className="summary-detail">MODIS and VIIRS</span>
              </div>
              <h3>Instrument counts</h3>
              <p className="summary-value summary-value-compact">
                {instrumentCounts}
              </p>
              <p className="summary-note">
                Raw counts reported with the analytics summary
              </p>
            </article>
          </div>
        </section>

        <MapView
          resource={hotspots}
          region={selectedRegion ?? null}
          childrenResource={children}
          regions={regions.data ?? []}
          onSelectRegion={handleSelectRegion}
          drawRectangle={isDrawingArea}
          onDrawComplete={activateCustomArea}
        />

        <div className="analytics-grid">
          <ActivityCalendar
            resource={calendar}
            selectedYear={periodRange?.year ?? null}
            selectedMonth={periodRange?.month ?? null}
            onSelectMonth={handleSelectMonth}
          />
          <div className="analytics-stack">
            <AnomalyPanel resource={summary} />
            <HarmonizationPanel resource={harmonization} />
            <OverlapChart resource={harmonization} />
          </div>
        </div>

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

        <section className="integration-slots" aria-label="Additional tools">
          <div className="integration-slot">
            <p className="eyebrow">AI INTERPRETATION</p>
            <h2>Assistant panel</h2>
            <p>Assistant integration is not available in this build.</p>
          </div>
          <div className="integration-slot integration-slot-export">
            <p className="eyebrow">DATA EXPORT</p>
            <h2>Export</h2>
            <p>Export integration is not available in this build.</p>
          </div>
        </section>

        <footer className="page-footer">
          <p>FIRE MEMORY · Historical satellite detections</p>
          <p>{DATA_ATTRIBUTION}</p>
          <p>{DATA_LIMITATIONS}</p>
          <p>{HARMONIZATION_NOTE}</p>
          {summary.data?.notes[0] && <p>Selected period: {summary.data.notes[0]}</p>}
        </footer>
      </main>
    </div>
  );
}
