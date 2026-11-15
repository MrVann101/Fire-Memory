import type { AnomalyLabel } from "@/contracts/types";

export const SUPPORTED_LANGUAGES = ["en", "ceb", "fil"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface LanguageOption {
  code: AppLanguage;
  shortLabel: string;
  nativeName: string;
  expandedLabel: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  {
    code: "en",
    shortLabel: "EN",
    nativeName: "English",
    expandedLabel: "English",
  },
  {
    code: "ceb",
    shortLabel: "CEB",
    nativeName: "Bisaya / Cebuano",
    expandedLabel: "Bisaya",
  },
  {
    code: "fil",
    shortLabel: "FIL",
    nativeName: "Filipino",
    expandedLabel: "Filipino",
  },
] as const;

export function normalizeLanguage(value: unknown): AppLanguage {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "ceb" || normalized === "fil" || normalized === "en") {
      return normalized;
    }
  }
  return "en";
}

const SHORT_MONTHS: Record<AppLanguage, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ceb: ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"],
  fil: ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"],
};

const FULL_MONTHS: Record<AppLanguage, readonly string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  ceb: [
    "Enero",
    "Pebrero",
    "Marso",
    "Abril",
    "Mayo",
    "Hunyo",
    "Hulyo",
    "Agosto",
    "Setyembre",
    "Oktubre",
    "Nobyembre",
    "Disyembre",
  ],
  fil: [
    "Enero",
    "Pebrero",
    "Marso",
    "Abril",
    "Mayo",
    "Hunyo",
    "Hulyo",
    "Agosto",
    "Setyembre",
    "Oktubre",
    "Nobyembre",
    "Disyembre",
  ],
};

export function getMonthName(
  month: number,
  language: AppLanguage,
  short = false,
): string {
  const index = month - 1;
  const list = short ? SHORT_MONTHS[language] : FULL_MONTHS[language];
  return list[index] ?? String(month);
}

export function formatMonthYear(
  year: number,
  month: number,
  language: AppLanguage,
): string {
  return `${getMonthName(month, language, false)} ${year}`;
}

export interface DashboardTranslations {
  language: AppLanguage;
  languageSelector: {
    heading: string;
    ariaLabel: string;
  };
  nav: {
    menuLabel: string;
    brandCaption: string;
    openNavigation: string;
    closeNavigation: string;
    map: string;
    calendar: string;
    anomaly: string;
    export: string;
  };
  shell: {
    skipToContent: string;
    simulatedNotice: string;
    filterBarAria: string;
    regionLabel: string;
    monthLabel: string;
    metricLabel: string;
    sensorLabel: string;
    loadingRegions: string;
    regionsUnavailable: string;
    customAreaGridApprox: string;
    harmonizedOption: string;
    rawOption: string;
    allInstrumentsOption: string;
    summaryCard: {
      region: string;
      period: string;
      activeCellDays: string;
      detections: string;
      coverage: string;
      lastUpdated: string;
      approxBadge: string;
      estimatedSuffix: string;
      notAvailable: string;
      awaitingWindow: string;
      noSavedDetections: string;
      dateRangeTo: string;
      filters: string;
      drawArea: string;
      finishDraw: string;
      cancelDraw: string;
      advisoryAi: string;
      darkMode: string;
      warmWhite: string;
      backToMap: string;
    };
    mapFilterPopover: {
      title: string;
      closeFilters: string;
      helpText: string;
      resetFilters: string;
      metricDescHarmonized: string;
      metricDescRaw: string;
    };
    mapShell: {
      sidebarAria: string;
      homeAria: string;
      navSectionsAria: string;
      mapWorkspaceAria: string;
      mapPageHeadingSr: string;
      mapSummaryAria: string;
      updatedPrefix: string;
      chooseRegion: string;
      openAdvisoryAi: string;
      selectedMonthFallback: string;
      selectedAreaFallback: string;
      selectRegionShort: string;
      filterChipFallback: string;
      harmonizedChipShort: string;
      rawChipShort: string;
      compactDark: string;
      compactWarm: string;
      regionHelpLoading: string;
      regionHelpDefault: string;
      monthHelp: string;
      liveFirmsPeriodLegend: string;
      liveFirmsHelp: string;
      harmonizedShort: string;
      rawShort: string;
      harmonizedHelp: string;
      sensorHelpRaw: string;
      sensorHelpDisabled: string;
    };
    mapCards: {
      formatTotalHotspots: (monthLabel: string) => string;
      combinedHeatDetections: string;
      verifyWithBfp: string;
      smallAreaSensor: string;
      smallAreaDetail: string;
      wideAreaSensor: string;
      wideAreaDetail: string;
      cellDayUnitNote: string;
      formatTypicalBaseline: (monthLabel: string) => string;
      formatNormalLevel: (monthLabel: string, detail: string) => string;
      medianFootnote: string;
      comparisonLabel: string;
      livePeriodValue: string;
      cdrrmoNonPredictive: string;
      formatBaselineYears: (count: number, startYear: number, endYear: number) => string;
      noComparableBaseline: string;
      liveLoading: string;
      liveNoData: string;
      anomalyStatus: {
        live: string;
        unusually_high: string;
        above_baseline: string;
        near_baseline: string;
        below_baseline: string;
        loading: string;
        unavailable: string;
      };
    };
    customArea: {
      activeSuffix: string;
      optionalSuffix: string;
      description: string;
      westLon: string;
      southLat: string;
      eastLon: string;
      northLat: string;
      useCustomArea: string;
      drawRectangle: string;
      cancelDrawing: string;
      enterAllCoords: string;
      invalidCoords: string;
      boundsUnavailable: string;
      boundsOutsidePh: string;
      formatActiveArea: (name: string, boundsText: string) => string;
    };
    errors: {
      title: string;
      retry: string;
    };
    exportUnavailable: {
      eyebrow: string;
      title: string;
      description: string;
    };
    footer: {
      compact: string;
    };
  };
  map: {
    regionLabel: string;
    regionAria: string;
    loadingMap: string;
    mapUnavailable: string;
    retry: string;
    loadingHotspots: string;
    hotspotErrorTitle: string;
    drawAreaBanner: string;
    noDetectionsTitle: string;
    noDetectionsBody: string;
    gridApproxBanner: string;
    coverageGapTitle: string;
    formatCoverageGap: (expectedCount: number, actualCount: number, regionName: string) => string;
    intensityTitle: string;
    intensityBands: {
      low: string;
      moderate: string;
      high: string;
      "very-high": string;
    };
    popup: {
      thermalDetection: string;
      latitude: string;
      longitude: string;
      satellite: string;
      instrument: string;
      acquisitionTimeUtc: string;
      sensorResolution: string;
      confidence: string;
      brightnessTemp: string;
      sourceProduct: string;
      notAvailable: string;
      viirsGrid: string;
      modisGrid: string;
      formatFootprintTooltip: (instrument: string, radius: number) => string;
      provinceSummarySuffix: string;
      thermalHotspotDetections: string;
      relativeActivityLevel: string;
      markerPlacement: string;
      markerPlacementValue: string;
      cdrrmoDrillDown: string;
      cdrrmoDrillDownValue: string;
      noData: string;
      detectionsCount: (count: number) => string;
      selectProvinceAria: (name: string, countLabel: string) => string;
      activityBands: {
        "very-high": string;
        high: string;
        moderate: string;
        low: string;
        "no-data": string;
      };
    };
  };
  calendar: {
    eyebrow: string;
    title: string;
    statusLoading: string;
    statusUnavailable: string;
    statusEmpty: string;
    statusEstimated: string;
    statusMetricPrefix: string;
    legendEstimated: string;
    legendNoData: string;
    legendLess: string;
    legendMore: string;
    railTitleEmpty: string;
    railSelectHint: string;
    recordedData: string;
    estimatedFromModis: string;
    noData: string;
    vsSameMonthMedian: string;
    anomalyVsSameMonth: string;
    clickToViewMap: string;
    viewOnMap: string;
    sameMonthYearOverYear: string;
    formatGridAria: (regionName: string) => string;
    formatCellAria: (
      monthName: string,
      year: number,
      valueText: string,
      estimatedText: string,
    ) => string;
    labels: Record<AnomalyLabel, string>;
  };
  analytics: {
    anomalyEyebrow: string;
    anomalyTitle: string;
    loadingComparison: string;
    comparisonUnavailable: string;
    emptyTitle: string;
    emptyBody: string;
    selectedActivity: string;
    sameMonthMedian: string;
    anomalyDelta: string;
    sensorMix: string;
    viirsLabel: string;
    modisLabel: string;
    noHistoricalBaseline: string;
    medianLabel: string;
    actualData: string;
    estimatedData: string;
    selectedMonthLegend: string;
    historicalMedianLegend: string;
    formatYoyChartTitle: (monthName: string) => string;
    formatBarAria: (year: number, count: number, estText: string) => string;
    technicalDetailsSummary: string;
    metricLabel: string;
    baselineYearsLabel: string;
    estimatedYearsLabel: string;
    approxLabel: string;
    yes: string;
    no: string;
    coverageLabel: string;
    statusPostures: Record<AnomalyLabel, string>;
    formatPostureSummary: (
      label: AnomalyLabel,
      regionName: string,
      periodLabel: string,
    ) => string;
    overlapEyebrow: string;
    overlapTitle: string;
    yearlyTotals: string;
    recent12Months: string;
    loadingOverlap: string;
    overlapUnavailable: string;
    noOverlapData: string;
    formatOverlapBarAria: (
      period: string,
      modis: string,
      viirs: string,
    ) => string;
    harmonizationEyebrow: string;
    harmonizationTitle: string;
    loadingHarmonization: string;
    harmonizationUnavailable: string;
    noHarmonizationData: string;
    scalingFactorLabel: string;
    overlapYearsLabel: string;
    correlationLabel: string;
    errorLabel: string;
    formatEstimatedYearsNote: (yearsText: string) => string;
    formatOverlapYearsSub: (firstYear: number, lastYear: number) => string;
    yearsSuffix: string;
    correlationSub: string;
    errorSub: string;
  };
  exportPanel: {
    eyebrow: string;
    title: string;
    intro: string;
    regionScope: string;
    periodScope: string;
    metricScope: string;
    instrumentScope: string;
    harmonizedScopeValue: string;
    rawScopeValue: string;
    activeFilters: string;
    rawCsvTitle: string;
    rawCsvDesc: string;
    rawCsvFormat: string;
    downloadHotspots: string;
    preparingCsv: string;
    analyticsCsvTitle: string;
    analyticsCsvDesc: string;
    analyticsCsvFormat: string;
    downloadSummary: string;
    preparingSummary: string;
    columnsIncludedLabel: string;
    filenameLabel: string;
    formatDownloadedHotspots: (fileName: string) => string;
    formatDownloadedSummary: (fileName: string) => string;
    fallbackError: string;
  };
  ai: {
    panelAria: string;
    title: string;
    closePanel: string;
    tabAdvisory: string;
    tabWatchlist: string;
    postureBadges: Record<AnomalyLabel, string>;
    hotspotsKpi: string;
    normalMedianKpi: string;
    statusKpi: string;
    formatSensorSplit: (viirs: string, modis: string) => string;
    generateAdvisory: string;
    generating: string;
    emptyAdvisoryPrompt: string;
    questionPrefix: string;
    summaryHeading: string;
    actionHeading: string;
    noteHeading: string;
    defaultComputedFallback: string;
    defaultInterpretationFallback: string;
    defaultLimitationsFallback: string;
    followupSummary: string;
    suggestedQuestions: readonly string[];
    questionSrLabel: string;
    questionPlaceholder: string;
    loadingRegionAnalytics: string;
    emptyQuestionHint: string;
    formatMaxLengthError: (maxLength: number) => string;
    askAdvisory: string;
    errorFallback: string;
    invalidResponse: string;
    watchlistHeading: string;
    monitorBukidnon: string;
    bukidnonSectors: string;
    provincesInFocus: string;
    corridors: {
      northern: { title: string; subtitle: string };
      central: { title: string; subtitle: string };
      southern: { title: string; subtitle: string };
    };
    badges: {
      HIGH: string;
      MODERATE: string;
      WATCH: string;
    };
    formatHotspotCount: (count: number) => string;
    viewButton: string;
    nationalFocusTitle: string;
    nationalFocusSub: string;
    activeCorridorSub: string;
    activeClusterSub: string;
    monitoringFocusSub: string;
    provinceWatchSub: string;
    standbyFocusSub: string;
    defaultDisclaimer: string;
    localeHint: string;
  };
}

