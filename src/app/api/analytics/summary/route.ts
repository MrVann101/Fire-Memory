import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics/summary";
import {
  errorToHttpResponse,
  validateSummarySearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  try {
    const query = validateSummarySearchParams(searchParams);
    const summary = await getAnalyticsSummary(query);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/summary",
      regionId: searchParams.get("regionId"),
    });
  }
}
