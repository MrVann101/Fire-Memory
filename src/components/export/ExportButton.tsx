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
  const dateWindow = `${filters.start} to ${filters.end} (UTC)`;
  const analysisMode =
    metric === "harmonized"
      ? "Harmonized (VIIRS-equivalent)"
      : "Raw Sensor Counts";
  const sensorFilter = filters.instrument ?? "ALL";

  return (
    <section
      aria-labelledby="export-controls-title"
      className="export-card"
    >
      <header className="export-header">
        <p className="eyebrow export-eyebrow">CDRRMO REPORTING · DATA EXPORT</p>
        <h2 id="export-controls-title" className="export-title">
          Export Fire Intelligence CSV
        </h2>
        <p className="export-description">
          Exports reflect the currently selected area, period, and sensor filters
          for use in LGU situational reports, GIS mapping, and BFP coordination.
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
          <span className="export-scope-label">Analysis Mode</span>
          <strong className="export-scope-value">{analysisMode}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">Sensor Filter</span>
          <strong className="export-scope-value">{sensorFilter}</strong>
        </div>
      </div>

      <div className="export-options-grid">
        <article className="export-option-card">
          <div className="export-option-body">
            <h3 className="export-option-title">
              Hotspot Coordinates CSV (Field &amp; GIS Mapping)
            </h3>
            <p className="export-option-description">
              Exports individual satellite thermal detections (
              <code>latitude</code>, <code>longitude</code>,{" "}
              <code>acquisitionDatetime</code>, <code>satellite</code>,{" "}
              <code>instrument</code>, <code>confidence</code>,{" "}
              <code>brightness</code>) for mapping in QGIS/ArcGIS or sharing
              coordinates with BFP/Barangay responders.
            </p>
            <p className="export-option-meta">
              <span>Columns: {HOTSPOT_CSV_COLUMNS.join(", ")}</span>
              <span>File: {hotspotFilename}</span>
            </p>
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
            <h3 className="export-option-title">
              Monthly Baseline &amp; Anomaly CSV (CDRRMO Situation Report)
            </h3>
            <p className="export-option-description">
              Exports the full historical monthly series (<code>year</code>,{" "}
              <code>month</code>, <code>metric</code>, <code>count</code>,{" "}
              <code>estimated</code>, <code>historicalMedian</code>,{" "}
              <code>anomalyPercent</code>, <code>label</code>) for LGU briefings
              and seasonal trend tables.
            </p>
            <p className="export-option-meta">
              <span>Columns: {ANALYTICS_CSV_COLUMNS.join(", ")}</span>
              <span>File: {analyticsFilename}</span>
            </p>
          </div>
          <div className="export-actions">
            <button
              type="button"
              onClick={() => exportFile("analytics")}
              disabled={activeExport !== null}
              className="export-button export-button-primary"
            >
              {activeExport === "analytics"
                ? "Preparing Analytics CSV..."
                : "Download Analytics CSV"}
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
