import { connection, NextRequest, NextResponse } from "next/server";
import { getChildCounts } from "@/lib/analytics/children";
import {
  errorToHttpResponse,
  validateChildrenSearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  const searchParams = request.nextUrl.searchParams;
  try {
    const { regionId, year, month, metric } =
      validateChildrenSearchParams(searchParams);
    const children = await getChildCounts(regionId, year, month, metric);
    return NextResponse.json(children, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/children",
      regionId: searchParams.get("regionId"),
    });
  }
}
