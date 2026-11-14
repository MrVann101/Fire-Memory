import { connection, NextRequest, NextResponse } from "next/server";
import { getCalendar } from "@/lib/analytics/calendar";
import {
  errorToHttpResponse,
  validateCalendarSearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  const searchParams = request.nextUrl.searchParams;
  try {
    const query = validateCalendarSearchParams(searchParams);
    const calendar = await getCalendar(query);
    return NextResponse.json(calendar, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/calendar",
      regionId: searchParams.get("regionId"),
    });
  }
}
