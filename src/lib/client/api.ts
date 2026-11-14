import type {
  AnalyticsQuery,
  AnalyticsSummary,
  CalendarResponse,
  ChildCount,
  HarmonizationResponse,
  Hotspot,
  HotspotFilters,
  HotspotsResponse,
  Instrument,
  Region,
} from "@/contracts/types";
import calendarFixture from "@/mocks/calendar.json";
import harmonizationFixture from "@/mocks/harmonization.json";
import hotspotsFixture from "@/mocks/hotspots.json";
import regionsFixture from "@/mocks/regions.json";
import summariesFixture from "@/mocks/summaries.json";

type CalendarQuery = Omit<AnalyticsQuery, "year" | "month">;
type ChildrenQuery = Pick<
  AnalyticsQuery,
  "regionId" | "year" | "month" | "metric"
>;

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

function assertSimulatedFixture(simulated: boolean, name: string): void {
  if (!simulated) {
    throw new Error(`${name} fixture is not marked as simulated.`);
  }
}

function parseRegionLevel(value: string): Region["level"] {
  switch (value) {
    case "country":
    case "region":
    case "province":
    case "custom":
      return value;
    default:
      throw new Error(`Unsupported region level in mock data: ${value}`);
  }
}

function getMockRegions(): Region[] {
  assertSimulatedFixture(regionsFixture._simulated, "Regions");
  return regionsFixture.regions.map(
    (region): Region => ({
      id: region.id,
      name: region.name,
      level: parseRegionLevel(region.level),
      parentId: region.parentId,
      bbox: [
        region.bbox[0],
        region.bbox[1],
        region.bbox[2],
        region.bbox[3],
      ],
    })
  );
}

function addRegionParams(
  params: URLSearchParams,
  regionId: string,
  bbox?: AnalyticsQuery["bbox"]
): void {
  params.set("regionId", regionId);
  if (bbox) {
    params.set("bbox", bbox.join(","));
  }
}

function addAnalyticsParams(
  params: URLSearchParams,
  query: AnalyticsQuery | CalendarQuery
): void {
  addRegionParams(params, query.regionId, query.bbox);
  params.set("metric", query.metric);
  if (query.metric === "raw" && query.instrument) {
    params.set("instrument", query.instrument);
  }
}

function resolveMockSummary(query: AnalyticsQuery): AnalyticsSummary {
  assertSimulatedFixture(summariesFixture._simulated, "Summary");

  let summary: AnalyticsSummary;
  if (query.regionId === "custom" && query.metric === "harmonized") {
    summary = summariesFixture.customArea as AnalyticsSummary;
  } else if (
    query.regionId === "PH-BAT" &&
    query.metric === "harmonized"
  ) {
    summary = summariesFixture.zeroBaseline as AnalyticsSummary;
  } else if (
    query.regionId === "PH-BUK" &&
    query.metric === "harmonized"
  ) {
    summary = summariesFixture.harmonizedWithEstimated as AnalyticsSummary;
  } else if (
    query.regionId === "PH-BUK" &&
    query.metric === "raw" &&
    query.instrument === "VIIRS"
  ) {
    summary = summariesFixture.rawSummary as AnalyticsSummary;
  } else {
    throw new Error(
      `No simulated summary is available for ${query.regionId}, ${query.metric}, instrument ${query.instrument ?? "ALL"}.`
    );
  }

  if (
    summary.period.year !== query.year ||
    summary.period.month !== query.month
  ) {
    throw new Error(
      `No simulated summary is available for ${query.year}-${String(query.month).padStart(2, "0")}.`
    );
  }

  return summary;
}

function resolveMockCalendar(query: CalendarQuery): CalendarResponse {
  assertSimulatedFixture(calendarFixture._simulated, "Calendar");
  const calendar = calendarFixture.calendar as CalendarResponse;

  if (
    query.regionId !== calendar.regionId ||
    query.metric !== calendar.metric ||
    (query.metric === "raw" && query.instrument !== calendar.instrument)
  ) {
    throw new Error(
      `No simulated calendar is available for ${query.regionId}, ${query.metric}, instrument ${query.instrument ?? "ALL"}.`
    );
  }

  return calendar;
}

function resolveMockHarmonization(regionId: string): HarmonizationResponse {
  assertSimulatedFixture(harmonizationFixture._simulated, "Harmonization");
  const response = harmonizationFixture.harmonization as HarmonizationResponse;

  if (regionId !== response.regionId) {
    throw new Error(
      `No simulated harmonization is available for ${regionId}.`
    );
  }

  return response;
}

