import { NextResponse } from "next/server";
import { z } from "zod";

import { toCsv } from "@/lib/export/csv";
import type {
  HotspotFiltersForExport,
  HotspotForExport,
} from "@/lib/export/types";

const bboxSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/)
  .transform((value) => value.split(",").map(Number) as [number, number, number, number]);

const hotspotResponseSchema = z.object({
  hotspots: z.array(
    z.object({
      id: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      acquisitionDatetime: z.string(),
      satellite: z.string(),
      instrument: z.enum(["MODIS", "VIIRS"]),
      confidence: z.union([z.string(), z.number()]).nullable(),
      brightness: z.number().nullable(),
      sourceProduct: z.string().nullable(),
    }),
  ),
  truncated: z.boolean(),
});

function buildFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "selection";
}

function parseFilters(request: Request): HotspotFiltersForExport {
  const searchParams = new URL(request.url).searchParams;
  const regionId = searchParams.get("regionId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const instrument = searchParams.get("instrument") ?? "ALL";
  const bbox = searchParams.get("bbox");

  const parsed = z
    .object({
      regionId: z.string().min(1),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      instrument: z.enum(["MODIS", "VIIRS", "ALL"]),
      bbox: bboxSchema.optional(),
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

function toBackendQuery(filters: HotspotFiltersForExport): string {
  const params = new URLSearchParams({
    regionId: filters.regionId,
    start: filters.start,
    end: filters.end,
    instrument: filters.instrument ?? "ALL",
    limit: "10000",
  });
  if (filters.bbox) {
    params.set("bbox", filters.bbox.join(","));
  }
  return params.toString();
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
    const backendResponse = await fetch(
      new URL(`/api/hotspots?${toBackendQuery(filters)}`, request.url),
      { cache: "no-store" },
    );
    const backendBody: unknown = await backendResponse.json().catch(() => null);
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: "HOTSPOT_QUERY_FAILED", message: "Hotspot data could not be loaded." },
        { status: 502 },
      );
    }

    const parsedBody = hotspotResponseSchema.safeParse(backendBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "INVALID_HOTSPOT_RESPONSE", message: "Hotspot data had an invalid shape." },
        { status: 502 },
      );
    }

    const csv = toCsv(parsedBody.data.hotspots as HotspotForExport[]);
    const filename = `fire-memory-${buildFilenameSegment(filters.regionId)}-${filters.start}-${filters.end}-${filters.instrument ?? "ALL"}.csv`;
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Fire-Memory-Truncated": String(parsedBody.data.truncated),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "HOTSPOT_EXPORT_FAILED", message: "The hotspot export failed." },
      { status: 502 },
    );
  }
}
