"use client";

import { useState } from "react";

import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
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
import { getTranslations } from "@/lib/i18n/translations";

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
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
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
          text:
            language === "ceb"
              ? `Na-download ang ${result.filename} — pahinumdom: gilimitahan sa 10,000 ka linya ang export. Gamita ang mas mubo nga petsa o lugar kon gikinahanglan.`
              : language === "fil"
                ? `Na-download ang ${result.filename} — paalala: limitado sa 10,000 na hanay ang export. Paliitin ang petsa o lugar kung kailangan ang kumpletong datos.`
                : `Downloaded ${result.filename} — note: hotspot rows were capped at the 10,000-row server limit. Narrow the date range or area if full coverage is needed.`,
        });
      } else {
        setStatus({
          tone: "success",
          text:
            kind === "hotspots"
              ? t.exportPanel.formatDownloadedHotspots(result.filename)
              : t.exportPanel.formatDownloadedSummary(result.filename),
        });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : t.exportPanel.fallbackError,
      });
    } finally {
      setActiveExport(null);
    }
  }

  const targetArea = regionName ?? filters.regionId;
  const dateWindow = `${filters.start} → ${filters.end}`;
  const analysisMode =
    metric === "harmonized"
      ? t.exportPanel.harmonizedScopeValue
      : t.exportPanel.rawScopeValue;
  const sensorFilter = filters.instrument ?? "ALL";

  const coordsLabel =
    language === "ceb"
      ? "Koordinato"
      : language === "fil"
        ? "Koordinato"
        : "Coordinates";
  const intensityLabel =
    language === "ceb"
      ? "Kakusog"
      : language === "fil"
        ? "Tindi"
        : "Intensity";
  const sourceLabel =
    language === "ceb"
      ? "Tinubdan"
      : language === "fil"
        ? "Pinagmulan"
        : "Source";
  const seriesLabel =
    language === "ceb"
      ? "Serye sa Oras"
      : language === "fil"
        ? "Serye ng Oras"
        : "Time Series";
  const benchmarkLabel =
    language === "ceb"
      ? "Basehan"
      : language === "fil"
        ? "Batayan"
        : "Benchmark";
  const deviationLabel =
    language === "ceb"
      ? "Kausaban"
      : language === "fil"
        ? "Pagkakaiba"
        : "Deviation";

  return (
    <section
      aria-labelledby="export-controls-title"
      className="export-card"
    >
      <header className="export-header">
        <p className="eyebrow export-eyebrow">{t.exportPanel.eyebrow}</p>
        <h2 id="export-controls-title" className="export-title">
          {t.exportPanel.title}
        </h2>
        <p className="export-description">{t.exportPanel.intro}</p>
      </header>

      <div
        className="export-scope-grid"
        aria-label={t.exportPanel.activeFilters}
      >
        <div className="export-scope-item">
          <span className="export-scope-label">{t.exportPanel.regionScope}</span>
          <strong className="export-scope-value">{targetArea}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">{t.exportPanel.periodScope}</span>
          <strong className="export-scope-value">{dateWindow}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">{t.exportPanel.metricScope}</span>
          <strong className="export-scope-value">{analysisMode}</strong>
        </div>
        <div className="export-scope-item">
          <span className="export-scope-label">
            {t.exportPanel.instrumentScope}
          </span>
          <strong className="export-scope-value">{sensorFilter}</strong>
        </div>
      </div>

      <div className="export-options-grid">
        <article className="export-option-card">
          <div className="export-option-body">
            <div className="export-option-top">
              <span className="export-option-tag">GIS &amp; FIELD DISPATCH</span>
              <span className="export-option-format">{t.exportPanel.rawCsvFormat}</span>
            </div>
            <h3 className="export-option-title">{t.exportPanel.rawCsvTitle}</h3>
            <p className="export-option-description">
              {t.exportPanel.rawCsvDesc}
            </p>
            <div
              className="export-preview-metrics"
              aria-label={t.exportPanel.rawCsvTitle}
            >
              <div className="export-preview-item">
                <span className="export-preview-label">{coordsLabel}</span>
                <span className="export-preview-value">Lat / Lon (WGS84)</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">{intensityLabel}</span>
                <span className="export-preview-value">FRP (MW) &amp; Confidence</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">{sourceLabel}</span>
                <span className="export-preview-value">VIIRS 375m / MODIS 1km</span>
              </div>
            </div>
            <div
              className="export-column-pills"
              aria-label={t.exportPanel.columnsIncludedLabel}
            >
              {HOTSPOT_CSV_COLUMNS.map((column) => (
                <span key={column} className="export-column-pill">
                  {column}
                </span>
              ))}
            </div>
            <div className="export-file-badge" title={hotspotFilename}>
              <span className="export-file-badge-label">
                {t.exportPanel.filenameLabel}
              </span>
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
                ? t.exportPanel.preparingCsv
                : t.exportPanel.downloadHotspots}
            </button>
          </div>
        </article>

        <article className="export-option-card">
          <div className="export-option-body">
            <div className="export-option-top">
              <span className="export-option-tag">CDRRMO BRIEFING SERIES</span>
              <span className="export-option-format">
                {t.exportPanel.analyticsCsvFormat}
              </span>
            </div>
            <h3 className="export-option-title">
              {t.exportPanel.analyticsCsvTitle}
            </h3>
            <p className="export-option-description">
              {t.exportPanel.analyticsCsvDesc}
            </p>
            <div
              className="export-preview-metrics"
              aria-label={t.exportPanel.analyticsCsvTitle}
            >
              <div className="export-preview-item">
                <span className="export-preview-label">{seriesLabel}</span>
                <span className="export-preview-value">Monthly UTC Counts</span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">{benchmarkLabel}</span>
                <span className="export-preview-value">
                  {t.analytics.sameMonthMedian}
                </span>
              </div>
              <div className="export-preview-item">
                <span className="export-preview-label">{deviationLabel}</span>
                <span className="export-preview-value">
                  {t.analytics.anomalyDelta}
                </span>
              </div>
            </div>
            <div
              className="export-column-pills"
              aria-label={t.exportPanel.columnsIncludedLabel}
            >
              {ANALYTICS_CSV_COLUMNS.map((column) => (
                <span key={column} className="export-column-pill">
                  {column}
                </span>
              ))}
            </div>
            <div className="export-file-badge" title={analyticsFilename}>
              <span className="export-file-badge-label">
                {t.exportPanel.filenameLabel}
              </span>
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
                ? t.exportPanel.preparingSummary
                : t.exportPanel.downloadSummary}
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
