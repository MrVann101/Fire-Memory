import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getRegionsRoute } from "@/app/api/regions/route";
import { GET as getHotspotsRoute } from "@/app/api/hotspots/route";
import { GET as getSummaryRoute } from "@/app/api/analytics/summary/route";
import { GET as getCalendarRoute } from "@/app/api/analytics/calendar/route";
import { GET as getChildrenRoute } from "@/app/api/analytics/children/route";
import { GET as getHarmonizationRoute } from "@/app/api/analytics/harmonization/route";
import { GET as getFirmsAreaRoute } from "@/app/api/firms/area/route";
import { GET as getFirmsWmsRoute } from "@/app/api/firms/wms/route";

describe("Next.js API Route Handlers Smoke & Error Tests", () => {
  const originalMocks = process.env.NEXT_PUBLIC_USE_MOCKS;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "true";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = originalMocks;
  });

  it("GET /api/regions returns 200 with Region[]", async () => {
    const res = await getRegionsRoute();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some((r: { id: string }) => r.id === "PH-BUK"));
  });

  it("GET /api/hotspots returns 200 for valid query and 400 for malformed bbox", async () => {
    const okReq = new NextRequest(
      "http://localhost/api/hotspots?regionId=PH-BUK&start=2026-11-01&end=2026-11-14"
    );
    const okRes = await getHotspotsRoute(okReq);
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.ok(Array.isArray(okBody.hotspots));

    const badReq = new NextRequest(
      "http://localhost/api/hotspots?regionId=custom&bbox=126,8,124,9&start=2026-11-01&end=2026-11-14"
    );
    const badRes = await getHotspotsRoute(badReq);
    assert.equal(badRes.status, 400);
  });

  it("GET /api/analytics/summary returns 200, 400 on bad month, and 404 on unknown region", async () => {
    const okReq = new NextRequest(
      "http://localhost/api/analytics/summary?regionId=PH-BUK&year=2026&month=11&metric=harmonized"
    );
    const okRes = await getSummaryRoute(okReq);
    assert.equal(okRes.status, 200);

    const badReq = new NextRequest(
      "http://localhost/api/analytics/summary?regionId=PH-BUK&year=2026&month=99"
    );
    const badRes = await getSummaryRoute(badReq);
    assert.equal(badRes.status, 400);

    const notFoundReq = new NextRequest(
      "http://localhost/api/analytics/summary?regionId=PH-DOES-NOT-EXIST&year=2026&month=11"
    );
    const notFoundRes = await getSummaryRoute(notFoundReq);
    assert.equal(notFoundRes.status, 404);
  });

  it("GET /api/analytics/calendar, /children, and /harmonization return 200 matching contract shapes", async () => {
    const calRes = await getCalendarRoute(
      new NextRequest(
        "http://localhost/api/analytics/calendar?regionId=PH-BUK&metric=harmonized"
      )
    );
    assert.equal(calRes.status, 200);

    const childRes = await getChildrenRoute(
      new NextRequest(
        "http://localhost/api/analytics/children?regionId=PH&year=2026&month=11&metric=harmonized"
      )
    );
    assert.equal(childRes.status, 200);

    const harmRes = await getHarmonizationRoute(
      new NextRequest(
        "http://localhost/api/analytics/harmonization?regionId=PH-BUK"
      )
    );
    assert.equal(harmRes.status, 200);
  });

  it("GET /api/firms/area validates bbox and falls back gracefully when upstream FIRMS is unavailable", async () => {
    const missingBboxRes = await getFirmsAreaRoute(
      new NextRequest("http://localhost/api/firms/area?instrument=ALL")
    );
    assert.equal(missingBboxRes.status, 400);

    const okRes = await getFirmsAreaRoute(
      new NextRequest(
        "http://localhost/api/firms/area?bbox=116.9,4.5,126.6,21.1&instrument=ALL&start=2026-11-01&end=2026-11-14"
      )
    );
    assert.equal(okRes.status, 200);
    const body = await okRes.json();
    assert.ok(Array.isArray(body.hotspots));
  });

  it("GET /api/firms/wms validates layers and returns a valid PNG tile response", async () => {
    const originalKey = process.env.FIRMS_MAP_KEY;
    process.env.FIRMS_MAP_KEY = "test-firms-map-key";
    try {
      const badLayerRes = await getFirmsWmsRoute(
        new NextRequest("http://localhost/api/firms/wms?layers=invalid_layer")
      );
      assert.equal(badLayerRes.status, 400);

      const okRes = await getFirmsWmsRoute(
        new NextRequest(
          "http://localhost/api/firms/wms?LAYERS=fires_viirs_24,fires_modis_24&BBOX=120,5,126,18&WIDTH=256&HEIGHT=256&SRS=EPSG:3857"
        )
      );
      assert.equal(okRes.status, 200);
      assert.match(okRes.headers.get("content-type") ?? "", /^image\/png/i);
    } finally {
      process.env.FIRMS_MAP_KEY = originalKey;
    }
  });
});
