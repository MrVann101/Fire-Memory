"use client";

import type {
  AnalyticsSummary,
  AnomalyLabel,
  HarmonizationResponse,
} from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";

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
    description: string;
    advisory: string;
  }
> = {
  below_baseline: {
    icon: "↓",
    label: "Below Historical Baseline",
    posture: "ROUTINE MONITORING",
    description:
      "Recorded satellite thermal detections are lower than the typical historical median for this same calendar month in previous years.",
    advisory:
      "Maintain standard seasonal fire monitoring and routine barangay reporting.",
  },
  near_baseline: {
    icon: "≈",
    label: "Near Historical Baseline",
    posture: "STANDARD WATCH",
    description:
      "Recorded satellite thermal detections are tracking close to the typical historical median for this same calendar month in previous years.",
    advisory:
      "Maintain standard seasonal fire monitoring and routine barangay reporting.",
  },
  above_baseline: {
    icon: "↑",
    label: "Above Historical Baseline",
    posture: "ELEVATED CDRRMO WATCH",
    description:
      "Recorded satellite thermal detections are higher than the typical historical median for this same calendar month in previous years.",
    advisory:
      "Increase monitoring frequency for recurring thermal detections and cross-check with local field reports.",
  },
  unusually_high: {
    icon: "!",
    label: "Unusually High Activity",
    posture: "PRIORITY GROUND VERIFICATION",
    description:
      "Recorded satellite thermal detections are substantially above the historical median for this same calendar month in previous years.",
    advisory:
      "Coordinate with BFP and Barangay DRRMCs to verify persistent hotspot clusters on the ground and review local preparedness posture.",
  },
  not_calculable: {
    icon: "—",
    label: "Baseline Comparison Unavailable",
    posture: "DATA COVERAGE CHECK",
    description:
      "A percentage comparison against previous years cannot be calculated because the historical monthly median is zero or baseline coverage is insufficient.",
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
      return "var(--hotspot-moderate, #f97316)";
    case "below_baseline":
      return "var(--hotspot-low, #fb923c)";
    case "not_calculable":
      return "var(--hotspot-moderate, #f97316)";
  }
}

