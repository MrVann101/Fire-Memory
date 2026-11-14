import { connection, NextRequest, NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics/summary";
import {
  errorToHttpResponse,
  validateSummarySearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  const searchParams = request.nextUrl.searchParams;
  try {
    const query = validateSummarySearchParams(searchParams);
    const summary = await getAnalyticsSummary(query);
    return NextResponse.json(summary, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/summary",
      regionId: searchParams.get("regionId"),
    });
  }
}