const EN_TRANSLATIONS: DashboardTranslations = {
  language: "en",
  languageSelector: {
    heading: "LANGUAGE",
    ariaLabel: "Interface and Advisory AI language",
  },
  nav: {
    menuLabel: "MENU",
    brandCaption: "CDRRMO Operations",
    openNavigation: "Open navigation menu",
    closeNavigation: "Close navigation menu",
    map: "Map",
    calendar: "Calendar",
    anomaly: "Anomaly Detection",
    export: "CSV Export",
  },
  shell: {
    skipToContent: "Skip to content",
    simulatedNotice: "Showing simulated data",
    filterBarAria: "Dashboard filters",
    regionLabel: "Region",
    monthLabel: "Month",
    metricLabel: "Metric",
    sensorLabel: "Sensor",
    loadingRegions: "Loading regions…",
    regionsUnavailable: "Region catalog unavailable",
    customAreaGridApprox: "Custom area · grid-approximated",
    harmonizedOption: "Harmonized (VIIRS-scale)",
    rawOption: "Raw",
    allInstrumentsOption: "All instruments",
    summaryCard: {
      region: "Region",
      period: "Period",
      activeCellDays: "Active cell-days",
      detections: "Detections",
      coverage: "Coverage",
      lastUpdated: "Last updated",
      approxBadge: "Approx.",
      estimatedSuffix: "est.",
      notAvailable: "Not available",
      awaitingWindow: "Awaiting date window",
      noSavedDetections: "No saved detections",
      dateRangeTo: "to",
      filters: "Filters",
      drawArea: "Draw area",
      finishDraw: "Drawing… click corner & drag",
      cancelDraw: "Cancel draw",
      advisoryAi: "Advisory AI",
      darkMode: "Dark Mode",
      warmWhite: "Warm White",
      backToMap: "← Map",
    },
    mapFilterPopover: {
      title: "Map filters",
      closeFilters: "Close filters",
      helpText:
        "All controls update the map, calendar, charts, and CSV exports.",
      resetFilters: "Reset",
      metricDescHarmonized:
        "Calibrated VIIRS-scale monthly active cell-days.",
      metricDescRaw: "Unadjusted MODIS / VIIRS sensor counts.",
    },
    mapShell: {
      sidebarAria: "Dashboard sidebar",
      homeAria: "FIRE MEMORY home",
      navSectionsAria: "Dashboard sections",
      mapWorkspaceAria: "Satellite fire map",
      mapPageHeadingSr: "Satellite activity dashboard",
      mapSummaryAria: "Selected month fire activity summary",
      updatedPrefix: "Updated",
      chooseRegion: "Choose region",
      openAdvisoryAi: "Open Advisory AI",
      selectedMonthFallback: "Selected month",
      selectedAreaFallback: "Selected area",
      selectRegionShort: "Select region",
      filterChipFallback: "Filter",
      harmonizedChipShort: "Harm",
      rawChipShort: "Raw",
      compactDark: "Dark",
      compactWarm: "Warm",
      regionHelpLoading: "Loading available regions.",
      regionHelpDefault: "Choose a national, province, or custom area view.",
      monthHelp: "Select a calendar month in UTC.",
      liveFirmsPeriodLegend: "Live FIRMS period",
      liveFirmsHelp: "Select a current-data window for the map.",
      harmonizedShort: "Harmonized",
      rawShort: "Raw",
      harmonizedHelp: "Harmonized is the default view.",
      sensorHelpRaw: "ALL includes MODIS and VIIRS.",
      sensorHelpDisabled: "Available when viewing raw detections.",
    },
    mapCards: {
      formatTotalHotspots: (monthLabel) => `Total Fire Hotspots (${monthLabel})`,
      combinedHeatDetections: "Combined satellite heat detections",
      verifyWithBfp: "Satellite heat detections • Verify on ground with BFP",
      smallAreaSensor: "Small-Area Sensor (VIIRS 375m)",
      smallAreaDetail: "High-detail sensor • Detects smaller brush & field fires",
      wideAreaSensor: "Wide-Area Sensor (MODIS 1km)",
      wideAreaDetail: "Long-term sensor • 20+ year historical archive",
      cellDayUnitNote: "Each count = 1 active grid area per day",
      formatTypicalBaseline: (monthLabel) => `Typical ${monthLabel} Baseline (Median)`,
      formatNormalLevel: (monthLabel, detail) => `Normal level for ${monthLabel} (${detail})`,
      medianFootnote: "Middle value of past years for this same month",
      comparisonLabel: "Comparison vs. Typical Month",
      livePeriodValue: "Live Period",
      cdrrmoNonPredictive: "CDRRMO Decision Support • Non-Predictive",
      formatBaselineYears: (count, startYear, endYear) => `${count} years (${startYear}-${endYear})`,
      noComparableBaseline: "No comparable baseline",
      liveLoading: "Loading...",
      liveNoData: "No data",
      anomalyStatus: {
        live: "Live Window in Progress",
        unusually_high: "Unusually High — Verify Area",
        above_baseline: "Above Normal — Monitor Closely",
        near_baseline: "Normal for This Month",
        below_baseline: "Below Normal Activity",
        loading: "Loading baseline",
        unavailable: "Baseline Unavailable",
      },
    },
    customArea: {
      activeSuffix: " · active",
      optionalSuffix: " · optional",
      description:
        "Enter longitude and latitude bounds or draw a rectangle on the map. The area must fit within the Philippines overview bounds.",
      westLon: "West longitude",
      southLat: "South latitude",
      eastLon: "East longitude",
      northLat: "North latitude",
      useCustomArea: "Use custom area",
      drawRectangle: "Draw rectangle on map",
      cancelDrawing: "Cancel map drawing",
      enterAllCoords: "Enter all four longitude and latitude values.",
      invalidCoords: "Enter valid coordinates with west < east and south < north.",
      boundsUnavailable: "Philippines bounds are unavailable; the area cannot be validated.",
      boundsOutsidePh: "The custom area must fit within the Philippines overview bounds.",
      formatActiveArea: (name, boundsText) =>
        `Active area: ${name} · bounds ${boundsText} · grid-approximated`,
    },
    errors: {
      title: "Some dashboard data could not be loaded",
      retry: "Retry failed requests",
    },
    exportUnavailable: {
      eyebrow: "FEATURE 05 · DATA EXPORT",
      title: "Export data",
      description: "Select a region and period to enable the data exports.",
    },
    footer: {
      compact: "FIRE MEMORY · NASA FIRMS MODIS & VIIRS Historical Archive (UTC)",
    },
  },
  map: {
    regionLabel: "Region:",
    regionAria: "Map region selector",
    loadingMap: "Loading map…",
    mapUnavailable: "Interactive map unavailable",
    retry: "Retry",
    loadingHotspots: "Loading hotspots…",
    hotspotErrorTitle: "Hotspot points could not be loaded",
    drawAreaBanner:
      "Click and drag on the map to draw a custom bounding box.",
    noDetectionsTitle: "No satellite detections in this area and month",
    noDetectionsBody:
      "Coverage can be affected by clouds, smoke, or overpass timing.",
    gridApproxBanner:
      "Counts for this custom area are grid-approximated.",
    coverageGapTitle: "Coverage limitation",
    formatCoverageGap: (expectedCount, actualCount, regionName) =>
      `Monthly active cell-days is ${expectedCount.toLocaleString("en-US")}, while ${actualCount.toLocaleString("en-US")} point detections were found in ${regionName} for this month. Point storage may have gaps for part of the archive.`,
    intensityTitle: "Hotspot Intensity Scale",
    intensityBands: {
      low: "Low",
      moderate: "Moderate",
      high: "High",
      "very-high": "Very High",
    },
    popup: {
      thermalDetection: "Thermal Hotspot Detection",
      latitude: "Latitude",
      longitude: "Longitude",
      satellite: "Satellite",
      instrument: "Instrument",
      acquisitionTimeUtc: "Acquisition time (UTC)",
      sensorResolution: "Sensor Resolution",
      confidence: "Confidence",
      brightnessTemp: "Fire Radiative / Brightness Temp",
      sourceProduct: "Source product",
      notAvailable: "Not available",
      viirsGrid: "375 m grid (VIIRS high-detail)",
      modisGrid: "1 km grid (MODIS wide-area)",
      formatFootprintTooltip: (instrument, radius) =>
        `${instrument} sensor resolution (~${radius} m radius — satellite scan area, not confirmed burn perimeter)`,
      provinceSummarySuffix: "Province Hotspot Summary",
      thermalHotspotDetections: "Thermal Hotspot Detections",
      relativeActivityLevel: "Relative Activity Level",
      markerPlacement: "Marker Placement",
      markerPlacementValue: "Approximate province bounding-box center",
      cdrrmoDrillDown: "CDRRMO Drill-Down",
      cdrrmoDrillDownValue: "Select bubble to inspect province hotspots",
      noData: "No data",
      detectionsCount: (count) => `${count.toLocaleString("en-US")} detections`,
      selectProvinceAria: (name, countLabel) =>
        `${name}: ${countLabel}. Select province.`,
      activityBands: {
        "very-high": "Very high relative activity",
        high: "High relative activity",
        moderate: "Moderate relative activity",
        low: "Low relative activity",
        "no-data": "No data coverage",
      },
    },
  },
  calendar: {
    eyebrow: "HISTORICAL ACTIVITY MATRIX",
    title: "Monthly Activity Calendar",
    statusLoading: "Loading calendar…",
    statusUnavailable: "Calendar unavailable",
    statusEmpty: "No calendar data available for this selection.",
    statusEstimated: "E = Estimated from MODIS",
    statusMetricPrefix: "Metric:",
    legendEstimated: "Estimated",
    legendNoData: "No data",
    legendLess: "Less",
    legendMore: "More",
    railTitleEmpty: "Cell Details",
    railSelectHint: "Select any month cell from the matrix to inspect metrics.",
    recordedData: "Recorded Data",
    estimatedFromModis: "Estimated from MODIS",
    noData: "No data",
    vsSameMonthMedian: "vs. same-month median",
    anomalyVsSameMonth: "Anomaly vs same month",
    clickToViewMap: "Click to view on map",
    viewOnMap: "View on Map →",
    sameMonthYearOverYear: "Same Month Year-over-Year",
    formatGridAria: (regionName) =>
      `Monthly thermal hotspot activity calendar for ${regionName}`,
    formatCellAria: (monthName, year, valueText, estimatedText) =>
      `${monthName} ${year}: ${valueText} active cell-days${estimatedText}`,
    labels: {
      below_baseline: "Below Baseline",
      near_baseline: "Near Baseline",
      above_baseline: "Above Baseline",
      unusually_high: "Unusually High",
      not_calculable: "Not Calculable",
    },
  },
  analytics: {
    anomalyEyebrow: "ANOMALY DETECTION",
    anomalyTitle: "Historical Baseline Comparison",
    loadingComparison: "Loading baseline comparison…",
    comparisonUnavailable: "Baseline comparison unavailable",
    emptyTitle: "No baseline data available",
    emptyBody:
      "Select a region with at least one recorded calendar year to view anomaly comparison.",
    selectedActivity: "Selected Activity",
    sameMonthMedian: "Same-Month Median",
    anomalyDelta: "Anomaly Delta",
    sensorMix: "Sensor Mix",
    viirsLabel: "VIIRS",
    modisLabel: "MODIS",
    noHistoricalBaseline: "No historical baseline",
    medianLabel: "Median",
    actualData: "Actual Data",
    estimatedData: "Estimated Data",
    selectedMonthLegend: "Selected Month",
    historicalMedianLegend: "Historical Median",
    formatYoyChartTitle: (monthName) =>
      `${monthName} — Year-by-Year Historical Comparison`,
    formatBarAria: (year, count, estText) =>
      `${year}: ${count.toLocaleString("en-US")} detections${estText}`,
    technicalDetailsSummary: "Technical baseline parameters",
    metricLabel: "Metric",
    baselineYearsLabel: "Baseline Years",
    estimatedYearsLabel: "Estimated Years",
    approxLabel: "Grid-Approximated",
    yes: "Yes",
    no: "No",
    coverageLabel: "Data Coverage",
    statusPostures: {
      unusually_high: "Unusually High",
      above_baseline: "Above Normal",
      near_baseline: "Near Normal",
      below_baseline: "Below Normal",
      not_calculable: "Insufficient Baseline",
    },
    formatPostureSummary: (label, regionName, periodLabel) => {
      switch (label) {
        case "unusually_high":
          return `${regionName} (${periodLabel}) is significantly elevated compared to prior same-month history. Prioritize field verification.`;
        case "above_baseline":
          return `${regionName} (${periodLabel}) is moderately above historical norms. Maintain active barangay coordination.`;
        case "near_baseline":
          return `${regionName} (${periodLabel}) tracks close to the typical seasonal baseline for this month.`;
        case "below_baseline":
          return `${regionName} (${periodLabel}) is lower than typical seasonal baseline levels.`;
        default:
          return `${regionName} (${periodLabel}) lacks sufficient same-month baseline data for a full historical percentage.`;
      }
    },
    overlapEyebrow: "SENSOR OVERLAP TIMELINE",
    overlapTitle: "MODIS vs VIIRS Activity Comparison",
    yearlyTotals: "Yearly Totals",
    recent12Months: "Recent 12 Months",
    loadingOverlap: "Loading overlap timeline…",
    overlapUnavailable: "Overlap timeline unavailable",
    noOverlapData: "No sensor overlap periods available for this region.",
    formatOverlapBarAria: (period, modis, viirs) =>
      `${period}: MODIS ${modis}, VIIRS ${viirs}`,
    harmonizationEyebrow: "CROSS-SENSOR HARMONIZATION",
    harmonizationTitle: "MODIS-to-VIIRS Calibration Metrics",
    loadingHarmonization: "Loading calibration metrics…",
    harmonizationUnavailable: "Calibration metrics unavailable",
    noHarmonizationData: "Harmonization metrics are not available for this view.",
    scalingFactorLabel: "MODIS-to-VIIRS Scaling Factor",
    overlapYearsLabel: "Overlap Calibration Years",
    correlationLabel: "Calibration Agreement (r)",
    errorLabel: "Calibration Error (MAPE)",
    formatEstimatedYearsNote: (yearsText) =>
      `Earlier years estimated from MODIS using calibrated scaling: ${yearsText}`,
    formatOverlapYearsSub: (firstYear, lastYear) => `${firstYear} – ${lastYear}`,
    yearsSuffix: "years",
    correlationSub: "Pearson correlation across overlap periods",
    errorSub: "Mean absolute percentage error in overlap periods",
  },
  exportPanel: {
    eyebrow: "FEATURE 05 · DATA EXPORT",
    title: "Export research & CDRRMO datasets",
    intro:
      "Download point-level hotspot detections or harmonized monthly baseline records aligned with your current filter selection.",
    regionScope: "Region Scope",
    periodScope: "Period Window",
    metricScope: "Metric Scale",
    instrumentScope: "Sensor Filter",
    harmonizedScopeValue: "Harmonized (VIIRS-scale)",
    rawScopeValue: "Raw Counts",
    activeFilters: "ACTIVE FILTERS",
    rawCsvTitle: "Raw Hotspot Detections",
    rawCsvDesc:
      "Individual satellite coordinates, timestamps (UTC), brightness temperature, radiative power (FRP), and sensor metadata.",
    rawCsvFormat: "POINT-LEVEL CSV",
    downloadHotspots: "Download Hotspots CSV",
    preparingCsv: "Preparing CSV…",
    analyticsCsvTitle: "Harmonized Analytics Summary",
    analyticsCsvDesc:
      "Monthly calibrated activity totals, same-month historical medians, anomaly labels, and data quality notes.",
    analyticsCsvFormat: "SUMMARY CSV",
    downloadSummary: "Download Summary CSV",
    preparingSummary: "Preparing Summary…",
    columnsIncludedLabel: "Columns included",
    filenameLabel: "Output file",
    formatDownloadedHotspots: (fileName) => `Downloaded ${fileName}.`,
    formatDownloadedSummary: (fileName) => `Downloaded ${fileName}.`,
    fallbackError: "The CSV download could not be completed.",
  },
  ai: {
    panelAria: "CDRRMO Advisory AI",
    title: "CDRRMO Advisory",
    closePanel: "Close advisory panel",
    tabAdvisory: "Advisory",
    tabWatchlist: "Watchlist",
    postureBadges: {
      unusually_high: "CRITICAL WATCH",
      above_baseline: "ABOVE NORMAL",
      near_baseline: "NEAR NORMAL",
      below_baseline: "BELOW NORMAL",
      not_calculable: "ACTIVE WATCH",
    },
    hotspotsKpi: "Hotspots",
    normalMedianKpi: "Normal Median",
    statusKpi: "Status",
    formatSensorSplit: (viirs, modis) => `VIIRS ${viirs} · MODIS ${modis}`,
    generateAdvisory: "Get CDRRMO Advisory",
    generating: "Generating…",
    emptyAdvisoryPrompt:
      "Click Get CDRRMO Advisory for grounded satellite interpretation and BFP / barangay verification actions.",
    questionPrefix: "Question:",
    summaryHeading: "Summary",
    actionHeading: "CDRRMO Action",
    noteHeading: "Note",
    defaultComputedFallback: "See summary metrics above.",
    defaultInterpretationFallback:
      "Maintain standard CDRRMO monitoring posture.",
    defaultLimitationsFallback:
      "Satellite hotspots indicate heat sources, not confirmed fires—verify with BFP or barangay responders.",
    followupSummary: "Ask a specific question",
    suggestedQuestions: [
      "What does this month's hotspot count vs. historical median mean for CDRRMO monitoring?",
      "How should our CDRRMO interpret the VIIRS and MODIS detections for this period?",
      "What data limitations should we note in our LGU situational briefing?",
    ],
    questionSrLabel: "Question for the CDRRMO Advisory AI",
    questionPlaceholder: "Ask a specific CDRRMO question…",
    loadingRegionAnalytics:
      "Loading region analytics before questions can be submitted…",
    emptyQuestionHint:
      "Enter a specific question above or click one of the suggested prompts.",
    formatMaxLengthError: (maxLength) =>
      `Keep the question under ${maxLength} characters.`,
    askAdvisory: "Ask Advisory",
    errorFallback: "The AI interpretation could not be loaded.",
    invalidResponse: "The AI returned an invalid response.",
    watchlistHeading: "Places to Closely Monitor",
    monitorBukidnon: "Monitor Bukidnon",
    bukidnonSectors: "Bukidnon Sectors",
    provincesInFocus: "Provinces in Focus",
    corridors: {
      northern: {
        title: "Northern Bukidnon",
        subtitle: "Malaybalay · Impasugong · Manolo Fortich · Sumilao",
      },
      central: {
        title: "Central Bukidnon",
        subtitle: "Valencia · Maramag · Lantapan · Quezon",
      },
      southern: {
        title: "Southern & Western Bukidnon",
        subtitle: "Don Carlos · Pangantucan · Talakag · Kitaotao",
      },
    },
    badges: {
      HIGH: "HIGH",
      MODERATE: "MODERATE",
      WATCH: "WATCH",
    },
    formatHotspotCount: (count) =>
      `${count.toLocaleString("en-US")} ${count === 1 ? "hotspot" : "hotspots"}`,
    viewButton: "View",
    nationalFocusTitle: "Bukidnon (National Focus)",
    nationalFocusSub:
      "Primary CDRRMO priority province · Open sector corridors",
    activeCorridorSub: "Active hotspot corridor for field verification",
    activeClusterSub: "Active hotspot cluster in selected window",
    monitoringFocusSub: "CDRRMO monitoring focus area",
    provinceWatchSub: "Provincial LGU coordination watchpoint",
    standbyFocusSub: "CDRRMO standby watch focus",
    defaultDisclaimer:
      "CDRRMO Advisory AI interpretation only. Satellite detections are not confirmed fires, forecasts, or emergency instructions.",
    localeHint: "Cebuano / Bisaya · Filipino · English supported",
  },
};

