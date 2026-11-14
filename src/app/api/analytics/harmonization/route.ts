import { connection, NextRequest, NextResponse } from "next/server";
import { getHarmonization } from "@/lib/analytics/harmonization";
import {
  errorToHttpResponse,
  validateHarmonizationSearchParams,
} from "@/lib/db/validation";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  const searchParams = request.nextUrl.searchParams;
  try {
    const { regionId } = validateHarmonizationSearchParams(searchParams);
    const harmonization = await getHarmonization(regionId);
    return NextResponse.json(harmonization, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, {
      route: "/api/analytics/harmonization",
      regionId: searchParams.get("regionId"),
    });
  }
}
