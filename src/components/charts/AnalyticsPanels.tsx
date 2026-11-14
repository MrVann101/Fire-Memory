"use client";

import type {
  AnalyticsSummary,
  AnomalyLabel,
  HarmonizationResponse,
} from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";

const anomalyPresentation: Record<
  AnomalyLabel,
  { icon: string; label: string; description: string }
> = {
  below_baseline: {
    icon: "↓",
    label: "Below baseline",
    description: "Activity is lower than the historical median.",
  },
  near_baseline: {
    icon: "≈",
    label: "Near baseline",
    description: "Activity is close to the historical median.",
  },
  above_baseline: {
    icon: "↑",
    label: "Above baseline",
    description: "Activity is higher than the historical median.",
  },
  unusually_high: {
    icon: "!",
    label: "Unusually high",
    description: "Activity is substantially above the historical baseline.",
  },
  not_calculable: {
    icon: "—",
    label: "Not calculable",
    description: "A percentage comparison is unavailable for this baseline.",
  },
};

function formatCount(value: number | null): string {
  return value === null ? "No data" : value.toLocaleString("en-US");
}

function formatYears(years: number[]): string {
  return years.length > 0 ? years.join(", ") : "No data";
}

function formatMetric(value: number | null, suffix = ""): string {
  return value === null
    ? "Not available"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}${suffix}`;
}

export function AnomalyPanel({
  resource,
}: {
  resource: ClientResource<AnalyticsSummary>;
}) {
  const summary = resource.data;
  const anomaly = summary ? anomalyPresentation[summary.label] : null;
  const title = resource.isLoading
    ? "Loading comparison…"
    : resource.error
      ? "Comparison unavailable"
      : anomaly?.label ?? "No comparison loaded";
  const notes =
    summary?.notes.length
      ? summary.notes
      : resource.error
        ? [resource.error.message]
        : ["No notes supplied for this comparison."];

  return (
    <section className="analytics-panel anomaly-panel" aria-labelledby="anomaly-title">
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">BASELINE COMPARISON</p>
          <h2 id="anomaly-title">Anomaly assessment</h2>
        </div>
        {anomaly && (
          <span
            className={`anomaly-icon anomaly-${summary?.label}`}
            aria-hidden="true"
          >
            {anomaly.icon}
          </span>
        )}
      </div>

      <div
        className={`anomaly-status${resource.error ? " analytics-error" : ""}`}
        role={resource.error ? "alert" : "status"}
        aria-live="polite"
      >
        <span className="anomaly-status-label">{title}</span>
        {anomaly && <span className="anomaly-status-description">{anomaly.description}</span>}
        {!summary && resource.error && (
          <span className="anomaly-status-description">{resource.error.message}</span>
        )}
      </div>

      <dl className="analytics-details">
        <div>
          <dt>Current detections</dt>
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
          <dt>Baseline years</dt>
          <dd>
            {summary
              ? formatYears(summary.baselineYears)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Historical median</dt>
          <dd>
            {summary
              ? formatCount(summary.historicalMedian)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Difference from median</dt>
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
          <dt>Estimated baseline years</dt>
          <dd>
            {summary
              ? formatYears(summary.estimatedBaselineYears)
              : resource.isLoading
                ? "Loading…"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Data coverage</dt>
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
        <span className="notes-label">Notes</span>
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
        : ["No notes supplied for this region."];

  return (
    <section
      className="analytics-panel harmonization-panel"
      aria-labelledby="harmonization-title"
    >
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">SENSOR NORMALIZATION</p>
          <h2 id="harmonization-title">Harmonization</h2>
        </div>
        <span className="method-chip">
          {info?.method ?? (resource.isLoading ? "Loading…" : "Not available")}
        </span>
      </div>

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
          <dt>Calibration factor</dt>
          <dd>
            {info
              ? formatMetric(info.factor)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Overlap years</dt>
          <dd>
            {info
              ? formatYears(info.overlapYears)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Correlation</dt>
          <dd>
            {info
              ? formatMetric(info.correlation)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Error</dt>
          <dd>
            {info
              ? formatMetric(info.errorPercent, "%")
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Estimated years</dt>
          <dd>
            {info
              ? formatYears(info.estimatedYears)
              : resource.isLoading
                ? "Loading…"
                : "Not available"}
          </dd>
        </div>
      </dl>

      <div className="analytics-notes harmonization-notes">
        <span className="notes-label">Method notes</span>
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
    <section className="analytics-panel overlap-panel" aria-labelledby="overlap-title">
      <div className="analytics-panel-heading">
        <div>
          <p className="eyebrow">SENSOR OVERLAP</p>
          <h2 id="overlap-title">MODIS vs VIIRS</h2>
        </div>
        <span className="panel-context">Overlap period</span>
      </div>

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
                  { label: "MODIS", value: point.modis, className: "modis-bar" },
                  {
                    label: "Scaled MODIS",
                    value: point.modisScaled,
                    className: "scaled-modis-bar",
                  },
                  { label: "VIIRS", value: point.viirs, className: "viirs-bar" },
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
                  <th scope="col">MODIS</th>
                  <th scope="col">Scaled MODIS</th>
                  <th scope="col">VIIRS</th>
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
          <span className="chart-legend-swatch modis-swatch" aria-hidden="true" />
          MODIS
        </span>
        <span>
          <span
            className="chart-legend-swatch scaled-modis-swatch"
            aria-hidden="true"
          />
          Scaled MODIS
        </span>
        <span>
          <span className="chart-legend-swatch viirs-swatch" aria-hidden="true" />
          VIIRS
        </span>
      </div>
    </section>
  );
}
