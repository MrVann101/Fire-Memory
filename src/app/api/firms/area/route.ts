import { connection, NextRequest, NextResponse } from "next/server";
import { fetchFirmsArea } from "@/lib/firms/area";
import { getHotspotWindow, queryHotspots } from "@/lib/db/hotspots";
import {
  errorToHttpResponse,
  parseBBoxParam,
  AppValidationError,
} from "@/lib/db/validation";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage.
  }

  const searchParams = request.nextUrl.searchParams;
  try {
    const bbox = parseBBoxParam(searchParams.get("bbox"));
    if (!bbox) {
      throw new AppValidationError(
        "bbox is required. Expected minLon,minLat,maxLon,maxLat."
      );
    }

    const instrument = searchParams.get("instrument") ?? "ALL";
    if (!["MODIS", "VIIRS", "ALL"].includes(instrument)) {
      throw new AppValidationError(
        "instrument must be MODIS, VIIRS, or ALL."
      );
    }

    const days = Number(searchParams.get("days") ?? "5");
    if (!Number.isInteger(days) || days < 1 || days > 5) {
      throw new AppValidationError("days must be an integer between 1 and 5.");
    }

    const date = searchParams.get("date") ?? undefined;
    if (date && !ISO_DATE.test(date)) {
      throw new AppValidationError("date must be YYYY-MM-DD.");
    }
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;
    if ((start && !end) || (!start && end)) {
      throw new AppValidationError("start and end must be provided together.");
    }
    if (
      (start && !ISO_DATE.test(start)) ||
      (end && !ISO_DATE.test(end))
    ) {
      throw new AppValidationError("start and end must be YYYY-MM-DD.");
    }
    if (start && end && start > end) {
      throw new AppValidationError(
        "start must be on or before end."
      );
    }

    const limit = Number(searchParams.get("limit") ?? "2000");
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
      throw new AppValidationError(
        "limit must be an integer between 1 and 10000."
      );
    }

    const typedInstrument = instrument as "MODIS" | "VIIRS" | "ALL";
    const requestedSpanDays =
      start && end
        ? Math.max(
            1,
            Math.round(
              (new Date(`${end}T00:00:00.000Z`).getTime() -
                new Date(`${start}T00:00:00.000Z`).getTime()) /
                86_400_000
            ) + 1
          )
        : days;

    try {
      const result = await fetchFirmsArea({
        bbox,
        instrument: typedInstrument,
        days,
        date,
        start,
        end,
        limit,
      });

      return NextResponse.json(
        {
          filters: {
            regionId: "custom",
            bbox,
            start: result.rawWindow?.start ?? start ?? date ?? "",
            end: result.rawWindow?.end ?? end ?? date ?? "",
            instrument: typedInstrument,
          },
          returned: result.hotspots.length,
          ...result,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      // Graceful fallback to the local hotspot archive if upstream NASA FIRMS NRT is unreachable or rate-limited.
      const windowInfo = await getHotspotWindow().catch(() => ({
        rawWindow: null,
        lastUpdated: null,
      }));
      const fallbackEnd =
        windowInfo.rawWindow?.end ?? end ?? date ?? new Date().toISOString().slice(0, 10);
      const fallbackStartDate = new Date(`${fallbackEnd}T00:00:00.000Z`);
      fallbackStartDate.setUTCDate(
        fallbackStartDate.getUTCDate() - (requestedSpanDays - 1)
      );
      const fallbackStart =
        start && windowInfo.rawWindow && start <= windowInfo.rawWindow.end
          ? start
          : fallbackStartDate.toISOString().slice(0, 10);

      try {
        const archiveResult = await queryHotspots(
          {
            regionId: "custom",
            bbox,
            start: fallbackStart,
            end: fallbackEnd,
            instrument: typedInstrument,
          },
          limit
        );

        return NextResponse.json(archiveResult, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      } catch {
        return NextResponse.json(
          {
            filters: {
              regionId: "custom",
              bbox,
              start: fallbackStart,
              end: fallbackEnd,
              instrument: typedInstrument,
            },
            total: 0,
            returned: 0,
            truncated: false,
            hotspots: [],
            rawWindow: windowInfo.rawWindow,
            lastUpdated: windowInfo.lastUpdated,
          },
          {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }
    }
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/firms/area",
    });
  }
}
