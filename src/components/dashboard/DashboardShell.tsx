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
import { FireMemoryLogo } from "@/components/brand/FireMemoryLogo";
import { ExportButton } from "@/components/export/ExportButton";
import MapView from "@/components/map/MapView";
import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
import {
  useCalendar,
  useChildren,
  useHarmonization,
  useHotspots,
  useHotspotWindow,
  useLiveHotspots,
  useRegions,
  useSummary,
} from "@/hooks/useDashboardData";
import type { ClientResource } from "@/hooks/useClientResource";
import { countLiveCellDays } from "@/lib/analytics/liveCounts";
import {
  LANGUAGE_OPTIONS,
  getMonthName,
  getTranslations,
  type AppLanguage,
  type DashboardTranslations,
} from "@/lib/i18n/translations";

type LiveRange = "today" | "7days" | "month" | "year";

const LIVE_RANGE_VALUES: readonly LiveRange[] = ["today", "7days", "month", "year"];

const LIVE_RANGE_LABELS: Record<
  LiveRange,
  Record<AppLanguage, string>
> = {
  today: { en: "Today", ceb: "Karon", fil: "Ngayon" },
  "7days": { en: "7 days", ceb: "7 ka adlaw", fil: "7 araw" },
  month: { en: "Month", ceb: "Buwan", fil: "Buwan" },
  year: { en: "Year", ceb: "Tuig", fil: "Taon" },
};

function getLiveDateRange(range: LiveRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now);

  if (range === "today") {
    return { start: end, end };
  }
  if (range === "7days") {
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (range === "month") {
    startDate.setUTCDate(1);
  } else {
    startDate.setUTCMonth(0, 1);
  }

  return { start: startDate.toISOString().slice(0, 10), end };
}

function formatSummaryNumber(
  resource: ClientResource<AnalyticsSummary>,
  value: number | null | undefined,
  language: AppLanguage = "en"
): string {
  if (resource.error) {
    return language === "ceb"
      ? "Dili magamit"
      : language === "fil"
        ? "Hindi magagamit"
        : "Unavailable";
  }
  if (resource.isLoading) {
    return language === "ceb"
      ? "Nagkarga…"
      : language === "fil"
        ? "Nilo-load…"
        : "Loading...";
  }
  const t = getTranslations(language);
  return value == null ? t.calendar.noData : value.toLocaleString("en-US");
}

