import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AppValidationError,
  RegionNotFoundError,
  errorToHttpResponse,
  parseBBoxParam,
  validateCalendarSearchParams,
  validateChildrenSearchParams,
  validateHarmonizationSearchParams,
  validateHotspotSearchParams,
  validateSummarySearchParams,
} from "@/lib/db/validation";
import { DatabaseProviderError } from "@/lib/db/supabase";

describe("Request Validation & Safe Error Responses", () => {
  it("parses valid bboxes and rejects malformed, reversed, or out-of-range bboxes", () => {
    assert.deepEqual(parseBBoxParam("124.5,7.4,125.5,8.6"), [
      124.5, 7.4, 125.5, 8.6,
    ]);
    assert.equal(parseBBoxParam(null), undefined);

    assert.throws(() => parseBBoxParam("124.5,7.4,125.5"), AppValidationError);
    assert.throws(
      () => parseBBoxParam("125.5,7.4,124.5,8.6"),
      AppValidationError
    );
    assert.throws(
      () => parseBBoxParam("124.5,8.6,125.5,7.4"),
      AppValidationError
    );
    assert.throws(
      () => parseBBoxParam("-190,7.4,125.5,8.6"),
      AppValidationError
    );
    assert.throws(
      () => parseBBoxParam("124.5,7.4,125.5,95"),
      AppValidationError
    );
    assert.throws(
      () => parseBBoxParam("abc,7.4,125.5,8.6"),
      AppValidationError
    );
  });

  it("validates hotspot query parameters, dates, limits, and custom bbox requirements", () => {
    const valid = validateHotspotSearchParams(
      new URLSearchParams({
        regionId: "PH-BUK",
        start: "2026-11-01",
        end: "2026-11-14",
        instrument: "VIIRS",
        limit: "500",
      })
    );
    assert.equal(valid.regionId, "PH-BUK");
    assert.equal(valid.limit, 500);

    // Inverted date range
    assert.throws(
      () =>
        validateHotspotSearchParams(
          new URLSearchParams({
            regionId: "PH-BUK",
            start: "2026-11-14",
            end: "2026-11-01",
          })
        ),
      AppValidationError
    );

    // Custom without bbox
    assert.throws(
      () =>
        validateHotspotSearchParams(
          new URLSearchParams({
            regionId: "custom",
            start: "2026-11-01",
            end: "2026-11-14",
          })
        ),
      AppValidationError
    );

    // Limit above 10000
    assert.throws(
      () =>
        validateHotspotSearchParams(
          new URLSearchParams({
            regionId: "PH-BUK",
            start: "2026-11-01",
            end: "2026-11-14",
            limit: "15000",
          })
        ),
      AppValidationError
    );

    // Impossible calendar dates (e.g. Feb 30, Apr 31)
    assert.throws(
      () =>
        validateHotspotSearchParams(
          new URLSearchParams({
            regionId: "PH-BUK",
            start: "2026-02-30",
            end: "2026-03-01",
          })
        ),
      AppValidationError
    );
  });

  it("validates summary, calendar, children, and harmonization query parameters", () => {
    const summary = validateSummarySearchParams(
      new URLSearchParams({
        regionId: "PH-BUK",
        year: "2026",
        month: "11",
        metric: "harmonized",
      })
    );
    assert.equal(summary.month, 11);
    assert.equal(summary.instrument, "ALL");

    // Bad month 13
    assert.throws(
      () =>
        validateSummarySearchParams(
          new URLSearchParams({
            regionId: "PH-BUK",
            year: "2026",
            month: "13",
          })
        ),
      AppValidationError
    );

    // Bad metric
    assert.throws(
      () =>
        validateCalendarSearchParams(
          new URLSearchParams({
            regionId: "PH-BUK",
            metric: "invalid_metric",
          })
        ),
      AppValidationError
    );

    assert.throws(
      () => validateChildrenSearchParams(new URLSearchParams({ regionId: "" })),
      AppValidationError
    );
    assert.throws(
      () =>
        validateHarmonizationSearchParams(new URLSearchParams({ regionId: "" })),
      AppValidationError
    );
  });

  it("returns 400, 404, and 500 HTTP error responses without leaking stack traces or secrets", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret-service-role-key";

    const badReq = errorToHttpResponse(new AppValidationError("Bad bbox"), {
      route: "/api/hotspots",
    });
    assert.equal(badReq.status, 400);

    const notFound = errorToHttpResponse(new RegionNotFoundError("PH-NONE"), {
      route: "/api/analytics/summary",
      regionId: "PH-NONE",
    });
    assert.equal(notFound.status, 404);

    const dbErr = errorToHttpResponse(
      new DatabaseProviderError("Database unavailable"),
      { route: "/api/regions" }
    );
    assert.equal(dbErr.status, 500);

    const unexpected = errorToHttpResponse(
      new Error("Internal crash at stack line 42"),
      { route: "/api/regions" }
    );
    assert.equal(unexpected.status, 500);
    const bodyText = await unexpected.text();
    assert.ok(!bodyText.includes("stack line 42"));
    assert.ok(!bodyText.includes("super-secret-service-role-key"));
  });
});
