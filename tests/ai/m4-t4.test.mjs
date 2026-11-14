import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_CSV_COLUMNS,
  HOTSPOT_CSV_COLUMNS,
  buildAnalyticsCsvFilename,
  buildFilenameSegment,
  buildHotspotCsvFilename,
  parseContentDispositionFilename,
  toAnalyticsCsv,
  toCsv,
} from "../../src/lib/export/csv.ts";

test("exports hotspot fields in contract order with escaped values", () => {
  const csv = toCsv([
    {
      id: "hotspot-1",
      latitude: 7.1,
      longitude: 125.2,
      acquisitionDatetime: "2025-11-14T00:00:00Z",
      satellite: 'NOAA "20"',
      instrument: "VIIRS",
      confidence: "n",
      brightness: null,
      sourceProduct: "product,version",
    },
  ]);

  assert.equal(csv.split("\r\n")[0], HOTSPOT_CSV_COLUMNS.join(","));
  assert.match(csv, /"NOAA ""20"""/);
  assert.match(csv, /"product,version"/);
  assert.match(csv, /VIIRS,n,/);
});

test("protects spreadsheet formulas and preserves analytics nulls", () => {
  const csv = toAnalyticsCsv([
    {
      year: 2025,
      month: 11,
      metric: "harmonized",
      count: null,
      estimated: true,
      historicalMedian: null,
      anomalyPercent: null,
      label: "=not_calculable",
    },
  ]);

  assert.equal(csv.split("\r\n")[0], ANALYTICS_CSV_COLUMNS.join(","));
  assert.match(csv, /,,true,,,'=not_calculable/);
});

test("protects tab and carriage-return formula prefixes", () => {
  const csv = toAnalyticsCsv([
    {
      year: 2025,
      month: 11,
      metric: "harmonized",
      count: null,
      estimated: false,
      historicalMedian: null,
      anomalyPercent: null,
      label: "\t=SUM(A1:A2)",
    },
    {
      year: 2025,
      month: 12,
      metric: "harmonized",
      count: null,
      estimated: false,
      historicalMedian: null,
      anomalyPercent: null,
      label: "\r+SUM(A1:A2)",
    },
  ]);

  assert.match(csv, /'\t=SUM\(A1:A2\)/);
  assert.match(csv, /'\r\+SUM\(A1:A2\)/);
});

test("builds descriptive CDRRMO CSV filenames and parses Content-Disposition", () => {
  assert.equal(buildFilenameSegment("CAR / Benguet"), "CAR-Benguet");
  assert.equal(buildFilenameSegment("///"), "selection");
  assert.equal(
    buildHotspotCsvFilename("ph-benguet", "2025-03-01", "2025-03-31"),
    "fire-memory-hotspots-ph-benguet-2025-03-01-to-2025-03-31.csv",
  );
  assert.equal(
    buildAnalyticsCsvFilename("ph-benguet", 2025, 3, "harmonized"),
    "fire-memory-analytics-ph-benguet-2025-03-harmonized.csv",
  );
  assert.equal(
    parseContentDispositionFilename(
      'attachment; filename="fire-memory-hotspots-ph-benguet-2025-03-01-to-2025-03-31.csv"',
    ),
    "fire-memory-hotspots-ph-benguet-2025-03-01-to-2025-03-31.csv",
  );
  assert.equal(parseContentDispositionFilename(null), null);
});
