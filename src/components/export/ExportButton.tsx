"use client";

import { useState } from "react";

import type {
  ExportMetric,
  HotspotFiltersForExport,
} from "@/lib/export/types";

interface ExportButtonProps {
  filters: HotspotFiltersForExport;
  metric: ExportMetric;
  year?: number;
  month?: number;
}

async function downloadCsv(
  url: string,
  filename: string,
): Promise<{ truncated: boolean }> {
  const response = await fetch(url);
  const body = await response.blob();
  if (!response.ok) {
    throw new Error("The export could not be created.");
  }

  const objectUrl = URL.createObjectURL(body);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
  return { truncated: response.headers.get("X-Fire-Memory-Truncated") === "true" };
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
    const selectedYear = year ?? Number(filters.start.slice(0, 4));
    const selectedMonth = month ?? Number(filters.start.slice(5, 7));
    if (Number.isInteger(selectedYear) && Number.isInteger(selectedMonth)) {
      params.set("year", String(selectedYear));
      params.set("month", String(selectedMonth));
    }
  }
  return params.toString();
}

export function ExportButton({
  filters,
  metric,
  year,
  month,
}: ExportButtonProps) {
  const [activeExport, setActiveExport] = useState<"hotspots" | "analytics" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  async function exportFile(kind: "hotspots" | "analytics") {
    setActiveExport(kind);
    setMessage(null);
    try {
      const query = queryString(
        filters,
        kind === "analytics" ? metric : undefined,
        year,
        month,
      );
      const result = await downloadCsv(
        `/api/export/${kind === "hotspots" ? "csv" : "analytics-csv"}?${query}`,
        `fire-memory-${kind}.csv`,
      );
      setMessage(
        result.truncated
          ? "Hotspot export downloaded, but it was truncated at the server limit."
          : `${kind === "hotspots" ? "Hotspot" : "Analytics"} export downloaded.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The export could not be created.",
      );
    } finally {
      setActiveExport(null);
    }
  }

  return (
    <section
      aria-labelledby="export-controls-title"
      className="export-card"
    >
      <h2 id="export-controls-title" className="export-title">
        Export data
      </h2>
      <p className="export-description">
        Downloads use the dashboard&apos;s active region, date, and metric filters.
      </p>
      <div className="export-actions">
        <button
          type="button"
          onClick={() => exportFile("hotspots")}
          disabled={activeExport !== null}
          className="export-button export-button-secondary"
        >
          {activeExport === "hotspots" ? "Preparing..." : "Hotspot CSV"}
        </button>
        <button
          type="button"
          onClick={() => exportFile("analytics")}
          disabled={activeExport !== null}
          className="export-button export-button-primary"
        >
          {activeExport === "analytics" ? "Preparing..." : "Analytics CSV"}
        </button>
      </div>
      {message ? (
        <p role="status" className="export-message">
          {message}
        </p>
      ) : null}
    </section>
  );
}
