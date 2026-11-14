import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRY_GEOBOUNDARIES_ID,
  listRegions,
  requireRegionWithDbId,
} from "@/lib/db/regions";
import {
  queryHotspots,
  sampleDeterministicallyAcrossTime,
} from "@/lib/db/hotspots";
import { getAnalyticsSummary } from "@/lib/analytics/summary";
import { getCalendar } from "@/lib/analytics/calendar";
import { getChildCounts } from "@/lib/analytics/children";
import { getHarmonization } from "@/lib/analytics/harmonization";
import { DatabaseProviderError } from "@/lib/db/supabase";

describe("Backend Contracts, Sampling, and Mock Integration", () => {
  const originalMocks = process.env.NEXT_PUBLIC_USE_MOCKS;
  const originalUrl = process.env.SUPABASE_URL;
  const originalNextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "true";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCKS = originalMocks;
    process.env.SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalNextUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it("samples deterministically across the full time window when over limit", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const sampled = sampleDeterministicallyAcrossTime(items, 10);
    assert.equal(sampled.length, 10);
    assert.equal(sampled[0].id, 0);
    assert.equal(sampled[9].id, 99);
    // Monotonically increasing across the full window
    for (let i = 1; i < sampled.length; i++) {
      assert.ok(sampled[i].id > sampled[i - 1].id);
    }
  });

  it("lists regions and queries hotspots with truncation, rawWindow, and lastUpdated", async () => {
    const regions = await listRegions();
    assert.ok(regions.length >= 2);
    assert.ok(regions.some((r) => r.id === "PH"));
    assert.ok(regions.some((r) => r.id === "PH-BUK"));

    const res = await queryHotspots(
      {
        regionId: "PH-BUK",
        start: "2026-11-01",
        end: "2026-11-14",
        instrument: "ALL",
      },
      2
    );
    assert.ok(res.total >= 2);
    assert.equal(res.returned, 2);
    assert.equal(res.truncated, res.total > 2);
    assert.ok(res.rawWindow !== null);
    assert.ok(res.lastUpdated !== null);
  });

  it("enforces harmonized vs raw semantics, zero baseline, and custom bbox approximation", async () => {
    // Harmonized ignores instrument filter
    const harmonized = await getAnalyticsSummary({
      regionId: "PH-BUK",
      year: 2026,
      month: 11,
      metric: "harmonized",
      instrument: "MODIS",
    });
    assert.equal(harmonized.instrument, "ALL");
    assert.ok(harmonized.estimatedBaselineYears.length > 0);
    assert.ok(harmonized.harmonization !== null);

    // Raw respects instrument filter and clears harmonization block
    const raw = await getAnalyticsSummary({
      regionId: "PH-BUK",
      year: 2026,
      month: 11,
      metric: "raw",
      instrument: "VIIRS",
    });
    assert.equal(raw.instrument, "VIIRS");
    assert.equal(raw.harmonization, null);

    // Zero baseline returns null anomalyPercent and not_calculable
    const zeroBase = await getAnalyticsSummary({
      regionId: "PH-BAT",
      year: 2026,
      month: 11,
      metric: "harmonized",
    });
    assert.equal(zeroBase.historicalMedian, 0);
    assert.equal(zeroBase.anomalyPercent, null);
    assert.equal(zeroBase.label, "not_calculable");

    // Custom bbox sets approximate = true
    const custom = await getAnalyticsSummary({
      regionId: "custom",
      bbox: [124.9, 7.8, 125.25, 8.2],
      year: 2026,
      month: 11,
      metric: "harmonized",
    });
    assert.equal(custom.approximate, true);
    assert.equal(custom.region.level, "custom");

    // Custom bbox and zero-baseline with metric=raw set harmonization = null
    const customRaw = await getAnalyticsSummary({
      regionId: "custom",
      bbox: [124.9, 7.8, 125.25, 8.2],
      year: 2026,
      month: 11,
      metric: "raw",
      instrument: "VIIRS",
    });
    assert.equal(customRaw.metric, "raw");
    assert.equal(customRaw.instrument, "VIIRS");
    assert.equal(customRaw.harmonization, null);

    const zeroBaseRaw = await getAnalyticsSummary({
      regionId: "PH-BAT",
      year: 2026,
      month: 11,
      metric: "raw",
      instrument: "VIIRS",
    });
    assert.equal(zeroBaseRaw.metric, "raw");
    assert.equal(zeroBaseRaw.instrument, "VIIRS");
    assert.equal(zeroBaseRaw.harmonization, null);
  });

  it("returns calendar with null and estimated cells, children counts, and harmonization overlap", async () => {
    const cal = await getCalendar({
      regionId: "PH-BUK",
      metric: "harmonized",
    });
    assert.ok(cal.cells.some((c) => c.count === null));
    assert.ok(cal.cells.some((c) => c.estimated === true));

    const phChildren = await getChildCounts("PH", 2026, 11, "harmonized");
    assert.ok(phChildren.length > 0);

    const provChildren = await getChildCounts("PH-BUK", 2026, 11, "harmonized");
    assert.deepEqual(provChildren, []);

    const customChildren = await getChildCounts("custom", 2026, 11, "harmonized");
    assert.deepEqual(customChildren, []);

    const harm = await getHarmonization("PH-BUK");
    assert.equal(harm.regionId, "PH-BUK");
    assert.ok(harm.overlap.length > 0);
  });

  it("resolves GeoBoundaries ADM0/ADM2 IDs and short region codes interchangeably", async () => {
    const countryViaGeo = await requireRegionWithDbId(COUNTRY_GEOBOUNDARIES_ID);
    assert.equal(countryViaGeo.region.id, "PH");
    assert.equal(countryViaGeo.region.level, "country");

    const bukViaGeo = await requireRegionWithDbId(
      "PHL-ADM2-2640588B97736443103823"
    );
    assert.equal(bukViaGeo.region.name, "Bukidnon");

    const admRegionViaGeo = await requireRegionWithDbId(
      "PHL-ADM2-2640588B65314213268917"
    );
    assert.equal(admRegionViaGeo.region.level, "region");

    const summaryViaGeo = await getAnalyticsSummary({
      regionId: "PHL-ADM2-2640588B97736443103823",
      year: 2026,
      month: 11,
      metric: "harmonized",
    });
    assert.equal(summaryViaGeo.region.name, "Bukidnon");

    const batViaGeo = await getAnalyticsSummary({
      regionId: "PHL-ADM2-2640588B23864872837062",
      year: 2026,
      month: 11,
      metric: "harmonized",
    });
    assert.equal(batViaGeo.label, "not_calculable");

    const childrenViaGeo = await getChildCounts(
      COUNTRY_GEOBOUNDARIES_ID,
      2026,
      11,
      "harmonized"
    );
    assert.ok(childrenViaGeo.length > 0);
  });

  it("fails explicitly with DatabaseProviderError when mocks are off and DB credentials are missing", async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "false";
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await assert.rejects(() => listRegions(), DatabaseProviderError);
  });
});
