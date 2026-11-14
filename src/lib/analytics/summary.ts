import type {
  AnalyticsQuery,
  AnalyticsSummary,
  BBox,
  Instrument,
} from "@/contracts/types";
import summariesMock from "@/mocks/summaries.json";
import { requireRegion } from "@/lib/db/regions";
import {
  DatabaseProviderError,
  getSupabaseServerClient,
  isMocksEnabled,
} from "@/lib/db/supabase";
import { AppValidationError } from "@/lib/db/validation";
import { getHarmonizationInfoForRegion } from "./harmonization";
import {
  buildAnalyticsNotes,
  calculateAnomalyPercent,
  classifyAnomalyLabel,
  roundToTwoDecimals,
} from "./labels";

interface HarmonizedMetricsRpcRow {
  current_count: number | null;
  current_is_estimated: boolean;
  historical_median: number | null;
  baseline_years: number[];
  estimated_baseline_years: number[];
  first_date: string | null;
  last_date: string | null;
  last_updated: string | null;
}

interface RawMetricsRpcRow {
  current_count: number | null;
  modis_count: number | null;
  viirs_count: number | null;
  historical_median: number | null;
  baseline_years: number[];
  first_date: string | null;
  last_date: string | null;
  last_updated: string | null;
}

interface GridCalendarRow {
  year: number;
  month: number;
  count: number | null;
  estimated: boolean;
}

