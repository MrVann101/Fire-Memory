import { NextRequest, NextResponse } from "next/server";
import { queryHotspots } from "@/lib/db/hotspots";
import {
  errorToHttpResponse,
  validateHotspotSearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  try {
    const { regionId, bbox, start, end, instrument, limit } =
      validateHotspotSearchParams(searchParams);

    const result = await queryHotspots(
      {
        regionId,
        bbox,
        start,
        end,
        instrument,
      },
      limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/hotspots",
      regionId: searchParams.get("regionId"),
    });
  }
}
