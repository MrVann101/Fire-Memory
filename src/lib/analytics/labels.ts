import type { AnomalyLabel, Instrument, Metric } from "@/contracts/types";

export const NEAR_BASELINE_THRESHOLD_PCT = 15;
export const UNUSUALLY_HIGH_THRESHOLD_PCT = 50;
export const SMALL_BASELINE_YEARS_THRESHOLD = 5;

export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes (current - median) / median * 100.
 * Returns null if current is null, median is null, or median <= 0 (never divides by zero).
 */
export function calculateAnomalyPercent(
  currentCount: number | null,
  historicalMedian: number | null
): number | null {
  if (
    currentCount === null ||
    historicalMedian === null ||
    historicalMedian <= 0 ||
    !Number.isFinite(currentCount) ||
    !Number.isFinite(historicalMedian)
  ) {
    return null;
  }
  return roundToTwoDecimals(
    ((currentCount - historicalMedian) / historicalMedian) * 100
  );
}

/**
 * Pure anomaly label classifier based on documented setup thresholds:
 * - below_baseline: anomalyPercent < -15%
 * - near_baseline: -15% <= anomalyPercent <= +15%
 * - above_baseline: +15% < anomalyPercent < +50%
 * - unusually_high: anomalyPercent >= +50%
 * - not_calculable: current missing or baseline 0/missing
 */
export function classifyAnomalyLabel(
  currentCount: number | null,
  historicalMedian: number | null,
  anomalyPercent: number | null
): AnomalyLabel {
  if (
    currentCount === null ||
    historicalMedian === null ||
    historicalMedian <= 0 ||
    anomalyPercent === null
  ) {
    return "not_calculable";
  }
  if (anomalyPercent >= UNUSUALLY_HIGH_THRESHOLD_PCT) {
    return "unusually_high";
  }
  if (anomalyPercent > NEAR_BASELINE_THRESHOLD_PCT) {
    return "above_baseline";
  }
  if (anomalyPercent >= -NEAR_BASELINE_THRESHOLD_PCT) {
    return "near_baseline";
  }
  return "below_baseline";
}

export function isCurrentUtcMonthInProgress(
  year: number,
  month: number,
  now: Date = new Date()
): boolean {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  return year === currentYear && month === currentMonth;
}

export function buildAnalyticsNotes(params: {
  year: number;
  month: number;
  metric: Metric;
  instrument: Instrument | "ALL";
  currentCount: number | null;
  currentIsEstimated: boolean;
  historicalMedian: number | null;
  baselineYears: number[];
  estimatedBaselineYears: number[];
  approximate: boolean;
  isNational?: boolean;
  now?: Date;
}): string[] {
  const notes: string[] = [];
  const paddedMonth = String(params.month).padStart(2, "0");

  if (params.approximate) {
    notes.push(
      "Grid-approximated: computed from 0.1-degree grid cells intersecting the selected bounding box using the national harmonization factor."
    );
  }

  if (isCurrentUtcMonthInProgress(params.year, params.month, params.now)) {
    notes.push(
      `Selected month (${params.year}-${paddedMonth} UTC) is currently in progress; counts are partial and not scaled.`
    );
  }

  if (params.currentCount === null) {
    notes.push(
      `No satellite data coverage available for ${params.year}-${paddedMonth} UTC (missing data is shown as null, never zero).`
    );
  } else if (params.currentIsEstimated) {
    notes.push(
      `Selected period (${params.year}-${paddedMonth} UTC) uses MODIS counts converted to VIIRS-equivalent values and is marked estimated.`
    );
  }

  if (params.historicalMedian === null || params.baselineYears.length === 0) {
    notes.push(
      "Insufficient historical baseline coverage for this calendar month; anomaly is not_calculable."
    );
  } else if (params.historicalMedian === 0) {
    notes.push(
      "Historical median is 0; percentage anomaly cannot be calculated without dividing by zero (not_calculable)."
    );
  }

  if (
    params.baselineYears.length > 0 &&
    params.baselineYears.length < SMALL_BASELINE_YEARS_THRESHOLD
  ) {
    notes.push(
      `Small baseline sample: only ${params.baselineYears.length} complete historical year(s) used in median.`
    );
  }

  if (params.estimatedBaselineYears.length > 0) {
    notes.push(
      `Baseline includes ${params.estimatedBaselineYears.length} MODIS-converted estimated year(s): ${params.estimatedBaselineYears.join(", ")}.`
    );
  }

  if (params.metric === "raw" && params.instrument === "ALL") {
    notes.push(
      "Raw ALL sums unharmonized MODIS and VIIRS hotspot counts; sensors differ in spatial resolution and sensitivity."
    );
  }

  if (params.isNational) {
    notes.push(
      "National totals include all detections inside the Philippine boundary, including coastal or unassigned points."
    );
  }

  notes.push("Months grouped in UTC.");

  return notes;
}
