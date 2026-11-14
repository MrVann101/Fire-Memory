import type { AnalyticsCsvRow, HotspotForExport } from "./types";

export const HOTSPOT_CSV_COLUMNS = [
  "id",
  "latitude",
  "longitude",
  "acquisitionDatetime",
  "satellite",
  "instrument",
  "confidence",
  "brightness",
  "sourceProduct",
] as const;

export const ANALYTICS_CSV_COLUMNS = [
  "year",
  "month",
  "metric",
  "count",
  "estimated",
  "historicalMedian",
  "anomalyPercent",
  "label",
] as const;

function protectSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = protectSpreadsheetFormula(String(value));
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function rowsToCsv(columns: readonly string[], rows: readonly unknown[][]): string {
  return [
    columns.join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
}

export function toCsv(hotspots: readonly HotspotForExport[]): string {
  return rowsToCsv(
    HOTSPOT_CSV_COLUMNS,
    hotspots.map((hotspot) => [
      hotspot.id,
      hotspot.latitude,
      hotspot.longitude,
      hotspot.acquisitionDatetime,
      hotspot.satellite,
      hotspot.instrument,
      hotspot.confidence,
      hotspot.brightness,
      hotspot.sourceProduct,
    ]),
  );
}

export function toAnalyticsCsv(rows: readonly AnalyticsCsvRow[]): string {
  return rowsToCsv(
    ANALYTICS_CSV_COLUMNS,
    rows.map((row) => [
      row.year,
      row.month,
      row.metric,
      row.count,
      row.estimated,
      row.historicalMedian,
      row.anomalyPercent,
      row.label,
    ]),
  );
}
