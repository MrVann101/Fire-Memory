import { NextResponse } from "next/server";
import { listRegions } from "@/lib/db/regions";
import { errorToHttpResponse } from "@/lib/db/validation";

export async function GET(): Promise<NextResponse> {
  try {
    const regions = await listRegions();
    return NextResponse.json(regions, { status: 200 });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/regions" });
  }
}
