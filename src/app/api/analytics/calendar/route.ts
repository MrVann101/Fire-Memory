import { NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/lib/analytics/calendar";
import {
  errorToHttpResponse,
  validateCalendarSearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  try {
    const query = validateCalendarSearchParams(searchParams);
    const calendar = await getCalendar(query);
    return NextResponse.json(calendar, { status: 200 });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/calendar",
      regionId: searchParams.get("regionId"),
    });
  }
}