function computeMedianInArray(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function getMockSummary(query: AnalyticsQuery): Promise<AnalyticsSummary> {
  if (query.regionId === "custom") {
    return {
      ...(summariesMock.customArea as AnalyticsSummary),
      period: { year: query.year, month: query.month },
      metric: query.metric,
      instrument:
        query.metric === "harmonized" ? "ALL" : (query.instrument ?? "ALL"),
    };
  }
  if (query.regionId === "PH-BAT") {
    return {
      ...(summariesMock.zeroBaseline as AnalyticsSummary),
      period: { year: query.year, month: query.month },
    };
  }
  if (query.metric === "raw") {
    return {
      ...(summariesMock.rawSummary as AnalyticsSummary),
      period: { year: query.year, month: query.month },
      instrument: query.instrument ?? "ALL",
    };
  }
  const region = await requireRegion(query.regionId);
  return {
    ...(summariesMock.harmonizedWithEstimated as AnalyticsSummary),
    region: { id: region.id, name: region.name, level: region.level },
    period: { year: query.year, month: query.month },
  };
}

async function getCustomAreaSummary(
  query: AnalyticsQuery,
  bbox: BBox,
  effectiveInstrument: Instrument | "ALL",
  currentUtcYear: number
): Promise<AnalyticsSummary> {
  const supabase = getSupabaseServerClient();
  const harmonization =
    query.metric === "harmonized"
      ? await getHarmonizationInfoForRegion("custom")
      : null;

  if (
    query.metric === "harmonized" &&
    (!harmonization || harmonization.factor === null)
  ) {
    throw new DatabaseProviderError(
      "National harmonization factor is missing; cannot compute custom area harmonized summary."
    );
  }

  const { data, error } = await supabase.rpc("get_custom_bbox_calendar", {
    p_min_lon: bbox[0],
    p_min_lat: bbox[1],
    p_max_lon: bbox[2],
    p_max_lat: bbox[3],
    p_metric: query.metric,
    p_instrument: effectiveInstrument,
    p_national_factor: harmonization?.factor ?? null,
  });

  if (error) {
    throw new DatabaseProviderError(
      "Failed to aggregate custom area grid counts."
    );
  }

  const rows = ((data ?? []) as GridCalendarRow[]).filter(
    (r) => r.count !== null
  );

  if (rows.length === 0) {
    const notes = buildAnalyticsNotes({
      year: query.year,
      month: query.month,
      metric: query.metric,
      instrument: effectiveInstrument,
      currentCount: null,
      currentIsEstimated: false,
      historicalMedian: null,
      baselineYears: [],
      estimatedBaselineYears: [],
      approximate: true,
    });

    return {
      region: {
        id: "custom",
        name: `Custom Area (${bbox.join(", ")})`,
        level: "custom",
      },
      period: { year: query.year, month: query.month },
      metric: query.metric,
      instrument: effectiveInstrument,
      currentCount: null,
      currentIsEstimated: false,
      byInstrument: { MODIS: null, VIIRS: null },
      baselineYears: [],
      estimatedBaselineYears: [],
      historicalMedian: null,
      anomalyPercent: null,
      label: "not_calculable",
      approximate: true,
      notes,
      dataCoverage: null,
      harmonization,
      lastUpdated: null,
    };
  }

  const currentRow = rows.find(
    (r) => r.year === query.year && r.month === query.month
  );
  const currentCount = currentRow?.count ?? null;
  const currentIsEstimated = currentRow?.estimated ?? false;

  const sameMonthBaseline = rows.filter(
    (r) =>
      r.month === query.month &&
      r.year < currentUtcYear &&
      r.year !== query.year &&
      r.count !== null
  );

  const baselineYears = sameMonthBaseline.map((r) => r.year).sort((a, b) => a - b);
  const estimatedBaselineYears = sameMonthBaseline
    .filter((r) => r.estimated)
    .map((r) => r.year)
    .sort((a, b) => a - b);

  const medianRaw = computeMedianInArray(
    sameMonthBaseline.map((r) => r.count as number)
  );
  const historicalMedian =
    medianRaw !== null ? roundToTwoDecimals(medianRaw) : null;

  const anomalyPercent = calculateAnomalyPercent(currentCount, historicalMedian);
  const label = classifyAnomalyLabel(
    currentCount,
    historicalMedian,
    anomalyPercent
  );

  const first = rows[0];
  const last = rows[rows.length - 1];
  const lastDayOfLastMonth = new Date(
    Date.UTC(last.year, last.month, 0)
  ).getUTCDate();

  const dataCoverage = {
    firstDate: `${first.year}-${String(first.month).padStart(2, "0")}-01`,
    lastDate: `${last.year}-${String(last.month).padStart(2, "0")}-${String(
      lastDayOfLastMonth
    ).padStart(2, "0")}`,
  };

  const notes = buildAnalyticsNotes({
    year: query.year,
    month: query.month,
    metric: query.metric,
    instrument: effectiveInstrument,
    currentCount,
    currentIsEstimated,
    historicalMedian,
    baselineYears,
    estimatedBaselineYears,
    approximate: true,
  });

  return {
    region: {
      id: "custom",
      name: `Custom Area (${bbox.map((n) => n.toFixed(2)).join(", ")})`,
      level: "custom",
    },
    period: { year: query.year, month: query.month },
    metric: query.metric,
    instrument: effectiveInstrument,
    currentCount,
    currentIsEstimated,
    byInstrument: { MODIS: null, VIIRS: null },
    baselineYears,
    estimatedBaselineYears,
    historicalMedian,
    anomalyPercent,
    label,
    approximate: true,
    notes,
    dataCoverage,
    harmonization,
    lastUpdated: null,
  };
}

export async function getAnalyticsSummary(
  query: AnalyticsQuery
): Promise<AnalyticsSummary> {
  if (isMocksEnabled()) {
    return getMockSummary(query);
  }

  const effectiveInstrument: Instrument | "ALL" =
    query.metric === "harmonized" ? "ALL" : (query.instrument ?? "ALL");
  const currentUtcYear = new Date().getUTCFullYear();

  if (query.regionId === "custom") {
    if (!query.bbox) {
      throw new AppValidationError(
        "bbox is required when regionId is 'custom'."
      );
    }
    return getCustomAreaSummary(
      query,
      query.bbox,
      effectiveInstrument,
      currentUtcYear
    );
  }

  const region = await requireRegion(query.regionId);
  const supabase = getSupabaseServerClient();

  if (query.metric === "harmonized") {
    const [{ data: rpcData, error: rpcError }, { data: rawRows, error: rawError }, harmonization] =
      await Promise.all([
        supabase.rpc("get_harmonized_summary_metrics", {
          p_region_id: region.id,
          p_target_year: query.year,
          p_month: query.month,
          p_current_utc_year: currentUtcYear,
        }),
        supabase
          .from("monthly_counts")
          .select("instrument, raw_count, has_coverage")
          .eq("region_id", region.id)
          .eq("year", query.year)
          .eq("month", query.month)
          .eq("has_coverage", true),
        getHarmonizationInfoForRegion(region.id),
      ]);

    if (rpcError || rawError) {
      throw new DatabaseProviderError(
        "Failed to compute harmonized analytics summary."
      );
    }

    const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | HarmonizedMetricsRpcRow
      | undefined;

    let modisRaw: number | null = null;
    let viirsRaw: number | null = null;
    for (const r of rawRows ?? []) {
      if (r.instrument === "MODIS") modisRaw = r.raw_count;
      if (r.instrument === "VIIRS") viirsRaw = r.raw_count;
    }

    const currentCount =
      row?.current_count !== null && row?.current_count !== undefined
        ? roundToTwoDecimals(row.current_count)
        : null;
    const currentIsEstimated = row?.current_is_estimated ?? false;
    const historicalMedian =
      row?.historical_median !== null && row?.historical_median !== undefined
        ? roundToTwoDecimals(row.historical_median)
        : null;
    const baselineYears = row?.baseline_years ?? [];
    const estimatedBaselineYears = row?.estimated_baseline_years ?? [];

    const anomalyPercent = calculateAnomalyPercent(
      currentCount,
      historicalMedian
    );
    const label = classifyAnomalyLabel(
      currentCount,
      historicalMedian,
      anomalyPercent
    );

    const dataCoverage =
      row?.first_date && row?.last_date
        ? { firstDate: row.first_date, lastDate: row.last_date }
        : null;

    const notes = buildAnalyticsNotes({
      year: query.year,
      month: query.month,
      metric: "harmonized",
      instrument: "ALL",
      currentCount,
      currentIsEstimated,
      historicalMedian,
      baselineYears,
      estimatedBaselineYears,
      approximate: false,
      isNational: region.level === "country",
    });

    return {
      region: { id: region.id, name: region.name, level: region.level },
      period: { year: query.year, month: query.month },
      metric: "harmonized",
      instrument: "ALL",
      currentCount,
      currentIsEstimated,
      byInstrument: { MODIS: modisRaw, VIIRS: viirsRaw },
      baselineYears,
      estimatedBaselineYears,
      historicalMedian,
      anomalyPercent,
      label,
      approximate: false,
      notes,
      dataCoverage,
      harmonization,
      lastUpdated: row?.last_updated
        ? new Date(row.last_updated).toISOString()
        : null,
    };
  }

  // Raw metric branch
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_raw_summary_metrics",
    {
      p_region_id: region.id,
      p_target_year: query.year,
      p_month: query.month,
      p_instrument: effectiveInstrument,
      p_current_utc_year: currentUtcYear,
    }
  );

  if (rpcError) {
    throw new DatabaseProviderError("Failed to compute raw analytics summary.");
  }

  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | RawMetricsRpcRow
    | undefined;

  const currentCount =
    row?.current_count !== null && row?.current_count !== undefined
      ? roundToTwoDecimals(row.current_count)
      : null;
  const historicalMedian =
    row?.historical_median !== null && row?.historical_median !== undefined
      ? roundToTwoDecimals(row.historical_median)
      : null;
  const baselineYears = row?.baseline_years ?? [];

  const anomalyPercent = calculateAnomalyPercent(
    currentCount,
    historicalMedian
  );
  const label = classifyAnomalyLabel(
    currentCount,
    historicalMedian,
    anomalyPercent
  );

  const dataCoverage =
    row?.first_date && row?.last_date
      ? { firstDate: row.first_date, lastDate: row.last_date }
      : null;

  const notes = buildAnalyticsNotes({
    year: query.year,
    month: query.month,
    metric: "raw",
    instrument: effectiveInstrument,
    currentCount,
    currentIsEstimated: false,
    historicalMedian,
    baselineYears,
    estimatedBaselineYears: [],
    approximate: false,
    isNational: region.level === "country",
  });

  return {
    region: { id: region.id, name: region.name, level: region.level },
    period: { year: query.year, month: query.month },
    metric: "raw",
    instrument: effectiveInstrument,
    currentCount,
    currentIsEstimated: false,
    byInstrument: {
      MODIS: row?.modis_count ?? null,
      VIIRS: row?.viirs_count ?? null,
    },
    baselineYears,
    estimatedBaselineYears: [],
    historicalMedian,
    anomalyPercent,
    label,
    approximate: false,
    notes,
    dataCoverage,
    harmonization: null,
    lastUpdated: row?.last_updated
      ? new Date(row.last_updated).toISOString()
      : null,
  };
}
