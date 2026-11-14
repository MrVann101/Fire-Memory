import { NextResponse } from "next/server";
import { z } from "zod";

import { queryHotspots } from "@/lib/db/hotspots";
import {
  AppValidationError,
  RegionNotFoundError,
  parseBBoxParam,
} from "@/lib/db/validation";
import { toCsv } from "@/lib/export/csv";
import type { HotspotFiltersForExport } from "@/lib/export/types";

function buildFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "selection";
}

function parseFilters(request: Request): HotspotFiltersForExport {
  const searchParams = new URL(request.url).searchParams;
  const regionId = searchParams.get("regionId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const instrument = searchParams.get("instrument") ?? "ALL";
  const bbox = parseBBoxParam(searchParams.get("bbox"));

  const parsed = z
    .object({
      regionId: z.string().min(1),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      instrument: z.enum(["MODIS", "VIIRS", "ALL"]),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    })
    .safeParse({ regionId, start, end, instrument, bbox });

  if (!parsed.success) {
    throw new Error("Invalid hotspot export filters.");
  }
  if (parsed.data.regionId === "custom" && !parsed.data.bbox) {
    throw new Error("A bbox is required for a custom hotspot export.");
  }

  return parsed.data;
}

export async function GET(request: Request) {
  let filters: HotspotFiltersForExport;
  try {
    filters = parseFilters(request);
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_EXPORT_REQUEST",
        message: error instanceof Error ? error.message : "Invalid export filters.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await queryHotspots(filters, 10_000);
    const csv = toCsv(response.hotspots);
    const filename = `fire-memory-${buildFilenameSegment(filters.regionId)}-${filters.start}-${filters.end}-${filters.instrument ?? "ALL"}.csv`;
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Fire-Memory-Truncated": String(response.truncated),
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
      { error: "HOTSPOT_EXPORT_FAILED", message: "The hotspot export failed." },
      { status: 502 },
    );
  }
}
