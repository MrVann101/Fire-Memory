import assert from "node:assert/strict";
import test from "node:test";
import {
  mapArtifactsToDatabase,
  type IngestArtifacts,
} from "./load-supabase";

function artifacts(): IngestArtifacts {
  return {
    regions: [
      {
        id: "PHL-ADM0-country",
        name: "Philippines",
        level: "country",
        parentId: null,
        bbox: [116.9, 4.5, 126.6, 21.1],
      },
      {
        id: "PHL-ADM2-bukidnon",
        name: "Bukidnon",
        level: "province",
        parentId: "PHL-ADM0-country",
        bbox: [124.48, 7.36, 125.49, 8.63],
      },
      {
        id: "PHL-ADM2-manila",
        name: "NCR District",
        level: "region",
        parentId: "PHL-ADM0-country",
        bbox: [120.9, 14.4, 121.1, 14.7],
      },
    ],
    monthlyCounts: [
      {
        region_id: "PHL-ADM2-bukidnon",
        year: 2020,
        month: 1,
        instrument: "MODIS",
        raw_count: 3,
        active_cell_days: 2,
        has_coverage: true,
      },
    ],
    monthlyHarmonized: [
      {
        region_id: "PHL-ADM2-bukidnon",
        year: 2001,
        month: 1,
        harmonized_count: 8,
        is_estimated: true,
        method_version: "median-monthly-viirs-over-modis-v1",
      },
    ],
    monthlyGridCounts: [
      {
        cell_id: "0.1:100:100",
        latitude: 10.05,
        longitude: 10.05,
        year: 2020,
        month: 1,
        instrument: "VIIRS",
        raw_count: 1,
        active_cell_days: 1,
      },
    ],
    factors: [
      {
        region_id: null,
        factor: 4,
        scope: "national",
        method: "median_monthly_viirs_over_modis",
        overlap_years: [2020, 2021],
        month_count: 24,
        correlation: 0.9,
        mean_absolute_error: 5,
        root_mean_square_error: 8,
        mean_absolute_percentage_error: 25,
        fallback_reason: null,
      },
      {
        region_id: "PHL-ADM2-bukidnon",
        factor: 4,
        scope: "national",
        method: "median_monthly_viirs_over_modis",
        overlap_years: [2020, 2021],
        month_count: 10,
        correlation: null,
        mean_absolute_error: null,
        root_mean_square_error: null,
        mean_absolute_percentage_error: null,
        fallback_reason: "below_month_minimum",
      },
    ],
    hotspots: [
      {
        hotspot: {
          id: "sha256:example",
          latitude: 8,
          longitude: 125,
          acquisitionDatetime: "2024-01-02T03:04:00.000Z",
          satellite: "N20",
          instrument: "VIIRS",
          confidence: 75,
          brightness: 320.5,
          sourceProduct: null,
        },
        province_id: "PHL-ADM2-bukidnon",
      },
      {
        hotspot: {
          id: "sha256:unassigned-example",
          latitude: 8.1,
          longitude: 125.1,
          acquisitionDatetime: "2024-01-03T03:04:00.000Z",
          satellite: "N20",
          instrument: "VIIRS",
          confidence: "high",
          brightness: null,
          sourceProduct: "verified-product",
        },
        province_id: null,
      },
    ],
  };
}

test("maps local artifacts to the Supabase schema and aliases country ID to PH", () => {
  const payloads = mapArtifactsToDatabase(artifacts());

  assert.deepEqual(payloads.regions[0], {
    id: "PH",
    name: "Philippines",
    level: "country",
    parent_id: null,
    bbox: [116.9, 4.5, 126.6, 21.1],
  });
  assert.equal(payloads.regions[1].parent_id, "PH");
  assert.equal(payloads.regions[1].id, "PHL-ADM2-bukidnon");
  assert.equal(payloads.regions[2].parent_id, "PH");
  assert.equal(payloads.monthly_grid_counts[0].cell_lat, 10.05);
  assert.equal(payloads.monthly_grid_counts[0].cell_lon, 10.05);
  assert.equal("latitude" in payloads.monthly_grid_counts[0], false);

  const nationalFactor = payloads.harmonization_factors.find(
    (row) => row.region_id === null,
  );
  assert.equal(nationalFactor?.id, "00000000-0000-4000-8000-000000000001");
  assert.equal(nationalFactor?.n_months, 24);
  assert.equal(nationalFactor?.error_percent, 25);
  assert.deepEqual(nationalFactor?.estimated_years, [2001]);

  assert.equal(payloads.hotspots[0].source_key, "sha256:example");
  assert.equal(payloads.hotspots[0].source_id, "sha256:example");
  assert.equal(payloads.hotspots[0].confidence, "75");
  assert.equal(payloads.hotspots[0].acquisition_datetime, "2024-01-02T03:04:00.000Z");
  assert.equal("sourceProduct" in payloads.hotspots[0], false);
  assert.equal(payloads.hotspots[1].confidence, "high");
  assert.equal(payloads.hotspots[1].province_id, null);
  assert.equal(payloads.hotspots[1].source_product, "verified-product");
});

test("rejects aggregate rows that reference a missing province", () => {
  const input = artifacts();
  input.monthlyCounts[0].region_id = "missing-province";

  assert.throws(
    () => mapArtifactsToDatabase(input),
    /Monthly-count row refers to unknown province/,
  );
});

test("rejects duplicate natural keys instead of relying on database upsert", () => {
  const input = artifacts();
  input.monthlyCounts.push({ ...input.monthlyCounts[0] });

  assert.throws(
    () => mapArtifactsToDatabase(input),
    /Duplicate monthly_counts key/,
  );
});
