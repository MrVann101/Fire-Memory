import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_USE_MOCKS = "true";

const { GET: getHotspotCsv } = await import(
  "../../src/app/api/export/csv/route.ts"
);
const { GET: getAnalyticsCsv } = await import(
  "../../src/app/api/export/analytics-csv/route.ts"
);

test("hotspot export accepts a standard region without bbox", async () => {
  const response = await getHotspotCsv(
    new Request(
      "http://localhost/api/export/csv?regionId=PH-BUK&start=2025-11-01&end=2025-11-30&instrument=ALL",
    ),
  );
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(body, /^id,latitude,longitude,/);
});

test("analytics export accepts a standard region without bbox", async () => {
  const response = await getAnalyticsCsv(
    new Request(
      "http://localhost/api/export/analytics-csv?regionId=PH-BUK&metric=harmonized&year=2025&month=11",
    ),
  );
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(body, /^year,month,metric,count,/);
});

test("custom exports require bbox", async () => {
  const [hotspotResponse, analyticsResponse] = await Promise.all([
    getHotspotCsv(
      new Request(
        "http://localhost/api/export/csv?regionId=custom&start=2025-11-01&end=2025-11-30&instrument=ALL",
      ),
    ),
    getAnalyticsCsv(
      new Request(
        "http://localhost/api/export/analytics-csv?regionId=custom&metric=harmonized&year=2025&month=11",
      ),
    ),
  ]);

  assert.equal(hotspotResponse.status, 400);
  assert.equal(analyticsResponse.status, 400);
});
