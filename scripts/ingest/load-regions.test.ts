import assert from "node:assert/strict";
import test from "node:test";
import { assignAdmin2Region, loadRegions } from "./load-regions";

const loaded = loadRegions();

test("loads the Philippines and stable ADM2 region records", () => {
  assert.equal(loaded.country.region.name, "The Philippines");
  assert.equal(loaded.admin2.length, 87);
  assert.equal(loaded.regions.length, 88);
  assert.equal(
    loaded.admin2.filter(({ region }) => region.level === "province").length,
    81,
  );
  assert.equal(
    loaded.admin2.filter(({ region }) => region.level === "region").length,
    6,
  );
  assert.equal(
    new Set(loaded.regions.map(({ id }) => id)).size,
    loaded.regions.length,
  );
});

test("assigns known points and leaves outside points unassigned", () => {
  const fixtures = [
    { name: "Bukidnon", latitude: 8.1575, longitude: 125.1278 },
    { name: "Abra", latitude: 17.6, longitude: 120.6167 },
    { name: "Davao del Sur", latitude: 6.749, longitude: 125.357 },
  ];

  for (const fixture of fixtures) {
    const expected = loaded.admin2.find(
      ({ region }) => region.name === fixture.name,
    );
    assert.ok(expected);
    assert.equal(
      assignAdmin2Region(fixture.latitude, fixture.longitude, loaded),
      expected.region.id,
    );
  }
  assert.equal(assignAdmin2Region(0, 0, loaded), null);
});

test("rejects coordinates outside WGS84 ranges", () => {
  assert.throws(
    () => assignAdmin2Region(91, 125, loaded),
    /finite WGS84 latitude\/longitude/,
  );
});
