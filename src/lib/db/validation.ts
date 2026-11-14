import { NextResponse } from "next/server";
import { z } from "zod";
import type { BBox, Instrument, Metric } from "@/contracts/types";
import { DatabaseProviderError } from "./supabase";

export class AppValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = "VALIDATION_ERROR";
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "AppValidationError";
    this.details = details;
  }
}

export class RegionNotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = "NOT_FOUND";

  constructor(regionId: string) {
    super(`Region "${regionId}" was not found.`);
    this.name = "RegionNotFoundError";
  }
}

export function parseBBoxParam(rawBBox: string | null): BBox | undefined {
  if (!rawBBox) {
    return undefined;
  }
  const parts = rawBBox.split(",").map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => p === "")) {
    throw new AppValidationError(
      "Invalid bbox format. Expected minLon,minLat,maxLon,maxLat."
    );
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new AppValidationError("bbox coordinates must be finite numbers.");
  }
  const [minLon, minLat, maxLon, maxLat] = nums;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    throw new AppValidationError(
      "bbox coordinates are out of valid WGS84 geographic bounds."
    );
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new AppValidationError(
      "bbox bounds are reversed or zero-area (min must be strictly less than max)."
    );
  }
  return [minLon, minLat, maxLon, maxLat];
}

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const HotspotQuerySchema = z
  .object({
    regionId: z.string().trim().min(1, "regionId is required"),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    start: z
      .string()
      .regex(isoDateRegex, "start must be YYYY-MM-DD (UTC)")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)), {
        message: "start is not a valid calendar date",
      }),
    end: z
      .string()
      .regex(isoDateRegex, "end must be YYYY-MM-DD (UTC)")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T23:59:59.999Z`)), {
        message: "end is not a valid calendar date",
      }),
    instrument: z.enum(["MODIS", "VIIRS", "ALL"]).default("ALL"),
    limit: z.coerce.number().int().min(1).max(10000).default(2000),
  })
  .superRefine((data, ctx) => {
    if (data.start > data.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start date must be less than or equal to end date",
        path: ["start"],
      });
    }
    if (data.regionId === "custom" && !data.bbox) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bbox is required when regionId is 'custom'",
        path: ["bbox"],
      });
    }
  });

const MetricSchema = z.enum(["harmonized", "raw"]).default("harmonized");
const InstrumentFilterSchema = z.enum(["MODIS", "VIIRS", "ALL"]).default("ALL");

const SummaryQuerySchema = z
  .object({
    regionId: z.string().trim().min(1, "regionId is required"),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    metric: MetricSchema,
    instrument: InstrumentFilterSchema,
  })
  .superRefine((data, ctx) => {
    if (data.regionId === "custom" && !data.bbox) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bbox is required when regionId is 'custom'",
        path: ["bbox"],
      });
    }
  });

const CalendarQuerySchema = z
  .object({
    regionId: z.string().trim().min(1, "regionId is required"),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    metric: MetricSchema,
    instrument: InstrumentFilterSchema,
  })
  .superRefine((data, ctx) => {
    if (data.regionId === "custom" && !data.bbox) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bbox is required when regionId is 'custom'",
        path: ["bbox"],
      });
    }
  });

const ChildrenQuerySchema = z.object({
  regionId: z.string().trim().min(1, "regionId is required"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  metric: MetricSchema,
});

const HarmonizationQuerySchema = z.object({
  regionId: z.string().trim().min(1, "regionId is required"),
});

export function validateHotspotSearchParams(searchParams: URLSearchParams): {
  regionId: string;
  bbox?: BBox;
  start: string;
  end: string;
  instrument: Instrument | "ALL";
  limit: number;
} {
  const bbox = parseBBoxParam(searchParams.get("bbox"));
  const parsed = HotspotQuerySchema.safeParse({
    regionId: searchParams.get("regionId") ?? "",
    bbox,
    start: searchParams.get("start") ?? "",
    end: searchParams.get("end") ?? "",
    instrument: searchParams.get("instrument") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    throw new AppValidationError(
      parsed.error.issues[0]?.message || "Invalid hotspot query parameters.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  return parsed.data;
}

export function validateSummarySearchParams(searchParams: URLSearchParams): {
  regionId: string;
  bbox?: BBox;
  year: number;
  month: number;
  metric: Metric;
  instrument: Instrument | "ALL";
} {
  const bbox = parseBBoxParam(searchParams.get("bbox"));
  const parsed = SummaryQuerySchema.safeParse({
    regionId: searchParams.get("regionId") ?? "",
    bbox,
    year: searchParams.get("year"),
    month: searchParams.get("month"),
    metric: searchParams.get("metric") ?? undefined,
    instrument: searchParams.get("instrument") ?? undefined,
  });

  if (!parsed.success) {
    throw new AppValidationError(
      parsed.error.issues[0]?.message || "Invalid analytics summary parameters.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  return parsed.data;
}

export function validateCalendarSearchParams(searchParams: URLSearchParams): {
  regionId: string;
  bbox?: BBox;
  metric: Metric;
  instrument: Instrument | "ALL";
} {
  const bbox = parseBBoxParam(searchParams.get("bbox"));
  const parsed = CalendarQuerySchema.safeParse({
    regionId: searchParams.get("regionId") ?? "",
    bbox,
    metric: searchParams.get("metric") ?? undefined,
    instrument: searchParams.get("instrument") ?? undefined,
  });

  if (!parsed.success) {
    throw new AppValidationError(
      parsed.error.issues[0]?.message || "Invalid calendar query parameters.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  return parsed.data;
}

export function validateChildrenSearchParams(searchParams: URLSearchParams): {
  regionId: string;
  year: number;
  month: number;
  metric: Metric;
} {
  const parsed = ChildrenQuerySchema.safeParse({
    regionId: searchParams.get("regionId") ?? "",
    year: searchParams.get("year"),
    month: searchParams.get("month"),
    metric: searchParams.get("metric") ?? undefined,
  });

  if (!parsed.success) {
    throw new AppValidationError(
      parsed.error.issues[0]?.message || "Invalid children query parameters.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  return parsed.data;
}

export function validateHarmonizationSearchParams(searchParams: URLSearchParams): {
  regionId: string;
} {
  const parsed = HarmonizationQuerySchema.safeParse({
    regionId: searchParams.get("regionId") ?? "",
  });

  if (!parsed.success) {
    throw new AppValidationError(
      parsed.error.issues[0]?.message || "Invalid harmonization query parameters.",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }

  return parsed.data;
}

export function errorToHttpResponse(
  error: unknown,
  context: { route: string; regionId?: string | null }
): NextResponse {
  if (error instanceof AppValidationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
          context,
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof RegionNotFoundError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          context,
        },
      },
      { status: 404 }
    );
  }

  if (error instanceof DatabaseProviderError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          context,
        },
      },
      { status: 500 }
    );
  }

  // Never leak stack traces, SQL strings, or environment secrets
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected backend error occurred while processing the request.",
        context,
      },
    },
    { status: 500 }
  );
}
