import assert from "node:assert/strict";
import test from "node:test";
import {
  harmonizeMonthlyCounts,
  type MonthlyInputRow,
} from "./harmonize";

function row(
  regionId: string,
  year: number,
  month: number,
  instrument: "MODIS" | "VIIRS",
  activeCellDays: number,
) {
  return {
    region_id: regionId,
    year,
    month,
    instrument,
    raw_count: activeCellDays,
    active_cell_days: activeCellDays,
    has_coverage: true,
  };
}

const fixtureRows: MonthlyInputRow[] = [];
for (let year = 2020; year <= 2022; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    const modis = 10 + month + (year - 2020) * 2;
    fixtureRows.push(
      row("province-a", year, month, "MODIS", modis),
      row("province-a", year, month, "VIIRS", modis * 2),
    );
  }
}
fixtureRows.push(
  row("province-b", 2020, 1, "MODIS", 20),
  row("province-b", 2020, 1, "VIIRS", 40),
  row("province-b", 2020, 2, "MODIS", 8),
  row("province-a", 2017, 3, "MODIS", 5),
);

test("calibrates province factors and falls back to the national median", () => {
  const result = harmonizeMonthlyCounts(fixtureRows);
  const provinceFactor = result.factors.find(
    ({ region_id }) => region_id === "province-a",
  );
  const fallbackFactor = result.factors.find(
    ({ region_id }) => region_id === "province-b",
  );
  const nationalFactor = result.factors.find(
    ({ region_id }) => region_id === null,
  );

  assert.equal(provinceFactor?.scope, "province");
  assert.equal(provinceFactor?.factor, 2);
  assert.equal(provinceFactor?.month_count, 36);
  assert.equal(fallbackFactor?.scope, "national");
  assert.equal(fallbackFactor?.factor, 2);
  assert.equal(nationalFactor?.factor, 2);
  assert.equal(result.report.factorSummary.provinceFactorCount, 1);
  assert.equal(result.report.factorSummary.nationalFallbackCount, 1);
});

test("uses VIIRS directly, estimates only pre-NOAA-20 months, and does not fill unknowns", () => {
  const result = harmonizeMonthlyCounts(fixtureRows);
  const estimated = result.monthlyHarmonized.find(
    ({ year, region_id }) => year === 2017 && region_id === "province-a",
  );
  const direct = result.monthlyHarmonized.find(
    ({ year, month, region_id }) =>
      year === 2020 && month === 1 && region_id === "province-a",
  );
  const unknownCoverage = result.monthlyHarmonized.find(
    ({ year, month, region_id }) =>
      year === 2020 && month === 2 && region_id === "province-b",
  );

  assert.deepEqual(
    {
      harmonized_count: estimated?.harmonized_count,
      is_estimated: estimated?.is_estimated,
    },
    { harmonized_count: 10, is_estimated: true },
  );
  assert.equal(direct?.is_estimated, false);
  assert.equal(direct?.harmonized_count, 22);
  assert.equal(unknownCoverage, undefined);
  assert.equal(result.report.estimatedRows, 1);
  assert.deepEqual(result.report.estimatedYears, [2017]);
  assert.equal(result.report.modisOnlyUnknownCoverageRows, 1);
  assert.equal(result.report.unobservedMonthsFilledAsZero, 0);
});

test("reports in-sample, leave-one-year-out, and anomaly consistency metrics", () => {
  const result = harmonizeMonthlyCounts(fixtureRows);
  const validation = result.report.validation;
  assert.equal(validation.nationalInSample.correlation, 1);
  assert.equal(validation.nationalInSample.mean_absolute_error, 0);
  assert.deepEqual(validation.leaveOneYearOut.heldOutYears, [2020, 2021, 2022]);
  assert.equal(validation.leaveOneYearOut.mean_absolute_error, 0);
  assert.equal(validation.anomalyConsistency.comparedMonths, 36);
  assert.equal(validation.anomalyConsistency.agreementRate, 1);
});
