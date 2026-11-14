import assert from "node:assert/strict";
import test from "node:test";
import { MonthlyAggregateBuilder } from "./aggregate";
import { assignAdmin2Region, loadRegions } from "./load-regions";
import { normalizeCsv } from "./normalize";

const boundaries = loadRegions();
const modis = normalizeCsv(
  [
    "latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence",
    "8.1575,125.1278,300,2024-01-01,0800,A,MODIS,75",
    "8.1576,125.1279,301,2024-01-01,0801,T,MODIS,80",
    "8.1575,125.1278,300,2024-01-02,0800,A,MODIS,75",
    "0,0,290,2024-02-01,0800,A,MODIS,50",
  ].join("\n"),
  "MODIS",
);
const viirs = normalizeCsv(
  [
    "latitude,longitude,bright_ti4,acq_date,acq_time,satellite,instrument,confidence",
    "8.1575,125.1278,310,2024-01-01,0800,N20,VIIRS,n",
  ].join("\n"),
  "VIIRS",
);

test("counts unique 0.01-degree cell-days by province, month, and instrument", () => {
  const builder = new MonthlyAggregateBuilder(boundaries);
  builder.addFile({
    file: "modis_2024.csv",
    instrument: "MODIS",
    sourceRows: modis.records.length + modis.duplicateCount,
    duplicateRows: modis.duplicateCount,
    records: modis.records,
  });
  builder.addFile({
    file: "viirs_2024.csv",
    instrument: "VIIRS",
    sourceRows: viirs.records.length + viirs.duplicateCount,
    duplicateRows: viirs.duplicateCount,
    records: viirs.records,
  });

  const result = builder.result();
  const provinceId = assignAdmin2Region(8.1575, 125.1278, boundaries);
  assert.ok(provinceId);
  const modisMonth = result.monthlyCounts.find(
    (row) => row.region_id === provinceId && row.instrument === "MODIS",
  );
  const viirsMonth = result.monthlyCounts.find(
    (row) => row.region_id === provinceId && row.instrument === "VIIRS",
  );
  assert.deepEqual(
    {
      raw_count: modisMonth?.raw_count,
      active_cell_days: modisMonth?.active_cell_days,
      has_coverage: modisMonth?.has_coverage,
    },
    { raw_count: 3, active_cell_days: 2, has_coverage: true },
  );
  assert.deepEqual(
    {
      raw_count: viirsMonth?.raw_count,
      active_cell_days: viirsMonth?.active_cell_days,
      has_coverage: viirsMonth?.has_coverage,
    },
    { raw_count: 1, active_cell_days: 1, has_coverage: true },
  );
  assert.equal(
    result.monthlyCounts.some((row) => row.month === 2),
    false,
  );
  assert.equal(result.report.unassignedRowsExcluded, 1);
  assert.equal(result.monthlyGridCounts.length, 3);
});

test("drops exact cross-file duplicates without merging sensors or nearby detections", () => {
  const builder = new MonthlyAggregateBuilder(boundaries);
  const input = {
    file: "viirs_2024.csv",
    instrument: "VIIRS" as const,
    sourceRows: viirs.records.length + viirs.duplicateCount,
    duplicateRows: viirs.duplicateCount,
    records: viirs.records,
  };
  builder.addFile(input);
  builder.addFile({ ...input, file: "viirs_duplicate.csv" });

  const result = builder.result();
  assert.equal(result.monthlyCounts.length, 1);
  assert.equal(result.monthlyCounts[0].raw_count, 1);
  assert.equal(result.monthlyCounts[0].active_cell_days, 1);
  assert.equal(result.report.duplicateRowsAcrossInputs, 1);
  assert.equal(result.report.coverageByYearInstrument[0].normalizedUniqueRows, 2);
});
