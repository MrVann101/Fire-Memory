"use client";

import { useState } from "react";

import {
  ANALYTICS_CSV_COLUMNS,
  HOTSPOT_CSV_COLUMNS,
  buildAnalyticsCsvFilename,
  buildHotspotCsvFilename,
  parseContentDispositionFilename,
} from "@/lib/export/csv";
import type {
  ExportMetric,
  HotspotFiltersForExport,
} from "@/lib/export/types";

export interface ExportButtonProps {
  filters: HotspotFiltersForExport;
  metric: ExportMetric;
  regionName?: string;
  year?: number;
  month?: number;
}

type ExportStatusTone = "success" | "warning" | "error";

interface ExportStatus {
  tone: ExportStatusTone;
  text: string;
}

function resolveExportYearMonth(
  filters: HotspotFiltersForExport,
  year?: number,
  month?: number,
): { resolvedYear: number; resolvedMonth: number } {
  const parsedYear = Number(filters.start.slice(0, 4));
  const parsedMonth = Number(filters.start.slice(5, 7));

  const resolvedYear =
    typeof year === "number" && Number.isInteger(year)
      ? year
      : Number.isInteger(parsedYear) && parsedYear > 0
        ? parsedYear
        : new Date().getUTCFullYear();

  const resolvedMonth =
    typeof month === "number" && Number.isInteger(month)
      ? month
      : Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : new Date().getUTCMonth() + 1;

  return { resolvedYear, resolvedMonth };
}

async function downloadCsv(
  url: string,
  fallbackFilename: string,
): Promise<{ filename: string; truncated: boolean }> {
  const response = await fetch(url);
  const body = await response.blob();
  if (!response.ok) {
    throw new Error("The export could not be created.");
  }

  const resolvedFilename =
    parseContentDispositionFilename(
      response.headers.get("Content-Disposition"),
    ) ?? fallbackFilename;

  const objectUrl = URL.createObjectURL(body);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = resolvedFilename;
  link.click();
  URL.revokeObjectURL(objectUrl);

  return {
    filename: resolvedFilename,
    truncated: response.headers.get("X-Fire-Memory-Truncated") === "true",
  };
}

function queryString(
  filters: HotspotFiltersForExport,
  metric?: ExportMetric,
  year?: number,
  month?: number,
): string {
  const params = new URLSearchParams({
    regionId: filters.regionId,
    start: filters.start,
    end: filters.end,
    instrument: filters.instrument ?? "ALL",
  });
  if (filters.bbox) {
    params.set("bbox", filters.bbox.join(","));
  }
  if (metric) {
    params.set("metric", metric);
  }
  if (metric === "harmonized" || metric === "raw") {
    const { resolvedYear, resolvedMonth } = resolveExportYearMonth(
      filters,
      year,
      month,
    );
    params.set("year", String(resolvedYear));
    params.set("month", String(resolvedMonth));
  }
  return params.toString();
}