export function AnomalyPanel({
  resource,
}: {
  resource: ClientResource<AnalyticsSummary>;
}) {
  const summary = resource.data;
  const anomaly = summary ? anomalyPresentation[summary.label] : null;
  const title = resource.isLoading
    ? "Loading baseline comparison…"
    : resource.error
      ? "Baseline comparison unavailable"
      : anomaly?.label ?? "No comparison loaded";
  const notes =
    summary?.notes.length
      ? summary.notes
      : resource.error
        ? [resource.error.message]
        : ["No additional data limitations noted for this comparison."];

  const currentCount = summary?.currentCount ?? null;
  const historicalMedian = summary?.historicalMedian ?? null;
  const meterMax = Math.max(currentCount ?? 0, historicalMedian ?? 0, 1);
  const currentBarPercent =
    currentCount !== null && currentCount > 0
      ? Math.min(100, Math.max(4, Math.round((currentCount / meterMax) * 100)))
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
        {anomaly && (
          <span className="anomaly-status-description">
            {anomaly.description}
          </span>
        )}
        {!summary && resource.error && (
          <span className="anomaly-status-description">
            {resource.error.message}
          </span>
        )}
      </div>

      {summary && anomaly && (
        <>
          <div
            className="anomaly-comparison-meter"
            role="group"
            aria-label="Visual comparison of selected month detections versus typical same-month baseline"
          >
            <div className="anomaly-meter-header">
              <span className="anomaly-meter-title">
                Visual Comparison: {periodLabel} vs. Historical {monthOnlyLabel}{" "}
                Baseline
              </span>
              <span className="anomaly-meter-delta">
                {summary.anomalyPercent === null
                  ? "Percentage deviation unavailable"
                  : `${summary.anomalyPercent > 0 ? "+" : ""}${summary.anomalyPercent.toLocaleString("en-US", { maximumFractionDigits: 1 })}% vs. typical ${monthOnlyLabel}`}
              </span>
            </div>

            <div className="anomaly-meter-rows">
              <div className="anomaly-meter-row">
                <div className="anomaly-meter-row-meta">
                  <span className="anomaly-meter-row-label">
                    Selected Month Detections ({periodLabel})
                  </span>
                  <strong className="anomaly-meter-row-value">
                    {formatCount(summary.currentCount)}
                    {summary.currentIsEstimated ? " · Estimated" : ""}
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
                    Typical Same-Month Baseline (Median across{" "}
                    {summary.baselineYears.length}{" "}
                    {summary.baselineYears.length === 1 ? "year" : "years"})
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

      <dl className="analytics-details">
        <div>
          <dt>
            Selected Month Hotspots
            <span className="analytics-detail-help">
              Total satellite heat detections recorded in this area during the
              selected month.
            </span>
          </dt>
          <dd>
            {summary
              ? formatCount(summary.currentCount)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
            {summary?.currentIsEstimated && (
              <span className="estimated-text"> · Estimated</span>
            )}
          </dd>
        </div>
        <div>
          <dt>
            Typical Monthly Baseline (Median)
            <span className="analytics-detail-help">
              Middle value of past years for this exact calendar month (less
              skewed by extreme fire years).
            </span>
          </dt>
          <dd>
            {summary
              ? formatCount(summary.historicalMedian)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>
            Deviation from Typical Month
            <span className="analytics-detail-help">
              Percentage above (+) or below (-) the historical monthly median.
            </span>
          </dt>
          <dd>
            {summary
              ? summary.anomalyPercent === null
                ? summary.label === "not_calculable"
                  ? "Not calculable"
                  : "Not available"
                : `${summary.anomalyPercent > 0 ? "+" : ""}${summary.anomalyPercent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>
            Sensor Breakdown (VIIRS / MODIS)
            <span className="analytics-detail-help">
              High-detail 375m sensor vs. long-term 1km historical sensor.
            </span>
          </dt>
          <dd>
            {summary
              ? `VIIRS: ${formatCount(summary.byInstrument.VIIRS)} · MODIS: ${formatCount(summary.byInstrument.MODIS)}`
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>
            Historical Baseline Years Used
            <span className="analytics-detail-help">
              Complete past years included when computing the typical monthly
              baseline.
            </span>
          </dt>
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
          <dt>
            Archive Data Coverage
            <span className="analytics-detail-help">
              Earliest to latest satellite records available for this area.
            </span>
          </dt>
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

      <div className="analytics-notes">
        <span className="notes-label">Operational &amp; Data Limitations</span>
        <ul>
          {notes.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HarmonizationPanel({
  resource,
}: {
  resource: ClientResource<HarmonizationResponse>;
}) {
  const info = resource.data?.info;
  const notes =
    info?.notes.length
      ? info.notes
      : resource.error
        ? [resource.error.message]
        : ["No additional harmonization notes supplied for this region."];

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
        Newer VIIRS satellites (375m resolution) detect smaller thermal hotspots
        than older MODIS satellites (1km resolution). To keep 20+ year CDRRMO
        baselines fair and consistent, historical MODIS-only years are scaled to
        VIIRS-equivalent counts using years when both sensors observed this area
        together.
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
          <dt>
            MODIS-to-VIIRS Scaling Factor
            <span className="analytics-detail-help">
              Multiplier applied to historical 1km MODIS counts to match 375m
              VIIRS sensitivity.
            </span>
          </dt>
          <dd>
            {info
              ? formatMetric(info.factor, "×")
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            Sensor Overlap Calibration Years
            <span className="analytics-detail-help">
              Shared years when both MODIS and VIIRS operated simultaneously to
              calibrate the ratio.
            </span>
          </dt>
          <dd>
            {info
              ? formatYears(info.overlapYears)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            Calibration Agreement (Correlation)
            <span className="analytics-detail-help">
              How closely scaled MODIS tracks actual VIIRS monthly counts during
              overlap (1.0 is ideal).
            </span>
          </dt>
          <dd>
            {info
              ? formatMetric(info.correlation)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            Typical Calibration Error (MAPE)
            <span className="analytics-detail-help">
              Average percentage difference between scaled MODIS and actual
              VIIRS during overlap months.
            </span>
          </dt>
          <dd>
            {info
              ? formatMetric(info.errorPercent, "%")
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            MODIS-Estimated Years
            <span className="analytics-detail-help">
              Pre-VIIRS historical years converted using the scaling factor
              above.
            </span>
          </dt>
          <dd>
            {info
              ? formatYears(info.estimatedYears)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            Calibration Scope
            <span className="analytics-detail-help">
              Geographic level used to calculate the scaling factor for this
              jurisdiction.
            </span>
          </dt>
          <dd>
            {info
              ? info.factorScope === "province"
                ? "Provincial calibration"
                : "National fallback calibration"
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
      </dl>

      <div className="analytics-notes harmonization-notes">
        <span className="notes-label">Calibration Method Notes</span>
        <ul>
          {notes.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function OverlapChart({
  resource,
}: {
  resource: ClientResource<HarmonizationResponse>;
}) {
  const overlap = resource.data?.overlap ?? [];
  const maxCount = overlap.reduce(
    (max, point) =>
      Math.max(
        max,
        point.modis ?? 0,
        point.modisScaled ?? 0,
        point.viirs ?? 0
      ),
    0
  );
  const chartHeight = 120;
  const chartWidth = Math.max(420, overlap.length * 76);

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
        <span className="panel-context">Overlap period</span>
      </div>

      <p className="analytics-panel-intro">
        This verification chart compares raw 1km MODIS detections, scaled MODIS
        baseline estimates, and actual 375m VIIRS detections during months when
        both sensors were active, showing how closely the calibrated historical
        baseline aligns with modern satellite observations.
      </p>

      {resource.isLoading ? (
        <p className="chart-message" role="status">
          Loading overlap data…
        </p>
      ) : resource.error ? (
        <p className="chart-message analytics-error" role="alert">
          {resource.error.message}
        </p>
      ) : overlap.length === 0 ? (
        <p className="chart-message" role="status">
          No overlap chart data is available for this region.
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
              viewBox={`0 0 ${chartWidth} ${chartHeight + 34}`}
              role="img"
              aria-labelledby="overlap-chart-title overlap-chart-desc"
            >
              <title id="overlap-chart-title">
                Monthly MODIS, scaled MODIS, and VIIRS overlap counts
              </title>
              <desc id="overlap-chart-desc">
                MODIS, scaled MODIS, and VIIRS counts per overlap month.
              </desc>
              {overlap.map((point, index) => {
                const center = 38 + index * 76;
                const monthLabel = `${point.year}-${String(point.month).padStart(2, "0")}`;
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
                return (
                  <g key={monthLabel}>
                    {values.map(({ label, value, className }, valueIndex) => {
                      const height =
                        value !== null && maxCount > 0
                          ? (value / maxCount) * chartHeight
                          : 0;
                      const x = center - 21 + valueIndex * 15;
                      return (
                        <g key={label}>
                          <title>
                            {monthLabel} {label}:{" "}
                            {value === null
                              ? "No data"
                              : value.toLocaleString("en-US")}
                          </title>
                          {value !== null && (
                            <rect
                              x={x}
                              y={chartHeight - Math.max(height, 1)}
                              width="12"
                              height={Math.max(height, 1)}
                              rx="2"
                              className={className}
                            />
                          )}
                        </g>
                      );
                    })}
                    <text
                      x={center}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      className="chart-period"
                    >
                      {monthLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
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
                {overlap.map((point) => (
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
        </>
      )}

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
    </section>
  );
}

