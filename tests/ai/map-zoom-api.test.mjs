import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_USE_MOCKS = "true";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const { GET: getFirmsWms } = await import(
  "../../src/app/api/firms/wms/route.ts"
);
const { GET: getFirmsArea } = await import(
  "../../src/app/api/firms/area/route.ts"
);
const { fetchFirmsArea } = await import("../../src/lib/firms/area.ts");

const BASE64_RGBA_1X1_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const RGBA_1X1_BYTES = Uint8Array.from(
  Buffer.from(BASE64_RGBA_1X1_PNG, "base64")
);

function makePngWithColorType(colorType) {
  const copy = Uint8Array.from(RGBA_1X1_BYTES);
  copy[25] = colorType;
  return copy;
}

test("GET /api/firms/wms sends uppercase TRANSPARENT=TRUE and passes through valid RGBA PNG tiles", async () => {
  const previousMapKey = process.env.FIRMS_MAP_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRMS_MAP_KEY = "test-firms-key";

  let capturedUrl = null;
  globalThis.fetch = async (input) => {
    capturedUrl = new URL(String(input));
    return new Response(RGBA_1X1_BYTES, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  try {
    const req = new NextRequest(
      "http://localhost/api/firms/wms?service=WMS&request=GetMap&layers=fires_viirs_24,fires_modis_24&bbox=120,10,122,12&width=256&height=256&srs=EPSG:3857"
    );
    const res = await getFirmsWms(req);
    const bytes = new Uint8Array(await res.arrayBuffer());

    assert.equal(res.status, 200);
    assert.ok(capturedUrl, "Expected upstream fetch to be called");
    assert.equal(capturedUrl.searchParams.get("TRANSPARENT"), "TRUE");
    assert.equal(capturedUrl.searchParams.get("FORMAT"), "image/png");
    assert.equal(
      res.headers.get("cache-control"),
      "public, max-age=300, stale-while-revalidate=600"
    );
    assert.equal(bytes[25], 6, "Expected RGBA PNG (IHDR colorType === 6)");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMapKey === undefined) {
      delete process.env.FIRMS_MAP_KEY;
    } else {
      process.env.FIRMS_MAP_KEY = previousMapKey;
    }
  }
});

test("GET /api/firms/wms converts OGC XML errors into a 1x1 RGBA transparent PNG", async () => {
  const previousMapKey = process.env.FIRMS_MAP_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRMS_MAP_KEY = "test-firms-key";

  globalThis.fetch = async () =>
    new Response(
      '<?xml version="1.0" encoding="UTF-8"?><ServiceExceptionReport><ServiceException>MapServer Error</ServiceException></ServiceExceptionReport>',
      {
        status: 200,
        headers: { "Content-Type": "application/vnd.ogc.se_xml" },
      }
    );

  try {
    const req = new NextRequest(
      "http://localhost/api/firms/wms?layers=fires_viirs_24,fires_modis_24&bbox=120,10,122,12&width=256&height=256&srs=EPSG:3857"
    );
    const res = await getFirmsWms(req);
    const bytes = new Uint8Array(await res.arrayBuffer());

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(bytes[25], 6, "Expected fallback 1x1 RGBA transparent PNG");
    assert.deepEqual([...bytes], [...RGBA_1X1_BYTES]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMapKey === undefined) {
      delete process.env.FIRMS_MAP_KEY;
    } else {
      process.env.FIRMS_MAP_KEY = previousMapKey;
    }
  }
});

test("GET /api/firms/wms rejects opaque black RGB (colorType=2) and grayscale (colorType=0) PNGs without tRNS", async () => {
  const previousMapKey = process.env.FIRMS_MAP_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRMS_MAP_KEY = "test-firms-key";

  try {
    for (const opaqueColorType of [2, 0]) {
      globalThis.fetch = async () =>
        new Response(makePngWithColorType(opaqueColorType), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });

      const req = new NextRequest(
        "http://localhost/api/firms/wms?layers=fires_viirs_7,fires_modis_7&bbox=120,10,122,12&width=256&height=256&srs=EPSG:3857"
      );
      const res = await getFirmsWms(req);
      const bytes = new Uint8Array(await res.arrayBuffer());

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(
        bytes[25],
        6,
        `Opaque colorType=${opaqueColorType} must be replaced with RGBA transparent PNG (colorType=6)`
      );
      assert.deepEqual([...bytes], [...RGBA_1X1_BYTES]);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMapKey === undefined) {
      delete process.env.FIRMS_MAP_KEY;
    } else {
      process.env.FIRMS_MAP_KEY = previousMapKey;
    }
  }
});