function formatAnomalyPercent(
  resource: ClientResource<AnalyticsSummary>,
  value: number | null | undefined,
  language: AppLanguage = "en"
): string {
  if (resource.error) {
    return language === "ceb"
      ? "Dili magamit"
      : language === "fil"
        ? "Hindi magagamit"
        : "Unavailable";
  }
  if (resource.isLoading) {
    return language === "ceb"
      ? "Nagkarga…"
      : language === "fil"
        ? "Nilo-load…"
        : "Loading...";
  }
  const t = getTranslations(language);
  if (value == null) {
    return t.shell.summaryCard.notAvailable;
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
};
type DashboardFeature = "map" | "calendar" | "anomaly" | "assistant" | "export";
const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/",
    feature: "map",
    icon: "map",
  },
  {
    href: "/calendar",
    feature: "calendar",
    icon: "calendar",
  },
  {
    href: "/anomaly",
    feature: "anomaly",
    icon: "analytics",
  },
  {
    href: "/export",
    feature: "export",
    icon: "export",
  },
];
function getNavLabel(
  feature: DashboardFeature,
  t: DashboardTranslations
): string {
  switch (feature) {
    case "map":
      return t.nav.map;
    case "calendar":
      return t.nav.calendar;
    case "anomaly":
      return t.nav.anomaly;
    case "export":
      return t.nav.export;
    default:
      return t.nav.map;
  }
}
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
function formatLastUpdated(
  value: string | null | undefined,
  language: AppLanguage = "en"
): string {
  const t = getTranslations(language);
  if (!value) {
    return t.shell.summaryCard.notAvailable;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return language === "ceb"
      ? "Dili magamit"
      : language === "fil"
        ? "Hindi magagamit"
        : "Unavailable";
  }
  const locale = language === "fil" ? "fil-PH" : "en-PH";
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp)} UTC`;
}
function validateBBox(
  bbox: BBox,
  countryBBox: BBox | undefined,
  language: AppLanguage = "en"
): string | null {
  const t = getTranslations(language);
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
    return t.shell.customArea.invalidCoords;
  }
  if (!countryBBox) {
    return t.shell.customArea.boundsUnavailable;
  }
  if (
    west < countryBBox[0] ||
    south < countryBBox[1] ||
    east > countryBBox[2] ||
    north > countryBBox[3]
  ) {
    return t.shell.customArea.boundsOutsidePh;
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
  const resolvedFeature = activeFeature === "assistant" ? "map" : activeFeature;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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
    language,
    setLanguage,
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
  const t = getTranslations(language);
  const [bboxDraft, setBboxDraft] = useState<BBoxDraft>({
    west: "124.90",
    south: "7.80",
    east: "125.25",
    north: "8.20",
  });
  const [customAreaError, setCustomAreaError] = useState<string | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [isFilterPopoverPinned, setIsFilterPopoverPinned] = useState(false);
  const [liveRange, setLiveRange] = useState<LiveRange>("month");
  const isFilterPopoverOpen = isFilterPopoverPinned;
  const regions = useRegions();
  const hotspotWindow = useHotspotWindow();
  const period =
    periodSelection ??
    hotspotWindow.data?.rawWindow?.end.slice(0, 7) ??
    "2025-12";
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
  const defaultCountryRegion = useMemo<Region>(
    () => ({
      id: "PH",
      name: "The Philippines",
      level: "country",
      parentId: null,
      bbox: [116.9, 4.5, 126.6, 21.1],
    }),
    []
  );
  const selectedRegion =
    regionId === "custom"
      ? customRegion
      : regions.data?.find((region) => region.id === regionId) ??
        (regionId === "PH" ? defaultCountryRegion : null);
  const countryBBox =
    regions.data?.find((region) => region.id === "PH")?.bbox ??
    defaultCountryRegion.bbox;
  const periodRange = useMemo(() => parsePeriod(period), [period]);
  const activateCustomArea = useCallback(
    (bbox: BBox) => {
      setBboxDraft({
        west: String(bbox[0]),
        south: String(bbox[1]),
        east: String(bbox[2]),
        north: String(bbox[3]),
      });
      const error = validateBBox(bbox, countryBBox, language);
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
    [countryBBox, language, setCustomBbox, setRegionId]
  );
  const applyCustomArea = useCallback(() => {
    if (
      !bboxDraft.west.trim() ||
      !bboxDraft.south.trim() ||
      !bboxDraft.east.trim() ||
      !bboxDraft.north.trim()
    ) {
      setCustomAreaError(t.shell.customArea.enterAllCoords);
      return;
    }
    const bbox: BBox = [
      Number(bboxDraft.west),
      Number(bboxDraft.south),
      Number(bboxDraft.east),
      Number(bboxDraft.north),
    ];
    activateCustomArea(bbox);
  }, [activateCustomArea, bboxDraft, t.shell.customArea.enterAllCoords]);
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
  const isCurrentPeriod = useMemo(() => {
    if (!periodRange) {
      return false;
    }
    const now = new Date();
    return (
      periodRange.year === now.getUTCFullYear() &&
      periodRange.month === now.getUTCMonth() + 1
    );
  }, [periodRange]);
  const liveDateRange = useMemo(
    () => getLiveDateRange(liveRange),
    [liveRange]
  );
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
  const historicalHotspots = useHotspots(
    hotspotFilters,
    2_000,
    Boolean(hotspotFilters) && !isCurrentPeriod
  );
  const liveHotspots = useLiveHotspots(
    selectedRegion?.bbox ?? null,
    metric === "raw" ? instrument : "ALL",
    liveDateRange.start,
    liveDateRange.end,
    Boolean(selectedRegion) && isCurrentPeriod
  );
  const liveCounts = useMemo(() => {
    if (!isCurrentPeriod || !liveHotspots.data) {
      return null;
    }
    const viirs = countLiveCellDays(liveHotspots.data.hotspots, "VIIRS");
    const modis = countLiveCellDays(liveHotspots.data.hotspots, "MODIS");
    return { viirs, modis, harmonized: viirs };
  }, [isCurrentPeriod, liveHotspots.data]);
  const hotspots = isCurrentPeriod ? liveHotspots : historicalHotspots;
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
  const latestUpdate =
    summary.data?.lastUpdated ??
    hotspots.data?.lastUpdated ??
    hotspotWindow.data?.lastUpdated;
  const summaryMonth = periodRange
    ? `${getMonthName(periodRange.month, language, true)} ${periodRange.year}`
    : t.shell.mapShell.selectedMonthFallback;
  const summaryRegion =
    summary.data?.region.name ??
    selectedRegion?.name ??
    t.shell.mapShell.selectedAreaFallback;
  const baselineYears = summary.data?.baselineYears ?? [];
  const baselineDetail = baselineYears.length
    ? t.shell.mapCards.formatBaselineYears(
        baselineYears.length,
        baselineYears[0],
        baselineYears[baselineYears.length - 1]
      )
    : t.shell.mapCards.noComparableBaseline;
  const liveCardValue = (value: number | undefined): string => {
    if (value !== undefined) {
      return value.toLocaleString("en-US");
    }
    if (liveHotspots.isLoading) {
      return t.shell.mapCards.liveLoading;
    }
    return liveHotspots.error
      ? t.shell.summaryCard.notAvailable
      : t.shell.mapCards.liveNoData;
  };
  const anomalyLabel = isCurrentPeriod
    ? t.shell.mapCards.anomalyStatus.live
    : summary.data?.label === "unusually_high"
      ? t.shell.mapCards.anomalyStatus.unusually_high
      : summary.data?.label === "above_baseline"
        ? t.shell.mapCards.anomalyStatus.above_baseline
        : summary.data?.label === "near_baseline"
          ? t.shell.mapCards.anomalyStatus.near_baseline
          : summary.data?.label === "below_baseline"
            ? t.shell.mapCards.anomalyStatus.below_baseline
            : summary.isLoading
              ? t.shell.mapCards.anomalyStatus.loading
              : t.shell.mapCards.anomalyStatus.unavailable;
  const anomalyClass = summary.data?.label ?? "not_calculable";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t.shell.skipToContent}
      </a>
      <aside
        className={`dashboard-sidebar${isSidebarOpen ? " sidebar-open" : ""}`}
        aria-label={t.shell.mapShell.sidebarAria}
      >
        <Link className="sidebar-brand" href="/" aria-label={t.shell.mapShell.homeAria}>
          <span className="sidebar-brand-mark" aria-hidden="true">
            <FireMemoryLogo />
          </span>
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-name">FIRE MEMORY</span>
            <span className="sidebar-brand-caption">{t.nav.brandCaption}</span>
          </span>
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isSidebarOpen ? t.nav.closeNavigation : t.nav.openNavigation}
          aria-expanded={isSidebarOpen}
          aria-controls="dashboard-nav"
          onClick={() => setIsSidebarOpen((open) => !open)}
        >
          <span aria-hidden="true">{isSidebarOpen ? "‹" : "›"}</span>
        </button>
        <p className="sidebar-heading">{t.nav.menuLabel}</p>
        <nav className="sidebar-nav" id="dashboard-nav" aria-label={t.shell.mapShell.navSectionsAria}>
          {dashboardNavItems.map((item) => {
            const label = getNavLabel(item.feature, t);
            return (
              <Link
                className={`sidebar-nav-link${resolvedFeature === item.feature ? " is-active" : ""}`}
                href={item.href}
                key={item.href}
                title={label}
                aria-current={resolvedFeature === item.feature ? "page" : undefined}
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="sidebar-icon">
                  <DashboardIcon name={item.icon} />
                </span>
                <span className="sidebar-label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div
          className="sidebar-lang-panel"
          role="group"
          aria-label={t.languageSelector.ariaLabel}
        >
          <p className="sidebar-lang-heading">{t.languageSelector.heading}</p>
          <div className="sidebar-lang-buttons">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                className={`sidebar-lang-btn${language === option.code ? " is-active" : ""}`}
                aria-pressed={language === option.code}
                title={option.nativeName}
                onClick={() => setLanguage(option.code)}
              >
                <span className="sidebar-lang-short">{option.shortLabel}</span>
                <span className="sidebar-lang-long">{option.expandedLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <div className="app-content">
      <main
        className={`dashboard-main${resolvedFeature === "map" ? " dashboard-map-page" : " dashboard-feature-page"}`}
        id="main-content"
      >
        {resolvedFeature === "map" && (
        <section className="map-workspace" aria-label={t.shell.mapShell.mapWorkspaceAria}>
          <MapView
            resource={hotspots}
            region={selectedRegion ?? null}
            childrenResource={children}
            regions={regions.data ?? []}
            imageryDate={
              isCurrentPeriod
                ? liveHotspots.data?.rawWindow?.end ??
                  new Date().toISOString().slice(0, 10)
                : periodRange?.end ?? null
            }
            isLiveData={isCurrentPeriod}
            onSelectRegion={handleSelectRegion}
            drawRectangle={isDrawingArea}
            onDrawComplete={activateCustomArea}
          />
          <h1 className="sr-only" id="page-title">
            {t.shell.mapShell.mapPageHeadingSr}
          </h1>
          <section
            className="map-summary-cards"
            aria-label={t.shell.mapShell.mapSummaryAria}
          >
            <article className="map-summary-card">
              <p className="map-summary-card-label">
                {t.shell.mapCards.formatTotalHotspots(summaryMonth)}
              </p>
              <strong className="map-summary-card-value">
                {isCurrentPeriod
                  ? liveCardValue(liveCounts?.harmonized)
                  : formatSummaryNumber(summary, summary.data?.currentCount, language)}
              </strong>
              <span className="map-summary-card-detail">
                {summaryRegion} · {t.shell.mapCards.combinedHeatDetections}
              </span>
              <span className="map-summary-card-disclaimer">
                {t.shell.mapCards.verifyWithBfp}
              </span>
            </article>
            <article className="map-summary-card">
              <p className="map-summary-card-label">
                {t.shell.mapCards.smallAreaSensor}
              </p>
              <strong className="map-summary-card-value">
                {isCurrentPeriod
                  ? liveCardValue(liveCounts?.viirs)
                  : formatSummaryNumber(
                      summary,
                      summary.data?.byInstrument.VIIRS,
                      language
                    )}
              </strong>
              <span className="map-summary-card-detail">
                {t.shell.mapCards.smallAreaDetail}
              </span>
              <span className="map-summary-card-disclaimer">
                {t.shell.mapCards.cellDayUnitNote}
              </span>
            </article>
            <article className="map-summary-card">
              <p className="map-summary-card-label">
                {t.shell.mapCards.wideAreaSensor}
              </p>
              <strong className="map-summary-card-value">
                {isCurrentPeriod
                  ? liveCardValue(liveCounts?.modis)
                  : formatSummaryNumber(
                      summary,
                      summary.data?.byInstrument.MODIS,
                      language
                    )}
              </strong>
              <span className="map-summary-card-detail">
                {t.shell.mapCards.wideAreaDetail}
              </span>
              <span className="map-summary-card-disclaimer">
                {t.shell.mapCards.cellDayUnitNote}
              </span>
            </article>
            <article className="map-summary-card">
              <p className="map-summary-card-label">
                {t.shell.mapCards.formatTypicalBaseline(summaryMonth)}
              </p>
              <strong className="map-summary-card-value">
                {formatSummaryNumber(summary, summary.data?.historicalMedian, language)}
              </strong>
              <span className="map-summary-card-detail">
                {t.shell.mapCards.formatNormalLevel(summaryMonth, baselineDetail)}
              </span>
              <span className="map-summary-card-disclaimer">
                {t.shell.mapCards.medianFootnote}
              </span>
            </article>
            <article
              className={`map-summary-card map-summary-card-anomaly map-summary-card-anomaly-${anomalyClass}`}
            >
              <p className="map-summary-card-label">
                {t.shell.mapCards.comparisonLabel}
              </p>
              <strong className="map-summary-card-value">
                {isCurrentPeriod
                  ? t.shell.mapCards.livePeriodValue
                  : formatAnomalyPercent(summary, summary.data?.anomalyPercent, language)}
              </strong>
              <span
                className={`map-summary-status map-summary-status-${anomalyClass}`}
              >
                {anomalyLabel}
              </span>
              <span className="map-summary-card-disclaimer">
                {t.shell.mapCards.cdrrmoNonPredictive}
              </span>
            </article>
          </section>
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
                <div className="map-filter-heading-main">
                  <h2 id="filter-title">{t.shell.mapFilterPopover.title}</h2>
                  <span className="filter-updated">
                    {t.shell.mapShell.updatedPrefix} {formatLastUpdated(latestUpdate, language)}
                  </span>
                </div>
                <div
                  className="assistant-lang-switcher"
                  role="group"
                  aria-label={t.languageSelector.ariaLabel}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className={`assistant-lang-btn${
                        language === option.code ? " is-active" : ""
                      }`}
                      aria-pressed={language === option.code}
                      title={option.nativeName}
                      onClick={() => setLanguage(option.code)}
                    >
                      {option.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
          <div className="filter-grid">
            <div className="filter-field">
              <label htmlFor="region">{t.shell.regionLabel}</label>
              <select
                id="region"
                value={regionId}
                disabled={regions.isLoading || Boolean(regions.error)}
                onChange={(event) => setRegionId(event.target.value)}
                aria-describedby="region-help"
              >
                {regions.isLoading && <option value="">{t.shell.loadingRegions}</option>}
                {regions.error && (
                  <option value="">{t.shell.regionsUnavailable}</option>
                )}
                {regions.data?.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
                {customRegion && (
                  <option value="custom">{t.shell.customAreaGridApprox}</option>
                )}
              </select>
              <span className="field-help" id="region-help">
                {regions.isLoading
                  ? t.shell.mapShell.regionHelpLoading
                  : regions.error
                    ? regions.error.message
                    : t.shell.mapShell.regionHelpDefault}
              </span>
            </div>
            <div className="filter-field">
              <label htmlFor="period">{t.shell.monthLabel}</label>
              <input
                id="period"
                type="month"
                value={period}
                onChange={(event) => setPeriodSelection(event.target.value)}
              />
              <span className="field-help">{t.shell.mapShell.monthHelp}</span>
            </div>
            <fieldset className="filter-field metric-field">
              <legend>{t.shell.mapShell.liveFirmsPeriodLegend}</legend>
              <div className="segmented-control">
                {LIVE_RANGE_VALUES.map((rangeValue) => (
                  <label
                    className={liveRange === rangeValue ? "selected" : ""}
                    key={rangeValue}
                  >
                    <input
                      type="radio"
                      name="live-range"
                      value={rangeValue}
                      checked={liveRange === rangeValue}
                      onChange={() => {
                        setLiveRange(rangeValue);
                        const now = new Date();
                        setPeriodSelection(
                          `${now.getUTCFullYear()}-${String(
                            now.getUTCMonth() + 1
                          ).padStart(2, "0")}`
                        );
                      }}
                    />
                    {LIVE_RANGE_LABELS[rangeValue][language]}
                  </label>
                ))}
              </div>
              <span className="field-help">
                {t.shell.mapShell.liveFirmsHelp}
              </span>
            </fieldset>
            <fieldset className="filter-field metric-field">
              <legend>{t.shell.metricLabel}</legend>
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
                  {t.shell.mapShell.harmonizedShort}
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
                  {t.shell.mapShell.rawShort}
                </label>
              </div>
              <span className="field-help">
                {t.shell.mapShell.harmonizedHelp}
              </span>
            </fieldset>
            <div className="filter-field">
              <label htmlFor="instrument">{t.shell.sensorLabel}</label>
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
                <option value="ALL">{t.shell.allInstrumentsOption}</option>
                <option value="MODIS">MODIS</option>
                <option value="VIIRS">VIIRS</option>
              </select>
              <span className="field-help" id="instrument-help">
                {metric === "raw"
                  ? t.shell.mapShell.sensorHelpRaw
                  : t.shell.mapShell.sensorHelpDisabled}
              </span>
            </div>
          </div>
          <details className="custom-area-tool">
            <summary>
              {t.shell.customAreaGridApprox}
              {customRegion
                ? t.shell.customArea.activeSuffix
                : t.shell.customArea.optionalSuffix}
            </summary>
            <p className="custom-area-description">
              {t.shell.customArea.description}
            </p>
            <div className="custom-area-grid">
              <div className="filter-field">
                <label htmlFor="area-west">{t.shell.customArea.westLon}</label>
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
                <label htmlFor="area-south">{t.shell.customArea.southLat}</label>
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
                <label htmlFor="area-east">{t.shell.customArea.eastLon}</label>
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
                <label htmlFor="area-north">{t.shell.customArea.northLat}</label>
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
                {t.shell.customArea.useCustomArea}
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
                {isDrawingArea
                  ? t.shell.customArea.cancelDrawing
                  : t.shell.customArea.drawRectangle}
              </button>
            </div>
            {customAreaError && (
              <p className="custom-area-error" role="alert">
                {customAreaError}
              </p>
            )}
            {customRegion && (
              <p className="custom-area-active">
                {t.shell.customArea.formatActiveArea(
                  customRegion.name,
                  customBbox?.map((coordinate) => String(coordinate)).join(", ") ?? ""
                )}
              </p>
            )}
          </details>
            </section>
          </div>
          <button
            type="button"
            className="map-region-trigger"
            aria-label={t.shell.mapShell.chooseRegion}
            aria-controls="map-filter-panel"
            aria-expanded={isFilterPopoverOpen}
            title={t.shell.mapShell.chooseRegion}
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
          <button
            type="button"
            className={`map-assistant-trigger${isAssistantOpen ? " is-open" : ""}`}
            aria-label={t.shell.mapShell.openAdvisoryAi}
            aria-expanded={isAssistantOpen}
            aria-controls="map-assistant-dock"
            title={t.shell.summaryCard.advisoryAi}
            onClick={() => setIsAssistantOpen((open) => !open)}
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
            {language === "en" ? (
              <span>Advisory AI</span>
            ) : (
              <span>{t.shell.summaryCard.advisoryAi}</span>
            )}
          </button>
          <div
            id="map-assistant-dock"
            className={`map-assistant-dock${isAssistantOpen ? " is-open" : ""}`}
            aria-hidden={!isAssistantOpen}
          >
            <AssistantPanel
              summary={summary.data ?? null}
              liveCounts={liveCounts}
              hotspots={hotspots.data?.hotspots ?? []}
              childCounts={children.data ?? []}
              regions={regions.data ?? []}
              selectedRegion={selectedRegion}
              onSelectRegion={handleSelectRegion}
              onClose={() => setIsAssistantOpen(false)}
            />
          </div>
        </section>
        )}
        {resolvedFeature !== "map" && (
          <section
            className={`dashboard-secondary feature-page${
              resolvedFeature === "calendar" ? " calendar-feature-page" : ""
            }`}
            data-calendar-theme={
              resolvedFeature === "calendar" ? calendarTheme : undefined
            }
          >
            {resolvedFeature === "calendar" ? (
              <header className="calendar-command-bar">
                <div className="calendar-command-title">
                  <h1 className="feature-page-title">{t.calendar.title}</h1>
                  <span className="calendar-command-scope">
                    {selectedRegion?.name ?? t.shell.mapShell.selectRegionShort} ·{" "}
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
                      {selectedRegion?.name ?? t.shell.mapShell.filterChipFallback} ·{" "}
                      {metric === "harmonized"
                        ? t.shell.mapShell.harmonizedChipShort
                        : t.shell.mapShell.rawChipShort}{" "}
                      {isCalendarFiltersOpen ? "▴" : "▾"}
                    </button>
                    <button
                      type="button"
                      className="calendar-theme-toggle"
                      aria-pressed={calendarTheme === "light"}
                      onClick={toggleCalendarTheme}
                    >
                      {calendarTheme === "light"
                        ? t.shell.mapShell.compactDark
                        : t.shell.mapShell.compactWarm}
                    </button>
                    <Link href="/" className="calendar-map-link">
                      {t.shell.summaryCard.backToMap}
                    </Link>
                  </div>
                </div>
                <div
                  className={`calendar-command-controls${
                    isCalendarFiltersOpen ? " is-open" : ""
                  }`}
                  aria-label={t.shell.filterBarAria}
                >
                  <label className="command-control">
                    <span>{t.shell.regionLabel}</span>
                    <select
                      id="feature-region"
                      value={regionId}
                      disabled={regions.isLoading || Boolean(regions.error)}
                      onChange={(event) => setRegionId(event.target.value)}
                    >
                      {regions.isLoading && (
                        <option value="">{t.shell.loadingRegions}</option>
                      )}
                      {regions.error && (
                        <option value="">{t.shell.regionsUnavailable}</option>
                      )}
                      {regions.data?.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                      {customRegion && (
                        <option value="custom">
                          {t.shell.customAreaGridApprox}
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="command-control">
                    <span>{t.shell.monthLabel}</span>
                    <input
                      id="feature-period"
                      type="month"
                      value={period}
                      onChange={(event) => setPeriodSelection(event.target.value)}
                    />
                  </label>
                  <label className="command-control">
                    <span>{t.shell.metricLabel}</span>
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
                      <option value="harmonized">{t.shell.mapShell.harmonizedShort}</option>
                      <option value="raw">{t.shell.mapShell.rawShort}</option>
                    </select>
                  </label>
                  <label className="command-control">
                    <span>{t.shell.sensorLabel}</span>
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
                      <option value="ALL">{t.shell.allInstrumentsOption}</option>
                      <option value="MODIS">MODIS</option>
                      <option value="VIIRS">VIIRS</option>
                    </select>
                  </label>
                  <label className="command-control command-control--lang">
                    <span>{t.languageSelector.heading}</span>
                    <select
                      id="calendar-language"
                      value={language}
                      aria-label={t.languageSelector.ariaLabel}
                      onChange={(event) =>
                        setLanguage(event.target.value as AppLanguage)
                      }
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.nativeName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="command-divider desktop-only-control" aria-hidden="true" />
                  <button
                    type="button"
                    className="calendar-theme-toggle desktop-only-control"
                    aria-pressed={calendarTheme === "light"}
                    onClick={toggleCalendarTheme}
                  >
                    {calendarTheme === "light"
                      ? t.shell.summaryCard.darkMode
                      : t.shell.summaryCard.warmWhite}
                  </button>
                  <Link href="/" className="calendar-map-link desktop-only-control">
                    {t.shell.summaryCard.backToMap}
                  </Link>
                </div>
              </header>
            ) : (
              <>
                <h1 className="feature-page-title">
                  {getNavLabel(resolvedFeature, t)}
                </h1>
                <div className="feature-filter-bar" aria-label={t.shell.filterBarAria}>
                  <div className="filter-field">
                    <label htmlFor="feature-region">{t.shell.regionLabel}</label>
                    <select
                      id="feature-region"
                      value={regionId}
                      disabled={regions.isLoading || Boolean(regions.error)}
                      onChange={(event) => setRegionId(event.target.value)}
                    >
                      {regions.isLoading && (
                        <option value="">{t.shell.loadingRegions}</option>
                      )}
                      {regions.error && (
                        <option value="">{t.shell.regionsUnavailable}</option>
                      )}
                      {regions.data?.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                      {customRegion && (
                        <option value="custom">
                          {t.shell.customAreaGridApprox}
                        </option>
                      )}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-period">{t.shell.monthLabel}</label>
                    <input
                      id="feature-period"
                      type="month"
                      value={period}
                      onChange={(event) => setPeriodSelection(event.target.value)}
                    />
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-metric">{t.shell.metricLabel}</label>
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
                      <option value="harmonized">{t.shell.mapShell.harmonizedShort}</option>
                      <option value="raw">{t.shell.mapShell.rawShort}</option>
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-instrument">{t.shell.sensorLabel}</label>
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
                      <option value="ALL">{t.shell.allInstrumentsOption}</option>
                      <option value="MODIS">MODIS</option>
                      <option value="VIIRS">VIIRS</option>
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="feature-language">{t.languageSelector.heading}</label>
                    <select
                      id="feature-language"
                      value={language}
                      aria-label={t.languageSelector.ariaLabel}
                      onChange={(event) =>
                        setLanguage(event.target.value as AppLanguage)
                      }
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.nativeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            {resolvedFeature === "calendar" && (
              <ActivityCalendar
                resource={calendar}
                selectedYear={periodRange?.year ?? null}
                selectedMonth={periodRange?.month ?? null}
                onSelectMonth={handleSelectMonth}
              />
            )}
            {resolvedFeature === "anomaly" && (
              <div className="analytics-stack">
                <AnomalyPanel
                  resource={summary}
                  calendar={calendar.data ?? null}
                  liveCounts={liveCounts}
                />
                <OverlapChart
                  resource={harmonization}
                  summary={summary.data ?? null}
                />
                <HarmonizationPanel resource={harmonization} />
              </div>
            )}
            {resolvedFeature === "export" &&
              (hotspotFilters ? (
                <ExportButton
                  filters={hotspotFilters}
                  metric={metric}
                  regionName={selectedRegion?.name}
                  year={periodRange?.year}
                  month={periodRange?.month}
                />
              ) : (
                <section
                  className="export-unavailable-card"
                  aria-labelledby="export-controls-title"
                >
                  <p className="eyebrow">{t.shell.exportUnavailable.eyebrow}</p>
                  <h2 id="export-controls-title">{t.shell.exportUnavailable.title}</h2>
                  <p>{t.shell.exportUnavailable.description}</p>
                </section>
              ))}
            <footer className="page-footer page-footer-compact">
              <p>{t.shell.footer.compact}</p>
            </footer>
          </section>
        )}
        {resolvedFeature === "map" && dataErrors.length > 0 && (
        <div className="dashboard-secondary">
        <section
          className="data-state-panel data-state-error"
          aria-labelledby="data-state-title"
          role="alert"
        >
          <span className="data-state-icon" aria-hidden="true">
            !
          </span>
          <div>
            <h2 id="data-state-title">
              {t.shell.errors.title}
            </h2>
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
              {t.shell.errors.retry}
            </button>
          </div>
        </section>
        </div>
        )}
      </main>
      </div>
    </div>
  );
}