const CEB_TRANSLATIONS: DashboardTranslations = {
  language: "ceb",
  languageSelector: {
    heading: "PINULONGAN",
    ariaLabel: "Pinulongan sa sistema ug Advisory AI",
  },
  nav: {
    menuLabel: "MENU",
    brandCaption: "Operasyon sa CDRRMO",
    openNavigation: "Ablihi ang menu sa nabigasyon",
    closeNavigation: "Sirad-i ang menu sa nabigasyon",
    map: "Mapa",
    calendar: "Kalendaryo",
    anomaly: "Pagsusi sa Anomaliya",
    export: "Pag-export og CSV",
  },
  shell: {
    skipToContent: "Laktaw ngadto sa sulod",
    simulatedNotice: "Nagpakita og simulated nga datos",
    filterBarAria: "Mga filter sa dashboard",
    regionLabel: "Rehiyon",
    monthLabel: "Buwan",
    metricLabel: "Sukdanan",
    sensorLabel: "Sensor",
    loadingRegions: "Nagkarga sa mga rehiyon…",
    regionsUnavailable: "Wala ma-load ang lista sa rehiyon",
    customAreaGridApprox: "Gidrowing nga lugar · gibanabana sa grid",
    harmonizedOption: "Gipantay (Sukdanan sa VIIRS)",
    rawOption: "Aktwal",
    allInstrumentsOption: "Tanang sensor",
    summaryCard: {
      region: "Rehiyon",
      period: "Panahon",
      activeCellDays: "Aktibong cell-days",
      detections: "Mga Deteksyon",
      coverage: "Sakop sa datos",
      lastUpdated: "Katapusang update",
      approxBadge: "Bana-bana",
      estimatedSuffix: "banabana",
      notAvailable: "Walay datos",
      awaitingWindow: "Naghulat sa petsa",
      noSavedDetections: "Walay natala nga deteksyon",
      dateRangeTo: "hangtod",
      filters: "Mga Filter",
      drawArea: "Idrowing",
      finishDraw: "Nagdrowing… i-klik ug i-drag",
      cancelDraw: "Kanselahon",
      advisoryAi: "Tambag sa AI",
      darkMode: "Ngitngit nga Tema",
      warmWhite: "Sanag nga Tema",
      backToMap: "← Mapa",
    },
    mapFilterPopover: {
      title: "Mga filter sa mapa",
      closeFilters: "Sirad-i ang mga filter",
      helpText:
        "Ang tanang kontrol mo-update sa mapa, kalendaryo, tsart, ug mga CSV export.",
      resetFilters: "I-reset",
      metricDescHarmonized:
        "Gipantay nga buwanang aktibong cell-days sa sukdanan sa VIIRS.",
      metricDescRaw: "Direktang ihap gikan sa MODIS / VIIRS nga walay kausaban.",
    },
    mapShell: {
      sidebarAria: "Sidebar sa dashboard",
      homeAria: "Home sa FIRE MEMORY",
      navSectionsAria: "Mga seksyon sa dashboard",
      mapWorkspaceAria: "Mapa sa kalayo sa satelayt",
      mapPageHeadingSr: "Dashboard sa aktibidad sa satelayt",
      mapSummaryAria: "Sumaryo sa aktibidad sa gipiling buwan",
      updatedPrefix: "Gi-update",
      chooseRegion: "Pilia ang rehiyon",
      openAdvisoryAi: "Ablihi ang Tambag sa AI",
      selectedMonthFallback: "Gipiling buwan",
      selectedAreaFallback: "Gipiling lugar",
      selectRegionShort: "Pili og rehiyon",
      filterChipFallback: "Filter",
      harmonizedChipShort: "Gipantay",
      rawChipShort: "Aktwal",
      compactDark: "Ngitngit",
      compactWarm: "Sanag",
      regionHelpLoading: "Nagkarga sa mga magamit nga rehiyon.",
      regionHelpDefault: "Pagpili og nasyonal, probinsya, o gidrowing nga lugar.",
      monthHelp: "Pilia ang buwan sa kalendaryo sa UTC.",
      liveFirmsPeriodLegend: "Live nga panahon sa FIRMS",
      liveFirmsHelp: "Pilia ang kasamtangang panahon sa datos alang sa mapa.",
      harmonizedShort: "Gipantay",
      rawShort: "Aktwal",
      harmonizedHelp: "Ang gipantay mao ang default nga pagtan-aw.",
      sensorHelpRaw: "Ang Tanang sensor naglakip sa MODIS ug VIIRS.",
      sensorHelpDisabled: "Magamit lang kung nagtan-aw sa aktwal nga ihap.",
    },
    mapCards: {
      formatTotalHotspots: (monthLabel) => `Kinatibuk-ang Hotspot sa Kalayo (${monthLabel})`,
      combinedHeatDetections: "Gihiusang deteksyon sa kainit sa satelayt",
      verifyWithBfp: "Deteksyon sa kainit sa satelayt • Beripikahon sa yuta uban sa BFP",
      smallAreaSensor: "Detalyadong Sensor (VIIRS 375m)",
      smallAreaDetail: "Taas og detalye • Makadakop sa gagmayng sunog sa sagbot ug uma",
      wideAreaSensor: "Lapad nga Sensor (MODIS 1km)",
      wideAreaDetail: "Dugay na nga sensor • 20+ ka tuig nga makasaysayanong arkibo",
      cellDayUnitNote: "Matag ihap = 1 aktibong grid area matag adlaw",
      formatTypicalBaseline: (monthLabel) => `Kasadya nga Sukdanan sa ${monthLabel} (Median)`,
      formatNormalLevel: (monthLabel, detail) => `Normal nga lebel alang sa ${monthLabel} (${detail})`,
      medianFootnote: "Tunga-tungang bili sa milabayng mga tuig alang niining buwana",
      comparisonLabel: "Pagtandi batok sa Kasagarang Buwan",
      livePeriodValue: "Live nga Panahon",
      cdrrmoNonPredictive: "Suporta sa Desisyon sa CDRRMO • Dili Tigtagna",
      formatBaselineYears: (count, startYear, endYear) => `${count} ka tuig (${startYear}-${endYear})`,
      noComparableBaseline: "Walay ikatandi nga baseline",
      liveLoading: "Nagkarga...",
      liveNoData: "Walay datos",
      anomalyStatus: {
        live: "Live nga Window Nagpadayon",
        unusually_high: "Talagsaon ka Taas — Beripikahon ang Lugar",
        above_baseline: "Labaw sa Normal — Bantayan og Maayo",
        near_baseline: "Normal Alang Niining Buwana",
        below_baseline: "Ubos sa Normal nga Aktibidad",
        loading: "Nagkarga sa baseline",
        unavailable: "Walay Magamit nga Baseline",
      },
    },
    customArea: {
      activeSuffix: " · aktibo",
      optionalSuffix: " · opsyonal",
      description:
        "Ibutang ang longitude ug latitude nga mga utlanan o pagdrowing og rektanggulo sa mapa. Kinahanglan sulod kini sa mga utlanan sa Pilipinas.",
      westLon: "West longitude",
      southLat: "South latitude",
      eastLon: "East longitude",
      northLat: "North latitude",
      useCustomArea: "Gamita ang gidrowing nga lugar",
      drawRectangle: "Pagdrowing og rektanggulo sa mapa",
      cancelDrawing: "Kanselahon ang pagdrowing",
      enterAllCoords: "Isulod ang upat ka bili sa longitude ug latitude.",
      invalidCoords: "Pagbutang og hustong koordinato diin west < east ug south < north.",
      boundsUnavailable: "Wala ang mga utlanan sa Pilipinas; dili masusi ang lugar.",
      boundsOutsidePh: "Ang gidrowing nga lugar kinahanglan mosulod sa mga utlanan sa Pilipinas.",
      formatActiveArea: (name, boundsText) =>
        `Aktibong lugar: ${name} · mga utlanan ${boundsText} · gibanabana sa grid`,
    },
    errors: {
      title: "Adunay pipila ka datos nga wala ma-load",
      retry: "Sulayi pag-usab",
    },
    exportUnavailable: {
      eyebrow: "FEATURE 05 · PAG-EXPORT OG DATOS",
      title: "Pag-export og datos",
      description: "Pilia una ang rehiyon ug buwan aron maablihan ang pag-export.",
    },
    footer: {
      compact: "FIRE MEMORY · NASA FIRMS MODIS & VIIRS Arkibo (UTC)",
    },
  },
  map: {
    regionLabel: "Rehiyon:",
    regionAria: "Pagpili og rehiyon sa mapa",
    loadingMap: "Nagkarga sa mapa…",
    mapUnavailable: "Dili magamit ang interactive nga mapa karon",
    retry: "Sulayi pag-usab",
    loadingHotspots: "Nagkarga sa mga hotspot…",
    hotspotErrorTitle: "Wala ma-load ang mga punto sa hotspot",
    drawAreaBanner:
      "I-klik ug i-drag sa mapa aron magdrowing og kaugalingong kahon nga lugar.",
    noDetectionsTitle: "Walay deteksyon sa satelayt niining lugar ug buwana",
    noDetectionsBody:
      "Mahimong naapektuhan sa panganod, aso, o oras sa paglabay sa satelayt ang pagtan-aw.",
    gridApproxBanner:
      "Ang mga ihap alang niining gidrowing nga lugar gibanabana gamit ang grid.",
    coverageGapTitle: "Limitasyon sa sakop",
    formatCoverageGap: (expectedCount, actualCount, regionName) =>
      `Ang buwanang aktibong cell-days kay ${expectedCount.toLocaleString("en-US")}, samtang ${actualCount.toLocaleString("en-US")} ka punto ang nakita sa ${regionName} niining buwana. Mahimong adunay kulang sa arkibo sa mga punto.`,
    intensityTitle: "Sukdanan sa Kakusog sa Hotspot",
    intensityBands: {
      low: "Ubos",
      moderate: "Kasarangan",
      high: "Taas",
      "very-high": "Labihan ka Taas",
    },
    popup: {
      thermalDetection: "Deteksyon sa Init sa Satelayt",
      latitude: "Latitud",
      longitude: "Longitud",
      satellite: "Satelayt",
      instrument: "Sensor",
      acquisitionTimeUtc: "Oras sa pagkuha (UTC)",
      sensorResolution: "Detalye sa Sensor",
      confidence: "Kompiyansa",
      brightnessTemp: "Temperatura / Kusog sa Init",
      sourceProduct: "Tinubdan nga produkto",
      notAvailable: "Walay datos",
      viirsGrid: "375 m grid (VIIRS detalyado)",
      modisGrid: "1 km grid (MODIS lapad nga sakop)",
      formatFootprintTooltip: (instrument, radius) =>
        `Sakop sa sensor sa ${instrument} (~${radius} m radius — luna sa pag-scan, dili kompirmadong nasunog nga utlanan)`,
      provinceSummarySuffix: "Katingbanan sa Probinsya",
      thermalHotspotDetections: "Mga Deteksyon sa Hotspot",
      relativeActivityLevel: "Ang-ang sa Aktibidad",
      markerPlacement: "Lokasyon sa Marka",
      markerPlacementValue: "Bana-bana nga sentro sa utlanan sa probinsya",
      cdrrmoDrillDown: "Pagtutok sa CDRRMO",
      cdrrmoDrillDownValue: "I-klik ang lingin aron masusi ang probinsya",
      noData: "Walay datos",
      detectionsCount: (count) => `${count.toLocaleString("en-US")} ka deteksyon`,
      selectProvinceAria: (name, countLabel) =>
        `${name}: ${countLabel}. Pilia ang probinsya.`,
      activityBands: {
        "very-high": "Labihan ka taas nga aktibidad",
        high: "Taas nga aktibidad",
        moderate: "Kasarangang aktibidad",
        low: "Ubos nga aktibidad",
        "no-data": "Walay datos nga nakuha",
      },
    },
  },
  calendar: {
    eyebrow: "KASAYSAYAN NGA MATRIKS SA AKTIBIDAD",
    title: "Buwanang Kalendaryo sa Aktibidad",
    statusLoading: "Nagkarga sa kalendaryo…",
    statusUnavailable: "Wala magamit ang kalendaryo",
    statusEmpty: "Walay datos sa kalendaryo alang niining gipili.",
    statusEstimated: "E = Gibanabana gikan sa MODIS",
    statusMetricPrefix: "Sukdanan:",
    legendEstimated: "Gibanabana",
    legendNoData: "Walay datos",
    legendLess: "Mas Ubos",
    legendMore: "Mas Daghan",
    railTitleEmpty: "Detalye sa Buwan",
    railSelectHint: "Pilia ang bisan unsang buwan sa lamesa aron tan-awon ang mga ihap.",
    recordedData: "Narekord nga Datos",
    estimatedFromModis: "Gibanabana gikan sa MODIS",
    noData: "Walay datos",
    vsSameMonthMedian: "kon itandi sa kasarangang ihap sa susamang buwan",
    anomalyVsSameMonth: "Anomaliya sa susamang buwan",
    clickToViewMap: "I-klik aron tan-awon sa mapa",
    viewOnMap: "Tan-awa sa Mapa →",
    sameMonthYearOverYear: "Susamang Buwan Matag Tuig",
    formatGridAria: (regionName) =>
      `Buwanang kalendaryo sa init sa satelayt alang sa ${regionName}`,
    formatCellAria: (monthName, year, valueText, estimatedText) =>
      `${monthName} ${year}: ${valueText} ka aktibong cell-days${estimatedText}`,
    labels: {
      below_baseline: "Ubos sa Normal",
      near_baseline: "Duol sa Normal",
      above_baseline: "Labaw sa Normal",
      unusually_high: "Labihan ka Taas",
      not_calculable: "Dili Makwenta",
    },
  },
  analytics: {
    anomalyEyebrow: "PAGSUSI SA ANOMALIYA",
    anomalyTitle: "Pagtandi sa Kasaysayan nga Basehan",
    loadingComparison: "Nagkarga sa pagtandi sa basehan…",
    comparisonUnavailable: "Wala ma-load ang pagtandi sa basehan",
    emptyTitle: "Walay datos sa kasaysayan",
    emptyBody:
      "Pagpili og rehiyon nga adunay labing menos usa ka tuig nga rekord aron makita ang pagtandi.",
    selectedActivity: "Napiling Aktibidad",
    sameMonthMedian: "Kasarangan sa Susamang Buwan",
    anomalyDelta: "Kausaban (Delta)",
    sensorMix: "Kombinasyon sa Sensor",
    viirsLabel: "VIIRS",
    modisLabel: "MODIS",
    noHistoricalBaseline: "Walay basehan sa kasaysayan",
    medianLabel: "Medyan",
    actualData: "Aktwal nga Datos",
    estimatedData: "Gibanabana nga Datos",
    selectedMonthLegend: "Napiling Buwan",
    historicalMedianLegend: "Medyan sa Kasaysayan",
    formatYoyChartTitle: (monthName) =>
      `${monthName} — Pagtandi Matag Tuig sa Kasaysayan`,
    formatBarAria: (year, count, estText) =>
      `${year}: ${count.toLocaleString("en-US")} ka deteksyon${estText}`,
    technicalDetailsSummary: "Mga teknikal nga detalye sa basehan",
    metricLabel: "Sukdanan",
    baselineYearsLabel: "Mga Tuig sa Basehan",
    estimatedYearsLabel: "Gibanabanang mga Tuig",
    approxLabel: "Gibanabana sa Grid",
    yes: "Oo",
    no: "Dili",
    coverageLabel: "Sakop sa Datos",
    statusPostures: {
      unusually_high: "Labihan ka Taas",
      above_baseline: "Labaw sa Normal",
      near_baseline: "Duol sa Normal",
      below_baseline: "Ubos sa Normal",
      not_calculable: "Kulang ang Basehan",
    },
    formatPostureSummary: (label, regionName, periodLabel) => {
      switch (label) {
        case "unusually_high":
          return `Mas taas kaayo ang ihap sa ${regionName} (${periodLabel}) kon itandi sa nangaging mga susamang buwan. Unaha ang pagpasusi sa field.`;
        case "above_baseline":
          return `Labaw sa kasarangang ihap ang ${regionName} (${periodLabel}). Padayuna ang aktibong koordinasyon sa mga barangay.`;
        case "near_baseline":
          return `Duol ra sa kasagarang lebel sa panahon ang ${regionName} (${periodLabel}).`;
        case "below_baseline":
          return `Mas ubos ang aktibidad sa ${regionName} (${periodLabel}) kon itandi sa kasagarang lebel niining buwana.`;
        default:
          return `Kulang pa ang nangaging datos alang sa ${regionName} (${periodLabel}) aron makalkulo ang kompletong porsyento.`;
      }
    },
    overlapEyebrow: "PANAHON NGA NAGDUNGANG MGA SENSOR",
    overlapTitle: "Pagtandi sa Aktibidad sa MODIS ug VIIRS",
    yearlyTotals: "Tibuok Tuig",
    recent12Months: "Katapusang 12 ka Buwan",
    loadingOverlap: "Nagkarga sa timeline sa mga sensor…",
    overlapUnavailable: "Wala ma-load ang timeline sa mga sensor",
    noOverlapData: "Walay panahon nga nagdungan ang mga sensor niining rehiyona.",
    formatOverlapBarAria: (period, modis, viirs) =>
      `${period}: MODIS ${modis}, VIIRS ${viirs}`,
    harmonizationEyebrow: "PAGPANTAY SA DUHA KA SENSOR",
    harmonizationTitle: "Mga Sukdanan sa Kalibrasyon sa MODIS ug VIIRS",
    loadingHarmonization: "Nagkarga sa mga sukdanan sa kalibrasyon…",
    harmonizationUnavailable: "Wala ma-load ang mga sukdanan sa kalibrasyon",
    noHarmonizationData: "Walay magamit nga datos sa kalibrasyon alang niining gipili.",
    scalingFactorLabel: "Sukdanan sa Pagpantay (MODIS ngadto sa VIIRS)",
    overlapYearsLabel: "Mga Tuig sa Pagpantay",
    correlationLabel: "Pagkahiusa sa Datos (r)",
    errorLabel: "Sayop sa Kalibrasyon (MAPE)",
    formatEstimatedYearsNote: (yearsText) =>
      `Ang sayo nga mga tuig gibanabana gikan sa MODIS gamit ang kalibrasyon: ${yearsText}`,
    formatOverlapYearsSub: (firstYear, lastYear) => `${firstYear} – ${lastYear}`,
    yearsSuffix: "ka tuig",
    correlationSub: "Koneksyon sa mga ihap samtang nagdungan ang duha ka sensor",
    errorSub: "Kasarangang porsyento sa sayop sa mga tuig nga nagdungan",
  },
  exportPanel: {
    eyebrow: "FEATURE 05 · PAG-EXPORT OG DATOS",
    title: "I-download ang mga rekord para sa CDRRMO ug panukiduki",
    intro:
      "I-download ang detalyadong punto sa hotspot o ang buwanang natipong rekord nga motakdo sa imong gipiling mga filter.",
    regionScope: "Sakop nga Rehiyon",
    periodScope: "Piniling Panahon",
    metricScope: "Sukdanan",
    instrumentScope: "Sensor",
    harmonizedScopeValue: "Gipantay (Sukdanan sa VIIRS)",
    rawScopeValue: "Aktwal nga Ihap",
    activeFilters: "AKTIBONG MGA FILTER",
    rawCsvTitle: "Detalyadong mga Punto sa Hotspot",
    rawCsvDesc:
      "Mga koordinato sa satelayt, oras (UTC), kainiton, kusog sa radyasyon (FRP), ug detalye sa sensor.",
    rawCsvFormat: "POINT-LEVEL CSV",
    downloadHotspots: "I-download ang Hotspots CSV",
    preparingCsv: "Giandam ang CSV…",
    analyticsCsvTitle: "Buwanang Katingbanan sa Anomaliya",
    analyticsCsvDesc:
      "Mga gipantay nga buwanang ihap, medyan sa kasaysayan, label sa anomaliya, ug mga nota sa kalidad.",
    analyticsCsvFormat: "SUMMARY CSV",
    downloadSummary: "I-download ang Summary CSV",
    preparingSummary: "Giandam ang Summary…",
    columnsIncludedLabel: "Mga kolum nga nalakip",
    filenameLabel: "Ngalan sa file",
    formatDownloadedHotspots: (fileName) => `Na-download ang ${fileName}.`,
    formatDownloadedSummary: (fileName) => `Na-download ang ${fileName}.`,
    fallbackError: "Wala mahuman ang pag-download sa CSV.",
  },
  ai: {
    panelAria: "CDRRMO Advisory AI",
    title: "Tambag sa CDRRMO",
    closePanel: "Sirad-i ang panel sa tambag",
    tabAdvisory: "Tambag (Advisory)",
    tabWatchlist: "Mga Bantayan",
    postureBadges: {
      unusually_high: "KRITIKAL NGA BANTAY",
      above_baseline: "LABAW SA NORMAL",
      near_baseline: "DUOL SA NORMAL",
      below_baseline: "UBOS SA NORMAL",
      not_calculable: "AKTIBONG BANTAY",
    },
    hotspotsKpi: "Mga Hotspot",
    normalMedianKpi: "Normal nga Medyan",
    statusKpi: "Kahimtang",
    formatSensorSplit: (viirs, modis) => `VIIRS ${viirs} · MODIS ${modis}`,
    generateAdvisory: "Kuhaa ang Tambag sa CDRRMO",
    generating: "Naghimog tambag…",
    emptyAdvisoryPrompt:
      "Pindota ang Kuhaa ang Tambag sa CDRRMO aron makakuha og interpretasyon base sa datos ug giya sa koordinasyon sa BFP/barangay.",
    questionPrefix: "Pangutana:",
    summaryHeading: "Katingbanan",
    actionHeading: "Lihok sa CDRRMO",
    noteHeading: "Pahinumdom",
    defaultComputedFallback: "Tan-awa ang mga numero sa ibabaw.",
    defaultInterpretationFallback:
      "Ipadayon ang regular nga pag-monitor sa CDRRMO.",
    defaultLimitationsFallback:
      "Mga deteksyon sa init gikan sa satelayt lang kini ug dili kompirmadong sunog—ipakumpirma sa BFP o barangay responders.",
    followupSummary: "Pangutana og espesipikong detalye",
    suggestedQuestions: [
      "Unsay buot ipasabot niining buwanang ihap kon itandi sa kasagarang lebel alang sa atong CDRRMO?",
      "Unsaon nato pagsabot ang mga deteksyon sa VIIRS ug MODIS alang niining buwana?",
      "Unsang mga limitasyon sa datos ang angay natong i-apil sa report sa LGU?",
    ],
    questionSrLabel: "Pangutana para sa CDRRMO Advisory AI",
    questionPlaceholder: "Isulat ang imong pangutana diri (Bisaya/EN/FIL)…",
    loadingRegionAnalytics:
      "Nagkarga pa sa datos sa rehiyon sa dili pa makapangutana…",
    emptyQuestionHint:
      "Pag-type og pangutana sa ibabaw o pili og sugyot nga pangutana.",
    formatMaxLengthError: (maxLength) =>
      `Palihug himoang ubos sa ${maxLength} ka letra ang pangutana.`,
    askAdvisory: "Pangutana sa Advisory",
    errorFallback: "Wala ma-load ang interpretasyon sa AI.",
    invalidResponse: "Nagbalik og dili husto nga tubag ang AI.",
    watchlistHeading: "Mga Lugar nga Angay Bantayan",
    monitorBukidnon: "Tan-awa ang Bukidnon",
    bukidnonSectors: "Mga Sektor sa Bukidnon",
    provincesInFocus: "Mga Probinsya nga Gibantayan",
    corridors: {
      northern: {
        title: "Amihanang Bukidnon",
        subtitle: "Malaybalay · Impasugong · Manolo Fortich · Sumilao",
      },
      central: {
        title: "Sentral Bukidnon",
        subtitle: "Valencia · Maramag · Lantapan · Quezon",
      },
      southern: {
        title: "Habagatan ug Kasadpang Bukidnon",
        subtitle: "Don Carlos · Pangantucan · Talakag · Kitaotao",
      },
    },
    badges: {
      HIGH: "TAAS",
      MODERATE: "KASARANGAN",
      WATCH: "BANTAY",
    },
    formatHotspotCount: (count) =>
      `${count.toLocaleString("en-US")} ka hotspot`,
    viewButton: "Tan-awa",
    nationalFocusTitle: "Bukidnon (Panguna nga Tutok)",
    nationalFocusSub: "Panguna nga prayoridad sa CDRRMO · Ablihi ang mga sektor",
    activeCorridorSub: "Aktibong koridor para sa field verification",
    activeClusterSub: "Aktibong tapok sa hotspot niining panahona",
    monitoringFocusSub: "Lugar nga gibantayan sa CDRRMO",
    provinceWatchSub: "Punto sa koordinasyon sa probinsya",
    standbyFocusSub: "Lugar nga naka-standby sa pagbantay",
    defaultDisclaimer:
      "Tambag sa CDRRMO AI lamang. Ang mga deteksyon sa satelayt dili kompirmadong sunog, panagna, o mando sa pagbakwit.",
    localeHint: "Magamit sa Bisaya · Filipino · English",
  },
};

