import type {
  AnalyticsQuery,
  CalendarCell,
  CalendarResponse,
  Instrument,
} from "@/contracts/types";
import calendarMock from "@/mocks/calendar.json";
import { requireRegionWithDbId } from "@/lib/db/regions";
import {
  DatabaseProviderError,
  getSupabaseServerClient,
  isMocksEnabled,
} from "@/lib/db/supabase";
import { AppValidationError } from "@/lib/db/validation";
import { getHarmonizationInfoForRegion } from "./harmonization";
import { roundToTwoDecimals } from "./labels";

interface HarmonizedCalendarRow {
  year: number;
  month: number;
  harmonized_count: number | null;
  is_estimated: boolean;
}

interface RawCalendarRow {
  year: number;
  month: number;
  instrument: Instrument;
  raw_count: number;
  has_coverage: boolean;
}

interface GridCalendarRow {
  year: number;
  month: number;
  count: number | null;
  estimated: boolean;
}

export async function getCalendar(
  query: Omit<AnalyticsQuery, "year" | "month">
): Promise<CalendarResponse> {
  const effectiveInstrument: Instrument | "ALL" =
    query.metric === "harmonized" ? "ALL" : (query.instrument ?? "ALL");

  if (isMocksEnabled()) {
    const resolved =
      query.regionId === "custom"
        ? null
        : await requireRegionWithDbId(query.regionId);
    const base = calendarMock.calendar as CalendarResponse;
    return {
      ...base,
      regionId: resolved ? resolved.region.id : query.regionId,
      metric: query.metric,
      instrument: effectiveInstrument,
      approximate: query.regionId === "custom",
      harmonization:
        query.metric === "harmonized" ? base.harmonization : null,
    };
  }

  const supabase = getSupabaseServerClient();

  if (query.regionId === "custom") {
    if (!query.bbox) {
      throw new AppValidationError(
        "bbox is required when regionId is 'custom'."
      );
    }

    const harmonization =
      query.metric === "harmonized"
        ? await getHarmonizationInfoForRegion("custom")
        : null;

    if (
      query.metric === "harmonized" &&
      (!harmonization || harmonization.factor === null)
    ) {
      return {
        regionId: "custom",
        metric: query.metric,
        instrument: effectiveInstrument,
        approximate: true,
        cells: [],
        harmonization,
      };
    }

    const { data, error } = await supabase.rpc("get_custom_bbox_calendar", {
      p_min_lon: query.bbox[0],
      p_min_lat: query.bbox[1],
      p_max_lon: query.bbox[2],
      p_max_lat: query.bbox[3],
      p_metric: query.metric,
      p_instrument: effectiveInstrument,
      p_national_factor: harmonization?.factor ?? null,
    });

    if (error) {
      throw new DatabaseProviderError("Failed to compute custom area calendar.");
    }

    const cells: CalendarCell[] = ((data ?? []) as GridCalendarRow[]).map(
      (r) => ({
        year: r.year,
        month: r.month,
        count: r.count !== null ? roundToTwoDecimals(r.count) : null,
        estimated: r.estimated,
      })
    );

    return {
      regionId: "custom",
      metric: query.metric,
      instrument: effectiveInstrument,
      approximate: true,
      cells,
      harmonization,
    };
  }

  const { region, dbId } = await requireRegionWithDbId(query.regionId);

  if (query.metric === "harmonized") {
    const [{ data, error }, harmonization] = await Promise.all([
      supabase
        .from("monthly_harmonized")
        .select("year, month, harmonized_count, is_estimated")
        .eq("region_id", dbId)
        .order("year", { ascending: true })
        .order("month", { ascending: true }),
      getHarmonizationInfoForRegion(region.id),
    ]);

    if (error) {
      throw new DatabaseProviderError(
        "Failed to load harmonized calendar data."
      );
    }

    const directRows = (data ?? []) as HarmonizedCalendarRow[];

    if (directRows.length === 0 && region.level === "country") {
      const { data: natData, error: natError } = await supabase.rpc(
        "get_national_calendar",
        {
          p_metric: "harmonized",
          p_instrument: "ALL",
        }
      );
      if (natError) {
        throw new DatabaseProviderError(
          "Failed to load national harmonized calendar data."
        );
      }
      const cells: CalendarCell[] = ((natData ?? []) as GridCalendarRow[]).map(
        (r) => ({
          year: r.year,
          month: r.month,
          count: r.count !== null ? roundToTwoDecimals(r.count) : null,
          estimated: r.estimated,
        })
      );
      return {
        regionId: region.id,
        metric: "harmonized",
        instrument: "ALL",
        approximate: false,
        cells,
        harmonization,
      };
    }

    if (directRows.length === 0 && region.level === "region") {
      const { data: bboxData, error: bboxError } = await supabase.rpc(
        "get_custom_bbox_calendar",
        {
          p_min_lon: region.bbox[0],
          p_min_lat: region.bbox[1],
          p_max_lon: region.bbox[2],
          p_max_lat: region.bbox[3],
          p_metric: "harmonized",
          p_instrument: "ALL",
          p_national_factor: harmonization?.factor ?? null,
        }
      );
      if (bboxError) {
        throw new DatabaseProviderError(
          "Failed to load regional bounding-box harmonized calendar data."
        );
      }
      const cells: CalendarCell[] = ((bboxData ?? []) as GridCalendarRow[]).map(
        (r) => ({
          year: r.year,
          month: r.month,
          count: r.count !== null ? roundToTwoDecimals(r.count) : null,
          estimated: r.estimated,
        })
      );
      return {
        regionId: region.id,
        metric: "harmonized",
        instrument: "ALL",
        approximate: true,
        cells,
        harmonization,
      };
    }

    const cells: CalendarCell[] = directRows.map((row) => ({
      year: row.year,
      month: row.month,
      count:
        row.harmonized_count !== null
          ? roundToTwoDecimals(row.harmonized_count)
          : null,
      estimated: row.harmonized_count !== null ? row.is_estimated : false,
    }));

    return {
      regionId: region.id,
      metric: "harmonized",
      instrument: "ALL",
      approximate: false,
      cells,
      harmonization,
    };
  }

  // Raw calendar
  let q = supabase
    .from("monthly_counts")
    .select("year, month, instrument, raw_count, has_coverage")
    .eq("region_id", dbId)
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (effectiveInstrument !== "ALL") {
    q = q.eq("instrument", effectiveInstrument);
  }

  const { data, error } = await q;
  if (error) {
    throw new DatabaseProviderError("Failed to load raw calendar data.");
  }

  const rows = (data ?? []) as RawCalendarRow[];

  if (rows.length === 0 && region.level === "country") {
    const { data: natData, error: natError } = await supabase.rpc(
      "get_national_calendar",
      {
        p_metric: "raw",
        p_instrument: effectiveInstrument,
      }
    );
    if (natError) {
      throw new DatabaseProviderError(
        "Failed to load national raw calendar data."
      );
    }
    const cells: CalendarCell[] = ((natData ?? []) as GridCalendarRow[]).map(
      (r) => ({
        year: r.year,
        month: r.month,
        count: r.count !== null ? roundToTwoDecimals(r.count) : null,
        estimated: false,
      })
    );
    return {
      regionId: region.id,
      metric: "raw",
      instrument: effectiveInstrument,
      approximate: false,
      cells,
      harmonization: null,
    };
  }

  if (rows.length === 0 && region.level === "region") {
    const { data: bboxData, error: bboxError } = await supabase.rpc(
      "get_custom_bbox_calendar",
      {
        p_min_lon: region.bbox[0],
        p_min_lat: region.bbox[1],
        p_max_lon: region.bbox[2],
        p_max_lat: region.bbox[3],
        p_metric: "raw",
        p_instrument: effectiveInstrument,
        p_national_factor: null,
      }
    );
    if (bboxError) {
      throw new DatabaseProviderError(
        "Failed to load regional bounding-box raw calendar data."
      );
    }
    const cells: CalendarCell[] = ((bboxData ?? []) as GridCalendarRow[]).map(
      (r) => ({
        year: r.year,
        month: r.month,
        count: r.count !== null ? roundToTwoDecimals(r.count) : null,
        estimated: false,
      })
    );
    return {
      regionId: region.id,
      metric: "raw",
      instrument: effectiveInstrument,
      approximate: true,
      cells,
      harmonization: null,
    };
  }

  const byPeriod = new Map<
    string,
    { year: number; month: number; sum: number; anyCoverage: boolean }
  >();

  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    let entry = byPeriod.get(key);
    if (!entry) {
      entry = {
        year: row.year,
        month: row.month,
        sum: 0,
        anyCoverage: false,
      };
      byPeriod.set(key, entry);
    }
    if (row.has_coverage) {
      entry.sum += row.raw_count;
      entry.anyCoverage = true;
    }
  }

  const cells: CalendarCell[] = Array.from(byPeriod.values())
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map((entry) => ({
      year: entry.year,
      month: entry.month,
      count: entry.anyCoverage ? entry.sum : null,
      estimated: false,
    }));

  return {
    regionId: region.id,
    metric: "raw",
    instrument: effectiveInstrument,
    approximate: false,
    cells,
    harmonization: null,
  };
}