test("fetchFirmsArea and GET /api/firms/area bound NRT upstream calls to <= 3 for month and year windows and resolve all 4 live ranges cleanly", async () => {
  const previousMapKey = process.env.FIRMS_MAP_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRMS_MAP_KEY = "test-firms-key";

  const sampleCsv = [
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
    "14.5995,120.9842,332.4,0.39,0.36,2025-11-14,0530,N20,VIIRS,h,2.0NRT,295.1,18.4,D",
  ].join("\n");

  const windows = [
    { name: "today", start: "2025-11-14", end: "2025-11-14", maxCalls: 3 },
    { name: "7days", start: "2025-11-08", end: "2025-11-14", maxCalls: 6 },
    { name: "month", start: "2025-10-15", end: "2025-11-14", maxCalls: 3 },
    { name: "year", start: "2024-11-15", end: "2025-11-14", maxCalls: 3 },
  ];

  try {
    // 1. Verify upstream success path across all 4 windows
    for (const win of windows) {
      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls += 1;
        return new Response(sampleCsv, {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        });
      };

      const directResult = await fetchFirmsArea({
        bbox: [116.9, 4.5, 126.6, 21.1],
        instrument: "ALL",
        start: win.start,
        end: win.end,
        limit: 2000,
      });

      assert.ok(
        fetchCalls <= win.maxCalls,
        `Expected ${win.name} window to make at most ${win.maxCalls} upstream NRT calls, but made ${fetchCalls}`
      );
      assert.ok(directResult.hotspots.length > 0);
    }

    // 2. Verify graceful archive fallback path across all 4 windows when upstream NRT fails
    for (const win of windows) {
      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls += 1;
        return new Response("Upstream NRT unavailable", { status: 503 });
      };

      const req = new NextRequest(
        `http://localhost/api/firms/area?bbox=116.9,4.5,126.6,21.1&instrument=ALL&start=${win.start}&end=${win.end}&limit=500`
      );
      const res = await getFirmsArea(req);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected HTTP 200 for ${win.name} fallback`);
      assert.ok(
        fetchCalls <= win.maxCalls,
        `Expected ${win.name} fallback to make at most ${win.maxCalls} upstream calls, made ${fetchCalls}`
      );
      assert.equal(body.filters.regionId, "custom");
      assert.equal(typeof body.total, "number");
      assert.equal(typeof body.returned, "number");
      assert.equal(typeof body.truncated, "boolean");
      assert.ok(Array.isArray(body.hotspots));
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMapKey === undefined) {
      delete process.env.FIRMS_MAP_KEY;
    } else {
      process.env.FIRMS_MAP_KEY = previousMapKey;
    }
  }
});

test("LeafletCanvas.tsx enforces cloud-free multi-layer basemap, maxNativeZoom scaling, errorTileUrl fallback, and viewport-bounded footprints", () => {
  const leafletCanvasSource = readFileSync(
    resolve(repoRoot, "src/components/map/LeafletCanvas.tsx"),
    "utf8"
  );

  // Verify transparent tile fallback URI is defined and used on all 3 TileLayers
  assert.match(
    leafletCanvasSource,
    /const TRANSPARENT_TILE_DATA_URI\s*=\s*"data:image\/png;base64,[^"]+"/
  );
  const errorTileUrlMatches =
    leafletCanvasSource.match(/errorTileUrl=\{TRANSPARENT_TILE_DATA_URI\}/g) ??
    [];
  assert.equal(
    errorTileUrlMatches.length,
    3,
    "All 3 <TileLayer> components must configure errorTileUrl={TRANSPARENT_TILE_DATA_URI}"
  );

  // Verify the 3 cloud-free tile layers and their zoom scaling props
  assert.match(leafletCanvasSource, /key="carto-voyager-underlay"/);
  assert.match(
    leafletCanvasSource,
    /basemaps\.cartocdn\.com\/rastertiles\/voyager_nolabels\/\{z\}\/\{x\}\/\{y\}\{r\}\.png/
  );
  assert.match(leafletCanvasSource, /key="esri-world-imagery-land"/);
  assert.match(
    leafletCanvasSource,
    /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/
  );
  assert.match(leafletCanvasSource, /key="esri-reference-boundaries-labels"/);
  assert.match(
    leafletCanvasSource,
    /services\.arcgisonline\.com\/ArcGIS\/rest\/services\/Reference\/World_Boundaries_and_Places\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/
  );
  assert.match(leafletCanvasSource, /maxNativeZoom=\{13\}/);
  assert.match(leafletCanvasSource, /maxNativeZoom=\{18\}/);
  assert.match(leafletCanvasSource, /maxZoom=\{18\}/);

  // Verify cloud-covered GIBS layer, broken Level13 URLs, and black-tile WMSTileLayer are absent
  assert.doesNotMatch(
    leafletCanvasSource,
    /VIIRS_SNPP_CorrectedReflectance_TrueColor/
  );
  assert.doesNotMatch(leafletCanvasSource, /GoogleMapsCompatible_Level13/);
  assert.doesNotMatch(leafletCanvasSource, /<WMSTileLayer/);
  assert.doesNotMatch(leafletCanvasSource, /\/api\/firms\/wms/);

  // Verify HotspotFootprintLayer bounds filtering and zoomend + moveend listeners
  assert.match(
    leafletCanvasSource,
    /const bounds = map\.getBounds\(\)\.pad\(0\.25\);/
  );
  assert.match(
    leafletCanvasSource,
    /if \(!bounds\.contains\(\[hotspot\.latitude, hotspot\.longitude\]\)\)/
  );
  assert.match(leafletCanvasSource, /map\.on\("zoomend", renderFootprints\)/);
  assert.match(leafletCanvasSource, /map\.on\("moveend", renderFootprints\)/);
});

test("globals.css overrides Leaflet tile blend mode and prevents pitch-black map container backgrounds", () => {
  const globalsCss = readFileSync(
    resolve(repoRoot, "src/app/globals.css"),
    "utf8"
  );

  assert.match(
    globalsCss,
    /\.leaflet-container\s*\{\s*background:\s*#0d1f33\s*!important;\s*\}/
  );
  assert.match(
    globalsCss,
    /\.leaflet-container img\.leaflet-tile\s*\{\s*mix-blend-mode:\s*normal\s*!important;\s*\}/
  );
  assert.doesNotMatch(
    globalsCss,
    /\.map-workspace\s*\{\s*background:\s*#020617;\s*\}/
  );
});
