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

const MONTH_NAMES = [
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
];

const anomalyPresentation: Record<
  AnomalyLabel,
  {
    icon: string;
    label: string;
    posture: string;
    advisory: string;
  }
> = {
  below_baseline: {
    icon: "↓",
    label: "Below Historical Baseline",
    posture: "ROUTINE MONITORING",
    advisory:
      "Maintain standard seasonal fire monitoring and routine barangay reporting.",
  },
  near_baseline: {
    icon: "≈",
    label: "Near Historical Baseline",
    posture: "STANDARD WATCH",
    advisory:
      "Maintain standard seasonal fire monitoring and routine barangay reporting.",
  },
  above_baseline: {
    icon: "↑",
    label: "Above Historical Baseline",
    posture: "ELEVATED CDRRMO WATCH",
    advisory:
      "Increase monitoring frequency for recurring thermal detections and cross-check with local field reports.",
  },
  unusually_high: {
    icon: "!",
    label: "Unusually High Activity",
    posture: "PRIORITY GROUND VERIFICATION",
    advisory:
      "Coordinate with BFP and Barangay DRRMCs to verify persistent hotspot clusters on the ground and review local preparedness posture.",
  },
  not_calculable: {
    icon: "—",
    label: "Baseline Comparison Unavailable",
    posture: "DATA COVERAGE CHECK",
    advisory:
      "Historical median is zero or unavailable; review raw sensor detections directly and verify local coverage.",
  },
};

function formatCount(value: number | null): string {
  return value === null ? "No data" : value.toLocaleString("en-US");
}

function formatYears(years: number[]): string {
  return years.length > 0 ? years.join(", ") : "None";
}

