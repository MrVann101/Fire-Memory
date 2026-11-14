import { connection, NextRequest, NextResponse } from "next/server";
import { AppValidationError, errorToHttpResponse } from "@/lib/db/validation";

const FIRMS_WMS_URL =
  "https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires";
const ALLOWED_LAYERS = new Set([
  "fires_viirs_24,fires_modis_24",
  "fires_viirs_48,fires_modis_48",
  "fires_viirs_72,fires_modis_72",
  "fires_viirs_7,fires_modis_7",
]);

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await connection();
  } catch {
    // Allow direct unit-test invocation outside Next.js request async storage.
  }

  try {
    const mapKey = process.env.FIRMS_MAP_KEY?.trim();
    if (!mapKey) {
      throw new AppValidationError(
        "FIRMS_MAP_KEY is not configured for the live map layer."
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const layers =
      searchParams.get("layers") ??
      searchParams.get("layer") ??
      "fires_viirs_24,fires_modis_24";
    if (!ALLOWED_LAYERS.has(layers)) {
      throw new AppValidationError("Unsupported FIRMS WMS layer.");
    }

    const upstreamUrl = new URL(
      `${FIRMS_WMS_URL}/${encodeURIComponent(mapKey)}/${layers}/`
    );
    upstreamUrl.searchParams.set("REQUEST", "GetMap");
    upstreamUrl.searchParams.set("SERVICE", "WMS");
    upstreamUrl.searchParams.set("VERSION", "1.1.1");
    upstreamUrl.searchParams.set("FORMAT", "image/png");
    upstreamUrl.searchParams.set("TRANSPARENT", "true");

    for (const name of ["BBOX", "WIDTH", "HEIGHT", "SRS", "STYLES"]) {
      const value = searchParams.get(name.toLowerCase());
      if (value) {
        upstreamUrl.searchParams.set(name, value);
      }
    }

    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "image/png" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      throw new Error(`FIRMS WMS returned HTTP ${upstream.status}.`);
    }

    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      },
    });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/firms/wms" });
  }
}
