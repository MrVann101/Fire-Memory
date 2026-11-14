import { NextResponse } from "next/server";
import { getHotspotWindow } from "@/lib/db/hotspots";
import { errorToHttpResponse } from "@/lib/db/validation";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getHotspotWindow(), { status: 200 });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/hotspots/window" });
  }
}