export function ExportButton({
  filters,
  metric,
  regionName,
  year,
  month,
}: ExportButtonProps) {
  const [activeExport, setActiveExport] = useState<"hotspots" | "analytics" | null>(
    null,
  );
  const [status, setStatus] = useState<ExportStatus | null>(null);

  const { resolvedYear, resolvedMonth } = resolveExportYearMonth(
    filters,
    year,
    month,
  );
  const hotspotFilename = buildHotspotCsvFilename(
    filters.regionId,
    filters.start,
    filters.end,
  );
  const analyticsFilename = buildAnalyticsCsvFilename(
    filters.regionId,
    resolvedYear,
    resolvedMonth,
    metric,
  );

  async function exportFile(kind: "hotspots" | "analytics") {
    setActiveExport(kind);
    setStatus(null);
    try {
      const query = queryString(
        filters,
        kind === "analytics" ? metric : undefined,
        resolvedYear,
        resolvedMonth,
      );
      const fallbackFilename =
        kind === "hotspots" ? hotspotFilename : analyticsFilename;
      const result = await downloadCsv(
        `/api/export/${kind === "hotspots" ? "csv" : "analytics-csv"}?${query}`,
        fallbackFilename,
      );
      if (result.truncated) {
        setStatus({
          tone: "warning",
          text: `Downloaded ${result.filename} — note: hotspot rows were capped at the 10,000-row server limit. Narrow the date range or area if full coverage is needed.`,
        });
      } else {
        setStatus({
          tone: "success",
          text: `${
            kind === "hotspots"
              ? "Hotspot Coordinates CSV"
              : "Monthly Baseline & Anomaly CSV"
          } downloaded (${result.filename}).`,
        });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "The export could not be created.",
      });
    } finally {
      setActiveExport(null);
    }
  }

  const targetArea = regionName ?? filters.regionId;
  const dateWindow = `${filters.start} → ${filters.end}`;
  const analysisMode =
    metric === "harmonized" ? "Harmonized (VIIRS-eq)" : "Raw Sensor";
  const sensorFilter = filters.instrument ?? "ALL";

  return (
    <section
      aria-labelledby="export-controls-title"
      className="export-card"
    >
      <header className="export-header">
        <p className="eyebrow export-eyebrow">CDRRMO DATA EXPORT</p>
        <h2 id="export-controls-title" className="export-title">
          Export Fire Intelligence CSV
        </h2>
        <p className="export-description">
          Download filtered hotspot coordinates or historical monthly baseline series.
        </p>
      </header>

      <div className="export-scope-grid" aria-label="Active export scope">
        <div className="export-scope-item">
          <span className="export-scope-label">Target Area</span>
          <strong className="export-scope-value">{targetArea}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">Date Window</span>
          <strong className="export-scope-value">{dateWindow}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">Metric Mode</span>
          <strong className="export-scope-value">{analysisMode}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">Sensor</span>
          <strong className="export-scope-value">{sensorFilter}</strong>
        </div>
      </div>

      <div className="export-options-grid">
        <article className="export-option-card">
          <div className="export-option-body">
            <div className="export-option-top">
              <span className="export-option-tag">GIS &amp; FIELD DISPATCH</span>
              <span className="export-option-format">CSV · UTF-8</span>
            </div>
            <h3 className="export-option-title">
              Hotspot Coordinates CSV
            </h3>
            <p className="export-option-description">
              Point coordinates, sensor source, radiative power (FRP), and UTC timestamps.
            </p>
            <div
              className="export-preview-metrics"
              aria-label="Hotspot CSV preview metrics"
            >
              <div className="export-preview-item">
                <span className="export-preview-label">Coordinates</span>
                <span className="export-preview-value">Lat / Lon (WGS84)</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">Intensity</span>
                <span className="export-preview-value">FRP (MW) &amp; Confidence</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">Source</span>
                <span className="export-preview-value">VIIRS 375m / MODIS 1km</span>
              </div>
            </div>
            <div
              className="export-column-pills"
              aria-label="Included hotspot CSV columns"
            >
              {HOTSPOT_CSV_COLUMNS.map((column) => (
                <span key={column} className="export-column-pill">
                  {column}
                </span>
              ))}
            </div>
            <div className="export-file-badge" title={hotspotFilename}>
              <span className="export-file-badge-label">OUTPUT</span>
              <code className="export-file-badge-name">{hotspotFilename}</code>
            </div>
          </div>
          <div className="export-actions">
            <button
              type="button"
              onClick={() => exportFile("hotspots")}
              disabled={activeExport !== null}
              className="export-button export-button-secondary"
            >
              {activeExport === "hotspots"
                ? "Preparing Hotspot CSV..."
                : "Download Hotspot CSV"}
            </button>
          </div>
        </article>

        <article className="export-option-card">
          <div className="export-option-body">
            <div className="export-option-top">
              <span className="export-option-tag">CDRRMO BRIEFING SERIES</span>
              <span className="export-option-format">CSV · UTF-8</span>
            </div>
            <h3 className="export-option-title">
              Monthly Baseline &amp; Anomaly CSV
            </h3>
            <p className="export-option-description">
              Multi-year monthly counts, historical median baseline, and anomaly percentages.
            </p>
            <div
              className="export-preview-metrics"
              aria-label="Monthly baseline CSV preview metrics"
            >
              <div className="export-preview-item">
                <span className="export-preview-label">Time Series</span>
                <span className="export-preview-value">Monthly UTC Counts</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">Benchmark</span>
                <span className="export-preview-value">Same-Month Median</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">Deviation</span>
                <span className="export-preview-value">Anomaly % &amp; Status</span>
              </div>
            </div>
            <div
              className="export-column-pills"
              aria-label="Included analytics CSV columns"
            >
              {ANALYTICS_CSV_COLUMNS.map((column) => (
                <span key={column} className="export-column-pill">
                  {column}
                </span>
              ))}
            </div>
            <div className="export-file-badge" title={analyticsFilename}>
              <span className="export-file-badge-label">OUTPUT</span>
              <code className="export-file-badge-name">{analyticsFilename}</code>
            </div>
          </div>
          <div className="export-actions">
            <button
              type="button"
              onClick={() => exportFile("analytics")}
              disabled={activeExport !== null}
              className="export-button export-button-primary"
            >
              {activeExport === "analytics"
                ? "Preparing Monthly Baseline CSV..."
                : "Download Monthly Baseline CSV"}
            </button>
          </div>
        </article>
      </div>

      {status ? (
        <p
          role="status"
          className={`export-message export-message-${status.tone}`}
        >
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
