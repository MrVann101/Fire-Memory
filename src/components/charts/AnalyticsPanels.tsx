"use client";

import { useState } from "react";
import type {
  AnalyticsSummary,
  AnomalyLabel,
  CalendarResponse,
  HarmonizationResponse,
  OverlapPoint,
} from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";
import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
import {
  getMonthName,
  getTranslations,
  type AppLanguage,
} from "@/lib/i18n/translations";

export interface LiveCountsSnapshot {
  viirs: number;
  modis: number;
  harmonized: number;
}

type HistoryBand =
  | "below_baseline"
  | "near_baseline"
  | "above_baseline"
  | "unusually_high";

interface HistoryBarPoint {
  key: string;
  label: string;
  year: number;
  count: number;
  estimated: boolean;
  isSelected: boolean;
  isLive: boolean;
  isMedianBenchmark?: boolean;
  band: HistoryBand;
}

const ANOMALY_META: Record<
  AnomalyLabel,
  {
    icon: string;
    postureByLang: Record<AppLanguage, string>;
  }
> = {
  below_baseline: {
    icon: "↓",
    postureByLang: {
      en: "ROUTINE MONITORING",
      ceb: "REGULAR NGA PAGBANTAY",
      fil: "KARANIWANG PAGBABANTAY",
    },
  },
  near_baseline: {
    icon: "≈",
    postureByLang: {
      en: "STANDARD WATCH",
      ceb: "NORMAL NGA BANTAY",
      fil: "STANDARD NA BANTAY",
    },
  },
  above_baseline: {
    icon: "↑",
    postureByLang: {
      en: "ELEVATED CDRRMO WATCH",
      ceb: "TAAS NGA BANTAY SA CDRRMO",
      fil: "PINATAAS NA BANTAY NG CDRRMO",
    },
  },
  unusually_high: {
    icon: "!",
    postureByLang: {
      en: "PRIORITY GROUND VERIFICATION",
      ceb: "UNAHONG PAGPASUSI SA FIELD",
      fil: "PRAYORIDAD NA BERIPIKASYON SA LUPA",
    },
  },
  not_calculable: {
    icon: "—",
    postureByLang: {
      en: "DATA COVERAGE CHECK",
      ceb: "PAG-SUSI SA SAKOP SA DATOS",
      fil: "PAGSUSURI NG SAKLAW NG DATOS",
    },
  },
};

function getAnomalyPresentation(label: AnomalyLabel, language: AppLanguage) {
  const t = getTranslations(language);
  const meta = ANOMALY_META[label] ?? ANOMALY_META.not_calculable;
  const advisory =
    label === "unusually_high"
      ? language === "ceb"
        ? "Makig-coordinate sa BFP ug Barangay DRRMC aron susihon sa field ang mga nagtapok nga hotspot ug susihon ang kahandaan sa LGU."
        : language === "fil"
          ? "Makipag-ugnayan sa BFP at Barangay DRRMC upang beripikahin sa lupa ang mga kumpol ng hotspot at suriin ang kahandaan ng LGU."
          : "Coordinate with BFP and Barangay DRRMCs to verify persistent hotspot clusters on the ground and review local preparedness posture."
      : label === "above_baseline"
        ? language === "ceb"
          ? "Dugangi ang pagbantay sa mga nagbalik-balik nga init sa satelayt ug itandi sa mga report gikan sa field."
          : language === "fil"
            ? "Dagdagan ang pagbabantay sa mga paulit-ulit na deteksyon ng init at itugma sa mga ulat mula sa komunidad."
            : "Increase monitoring frequency for recurring thermal detections and cross-check with local field reports."
        : label === "not_calculable"
          ? language === "ceb"
            ? "Walay saktong medyan sa kasaysayan o zero kini; susiha direkta ang mga ihap sa sensor ug sakop sa datos."
            : language === "fil"
              ? "Walang magagamit o zero ang medyan sa kasaysayan; direktang suriin ang mga deteksyon ng sensor at saklaw ng datos."
              : "Historical median is zero or unavailable; review raw sensor detections directly and verify local coverage."
          : language === "ceb"
            ? "Ipadayon ang naandang pagbantay sa panahon ug regular nga koordinasyon sa mga barangay."
            : language === "fil"
              ? "Panatilihin ang karaniwang pagbabantay sa panahon at regular na pag-uulat ng mga barangay."
              : "Maintain standard seasonal fire monitoring and routine barangay reporting.";

  return {
    icon: meta.icon,
    label: t.analytics.statusPostures[label],
    posture: meta.postureByLang[language],
    advisory,
  };
}

function formatCount(value: number | null, noDataLabel = "No data"): string {
  return value === null ? noDataLabel : value.toLocaleString("en-US");
}

function formatYears(years: number[]): string {
  return years.length > 0 ? years.join(", ") : "None";
}