function parseHotspotInstrument(value: string): Instrument {
  if (value === "MODIS" || value === "VIIRS") {
    return value;
  }
  throw new Error(`Unsupported instrument in mock data: ${value}`);
}

function getMockHotspots(filters: HotspotFilters, limit: number): HotspotsResponse {
  assertSimulatedFixture(hotspotsFixture._simulated, "Hotspots");

  const regions = getMockRegions();
  const bbox =
    filters.regionId === "custom"
      ? filters.bbox
      : regions.find((region) => region.id === filters.regionId)?.bbox;

  if (!bbox) {
    throw new Error(`No region bounds are available for ${filters.regionId}.`);
  }

  const filtered = hotspotsFixture.hotspots
    .map(
      (hotspot): Hotspot => ({
        id: hotspot.id,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        acquisitionDatetime: hotspot.acquisitionDatetime,
        satellite: hotspot.satellite,
        instrument: parseHotspotInstrument(hotspot.instrument),
        confidence: hotspot.confidence,
        brightness: hotspot.brightness,
        sourceProduct: hotspot.sourceProduct,
      })
    )
    .filter((hotspot) => {
      const date = hotspot.acquisitionDatetime.slice(0, 10);
      return (
        hotspot.longitude >= bbox[0] &&
        hotspot.latitude >= bbox[1] &&
        hotspot.longitude <= bbox[2] &&
        hotspot.latitude <= bbox[3] &&
        date >= filters.start &&
        date <= filters.end &&
        (!filters.instrument ||
          filters.instrument === "ALL" ||
          hotspot.instrument === filters.instrument)
      );
    });

  const boundedLimit = Math.max(1, Math.min(limit, 10_000));
  const hotspots = filtered.slice(0, boundedLimit);

  return {
    filters,
    total: filtered.length,
    returned: hotspots.length,
    truncated: filtered.length > hotspots.length,
    hotspots,
    rawWindow: hotspotsFixture.rawWindow,
    lastUpdated: hotspotsFixture.lastUpdated,
  };
}

export async function getRegions(signal?: AbortSignal): Promise<Region[]> {
  if (USE_MOCKS) {
    return getMockRegions();
  }
  return fetchJson<Region[]>("/api/regions", signal);
}

export async function getHotspots(
  filters: HotspotFilters,
  limit = 2_000,
  signal?: AbortSignal
): Promise<HotspotsResponse> {
  if (USE_MOCKS) {
    return getMockHotspots(filters, limit);
  }

  const params = new URLSearchParams();
  addRegionParams(params, filters.regionId, filters.bbox);
  params.set("start", filters.start);
  params.set("end", filters.end);
  params.set("instrument", filters.instrument ?? "ALL");
  params.set("limit", String(limit));

  return fetchJson<HotspotsResponse>(`/api/hotspots?${params}`, signal);
}

export async function getAnalyticsSummary(
  query: AnalyticsQuery,
  signal?: AbortSignal
): Promise<AnalyticsSummary> {
  if (USE_MOCKS) {
    return resolveMockSummary(query);
  }

  const params = new URLSearchParams();
  addAnalyticsParams(params, query);
  params.set("year", String(query.year));
  params.set("month", String(query.month));

  return fetchJson<AnalyticsSummary>(
    `/api/analytics/summary?${params}`,
    signal
  );
}

export async function getCalendar(
  query: CalendarQuery,
  signal?: AbortSignal
): Promise<CalendarResponse> {
  if (USE_MOCKS) {
    return resolveMockCalendar(query);
  }

  const params = new URLSearchParams();
  addAnalyticsParams(params, query);
  return fetchJson<CalendarResponse>(
    `/api/analytics/calendar?${params}`,
    signal
  );
}

export async function getChildren(
  query: ChildrenQuery,
  signal?: AbortSignal
): Promise<ChildCount[]> {
  const params = new URLSearchParams();
  addRegionParams(params, query.regionId);
  params.set("year", String(query.year));
  params.set("month", String(query.month));
  params.set("metric", query.metric);

  return fetchJson<ChildCount[]>(`/api/analytics/children?${params}`, signal);
}

export async function getHarmonization(
  regionId: string,
  signal?: AbortSignal
): Promise<HarmonizationResponse> {
  if (USE_MOCKS) {
    return resolveMockHarmonization(regionId);
  }

  const params = new URLSearchParams({ regionId });
  return fetchJson<HarmonizationResponse>(
    `/api/analytics/harmonization?${params}`,
    signal
  );
}
