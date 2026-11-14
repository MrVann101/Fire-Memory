import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsNotes,
  calculateAnomalyPercent,
  classifyAnomalyLabel,
  isCurrentUtcMonthInProgress,
} from "@/lib/analytics/labels";

describe("Analytics Anomaly Calculations & Pure Labels", () => {
  it("computes anomaly percent accurately and avoids division by zero", () => {
    assert.equal(calculateAnomalyPercent(38, 22), 72.73);
    assert.equal(calculateAnomalyPercent(20, 20), 0);
    assert.equal(calculateAnomalyPercent(10, 20), -50);
    assert.equal(calculateAnomalyPercent(5, 0), null);
    assert.equal(calculateAnomalyPercent(5, null), null);
    assert.equal(calculateAnomalyPercent(null, 20), null);
  });

  it("classifies all 5 AnomalyLabel values according to thresholds", () => {
    assert.equal(classifyAnomalyLabel(null, 20, null), "not_calculable");
    assert.equal(classifyAnomalyLabel(10, 0, null), "not_calculable");
    assert.equal(classifyAnomalyLabel(10, null, null), "not_calculable");

    assert.equal(classifyAnomalyLabel(15, 20, -25), "below_baseline");
    assert.equal(classifyAnomalyLabel(17, 20, -15), "near_baseline");
    assert.equal(classifyAnomalyLabel(20, 20, 0), "near_baseline");
    assert.equal(classifyAnomalyLabel(23, 20, 15), "near_baseline");
    assert.equal(classifyAnomalyLabel(24, 20, 20), "above_baseline");
    assert.equal(classifyAnomalyLabel(30, 20, 50), "unusually_high");
    assert.equal(classifyAnomalyLabel(40, 20, 100), "unusually_high");
  });

  it("detects in-progress UTC month accurately", () => {
    const fixedNow = new Date("2026-11-14T05:00:00.000Z");
    assert.equal(isCurrentUtcMonthInProgress(2026, 11, fixedNow), true);
    assert.equal(isCurrentUtcMonthInProgress(2026, 10, fixedNow), false);
    assert.equal(isCurrentUtcMonthInProgress(2025, 11, fixedNow), false);
  });

  it("produces explicit notes for partial month, small baseline, estimated years, and custom bbox", () => {
    const notes = buildAnalyticsNotes({
      year: 2026,
      month: 11,
      metric: "harmonized",
      instrument: "ALL",
      currentCount: 14,
      currentIsEstimated: false,
      historicalMedian: 12,
      baselineYears: [2008, 2024, 2025],
      estimatedBaselineYears: [2008],
      approximate: true,
      now: new Date("2026-11-14T05:00:00.000Z"),
    });

    assert.ok(notes.some((n) => n.includes("Grid-approximated")));
    assert.ok(notes.some((n) => n.includes("currently in progress")));
    assert.ok(notes.some((n) => n.includes("Small baseline sample")));
    assert.ok(notes.some((n) => n.includes("MODIS-converted estimated")));
    assert.ok(notes.some((n) => n.includes("Months grouped in UTC")));
  });
});