function formatMetric(value: number | null, suffix = ""): string {
  return value === null
    ? "Not available"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}${suffix}`;
}

function formatPeriodMonth(
  year: number,
  month: number,
  language: AppLanguage = "en"
): string {
  const monthName = getMonthName(month, language);
  return `${monthName} ${year}`;
}

function getCurrentMeterColor(label: AnomalyLabel): string {
  switch (label) {
    case "unusually_high":
      return "var(--hotspot-very-high, #ef4444)";
    case "above_baseline":
      return "var(--hotspot-high, #ea580c)";
    case "near_baseline":
      return "var(--hotspot-moderate, #14b8a6)";
    case "below_baseline":
      return "var(--hotspot-low, #fb923c)";
    case "not_calculable":
      return "var(--hotspot-moderate, #14b8a6)";
  }
}

function classifyHistoryBand(
  count: number,
  historicalMedian: number | null
): HistoryBand {
  if (historicalMedian === null || historicalMedian <= 0) {
    return "near_baseline";
  }
  const pct = ((count - historicalMedian) / historicalMedian) * 100;
  if (pct <= -25) {
    return "below_baseline";
  }
  if (pct <= 25) {
    return "near_baseline";
  }
  if (pct <= 75) {
    return "above_baseline";
  }
  return "unusually_high";
}

function getHistoryBandColor(band: HistoryBand): string {
  switch (band) {
    case "below_baseline":
      return "#fb923c";
    case "near_baseline":
      return "#14b8a6";
    case "above_baseline":
      return "#ea580c";
    case "unusually_high":
      return "#ef4444";
  }
}

function buildSameMonthHistoryBars(
  summary: AnalyticsSummary,
  calendar: CalendarResponse | null,
  effectiveCurrentCount: number | null,
  isLiveFallback: boolean
): HistoryBarPoint[] {
  const targetMonth = summary.period.month;
  const median = summary.historicalMedian;
  const byYear = new Map<
    number,
    {
      year: number;
      count: number;
      estimated: boolean;
      isSelected: boolean;
      isLive: boolean;
    }
  >();

  if (calendar?.cells) {
    for (const cell of calendar.cells) {
      if (cell.month === targetMonth && cell.count !== null) {
        byYear.set(cell.year, {
          year: cell.year,
          count: cell.count,
          estimated: cell.estimated,
          isSelected: cell.year === summary.period.year,
          isLive: false,
        });
      }
    }
  }

  if (
    effectiveCurrentCount !== null &&
    !byYear.has(summary.period.year)
  ) {
    byYear.set(summary.period.year, {
      year: summary.period.year,
      count: effectiveCurrentCount,
      estimated: summary.currentIsEstimated,
      isSelected: true,
      isLive: isLiveFallback,
    });
  }

  const realBars: HistoryBarPoint[] = Array.from(byYear.values())
    .sort((a, b) => a.year - b.year)
    .map((item) => ({
      ...item,
      key: String(item.year),
      label: `${item.year}${item.isSelected ? " ★" : item.estimated ? "*" : ""}`,
      band: classifyHistoryBand(item.count, median),
    }));

  if (realBars.length < 2 && median !== null) {
    if (
      realBars.length === 0 &&
      effectiveCurrentCount !== null
    ) {
      realBars.push({
        key: String(summary.period.year),
        label: `${summary.period.year} ★`,
        year: summary.period.year,
        count: effectiveCurrentCount,
        estimated: summary.currentIsEstimated,
        isSelected: true,
        isLive: isLiveFallback,
        band: classifyHistoryBand(effectiveCurrentCount, median),
      });
    }

    realBars.push({
      key: "median-benchmark",
      label: "Typical Median",
      year: summary.period.year,
      count: median,
      estimated: false,
      isSelected: false,
      isLive: false,
      isMedianBenchmark: true,
      band: "near_baseline",
    });
  }

  return realBars;
}

export function AnomalyPanel({
  resource,
  calendar = null,
  liveCounts = null,
}: {
  resource: ClientResource<AnalyticsSummary>;
  calendar?: CalendarResponse | null;
  liveCounts?: LiveCountsSnapshot | null;
}) {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  const summary = resource.data;
  const anomaly = summary ? getAnomalyPresentation(summary.label, language) : null;
  const title = resource.isLoading
    ? t.analytics.loadingComparison
    : resource.error
      ? t.analytics.comparisonUnavailable
      : anomaly?.label ?? t.analytics.emptyTitle;

  const loadingText =
    language === "ceb"
      ? "Nagkarga…"
      : language === "fil"
        ? "Nilo-load…"
        : "Loading…";
  const unavailableText =
    language === "ceb"
      ? "Dili magamit"
      : language === "fil"
        ? "Hindi magagamit"
        : "Unavailable";
  const notAvailableText =
    language === "ceb"
      ? "Walay datos"
      : language === "fil"
        ? "Walang datos"
        : "Not available";

  const isLiveFallback =
    summary !== null &&
    summary !== undefined &&
    summary.currentCount === null &&
    liveCounts !== null;

  const effectiveCurrentCount: number | null = summary
    ? summary.currentCount !== null && summary.currentCount !== undefined
      ? summary.currentCount
      : liveCounts !== null
        ? summary.metric === "raw"
          ? summary.instrument === "MODIS"
            ? liveCounts.modis
            : summary.instrument === "VIIRS"
              ? liveCounts.viirs
              : liveCounts.viirs + liveCounts.modis
          : liveCounts.harmonized
        : null
    : null;

  const historicalMedian = summary?.historicalMedian ?? null;
  const meterMax = Math.max(effectiveCurrentCount ?? 0, historicalMedian ?? 0, 1);
  const currentBarPercent =
    effectiveCurrentCount !== null && effectiveCurrentCount > 0
      ? Math.min(
          100,
          Math.max(4, Math.round((effectiveCurrentCount / meterMax) * 100))
        )
      : 0;
  const baselineBarPercent =
    historicalMedian !== null && historicalMedian > 0
      ? Math.min(
          100,
          Math.max(4, Math.round((historicalMedian / meterMax) * 100))
        )
      : 0;

  const periodLabel = summary
    ? formatPeriodMonth(summary.period.year, summary.period.month, language)
    : null;
  const monthOnlyLabel = summary
    ? getMonthName(summary.period.month, language)
    : t.analytics.selectedMonthLegend;

  const effectiveAnomalyPercentValue =
    summary &&
    summary.anomalyPercent === null &&
    effectiveCurrentCount !== null &&
    historicalMedian !== null &&
    historicalMedian > 0
      ? ((effectiveCurrentCount - historicalMedian) / historicalMedian) * 100
      : summary?.anomalyPercent ?? null;

  const anomalyPercent = summary
    ? effectiveAnomalyPercentValue === null
      ? summary.label === "not_calculable"
        ? t.calendar.labels.not_calculable
        : notAvailableText
      : `${effectiveAnomalyPercentValue > 0 ? "+" : ""}${effectiveAnomalyPercentValue.toLocaleString("en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
    : resource.isLoading
      ? loadingText
      : unavailableText;

  const historyBars = summary
    ? buildSameMonthHistoryBars(
        summary,
        calendar,
        effectiveCurrentCount,
        isLiveFallback
      )
    : [];

  const leftPad = 48;
  const rightPad = 100;
  const topPad = 28;
  const bottomPad = 38;
  const plotWidth = 720 - leftPad - rightPad;
  const plotHeight = 210 - topPad - bottomPad;
  const baselineY = topPad + plotHeight;
  const maxVal = Math.max(
    ...historyBars.map((b) => b.count),
    historicalMedian ?? 0,
    1
  );
  const gridTicks = Array.from(new Set([0, Math.round(maxVal / 2), maxVal]));
  const medianY =
    historicalMedian !== null && historicalMedian >= 0
      ? baselineY - (historicalMedian / maxVal) * plotHeight
      : null;

  const liveWindowLabel =
    language === "ceb"
      ? "Live nga datos"
      : language === "fil"
        ? "Live na datos"
        : "Live window";
  const observedLabel = t.calendar.recordedData;
  const estimatedLabel = t.calendar.legendEstimated;
  const activeCellDaysLabel = t.shell.summaryCard.activeCellDays;

  return (
    <section
      className="analytics-panel anomaly-panel"
      aria-labelledby="anomaly-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">{t.analytics.anomalyEyebrow}</p>
          <h2 id="anomaly-title">{t.analytics.anomalyTitle}</h2>
        </div>
        {anomaly && summary && (
          <div className="anomaly-heading-badges">
            <span
              className={`anomaly-posture-badge posture-${summary.label}`}
            >
              {anomaly.posture}
            </span>
            <span
              className={`anomaly-icon anomaly-${summary.label}`}
              aria-hidden="true"
            >
              {anomaly.icon}
            </span>
          </div>
        )}
      </div>

      <div
        className={`anomaly-status${
          summary ? ` anomaly-status-${summary.label}` : ""
        }${resource.error ? " analytics-error" : ""}`}
        role={resource.error ? "alert" : "status"}
        aria-live="polite"
      >
        <div className="anomaly-status-header">
          <span className="anomaly-status-label">{title}</span>
          {summary && periodLabel && (
            <span className="anomaly-status-scope">
              {summary.region.name} · {periodLabel}
            </span>
          )}
        </div>
        {!summary && resource.error && (
          <span className="anomaly-status-description">
            {resource.error.message}
          </span>
        )}
      </div>

      <div
        className="anomaly-kpi-grid"
        role="list"
        aria-label={t.analytics.anomalyTitle}
      >
        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">{t.analytics.selectedActivity}</span>
          <strong className="anomaly-kpi-value">
            {summary
              ? formatCount(effectiveCurrentCount, notAvailableText)
              : resource.isLoading
                ? loadingText
                : unavailableText}
          </strong>
          <span
            className={`anomaly-kpi-sub${
              summary?.currentIsEstimated ? " estimated-text" : ""
            }`}
          >
            {summary
              ? isLiveFallback
                ? liveWindowLabel
                : summary.currentIsEstimated
                  ? estimatedLabel
                  : observedLabel
              : activeCellDaysLabel}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">{t.analytics.sameMonthMedian}</span>
          <strong className="anomaly-kpi-value">
            {summary
              ? formatCount(summary.historicalMedian, notAvailableText)
              : resource.isLoading
                ? loadingText
                : unavailableText}
          </strong>
          <span className="anomaly-kpi-sub">
            {summary
              ? `${summary.baselineYears.length} ${t.analytics.yearsSuffix}`
              : t.analytics.historicalMedianLegend}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">{t.analytics.anomalyDelta}</span>
          <strong
            className={`anomaly-kpi-value${
              summary ? ` anomaly-kpi-value--${summary.label}` : ""
            }`}
          >
            {anomalyPercent}
          </strong>
          <span className="anomaly-kpi-sub">
            {anomaly ? anomaly.label : t.analytics.anomalyDelta}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">{t.analytics.sensorMix}</span>
          <strong className="anomaly-kpi-value anomaly-kpi-value--split">
            {summary
              ? `${t.analytics.viirsLabel} ${formatCount(
                  summary.byInstrument.VIIRS ??
                    (liveCounts ? liveCounts.viirs : null),
                  notAvailableText
                )} · ${t.analytics.modisLabel} ${formatCount(
                  summary.byInstrument.MODIS ??
                    (liveCounts ? liveCounts.modis : null),
                  notAvailableText
                )}`
              : resource.isLoading
                ? loadingText
                : unavailableText}
          </strong>
          <span className="anomaly-kpi-sub">375m VIIRS · 1km MODIS</span>
        </div>
      </div>

      {summary && anomaly && (
        <>
          <div
            className="anomaly-history-chart"
            role="group"
            aria-label={t.analytics.formatYoyChartTitle(monthOnlyLabel)}
          >
            <div className="anomaly-chart-header">
              <div>
                <h3 className="anomaly-chart-title">
                  {t.analytics.formatYoyChartTitle(monthOnlyLabel)}
                </h3>
                <p className="anomaly-chart-subtitle">
                  {activeCellDaysLabel} ({summary.region.name})
                </p>
              </div>
              <span className="anomaly-chart-median-badge">
                {t.analytics.medianLabel}: {formatCount(summary.historicalMedian, notAvailableText)}
              </span>
            </div>

            <div className="chart-scroll">
              {historyBars.length === 0 ? (
                <p className="chart-message" role="status">
                  {t.analytics.emptyBody}
                </p>
              ) : (
              <svg
                className="anomaly-history-svg"
                viewBox="0 0 720 210"
                role="img"
                aria-label={t.analytics.formatYoyChartTitle(monthOnlyLabel)}
              >
                <title>
                  {t.analytics.formatYoyChartTitle(monthOnlyLabel)} ({summary.region.name})
                </title>
                {gridTicks.map((tickVal, idx) => {
                  const tickY = baselineY - (tickVal / maxVal) * plotHeight;
                  return (
                    <g key={`grid-${idx}-${tickVal}`}>
                      <line
                        x1={leftPad}
                        y1={tickY}
                        x2={720 - rightPad}
                        y2={tickY}
                        className="chart-grid-line"
                        stroke="rgba(148, 163, 184, 0.18)"
                        strokeDasharray={tickVal === 0 ? undefined : "3 3"}
                      />
                      <text
                        x={leftPad - 8}
                        y={tickY + 4}
                        textAnchor="end"
                        className="chart-axis-label"
                        fill="#94a3b8"
                        fontSize="11"
                      >
                        {tickVal.toLocaleString("en-US")}
                      </text>
                    </g>
                  );
                })}

                {historyBars.map((bar, index) => {
                  const slotWidth =
                    plotWidth / Math.max(historyBars.length, 1);
                  const barWidth = Math.min(
                    54,
                    Math.max(24, Math.floor(slotWidth) - 18)
                  );
                  const centerX = leftPad + slotWidth * index + slotWidth / 2;
                  const barX = centerX - barWidth / 2;
                  const rawHeight = (bar.count / maxVal) * plotHeight;
                  const barHeight =
                    bar.count > 0 ? Math.max(6, rawHeight) : 2;
                  const barY = baselineY - barHeight;
                  const fill = bar.isMedianBenchmark
                    ? "#38bdf8"
                    : getHistoryBandColor(bar.band);

                  const displayBarLabel = bar.isMedianBenchmark
                    ? t.analytics.medianLabel
                    : bar.label;

                  return (
                    <g key={bar.key}>
                      <title>
                        {bar.isMedianBenchmark
                          ? t.analytics.historicalMedianLegend
                          : `${monthOnlyLabel} ${bar.year}`}
                        : {bar.count.toLocaleString("en-US")} cell-days
                        {bar.isSelected
                          ? ` (${t.analytics.selectedMonthLegend})`
                          : bar.estimated
                            ? ` (${estimatedLabel})`
                            : ""}
                      </title>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill={fill}
                        stroke={bar.isSelected ? "#fff7ed" : undefined}
                        strokeWidth={bar.isSelected ? "2" : undefined}
                        className={`anomaly-history-bar anomaly-bar-${bar.band}${
                          bar.isSelected ? " is-selected" : ""
                        }`}
                      />
                      <text
                        x={centerX}
                        y={Math.max(14, barY - 6)}
                        textAnchor="middle"
                        className="anomaly-bar-value"
                        fill={bar.isSelected ? "#fff7ed" : "#cbd5e1"}
                        fontSize="11"
                        fontWeight={bar.isSelected ? "700" : "600"}
                      >
                        {bar.count.toLocaleString("en-US")}
                      </text>
                      <text
                        x={centerX}
                        y={baselineY + 18}
                        textAnchor="middle"
                        className="anomaly-bar-year"
                        fill={
                          bar.isMedianBenchmark
                            ? "#7dd3fc"
                            : bar.isSelected
                              ? "#fb923c"
                              : "#94a3b8"
                        }
                        fontSize="11"
                        fontWeight={bar.isSelected ? "700" : "500"}
                      >
                        {displayBarLabel}
                      </text>
                    </g>
                  );
                })}

                {medianY !== null && (
                  <g className="anomaly-median-group">
                    <line
                      x1={leftPad}
                      y1={medianY}
                      x2={720 - rightPad}
                      y2={medianY}
                      className="anomaly-median-line"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <g
                      transform={`translate(${720 - rightPad + 6}, ${Math.min(
                        baselineY - 18,
                        Math.max(topPad - 9, medianY - 9)
                      )})`}
                    >
                      <rect
                        width="88"
                        height="18"
                        rx="9"
                        fill="rgba(15, 23, 42, 0.94)"
                        stroke="#38bdf8"
                        strokeWidth="1"
                      />
                      <text
                        x="44"
                        y="12.5"
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="10"
                        fontWeight="700"
                      >
                        Med: {formatCount(summary.historicalMedian, notAvailableText)}
                      </text>
                    </g>
                  </g>
                )}
              </svg>
              )}
            </div>

            <div
              className="anomaly-chart-legend"
              aria-label={t.analytics.anomalyTitle}
            >
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#fb923c" }}
                  aria-hidden="true"
                />
                {t.analytics.statusPostures.below_baseline} (&lt;-25%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#14b8a6" }}
                  aria-hidden="true"
                />
                {t.analytics.statusPostures.near_baseline} (±25%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#ea580c" }}
                  aria-hidden="true"
                />
                {t.analytics.statusPostures.above_baseline} (+25%..+75%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#ef4444" }}
                  aria-hidden="true"
                />
                {t.analytics.statusPostures.unusually_high} (&gt;+75%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-line"
                  style={{ borderTop: "2px dashed #38bdf8" }}
                  aria-hidden="true"
                />
                {t.analytics.historicalMedianLegend}
              </span>
            </div>
          </div>

          <div
            className="anomaly-comparison-meter"
            role="group"
            aria-label={t.analytics.anomalyTitle}
          >
            <div className="anomaly-meter-header">
              <span className="anomaly-meter-title">
                {t.analytics.selectedMonthLegend} vs. {t.analytics.sameMonthMedian} ({monthOnlyLabel})
              </span>
              <span className="anomaly-meter-delta">
                {effectiveAnomalyPercentValue === null
                  ? t.analytics.noHistoricalBaseline
                  : `${anomalyPercent} vs. ${t.analytics.medianLabel}`}
              </span>
            </div>

            <div className="anomaly-meter-rows">
              <div className="anomaly-meter-row">
                <div className="anomaly-meter-row-meta">
                  <span className="anomaly-meter-row-label">
                    {t.analytics.selectedMonthLegend} ({periodLabel})
                  </span>
                  <strong className="anomaly-meter-row-value">
                    {effectiveCurrentCount !== null
                      ? `${formatCount(effectiveCurrentCount, notAvailableText)}${
                          isLiveFallback
                            ? ` · ${liveWindowLabel}`
                            : summary.currentIsEstimated
                              ? ` · ${estimatedLabel}`
                              : ""
                        }`
                      : notAvailableText}
                  </strong>
                </div>
                <div className="anomaly-meter-track" aria-hidden="true">
                  <span
                    className={`anomaly-meter-fill anomaly-meter-fill-current anomaly-meter-${summary.label}`}
                    style={{
                      width: `${currentBarPercent}%`,
                      background: getCurrentMeterColor(summary.label),
                    }}
                  />
                </div>
              </div>

              <div className="anomaly-meter-row">
                <div className="anomaly-meter-row-meta">
                  <span className="anomaly-meter-row-label">
                    {t.analytics.sameMonthMedian} ({summary.baselineYears.length}{" "}
                    {t.analytics.yearsSuffix})
                  </span>
                  <strong className="anomaly-meter-row-value">
                    {formatCount(summary.historicalMedian, notAvailableText)}
                  </strong>
                </div>
                <div className="anomaly-meter-track" aria-hidden="true">
                  <span
                    className="anomaly-meter-fill anomaly-meter-fill-baseline"
                    style={{
                      width: `${baselineBarPercent}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`anomaly-cdrrmo-advisory advisory-${summary.label}`}
            role="note"
            aria-label={anomaly.posture}
          >
            <div className="anomaly-advisory-header">
              <span className="anomaly-advisory-title">
                {t.ai.actionHeading}
              </span>
              <span
                className={`anomaly-posture-badge posture-${summary.label}`}
              >
                {anomaly.posture}
              </span>
            </div>
            <p className="anomaly-advisory-text">{anomaly.advisory}</p>
          </div>
        </>
      )}

      <details className="anomaly-technical-details">
        <summary>{t.analytics.technicalDetailsSummary}</summary>
        <div className="anomaly-technical-body">
          <dl className="analytics-details">
            <div>
              <dt>{t.analytics.baselineYearsLabel}</dt>
              <dd>
                {summary ? (
                  <>
                    {formatYears(summary.baselineYears)}
                    {summary.estimatedBaselineYears.length > 0 && (
                      <span className="estimated-text">
                        {" "}
                        ({summary.estimatedBaselineYears.length} {t.analytics.estimatedYearsLabel.toLowerCase()}:{" "}
                        {formatYears(summary.estimatedBaselineYears)})
                      </span>
                    )}
                  </>
                ) : resource.isLoading ? (
                  loadingText
                ) : (
                  unavailableText
                )}
              </dd>
            </div>
            <div>
              <dt>{t.analytics.coverageLabel}</dt>
              <dd>
                {summary
                  ? summary.dataCoverage
                    ? `${summary.dataCoverage.firstDate} ${t.shell.summaryCard.dateRangeTo} ${summary.dataCoverage.lastDate} UTC`
                    : notAvailableText
                  : resource.isLoading
                    ? loadingText
                    : unavailableText}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </section>
  );
}

export function HarmonizationPanel({
  resource,
}: {
  resource: ClientResource<HarmonizationResponse>;
}) {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  const info = resource.data?.info;
  const loadingText =
    language === "ceb"
      ? "Nagkarga…"
      : language === "fil"
        ? "Nilo-load…"
        : "Loading…";
  const notAvailableText =
    language === "ceb"
      ? "Walay datos"
      : language === "fil"
        ? "Walang datos"
        : "Not available";

  return (
    <section
      className="analytics-panel harmonization-panel"
      aria-labelledby="harmonization-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">{t.analytics.harmonizationEyebrow}</p>
          <h2 id="harmonization-title">{t.analytics.harmonizationTitle}</h2>
        </div>
        <span className="method-chip">
          {info?.method ?? (resource.isLoading ? loadingText : notAvailableText)}
        </span>
      </div>

      <p className="analytics-panel-intro">
        {language === "ceb"
          ? "Nagpantay sa daan nga 1km MODIS ngadto sa sukdanan sa 375m VIIRS gamit ang mga tuig nga nagdungan ang duha ka satelayt."
          : language === "fil"
            ? "Pinapantay ang dating 1km MODIS patungo sa sukat ng 375m VIIRS gamit ang mga taong magkasabay ang dalawang satelayt."
            : "Scales historical 1km MODIS counts to 375m VIIRS-equivalent levels using overlapping satellite observation years."}
      </p>

      {resource.error && (
        <p className="analytics-inline-error" role="alert">
          {t.analytics.harmonizationUnavailable}: {resource.error.message}
        </p>
      )}
      {!info && !resource.isLoading && !resource.error && (
        <p className="analytics-inline-empty" role="status">
          {t.analytics.noHarmonizationData}
        </p>
      )}

      <dl className="analytics-details harmonization-details">
        <div>
          <dt>{t.analytics.scalingFactorLabel || "MODIS-to-VIIRS Scaling Factor"}</dt>
          <dd>
            {info
              ? formatMetric(info.factor, "×")
              : resource.isLoading
                ? loadingText
                : notAvailableText}
          </dd>
        </div>
        <div>
          <dt>{t.analytics.overlapYearsLabel || "Overlap Calibration Years"}</dt>
          <dd>
            {info
              ? formatYears(info.overlapYears)
              : resource.isLoading
                ? loadingText
                : notAvailableText}
          </dd>
        </div>
        <div>
          <dt>{t.analytics.correlationLabel || "Calibration Agreement (r)"}</dt>
          <dd>
            {info
              ? formatMetric(info.correlation)
              : resource.isLoading
                ? loadingText
                : notAvailableText}
          </dd>
        </div>
        <div>
          <dt>{t.analytics.errorLabel || "Calibration Error (MAPE)"}</dt>
          <dd>
            {info
              ? formatMetric(info.errorPercent, "%")
              : resource.isLoading
                ? loadingText
                : notAvailableText}
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface OverlapClusterPoint {
  periodKey: string;
  periodLabel: string;
  modis: number | null;
  modisScaled: number | null;
  viirs: number | null;
}

function buildFallbackOverlapPoints(
  resourceData: HarmonizationResponse | null,
  summary: AnalyticsSummary | null
): OverlapPoint[] {
  const raw = resourceData?.overlap ?? [];
  if (raw.length > 0) {
    return raw;
  }

  const rawFactor =
    resourceData?.info?.factor ??
    summary?.harmonization?.factor ??
    null;

  if (
    summary &&
    (summary.byInstrument.MODIS !== null || summary.byInstrument.VIIRS !== null)
  ) {
    const modis = summary.byInstrument.MODIS;
    const viirs = summary.byInstrument.VIIRS;
    return [
      {
        year: summary.period.year,
        month: summary.period.month,
        modis,
        modisScaled:
          modis !== null && rawFactor !== null
            ? Math.round(modis * rawFactor * 100) / 100
            : null,
        viirs,
      },
    ];
  }

  return [];
}

export function OverlapChart({
  resource,
  summary = null,
}: {
  resource: ClientResource<HarmonizationResponse>;
  summary?: AnalyticsSummary | null;
  calendar?: CalendarResponse | null;
}) {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  const [viewMode, setViewMode] = useState<"annual" | "monthly">("annual");

  const effectiveOverlap = buildFallbackOverlapPoints(resource.data, summary);

  const annualPoints: OverlapClusterPoint[] = (() => {
    const byYear = new Map<
      number,
      { modis: number; modisScaled: number; viirs: number }
    >();
    for (const pt of effectiveOverlap) {
      const current = byYear.get(pt.year) ?? {
        modis: 0,
        modisScaled: 0,
        viirs: 0,
      };
      current.modis += pt.modis ?? 0;
      current.modisScaled += pt.modisScaled ?? 0;
      current.viirs += pt.viirs ?? 0;
      byYear.set(pt.year, current);
    }
    return Array.from(byYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, totals]) => ({
        periodKey: String(year),
        periodLabel: String(year),
        modis: totals.modis,
        modisScaled: totals.modisScaled,
        viirs: totals.viirs,
      }));
  })();

  const monthlyPoints: OverlapClusterPoint[] = effectiveOverlap
    .slice(-12)
    .map((pt) => {
      const label = `${pt.year}-${String(pt.month).padStart(2, "0")}`;
      return {
        periodKey: label,
        periodLabel: label,
        modis: pt.modis,
        modisScaled: pt.modisScaled,
        viirs: pt.viirs,
      };
    });

  const displayPoints =
    viewMode === "annual" ? annualPoints : monthlyPoints;

  const maxCount = Math.max(
    ...displayPoints.flatMap((point) => [
      point.modis ?? 0,
      point.modisScaled ?? 0,
      point.viirs ?? 0,
    ]),
    1
  );

  const chartHeight = 160;
  const topPad = 26;
  const bottomPad = 36;
  const leftPad = 48;
  const rightPad = 20;
  const baselineY = topPad + chartHeight;
  const groupSpacing =
    viewMode === "annual"
      ? Math.max(105, Math.floor(640 / Math.max(displayPoints.length, 1)))
      : 68;
  const chartWidth = Math.max(
    680,
    leftPad + rightPad + displayPoints.length * groupSpacing
  );
  const gridTicks = Array.from(new Set([0, Math.round(maxCount / 2), maxCount]));

  const rawModisLabel =
    language === "ceb"
      ? "Aktwal nga MODIS (1km)"
      : language === "fil"
        ? "Aktwal na MODIS (1km)"
        : "Raw MODIS (1km)";
  const scaledModisLabel =
    language === "ceb"
      ? "Gipantay nga MODIS"
      : language === "fil"
        ? "Pinantay na MODIS"
        : "Scaled MODIS (Harmonized)";
  const actualViirsLabel =
    language === "ceb"
      ? "Aktwal nga VIIRS (375m)"
      : language === "fil"
        ? "Aktwal na VIIRS (375m)"
        : "Actual VIIRS (375m)";
  const noDataLabel =
    language === "ceb"
      ? "Walay datos"
      : language === "fil"
        ? "Walang datos"
        : "No data";
  const monthHeaderLabel =
    language === "ceb"
      ? "Buwan"
      : language === "fil"
        ? "Buwan"
        : "Month";

  return (
    <section
      className="analytics-panel overlap-panel"
      aria-labelledby="overlap-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">{t.analytics.overlapEyebrow}</p>
          <h2 id="overlap-title">{t.analytics.overlapTitle}</h2>
        </div>
        <div
          className="overlap-view-toggle"
          role="group"
          aria-label={t.analytics.overlapTitle}
        >
          <button
            type="button"
            className={`overlap-toggle-btn${
              viewMode === "annual" ? " is-active" : ""
            }`}
            aria-pressed={viewMode === "annual"}
            onClick={() => setViewMode("annual")}
          >
            {t.analytics.yearlyTotals || "Yearly Totals"}
          </button>
          <button
            type="button"
            className={`overlap-toggle-btn${
              viewMode === "monthly" ? " is-active" : ""
            }`}
            aria-pressed={viewMode === "monthly"}
            onClick={() => setViewMode("monthly")}
          >
            {t.analytics.recent12Months || "Recent 12 Months"}
          </button>
        </div>
      </div>

      <p className="analytics-panel-intro">
        {language === "ceb"
          ? "Nagtandi sa aktwal nga 1km MODIS, gipantay nga MODIS, ug tinuod nga 375m VIIRS sa mga panahon nga nagdungan."
          : language === "fil"
            ? "Inihahambing ang aktwal na 1km MODIS, pinantay na MODIS, at tunay na 375m VIIRS sa mga panahong magkasabay."
            : "Compares raw 1km MODIS, harmonized MODIS estimates, and actual 375m VIIRS detections across shared calibration periods."}
      </p>

      <div className="chart-legend">
        <span>
          <span
            className="chart-legend-swatch modis-swatch"
            aria-hidden="true"
          />
          {rawModisLabel}
        </span>
        <span>
          <span
            className="chart-legend-swatch scaled-modis-swatch"
            aria-hidden="true"
          />
          {scaledModisLabel}
        </span>
        <span>
          <span
            className="chart-legend-swatch viirs-swatch"
            aria-hidden="true"
          />
          {actualViirsLabel}
        </span>
      </div>

      {resource.isLoading && effectiveOverlap.length === 0 ? (
        <p className="chart-message" role="status">
          {t.analytics.loadingOverlap}
        </p>
      ) : resource.error && effectiveOverlap.length === 0 ? (
        <p className="chart-message analytics-error" role="alert">
          {resource.error.message}
        </p>
      ) : displayPoints.length === 0 ? (
        <p className="chart-message" role="status">
          {t.analytics.noOverlapData}
        </p>
      ) : (
        <>
          <div
            className="chart-scroll"
            role="region"
            aria-label={t.analytics.overlapTitle}
          >
            <svg
              className="overlap-chart"
              viewBox={`0 0 ${chartWidth} ${topPad + chartHeight + bottomPad}`}
              role="img"
              aria-labelledby="overlap-chart-title overlap-chart-desc"
            >
              <title id="overlap-chart-title">{t.analytics.overlapTitle}</title>
              <desc id="overlap-chart-desc">
                {rawModisLabel} / {scaledModisLabel} / {actualViirsLabel}
              </desc>

              {gridTicks.map((tickVal, idx) => {
                const tickY = baselineY - (tickVal / maxCount) * chartHeight;
                return (
                  <g key={`overlap-grid-${idx}-${tickVal}`}>
                    <line
                      x1={leftPad}
                      y1={tickY}
                      x2={chartWidth - rightPad}
                      y2={tickY}
                      className="chart-grid-line"
                      stroke="rgba(148, 163, 184, 0.18)"
                      strokeDasharray={tickVal === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={leftPad - 8}
                      y={tickY + 4}
                      textAnchor="end"
                      className="chart-axis-label"
                      fill="#94a3b8"
                      fontSize="11"
                    >
                      {tickVal.toLocaleString("en-US")}
                    </text>
                  </g>
                );
              })}

              {displayPoints.map((point, index) => {
                const center =
                  leftPad + groupSpacing * index + groupSpacing / 2;
                const barWidth = viewMode === "annual" ? 16 : 12;
                const barStep = viewMode === "annual" ? 20 : 15;
                const startOffset = viewMode === "annual" ? -28 : -21;
                const values = [
                  {
                    label: rawModisLabel,
                    value: point.modis,
                    className: "modis-bar",
                  },
                  {
                    label: scaledModisLabel,
                    value: point.modisScaled,
                    className: "scaled-modis-bar",
                  },
                  {
                    label: actualViirsLabel,
                    value: point.viirs,
                    className: "viirs-bar",
                  },
                ];
                const clusterMax = Math.max(
                  point.modis ?? 0,
                  point.modisScaled ?? 0,
                  point.viirs ?? 0
                );

                return (
                  <g key={point.periodKey}>
                    {values.map(({ label, value, className }, valueIndex) => {
                      const rawHeight =
                        value !== null && maxCount > 0
                          ? (value / maxCount) * chartHeight
                          : 0;
                      const height =
                        value !== null
                          ? value > 0
                            ? Math.max(4, rawHeight)
                            : 2
                          : 0;
                      const x = center + startOffset + valueIndex * barStep;
                      const y = baselineY - height;
                      const showValueLabel =
                        value !== null &&
                        (viewMode === "annual" || value === clusterMax);

                      return (
                        <g key={label}>
                          <title>
                            {point.periodLabel} {label}:{" "}
                            {value === null
                              ? noDataLabel
                              : value.toLocaleString("en-US")}
                          </title>
                          {value !== null && (
                            <>
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={height}
                                rx="3"
                                className={className}
                              />
                              {showValueLabel && (
                                <text
                                  x={x + barWidth / 2}
                                  y={Math.max(12, y - 5)}
                                  textAnchor="middle"
                                  className="chart-bar-value"
                                  fill="#cbd5e1"
                                  fontSize={viewMode === "annual" ? "10" : "9"}
                                  fontWeight="600"
                                >
                                  {value.toLocaleString("en-US")}
                                </text>
                              )}
                            </>
                          )}
                        </g>
                      );
                    })}
                    <text
                      x={center}
                      y={baselineY + 20}
                      textAnchor="middle"
                      className="chart-period"
                    >
                      {point.periodLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <details className="anomaly-technical-details">
            <summary>
              {language === "ceb"
                ? `Tan-awa ang binuwan nga lamesa (${effectiveOverlap.length} ka buwan)`
                : language === "fil"
                  ? `Tingnan ang buwanang talahanayan (${effectiveOverlap.length} buwan)`
                  : `View monthly overlap table (${effectiveOverlap.length} months)`}
            </summary>
            <div className="overlap-table-wrap">
              <table className="overlap-data-table">
                <thead>
                  <tr>
                    <th scope="col">{monthHeaderLabel}</th>
                    <th scope="col">{rawModisLabel}</th>
                    <th scope="col">{scaledModisLabel}</th>
                    <th scope="col">{actualViirsLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveOverlap.map((point) => (
                    <tr key={`${point.year}-${point.month}`}>
                      <th scope="row">
                        {point.year}-{String(point.month).padStart(2, "0")}
                      </th>
                      <td>{formatCount(point.modis, noDataLabel)}</td>
                      <td>{formatCount(point.modisScaled, noDataLabel)}</td>
                      <td>{formatCount(point.viirs, noDataLabel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
