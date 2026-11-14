import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCsv } from "./normalize";

test("normalizes UTC time, coordinates, and numeric MODIS confidence", () => {
  const csv = [
    "latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence,version",
    "14.005,121.0028,310.2,2022-01-01,509,Aqua,MODIS,63,6.03",
  ].join("\n");

  const result = normalizeCsv(csv, "MODIS");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].hotspot.acquisitionDatetime, "2022-01-01T05:09:00.000Z");
  assert.equal(result.records[0].hotspot.confidence, 63);
  assert.equal(typeof result.records[0].hotspot.confidence, "number");
  assert.equal(result.records[0].hotspot.brightness, 310.2);
  assert.equal(result.records[0].hotspot.satellite, "Aqua");
  assert.equal(
    result.records[0].hotspot.id,
    normalizeCsv(csv, "MODIS").records[0].hotspot.id,
  );
});

test("preserves categorical VIIRS confidence and removes duplicate source rows", () => {
  const header =
    "latitude,longitude,bright_ti4,acq_date,acq_time,satellite,instrument,confidence,version";
  const row = "6.29117,124.45857,338.61,2020-01-01,419,N20,VIIRS,n,2";
  const result = normalizeCsv(`${header}\n${row}\n${row}\n`, "VIIRS");

  assert.equal(result.records.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.records[0].hotspot.confidence, "n");
  assert.equal(typeof result.records[0].hotspot.confidence, "string");
  assert.equal(result.records[0].hotspot.brightness, 338.61);
  assert.equal(result.records[0].hotspot.acquisitionDatetime, "2020-01-01T04:19:00.000Z");
  assert.equal(result.records[0].sourceRow.confidence, "n");
});

test("rejects out-of-range coordinates and impossible acquisition times", () => {
  const header =
    "latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence";
  const invalidLatitude = `${header}\n91,121,310,2022-01-01,509,Aqua,MODIS,63`;
  const invalidTime = `${header}\n14,121,310,2022-01-01,2460,Aqua,MODIS,63`;
  const invalidDate = `${header}\n14,121,310,2022-02-30,509,Aqua,MODIS,63`;

  assert.throws(() => normalizeCsv(invalidLatitude, "MODIS"), /record 2.*latitude/);
  assert.throws(() => normalizeCsv(invalidTime, "MODIS"), /record 2.*Impossible UTC/);
  assert.throws(() => normalizeCsv(invalidDate, "MODIS"), /record 2.*Impossible UTC/);
});
