import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_CSV_COLUMNS,
  HOTSPOT_CSV_COLUMNS,
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
