import { connection, NextResponse } from "next/server";
import { listRegions } from "@/lib/db/regions";
import { errorToHttpResponse } from "@/lib/db/validation";

export async function GET(): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  try {
    const regions = await listRegions();
    return NextResponse.json(regions, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/regions" });
  }
}