function formatMetric(value: number | null, suffix = ""): string {
  return value === null
    ? "Not available"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}${suffix}`;
}

function formatPeriodMonth(year: number, month: number): string {
  const monthName = MONTH_NAMES[month - 1] ?? `Month ${month}`;
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
  const summary = resource.data;
  const anomaly = summary ? anomalyPresentation[summary.label] : null;
  const title = resource.isLoading
    ? "Loading baseline comparison…"
    : resource.error
      ? "Baseline comparison unavailable"
      : anomaly?.label ?? "No comparison loaded";

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
    ? formatPeriodMonth(summary.period.year, summary.period.month)
    : null;
  const monthOnlyLabel = summary
    ? (MONTH_NAMES[summary.period.month - 1] ?? `Month ${summary.period.month}`)
    : "Selected Month";

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
        ? "Not calculable"
        : "Not available"
      : `${effectiveAnomalyPercentValue > 0 ? "+" : ""}${effectiveAnomalyPercentValue.toLocaleString("en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
    : resource.isLoading
      ? "Loading…"
      : "Unavailable";

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

  return (
    <section
      className="analytics-panel anomaly-panel"
      aria-labelledby="anomaly-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">CDRRMO BASELINE ASSESSMENT</p>
          <h2 id="anomaly-title">Monthly Anomaly &amp; Operational Posture</h2>
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
        aria-label="Monthly anomaly key metrics"
      >
        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">Selected Month</span>
          <strong className="anomaly-kpi-value">
            {summary
              ? formatCount(effectiveCurrentCount)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </strong>
          <span
            className={`anomaly-kpi-sub${
              summary?.currentIsEstimated ? " estimated-text" : ""
            }`}
          >
            {summary
              ? isLiveFallback
                ? "Live window"
                : summary.currentIsEstimated
                  ? "Estimated"
                  : "Observed"
              : "Active cell-days"}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">Typical Median</span>
          <strong className="anomaly-kpi-value">
            {summary
              ? formatCount(summary.historicalMedian)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </strong>
          <span className="anomaly-kpi-sub">
            {summary
              ? `${summary.baselineYears.length} baseline yrs`
              : "Same-month norm"}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">vs. Baseline</span>
          <strong
            className={`anomaly-kpi-value${
              summary ? ` anomaly-kpi-value--${summary.label}` : ""
            }`}
          >
            {anomalyPercent}
          </strong>
          <span className="anomaly-kpi-sub">
            {anomaly ? anomaly.label : "Deviation"}
          </span>
        </div>

        <div className="anomaly-kpi-card" role="listitem">
          <span className="anomaly-kpi-label">Sensor Split</span>
          <strong className="anomaly-kpi-value anomaly-kpi-value--split">
            {summary
              ? `VIIRS ${formatCount(
                  summary.byInstrument.VIIRS ??
                    (liveCounts ? liveCounts.viirs : null)
                )} · MODIS ${formatCount(
                  summary.byInstrument.MODIS ??
                    (liveCounts ? liveCounts.modis : null)
                )}`
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </strong>
          <span className="anomaly-kpi-sub">375m VIIRS · 1km MODIS</span>
        </div>
      </div>

      {summary && anomaly && (
        <>
          <div
            className="anomaly-history-chart"
            role="group"
            aria-label={`${monthOnlyLabel} year-by-year hotspot comparison`}
          >
            <div className="anomaly-chart-header">
              <div>
                <h3 className="anomaly-chart-title">
                  {monthOnlyLabel} Hotspot Detections by Year
                </h3>
                <p className="anomaly-chart-subtitle">
                  Same-month active cell-days ({summary.region.name})
                </p>
              </div>
              <span className="anomaly-chart-median-badge">
                Dashed line = Typical {monthOnlyLabel} Median (
                {formatCount(summary.historicalMedian)})
              </span>
            </div>

            <div className="chart-scroll">
              {historyBars.length === 0 ? (
                <p className="chart-message" role="status">
                  No same-month historical observations are recorded for this area yet.
                </p>
              ) : (
              <svg
                className="anomaly-history-svg"
                viewBox="0 0 720 210"
                role="img"
                aria-label={`${monthOnlyLabel} year-by-year hotspot comparison chart`}
              >
                <title>
                  {monthOnlyLabel} Hotspot Detections by Year ({summary.region.name})
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

                  return (
                    <g key={bar.key}>
                      <title>
                        {bar.isMedianBenchmark
                          ? `Typical ${monthOnlyLabel} Median`
                          : `${monthOnlyLabel} ${bar.year}`}
                        : {bar.count.toLocaleString("en-US")} cell-days
                        {bar.isSelected
                          ? " (Selected Year)"
                          : bar.estimated
                            ? " (MODIS-estimated)"
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
                        {bar.label}
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
                        Med: {formatCount(summary.historicalMedian)}
                      </text>
                    </g>
                  </g>
                )}
              </svg>
              )}
            </div>

            <div
              className="anomaly-chart-legend"
              aria-label="Anomaly severity color key"
            >
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#fb923c" }}
                  aria-hidden="true"
                />
                Below Normal (&lt;-25%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#14b8a6" }}
                  aria-hidden="true"
                />
                Near Normal (±25%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#ea580c" }}
                  aria-hidden="true"
                />
                Above Normal (+25% to +75%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-swatch"
                  style={{ background: "#ef4444" }}
                  aria-hidden="true"
                />
                Unusually High (&gt;+75%)
              </span>
              <span className="anomaly-legend-item">
                <span
                  className="anomaly-legend-line"
                  style={{ borderTop: "2px dashed #38bdf8" }}
                  aria-hidden="true"
                />
                Typical Median Line
              </span>
            </div>
          </div>

          <div
            className="anomaly-comparison-meter"
            role="group"
            aria-label="Visual comparison of selected month detections versus typical same-month baseline"
          >
            <div className="anomaly-meter-header">
              <span className="anomaly-meter-title">
                Selected Month vs. Typical {monthOnlyLabel} Baseline
              </span>
              <span className="anomaly-meter-delta">
                {effectiveAnomalyPercentValue === null
                  ? "Percentage deviation unavailable"
                  : `${anomalyPercent} vs. typical ${monthOnlyLabel}`}
              </span>
            </div>

            <div className="anomaly-meter-rows">
              <div className="anomaly-meter-row">
                <div className="anomaly-meter-row-meta">
                  <span className="anomaly-meter-row-label">
                    Selected Month ({periodLabel})
                  </span>
                  <strong className="anomaly-meter-row-value">
                    {effectiveCurrentCount !== null
                      ? `${formatCount(effectiveCurrentCount)}${
                          isLiveFallback
                            ? " · Live window"
                            : summary.currentIsEstimated
                              ? " · Estimated"
                              : ""
                        }`
                      : "In-progress month (see historical chart above)"}
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
                    Typical Baseline ({summary.baselineYears.length}{" "}
                    {summary.baselineYears.length === 1 ? "yr" : "yrs"} median)
                  </span>
                  <strong className="anomaly-meter-row-value">
                    {formatCount(summary.historicalMedian)}
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
            aria-label="CDRRMO Recommended Monitoring Focus"
          >
            <div className="anomaly-advisory-header">
              <span className="anomaly-advisory-title">
                CDRRMO Recommended Monitoring Focus
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
        <summary>Baseline coverage &amp; technical notes</summary>
        <div className="anomaly-technical-body">
          <dl className="analytics-details">
            <div>
              <dt>Historical Baseline Years Used</dt>
              <dd>
                {summary ? (
                  <>
                    {formatYears(summary.baselineYears)}
                    {summary.estimatedBaselineYears.length > 0 && (
                      <span className="estimated-text">
                        {" "}
                        ({summary.estimatedBaselineYears.length} estimated:{" "}
                        {formatYears(summary.estimatedBaselineYears)})
                      </span>
                    )}
                  </>
                ) : resource.isLoading ? (
                  "Loading…"
                ) : (
                  "Unavailable"
                )}
              </dd>
            </div>
            <div>
              <dt>Archive Data Coverage</dt>
              <dd>
                {summary
                  ? summary.dataCoverage
                    ? `${summary.dataCoverage.firstDate} to ${summary.dataCoverage.lastDate} UTC`
                    : "No data"
                  : resource.isLoading
                    ? "Loading…"
                    : "Unavailable"}
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
  const info = resource.data?.info;

  return (
    <section
      className="analytics-panel harmonization-panel"
      aria-labelledby="harmonization-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">SENSOR NORMALIZATION</p>
          <h2 id="harmonization-title">Cross-Sensor Harmonization</h2>
        </div>
        <span className="method-chip">
          {info?.method ?? (resource.isLoading ? "Loading…" : "Not available")}
        </span>
      </div>

      <p className="analytics-panel-intro">
        Scales historical 1km MODIS counts to 375m VIIRS-equivalent levels using
        overlapping satellite observation years.
      </p>

      {resource.error && (
        <p className="analytics-inline-error" role="alert">
          Harmonization details could not be loaded: {resource.error.message}
        </p>
      )}
      {!info && !resource.isLoading && !resource.error && (
        <p className="analytics-inline-empty" role="status">
          No harmonization information is available for this region.
        </p>
      )}

      <dl className="analytics-details harmonization-details">
        <div>
          <dt>MODIS-to-VIIRS Scaling Factor</dt>
          <dd>
            {info
              ? formatMetric(info.factor, "×")
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Overlap Calibration Years</dt>
          <dd>
            {info
              ? formatYears(info.overlapYears)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Calibration Agreement (r)</dt>
          <dd>
            {info
              ? formatMetric(info.correlation)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Calibration Error (MAPE)</dt>
          <dd>
            {info
              ? formatMetric(info.errorPercent, "%")
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
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

  return (
    <section
      className="analytics-panel overlap-panel"
      aria-labelledby="overlap-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">SENSOR OVERLAP VERIFICATION</p>
          <h2 id="overlap-title">MODIS vs. VIIRS Calibration Check</h2>
        </div>
        <div
          className="overlap-view-toggle"
          role="group"
          aria-label="Calibration chart view mode"
        >
          <button
            type="button"
            className={`overlap-toggle-btn${
              viewMode === "annual" ? " is-active" : ""
            }`}
            aria-pressed={viewMode === "annual"}
            onClick={() => setViewMode("annual")}
          >
            Yearly Totals
          </button>
          <button
            type="button"
            className={`overlap-toggle-btn${
              viewMode === "monthly" ? " is-active" : ""
            }`}
            aria-pressed={viewMode === "monthly"}
            onClick={() => setViewMode("monthly")}
          >
            Recent 12 Months
          </button>
        </div>
      </div>

      <p className="analytics-panel-intro">
        Compares raw 1km MODIS, harmonized MODIS estimates, and actual 375m
        VIIRS detections across shared calibration periods.
      </p>

      <div className="chart-legend">
        <span>
          <span
            className="chart-legend-swatch modis-swatch"
            aria-hidden="true"
          />
          Raw MODIS (1km)
        </span>
        <span>
          <span
            className="chart-legend-swatch scaled-modis-swatch"
            aria-hidden="true"
          />
          Scaled MODIS (Harmonized)
        </span>
        <span>
          <span
            className="chart-legend-swatch viirs-swatch"
            aria-hidden="true"
          />
          Actual VIIRS (375m)
        </span>
      </div>

      {resource.isLoading && effectiveOverlap.length === 0 ? (
        <p className="chart-message" role="status">
          Loading overlap data…
        </p>
      ) : resource.error && effectiveOverlap.length === 0 ? (
        <p className="chart-message analytics-error" role="alert">
          {resource.error.message}
        </p>
      ) : displayPoints.length === 0 ? (
        <p className="chart-message" role="status">
          Sensor overlap pairs are recorded at province and national levels; switch area scope to inspect MODIS vs. VIIRS calibration.
        </p>
      ) : (
        <>
          <div
            className="chart-scroll"
            role="region"
            aria-label="MODIS and VIIRS overlap chart"
          >
            <svg
              className="overlap-chart"
              viewBox={`0 0 ${chartWidth} ${topPad + chartHeight + bottomPad}`}
              role="img"
              aria-labelledby="overlap-chart-title overlap-chart-desc"
            >
              <title id="overlap-chart-title">
                {viewMode === "annual"
                  ? "Annual MODIS, scaled MODIS, and VIIRS calibration totals"
                  : "Recent 12-month MODIS, scaled MODIS, and VIIRS overlap counts"}
              </title>
              <desc id="overlap-chart-desc">
                MODIS, scaled MODIS, and VIIRS active cell-day counts per{" "}
                {viewMode === "annual" ? "calibration year" : "overlap month"}.
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
                    label: "Raw MODIS (1km)",
                    value: point.modis,
                    className: "modis-bar",
                  },
                  {
                    label: "Scaled MODIS (Harmonized)",
                    value: point.modisScaled,
                    className: "scaled-modis-bar",
                  },
                  {
                    label: "Actual VIIRS (375m)",
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
                              ? "No data"
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
              View monthly overlap table ({effectiveOverlap.length} months)
            </summary>
            <div className="overlap-table-wrap">
              <table className="overlap-data-table">
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Raw MODIS (1km)</th>
                    <th scope="col">Scaled MODIS</th>
                    <th scope="col">Actual VIIRS (375m)</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveOverlap.map((point) => (
                    <tr key={`${point.year}-${point.month}`}>
                      <th scope="row">
                        {point.year}-{String(point.month).padStart(2, "0")}
                      </th>
                      <td>{formatCount(point.modis)}</td>
                      <td>{formatCount(point.modisScaled)}</td>
                      <td>{formatCount(point.viirs)}</td>
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