const FIL_TRANSLATIONS: DashboardTranslations = {
  language: "fil",
  languageSelector: {
    heading: "WIKA",
    ariaLabel: "Wika ng dashboard at Advisory AI",
  },
  nav: {
    menuLabel: "MENU",
    brandCaption: "Operasyon ng CDRRMO",
    openNavigation: "Buksan ang menu ng nabigasyon",
    closeNavigation: "Isara ang menu ng nabigasyon",
    map: "Mapa",
    calendar: "Kalendaryo",
    anomaly: "Pagsusuri ng Anomalya",
    export: "Pag-export ng CSV",
  },
  shell: {
    skipToContent: "Laktawan patungo sa nilalaman",
    simulatedNotice: "Nagpapakita ng simulated na datos",
    filterBarAria: "Mga filter ng dashboard",
    regionLabel: "Rehiyon",
    monthLabel: "Buwan",
    metricLabel: "Sukatan",
    sensorLabel: "Sensor",
    loadingRegions: "Nilo-load ang mga rehiyon…",
    regionsUnavailable: "Hindi magagamit ang listahan ng rehiyon",
    customAreaGridApprox: "Ginuhit na lugar · tinataya sa grid",
    harmonizedOption: "Pinantay (Sukatan ng VIIRS)",
    rawOption: "Aktwal",
    allInstrumentsOption: "Lahat ng sensor",
    summaryCard: {
      region: "Rehiyon",
      period: "Panahon",
      activeCellDays: "Aktibong cell-days",
      detections: "Mga Deteksyon",
      coverage: "Saklaw ng datos",
      lastUpdated: "Huling update",
      approxBadge: "Tinataya",
      estimatedSuffix: "taya",
      notAvailable: "Walang datos",
      awaitingWindow: "Naghihintay ng petsa",
      noSavedDetections: "Walang nakitang deteksyon",
      dateRangeTo: "hanggang",
      filters: "Mga Filter",
      drawArea: "Gumuhit",
      finishDraw: "Gumuguhit… i-click at i-drag",
      cancelDraw: "Kanselahin",
      advisoryAi: "Abiso ng AI",
      darkMode: "Madilim na Tema",
      warmWhite: "Maliwanag na Tema",
      backToMap: "← Mapa",
    },
    mapFilterPopover: {
      title: "Mga filter sa mapa",
      closeFilters: "Isara ang mga filter",
      helpText:
        "Ina-update ng mga kontrol na ito ang mapa, kalendaryo, tsart, at mga CSV export.",
      resetFilters: "I-reset",
      metricDescHarmonized:
        "Pinantay na buwanang aktibong cell-days sa sukatan ng VIIRS.",
      metricDescRaw: "Direktang bilang mula sa MODIS / VIIRS nang walang kalibrasyon.",
    },
    mapShell: {
      sidebarAria: "Sidebar ng dashboard",
      homeAria: "Home ng FIRE MEMORY",
      navSectionsAria: "Mga seksyon ng dashboard",
      mapWorkspaceAria: "Mapa ng init sa satelayt",
      mapPageHeadingSr: "Dashboard ng aktibidad sa satelayt",
      mapSummaryAria: "Buod ng aktibidad sa napiling buwan",
      updatedPrefix: "Na-update",
      chooseRegion: "Piliin ang rehiyon",
      openAdvisoryAi: "Buksan ang Abiso ng AI",
      selectedMonthFallback: "Napiling buwan",
      selectedAreaFallback: "Napiling lugar",
      selectRegionShort: "Piliin ang rehiyon",
      filterChipFallback: "Filter",
      harmonizedChipShort: "Pinantay",
      rawChipShort: "Aktwal",
      compactDark: "Madilim",
      compactWarm: "Maliwanag",
      regionHelpLoading: "Nilo-load ang mga magagamit na rehiyon.",
      regionHelpDefault: "Pumili ng pambansa, lalawigan, o ginuhit na lugar.",
      monthHelp: "Pumili ng buwan sa kalendaryo sa UTC.",
      liveFirmsPeriodLegend: "Live na panahon ng FIRMS",
      liveFirmsHelp: "Pumili ng kasalukuyang saklaw ng datos para sa mapa.",
      harmonizedShort: "Pinantay",
      rawShort: "Aktwal",
      harmonizedHelp: "Ang Pinantay ang default na pagtingin.",
      sensorHelpRaw: "Kasama sa Lahat ang MODIS at VIIRS.",
      sensorHelpDisabled: "Magagamit lamang kapag aktwal na bilang ang tinitingnan.",
    },
    mapCards: {
      formatTotalHotspots: (monthLabel) => `Kabuuang Hotspot ng Apoy (${monthLabel})`,
      combinedHeatDetections: "Pinagsamang deteksyon ng init sa satelayt",
      verifyWithBfp: "Deteksyon ng init sa satelayt • Beripikahin sa lugar kasama ang BFP",
      smallAreaSensor: "Detalyadong Sensor (VIIRS 375m)",
      smallAreaDetail: "Mataas ang detalye • Nakakahuli ng maliliit na sunog sa damuhan at bukid",
      wideAreaSensor: "Malawak na Sensor (MODIS 1km)",
      wideAreaDetail: "Pangmatagalang sensor • 20+ taon ng makasaysayang arkibo",
      cellDayUnitNote: "Bawat bilang = 1 aktibong grid area bawat araw",
      formatTypicalBaseline: (monthLabel) => `Karaniwang Batayan sa ${monthLabel} (Median)`,
      formatNormalLevel: (monthLabel, detail) => `Normal na antas para sa ${monthLabel} (${detail})`,
      medianFootnote: "Gitnang halaga ng mga nakaraang taon para sa parehong buwan",
      comparisonLabel: "Paghahambing sa Karaniwang Buwan",
      livePeriodValue: "Live na Panahon",
      cdrrmoNonPredictive: "Suporta sa Desisyon ng CDRRMO • Hindi Panghula",
      formatBaselineYears: (count, startYear, endYear) => `${count} taon (${startYear}-${endYear})`,
      noComparableBaseline: "Walang maihahambing na baseline",
      liveLoading: "Nilo-load...",
      liveNoData: "Walang datos",
      anomalyStatus: {
        live: "Live na Window Kasalukuyang Gumagana",
        unusually_high: "Lubhang Mataas — Beripikahin ang Lugar",
        above_baseline: "Higit sa Normal — Bantayang Mabuti",
        near_baseline: "Normal para sa Buwang Ito",
        below_baseline: "Mas Mababa sa Normal na Aktibidad",
        loading: "Nilo-load ang baseline",
        unavailable: "Walang Magagamit na Baseline",
      },
    },
    customArea: {
      activeSuffix: " · aktibo",
      optionalSuffix: " · opsyonal",
      description:
        "Ilagay ang mga hangganan ng longitude at latitude o gumuhit ng parihaba sa mapa. Dapat itong magkasya sa loob ng hangganan ng Pilipinas.",
      westLon: "West longitude",
      southLat: "South latitude",
      eastLon: "East longitude",
      northLat: "North latitude",
      useCustomArea: "Gamitin ang ginuhit na lugar",
      drawRectangle: "Gumuhit ng parihaba sa mapa",
      cancelDrawing: "Kanselahin ang pagguhit",
      enterAllCoords: "Ilagay ang lahat ng apat na halaga ng longitude at latitude.",
      invalidCoords: "Maglagay ng wastong mga coordinate kung saan west < east at south < north.",
      boundsUnavailable: "Hindi magagamit ang mga hangganan ng Pilipinas; hindi masuri ang lugar.",
      boundsOutsidePh: "Dapat magkasya ang ginuhit na lugar sa loob ng hangganan ng Pilipinas.",
      formatActiveArea: (name, boundsText) =>
        `Aktibong lugar: ${name} · mga hangganan ${boundsText} · tinataya sa grid`,
    },
    errors: {
      title: "Hindi na-load ang ilang datos ng dashboard",
      retry: "Subukan muli",
    },
    exportUnavailable: {
      eyebrow: "FEATURE 05 · PAG-EXPORT NG DATOS",
      title: "I-export ang datos",
      description: "Pumili muna ng rehiyon at buwan upang paganahin ang pag-export.",
    },
    footer: {
      compact: "FIRE MEMORY · NASA FIRMS MODIS & VIIRS Arkibo (UTC)",
    },
  },
  map: {
    regionLabel: "Rehiyon:",
    regionAria: "Pagpili ng rehiyon sa mapa",
    loadingMap: "Nilo-load ang mapa…",
    mapUnavailable: "Hindi magagamit ang interactive na mapa",
    retry: "Subukan muli",
    loadingHotspots: "Nilo-load ang mga hotspot…",
    hotspotErrorTitle: "Hindi na-load ang mga punto ng hotspot",
    drawAreaBanner:
      "I-click at i-drag sa mapa upang gumuhit ng sariling hangganan.",
    noDetectionsTitle: "Walang deteksyon ng satelayt sa lugar at buwang ito",
    noDetectionsBody:
      "Maaaring maapektuhan ng ulap, usok, o oras ng pagdaan ng satelayt ang pagkuha ng datos.",
    gridApproxBanner:
      "Tinataya sa grid ang mga bilang para sa ginuhit na lugar na ito.",
    coverageGapTitle: "Limitasyon sa saklaw",
    formatCoverageGap: (expectedCount, actualCount, regionName) =>
      `Ang buwanang aktibong cell-days ay ${expectedCount.toLocaleString("en-US")}, habang ${actualCount.toLocaleString("en-US")} na punto ang naitala sa ${regionName} ngayong buwan. Maaaring may kulang sa nakaimbak na mga punto.`,
    intensityTitle: "Antas ng Tindi ng Hotspot",
    intensityBands: {
      low: "Mababa",
      moderate: "Katamtaman",
      high: "Mataas",
      "very-high": "Lubhang Mataas",
    },
    popup: {
      thermalDetection: "Deteksyon ng Init mula sa Satelayt",
      latitude: "Latitud",
      longitude: "Longitud",
      satellite: "Satelayt",
      instrument: "Sensor",
      acquisitionTimeUtc: "Oras ng pagkuha (UTC)",
      sensorResolution: "Detalye ng Sensor",
      confidence: "Kompiyansa",
      brightnessTemp: "Temperatura / Lakas ng Init",
      sourceProduct: "Pinagmulang produkto",
      notAvailable: "Walang datos",
      viirsGrid: "375 m grid (VIIRS detalyado)",
      modisGrid: "1 km grid (MODIS malawak na sakop)",
      formatFootprintTooltip: (instrument, radius) =>
        `Sakop ng sensor ng ${instrument} (~${radius} m radius — lawak ng scan, hindi kumpirmadong hangganan ng sunog)`,
      provinceSummarySuffix: "Buod sa Lalawigan",
      thermalHotspotDetections: "Mga Deteksyon ng Hotspot",
      relativeActivityLevel: "Antas ng Aktibidad",
      markerPlacement: "Lokasyon ng Marka",
      markerPlacementValue: "Tinatayang gitna ng hangganan ng lalawigan",
      cdrrmoDrillDown: "Pagsusuri ng CDRRMO",
      cdrrmoDrillDownValue: "I-click ang bilog upang suriin ang lalawigan",
      noData: "Walang datos",
      detectionsCount: (count) => `${count.toLocaleString("en-US")} na deteksyon`,
      selectProvinceAria: (name, countLabel) =>
        `${name}: ${countLabel}. Piliin ang lalawigan.`,
      activityBands: {
        "very-high": "Lubhang mataas na aktibidad",
        high: "Mataas na aktibidad",
        moderate: "Katamtamang aktibidad",
        low: "Mababang aktibidad",
        "no-data": "Walang saklaw na datos",
      },
    },
  },
  calendar: {
    eyebrow: "KASAYSAYANG MATRIKS NG AKTIBIDAD",
    title: "Buwanang Kalendaryo ng Aktibidad",
    statusLoading: "Nilo-load ang kalendaryo…",
    statusUnavailable: "Hindi magagamit ang kalendaryo",
    statusEmpty: "Walang datos sa kalendaryo para sa napiling ito.",
    statusEstimated: "E = Tinataya mula sa MODIS",
    statusMetricPrefix: "Sukatan:",
    legendEstimated: "Tinataya",
    legendNoData: "Walang datos",
    legendLess: "Mas Kaunti",
    legendMore: "Mas Marami",
    railTitleEmpty: "Detalye ng Buwan",
    railSelectHint: "Pumili ng kahit anong buwan sa talahanayan upang makita ang mga bilang.",
    recordedData: "Naitalang Datos",
    estimatedFromModis: "Tinataya mula sa MODIS",
    noData: "Walang datos",
    vsSameMonthMedian: "kumpara sa medyan ng parehong buwan",
    anomalyVsSameMonth: "Anomalya sa parehong buwan",
    clickToViewMap: "I-click upang tingnan sa mapa",
    viewOnMap: "Tingnan sa Mapa →",
    sameMonthYearOverYear: "Parehong Buwan Taon-taon",
    formatGridAria: (regionName) =>
      `Buwanang kalendaryo ng aktibidad sa satelayt para sa ${regionName}`,
    formatCellAria: (monthName, year, valueText, estimatedText) =>
      `${monthName} ${year}: ${valueText} na aktibong cell-days${estimatedText}`,
    labels: {
      below_baseline: "Mas Mababa sa Normal",
      near_baseline: "Malapit sa Normal",
      above_baseline: "Higit sa Normal",
      unusually_high: "Lubhang Mataas",
      not_calculable: "Hindi Makalkula",
    },
  },
  analytics: {
    anomalyEyebrow: "PAGSUSURI NG ANOMALYA",
    anomalyTitle: "Paghahambing sa Batayang Kasaysayan",
    loadingComparison: "Nilo-load ang paghahambing…",
    comparisonUnavailable: "Hindi magagamit ang paghahambing",
    emptyTitle: "Walang batayang datos sa kasaysayan",
    emptyBody:
      "Pumili ng rehiyong may kahit isang buong taon ng rekord upang makita ang paghahambing.",
    selectedActivity: "Napiling Aktibidad",
    sameMonthMedian: "Medyan ng Parehong Buwan",
    anomalyDelta: "Pagkakaiba (Delta)",
    sensorMix: "Paghahati ng Sensor",
    viirsLabel: "VIIRS",
    modisLabel: "MODIS",
    noHistoricalBaseline: "Walang batayan sa kasaysayan",
    medianLabel: "Medyan",
    actualData: "Aktwal na Datos",
    estimatedData: "Tinatayang Datos",
    selectedMonthLegend: "Napiling Buwan",
    historicalMedianLegend: "Medyan sa Kasaysayan",
    formatYoyChartTitle: (monthName) =>
      `${monthName} — Paghahambing Taon-taon sa Kasaysayan`,
    formatBarAria: (year, count, estText) =>
      `${year}: ${count.toLocaleString("en-US")} na deteksyon${estText}`,
    technicalDetailsSummary: "Mga teknikal na detalye ng batayan",
    metricLabel: "Sukatan",
    baselineYearsLabel: "Mga Taon ng Batayan",
    estimatedYearsLabel: "Mga Tinatayang Taon",
    approxLabel: "Tinataya sa Grid",
    yes: "Oo",
    no: "Hindi",
    coverageLabel: "Saklaw ng Datos",
    statusPostures: {
      unusually_high: "Lubhang Mataas",
      above_baseline: "Higit sa Normal",
      near_baseline: "Malapit sa Normal",
      below_baseline: "Mas Mababa sa Normal",
      not_calculable: "Kulang ang Batayan",
    },
    formatPostureSummary: (label, regionName, periodLabel) => {
      switch (label) {
        case "unusually_high":
          return `Lubhang mataas ang aktibidad sa ${regionName} (${periodLabel}) kumpara sa mga nakaraang parehong buwan. Unahin ang beripikasyon sa field.`;
        case "above_baseline":
          return `Mas mataas sa karaniwan ang ${regionName} (${periodLabel}). Panatilihin ang aktibong koordinasyon sa mga barangay.`;
        case "near_baseline":
          return `Malapit sa karaniwang lebel ng panahon ang ${regionName} (${periodLabel}).`;
        case "below_baseline":
          return `Mas mababa ang aktibidad sa ${regionName} (${periodLabel}) kumpara sa karaniwang lebel para sa buwang ito.`;
        default:
          return `Kulang pa ang nakaraang datos sa ${regionName} (${periodLabel}) upang makalkula ang buong porsyento.`;
      }
    },
    overlapEyebrow: "PANAHON NG MAGKASABAY NA SENSOR",
    overlapTitle: "Paghahambing ng Aktibidad ng MODIS at VIIRS",
    yearlyTotals: "Taunang Kabuuan",
    recent12Months: "Nakaraang 12 Buwan",
    loadingOverlap: "Nilo-load ang timeline ng mga sensor…",
    overlapUnavailable: "Hindi magagamit ang timeline ng mga sensor",
    noOverlapData: "Walang panahong magkasabay ang mga sensor sa rehiyong ito.",
    formatOverlapBarAria: (period, modis, viirs) =>
      `${period}: MODIS ${modis}, VIIRS ${viirs}`,
    harmonizationEyebrow: "PAGPAPANTAY NG DALAWANG SENSOR",
    harmonizationTitle: "Mga Sukatan ng Kalibrasyon ng MODIS at VIIRS",
    loadingHarmonization: "Nilo-load ang mga sukatan ng kalibrasyon…",
    harmonizationUnavailable: "Hindi magagamit ang mga sukatan ng kalibrasyon",
    noHarmonizationData: "Walang magagamit na datos ng kalibrasyon para sa napiling ito.",
    scalingFactorLabel: "Sukatan ng Pagpapantay (MODIS patungong VIIRS)",
    overlapYearsLabel: "Mga Taon ng Kalibrasyon",
    correlationLabel: "Pagkakatugma ng Datos (r)",
    errorLabel: "Antas ng Error (MAPE)",
    formatEstimatedYearsNote: (yearsText) =>
      `Ang mga naunang taon ay tinataya mula sa MODIS gamit ang kalibrasyon: ${yearsText}`,
    formatOverlapYearsSub: (firstYear, lastYear) => `${firstYear} – ${lastYear}`,
    yearsSuffix: "taon",
    correlationSub: "Korelasyon sa mga panahong magkasabay ang dalawang sensor",
    errorSub: "Karaniwang porsyento ng error sa mga panahong magkasabay",
  },
  exportPanel: {
    eyebrow: "FEATURE 05 · PAG-EXPORT NG DATOS",
    title: "I-download ang mga dataset para sa CDRRMO at pananaliksik",
    intro:
      "I-download ang mga detalyadong punto ng hotspot o ang buwanang naitalang buod ayon sa iyong napiling mga filter.",
    regionScope: "Sakop na Rehiyon",
    periodScope: "Piniling Panahon",
    metricScope: "Sukatan",
    instrumentScope: "Sensor",
    harmonizedScopeValue: "Pinantay (Sukatan ng VIIRS)",
    rawScopeValue: "Aktwal na Bilang",
    activeFilters: "MGA AKTIBONG FILTER",
    rawCsvTitle: "Detalyadong mga Punto ng Hotspot",
    rawCsvDesc:
      "Mga koordinato ng satelayt, oras (UTC), temperatura, lakas ng radyasyon (FRP), at metadata ng sensor.",
    rawCsvFormat: "POINT-LEVEL CSV",
    downloadHotspots: "I-download ang Hotspots CSV",
    preparingCsv: "Inihahanda ang CSV…",
    analyticsCsvTitle: "Pinantay na Buod ng Analitika",
    analyticsCsvDesc:
      "Mga pinantay na buwanang bilang, medyan sa kasaysayan, label ng anomalya, at mga tala sa kalidad.",
    analyticsCsvFormat: "SUMMARY CSV",
    downloadSummary: "I-download ang Summary CSV",
    preparingSummary: "Inihahanda ang Summary…",
    columnsIncludedLabel: "Mga kolum na kasama",
    filenameLabel: "Pangalan ng file",
    formatDownloadedHotspots: (fileName) => `Na-download ang ${fileName}.`,
    formatDownloadedSummary: (fileName) => `Na-download ang ${fileName}.`,
    fallbackError: "Hindi nakumpleto ang pag-download ng CSV.",
  },
  ai: {
    panelAria: "CDRRMO Advisory AI",
    title: "Abiso ng CDRRMO",
    closePanel: "Isara ang panel ng abiso",
    tabAdvisory: "Abiso",
    tabWatchlist: "Mga Babantayan",
    postureBadges: {
      unusually_high: "KRITIKAL NA BANTAY",
      above_baseline: "HIGIT SA NORMAL",
      near_baseline: "MALAPIT SA NORMAL",
      below_baseline: "MABABA SA NORMAL",
      not_calculable: "AKTIBONG BANTAY",
    },
    hotspotsKpi: "Mga Hotspot",
    normalMedianKpi: "Normal na Medyan",
    statusKpi: "Katayuan",
    formatSensorSplit: (viirs, modis) => `VIIRS ${viirs} · MODIS ${modis}`,
    generateAdvisory: "Kunin ang Abiso ng CDRRMO",
    generating: "Bumubuo ng abiso…",
    emptyAdvisoryPrompt:
      "I-click ang Kunin ang Abiso ng CDRRMO para sa interpretasyong nakabatay sa datos at gabay sa pagberipika ng BFP/barangay.",
    questionPrefix: "Tanong:",
    summaryHeading: "Buod",
    actionHeading: "Aksyon ng CDRRMO",
    noteHeading: "Paalala",
    defaultComputedFallback: "Tingnan ang mga sukatan sa itaas.",
    defaultInterpretationFallback:
      "Panatilihin ang karaniwang pagbabantay ng CDRRMO.",
    defaultLimitationsFallback:
      "Mga deteksyon ng init mula sa satelayt lamang ito at hindi kumpirmadong sunog—ipaberipika sa BFP o barangay responders.",
    followupSummary: "Magtanong ng partikular na detalye",
    suggestedQuestions: [
      "Ano ang ibig sabihin ng bilang ngayong buwan kumpara sa karaniwang medyan para sa aming CDRRMO?",
      "Paano namin dapat unawain ang mga deteksyon ng VIIRS at MODIS para sa buwang ito?",
      "Anong mga limitasyon sa datos ang dapat naming ilagay sa ulat ng LGU?",
    ],
    questionSrLabel: "Tanong para sa CDRRMO Advisory AI",
    questionPlaceholder: "Magtanong para sa CDRRMO (Filipino/Bisaya/EN)…",
    loadingRegionAnalytics:
      "Nilo-load pa ang datos ng rehiyon bago makapagtanong…",
    emptyQuestionHint:
      "Mag-type ng tanong sa itaas o pumili sa mga mungkahing tanong.",
    formatMaxLengthError: (maxLength) =>
      `Panatilihing mas maikli sa ${maxLength} na karakter ang tanong.`,
    askAdvisory: "Magtanong sa Advisory",
    errorFallback: "Hindi na-load ang interpretasyon ng AI.",
    invalidResponse: "Nagbalik ng hindi wastong sagot ang AI.",
    watchlistHeading: "Mga Lugar na Dapat Tutukan",
    monitorBukidnon: "Suriin ang Bukidnon",
    bukidnonSectors: "Mga Sektor ng Bukidnon",
    provincesInFocus: "Mga Lalawigang Binabantayan",
    corridors: {
      northern: {
        title: "Hilagang Bukidnon",
        subtitle: "Malaybalay · Impasugong · Manolo Fortich · Sumilao",
      },
      central: {
        title: "Gitnang Bukidnon",
        subtitle: "Valencia · Maramag · Lantapan · Quezon",
      },
      southern: {
        title: "Timog at Kanlurang Bukidnon",
        subtitle: "Don Carlos · Pangantucan · Talakag · Kitaotao",
      },
    },
    badges: {
      HIGH: "MATAAS",
      MODERATE: "KATAMTAMAN",
      WATCH: "BANTAY",
    },
    formatHotspotCount: (count) =>
      `${count.toLocaleString("en-US")} na hotspot`,
    viewButton: "Tingnan",
    nationalFocusTitle: "Bukidnon (Pangunahing Tutok)",
    nationalFocusSub: "Pangunahing prayoridad ng CDRRMO · Buksan ang mga sektor",
    activeCorridorSub: "Aktibong koridor para sa field verification",
    activeClusterSub: "Aktibong kumpol ng hotspot sa panahong ito",
    monitoringFocusSub: "Lugar na binabantayan ng CDRRMO",
    provinceWatchSub: "Punto ng koordinasyon sa lalawigan",
    standbyFocusSub: "Lugar na naka-standby sa pagbabantay",
    defaultDisclaimer:
      "Interpretasyon ng CDRRMO Advisory AI lamang. Ang mga deteksyon ng satelayt ay hindi kumpirmadong sunog, hula, o utos sa paglikas.",
    localeHint: "Magagamit sa Filipino · Bisaya · English",
  },
};

const TRANSLATIONS_BY_LANGUAGE: Record<AppLanguage, DashboardTranslations> = {
  en: EN_TRANSLATIONS,
  ceb: CEB_TRANSLATIONS,
  fil: FIL_TRANSLATIONS,
};

export function getTranslations(language: AppLanguage): DashboardTranslations {
  return TRANSLATIONS_BY_LANGUAGE[language] ?? EN_TRANSLATIONS;
}
