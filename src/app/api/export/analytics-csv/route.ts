import { NextResponse } from "next/server";
import { z } from "zod";

import { toAnalyticsCsv } from "@/lib/export/csv";
import type { AnalyticsCsvRow, ExportMetric } from "@/lib/export/types";

const calendarResponseSchema = z.object({
  cells: z.array(
    z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      count: z.number().nullable(),
      estimated: z.boolean(),
    }),
  ),
});

const summaryResponseSchema = z.object({
  historicalMedian: z.number().nullable(),
  anomalyPercent: z.number().nullable(),
  label: z.string(),
});

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
  const bbox = searchParams.get("bbox");
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
      bbox: z.string().optional(),
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

function backendUrl(
  request: Request,
  path: string,
  params: Record<string, string>,
): URL {
  const url = new URL(path, request.url);
  url.search = new URLSearchParams(params).toString();
  return url;
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
    const [calendarResponse, summaryResponse] = await Promise.all([
      fetch(backendUrl(request, "/api/analytics/calendar", commonParams), {
        cache: "no-store",
      }),
      fetch(
        backendUrl(request, "/api/analytics/summary", {
          ...commonParams,
          year: String(filters.year),
          month: String(filters.month),
        }),
        { cache: "no-store" },
      ),
    ]);

    if (!calendarResponse.ok || !summaryResponse.ok) {
      return NextResponse.json(
        { error: "ANALYTICS_QUERY_FAILED", message: "Analytics data could not be loaded." },
        { status: 502 },
      );
    }

    const [calendarBody, summaryBody]: [unknown, unknown] = await Promise.all([
      calendarResponse.json(),
      summaryResponse.json(),
    ]);
    const calendar = calendarResponseSchema.safeParse(calendarBody);
    const summary = summaryResponseSchema.safeParse(summaryBody);
    if (!calendar.success || !summary.success) {
      return NextResponse.json(
        { error: "INVALID_ANALYTICS_RESPONSE", message: "Analytics data had an invalid shape." },
        { status: 502 },
      );
    }

    const rows: AnalyticsCsvRow[] = calendar.data.cells.map((cell) => ({
      year: cell.year,
      month: cell.month,
      metric: filters.metric,
      count: cell.count,
      estimated: cell.estimated,
      historicalMedian:
        cell.year === filters.year && cell.month === filters.month
          ? summary.data.historicalMedian
          : null,
      anomalyPercent:
        cell.year === filters.year && cell.month === filters.month
          ? summary.data.anomalyPercent
          : null,
      label:
        cell.year === filters.year && cell.month === filters.month
          ? summary.data.label
          : "",
    }));
    const csv = toAnalyticsCsv(rows);
    const filename = `fire-memory-analytics-${filters.regionId}-${filters.metric}.csv`;

    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "ANALYTICS_EXPORT_FAILED", message: "The analytics export failed." },
      { status: 502 },
    );
  }
}
