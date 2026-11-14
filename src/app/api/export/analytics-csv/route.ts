import { NextResponse } from "next/server";
import { z } from "zod";

import { getCalendar } from "@/lib/analytics/calendar";
import { getAnalyticsSummary } from "@/lib/analytics/summary";
import {
  AppValidationError,
  RegionNotFoundError,
  parseBBoxParam,
} from "@/lib/db/validation";
import { buildAnalyticsCsvFilename, toAnalyticsCsv } from "@/lib/export/csv";
import type { AnalyticsCsvRow, ExportMetric } from "@/lib/export/types";

function parseMetric(value: string | null): ExportMetric {
  if (value === "raw" || value === "harmonized") {
    return value;
  }
  throw new Error("Metric must be raw or harmonized.");
}

function parseAnalyticsRequest(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const regionId = searchParams.get("regionId");
  const metric = parseMetric(searchParams.get("metric"));
  const instrument = searchParams.get("instrument") ?? "ALL";
  const bbox = parseBBoxParam(searchParams.get("bbox"));
  const selectedYear = Number(
    searchParams.get("year") ?? new Date().getUTCFullYear(),
  );
  const selectedMonth = Number(
    searchParams.get("month") ?? new Date().getUTCMonth() + 1,
  );

  const parsed = z
    .object({
      regionId: z.string().min(1),
      metric: z.enum(["raw", "harmonized"]),
      instrument: z.enum(["MODIS", "VIIRS", "ALL"]),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
      year: z.number().int().min(1900).max(2200),
      month: z.number().int().min(1).max(12),
    })
    .safeParse({ regionId, metric, instrument, bbox, year: selectedYear, month: selectedMonth });

  if (!parsed.success) {
    throw new Error("Invalid analytics export filters.");
  }
  if (parsed.data.regionId === "custom" && !parsed.data.bbox) {
    throw new Error("A bbox is required for a custom analytics export.");
  }
  return parsed.data;
}

export async function GET(request: Request) {
  let filters: ReturnType<typeof parseAnalyticsRequest>;
  try {
    filters = parseAnalyticsRequest(request);
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_EXPORT_REQUEST",
        message: error instanceof Error ? error.message : "Invalid analytics filters.",
      },
      { status: 400 },
    );
  }

  const commonParams = {
    regionId: filters.regionId,
    metric: filters.metric,
    instrument: filters.instrument,
    ...(filters.bbox ? { bbox: filters.bbox } : {}),
  };

  try {
    const [calendar, summary] = await Promise.all([
      getCalendar(commonParams),
      getAnalyticsSummary({
        ...commonParams,
        year: filters.year,
        month: filters.month,
      }),
    ]);

    const rows: AnalyticsCsvRow[] = calendar.cells.map((cell) => ({
      year: cell.year,
      month: cell.month,
      metric: filters.metric,
      count: cell.count,
      estimated: cell.estimated,
      historicalMedian:
        cell.year === filters.year && cell.month === filters.month
          ? summary.historicalMedian
          : null,
      anomalyPercent:
        cell.year === filters.year && cell.month === filters.month
          ? summary.anomalyPercent
          : null,
      label:
        cell.year === filters.year && cell.month === filters.month
          ? summary.label
          : "",
    }));
    const csv = toAnalyticsCsv(rows);
    const filename = buildAnalyticsCsvFilename(
      filters.regionId,
      filters.year,
      filters.month,
      filters.metric,
    );

    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Fire-Memory-Truncated": "false",
        "Access-Control-Expose-Headers":
          "Content-Disposition, X-Fire-Memory-Truncated",
      },
    });
  } catch (error) {
    if (error instanceof AppValidationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 },
      );
    }
    if (error instanceof RegionNotFoundError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "ANALYTICS_EXPORT_FAILED", message: "The analytics export failed." },
      { status: 502 },
    );
  }
}
