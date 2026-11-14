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

// 1x1 transparent PNG fallback so Leaflet never shows broken tile icons if NASA WMS is unreachable or returns an OGC XML exception.
const TRANSPARENT_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  )
);

const PNG_SIGNATURE = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
] as const;

function hasTrnsChunk(buffer: Uint8Array): boolean {
  for (let i = 8; i <= buffer.byteLength - 4; i += 1) {
    if (
      buffer[i] === 0x74 &&
      buffer[i + 1] === 0x52 &&
      buffer[i + 2] === 0x4e &&
      buffer[i + 3] === 0x53
    ) {
      return true;
    }
  }
  return false;
}

function isTransparentPngBuffer(buffer: Uint8Array): boolean {
  if (buffer.byteLength < 33) {
    return false;
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (buffer[i] !== PNG_SIGNATURE[i]) {
      return false;
    }
  }

  const colorType = buffer[25];
  if (colorType === 6 || colorType === 4) {
    return true;
  }
  if (colorType === 3 || colorType === 2 || colorType === 0) {
    return hasTrnsChunk(buffer);
  }
  return false;
}

function getParamCaseInsensitive(
  searchParams: URLSearchParams,
  name: string
): string | null {
  return (
    searchParams.get(name.toLowerCase()) ??
    searchParams.get(name.toUpperCase()) ??
    searchParams.get(name)
  );
}

function transparentPngResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_PNG_BYTES, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/png",
    },
  });
}

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
      getParamCaseInsensitive(searchParams, "layers") ??
      getParamCaseInsensitive(searchParams, "layer") ??
      "fires_viirs_24,fires_modis_24";
    if (!ALLOWED_LAYERS.has(layers)) {
      throw new AppValidationError("Unsupported FIRMS WMS layer.");
    }

    const upstreamUrl = new URL(
      `${FIRMS_WMS_URL}/${encodeURIComponent(mapKey)}/`
    );
    upstreamUrl.searchParams.set("REQUEST", "GetMap");
    upstreamUrl.searchParams.set("SERVICE", "WMS");
    upstreamUrl.searchParams.set("VERSION", "1.1.1");
    upstreamUrl.searchParams.set("LAYERS", layers);
    upstreamUrl.searchParams.set("FORMAT", "image/png");
    upstreamUrl.searchParams.set("TRANSPARENT", "TRUE");
    upstreamUrl.searchParams.set(
      "STYLES",
      getParamCaseInsensitive(searchParams, "styles") ?? ""
    );

    for (const name of ["BBOX", "WIDTH", "HEIGHT", "SRS"]) {
      const value =
        getParamCaseInsensitive(searchParams, name) ??
        (name === "SRS" ? getParamCaseInsensitive(searchParams, "CRS") : null);
      if (value) {
        upstreamUrl.searchParams.set(name, value);
      }
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        headers: { Accept: "image/png" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return transparentPngResponse();
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
      return transparentPngResponse();
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (!isTransparentPngBuffer(bytes)) {
      return transparentPngResponse();
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "Content-Type": contentType || "image/png",
      },
    });
  } catch (error) {
    return errorToHttpResponse(error, { route: "/api/firms/wms" });
  }
}
