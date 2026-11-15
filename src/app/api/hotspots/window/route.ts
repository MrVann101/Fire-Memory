import { connection, NextResponse } from "next/server";
import { getHotspotWindow } from "@/lib/db/hotspots";
import { errorToHttpResponse } from "@/lib/db/validation";

export async function GET(): Promise<NextResponse> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage
  }
  try {
    return NextResponse.json(await getHotspotWindow(), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/hotspots/window" });
  }
}
