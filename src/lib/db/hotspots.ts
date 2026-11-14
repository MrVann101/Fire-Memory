import type {
  BBox,
  Hotspot,
  HotspotFilters,
  HotspotsResponse,
  Instrument,
} from "@/contracts/types";
import hotspotsMock from "@/mocks/hotspots.json";
import { requireRegion, requireRegionWithDbId } from "./regions";
import {
  DatabaseProviderError,
  getSupabaseServerClient,
  isMocksEnabled,
} from "./supabase";
import { AppValidationError } from "./validation";

export const DEFAULT_HOTSPOT_LIMIT = 2000;
export const MAX_HOTSPOT_LIMIT = 10000;

interface HotspotRow {
  id: string;
  latitude: number;
  longitude: number;
  acquisition_datetime: string;
  satellite: string;
  instrument: string;
  confidence: string | null;
  brightness: number | null;
  source_product: string | null;
  province_id: string | null;
  ingested_at?: string;
}

function parseConfidence(raw: string | null): string | number | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const num = Number(raw);
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    return num;
  }
  return raw;
}

function mapHotspotRow(row: HotspotRow): Hotspot {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    acquisitionDatetime: new Date(row.acquisition_datetime).toISOString(),
    satellite: row.satellite,
    instrument: row.instrument as Instrument,
    confidence: parseConfidence(row.confidence),
    brightness: row.brightness,
    sourceProduct: row.source_product,
  };
}

/**
 * Deterministic uniform sampling across a time-ordered array so large windows
 * preserve representation across the full date range rather than only earliest rows.
 */
export function sampleDeterministicallyAcrossTime<T>(
  items: T[],
  limit: number
): T[] {
  if (items.length <= limit) {
    return items;
  }
  if (limit <= 0) {
    return [];
  }
  if (limit === 1) {
    return [items[0]];
  }

  const sampled: T[] = [];
  const step = (items.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i++) {
    const idx = Math.min(items.length - 1, Math.round(i * step));
    sampled.push(items[idx]);
  }
  return sampled;
}

function clampLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_HOTSPOT_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HOTSPOT_LIMIT) {
    throw new AppValidationError(
      `limit must be an integer between 1 and ${MAX_HOTSPOT_LIMIT}.`
    );
  }
  return limit;
}

function isInsideBBox(lat: number, lon: number, bbox: BBox): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

async function queryMockHotspots(
  filters: HotspotFilters,
  limit: number
): Promise<HotspotsResponse> {
  const all = hotspotsMock.hotspots as Hotspot[];
  const startIso = `${filters.start}T00:00:00.000Z`;
  const endIso = `${filters.end}T23:59:59.999Z`;
  const instrument = filters.instrument ?? "ALL";

  let targetBBox: BBox | undefined = filters.bbox;
  if (filters.regionId !== "custom") {
    const region = await requireRegion(filters.regionId);
    targetBBox = region.bbox;
  } else if (!targetBBox) {
    throw new AppValidationError("bbox is required when regionId is 'custom'.");
  }

  const filtered = all
    .filter((h) => {
      if (h.acquisitionDatetime < startIso || h.acquisitionDatetime > endIso) {
        return false;
      }
      if (instrument !== "ALL" && h.instrument !== instrument) {
        return false;
      }
      if (targetBBox && !isInsideBBox(h.latitude, h.longitude, targetBBox)) {
        return false;
      }
      return true;
    })
    .sort((a, b) =>
      a.acquisitionDatetime.localeCompare(b.acquisitionDatetime)
    );

  const sampled = sampleDeterministicallyAcrossTime(filtered, limit);

  return {
    filters: {
      regionId: filters.regionId,
      ...(filters.bbox ? { bbox: filters.bbox } : {}),
      start: filters.start,
      end: filters.end,
      instrument,
    },
    total: filtered.length,
    returned: sampled.length,
    truncated: filtered.length > sampled.length,
    hotspots: sampled,
    rawWindow: hotspotsMock.rawWindow,
    lastUpdated: hotspotsMock.lastUpdated,
  };
}

export async function queryHotspots(
  filters: HotspotFilters,
  limit?: number
): Promise<HotspotsResponse> {
  const effectiveLimit = clampLimit(limit);
  const instrument = filters.instrument ?? "ALL";

  if (isMocksEnabled()) {
    return queryMockHotspots(filters, effectiveLimit);
  }

  let bboxFilter: BBox | undefined;
  let targetDbId: string | undefined;
  let isProvince = false;
  let isAdmRegion = false;

  if (filters.regionId === "custom") {
    if (!filters.bbox) {
      throw new AppValidationError(
        "bbox is required when regionId is 'custom'."
      );
    }
    bboxFilter = filters.bbox;
  } else {
    const resolved = await requireRegionWithDbId(filters.regionId);
    const { region, dbId } = resolved;
    targetDbId = dbId;
    if (region.level === "country") {
      bboxFilter = region.bbox;
    } else if (region.level === "province") {
      isProvince = true;
    } else {
      isAdmRegion = true;
      bboxFilter = region.bbox;
    }
  }

  const supabase = getSupabaseServerClient();
  const startIso = `${filters.start}T00:00:00.000Z`;
  const endIso = `${filters.end}T23:59:59.999Z`;

  // Helper to apply common filters to a Supabase query builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    let query = q
      .gte("acquisition_datetime", startIso)
      .lte("acquisition_datetime", endIso);

    if (instrument !== "ALL") {
      query = query.eq("instrument", instrument);
    }

    if (isProvince && targetDbId) {
      query = query.eq("province_id", targetDbId);
    } else if (isAdmRegion && targetDbId && bboxFilter) {
      const [minLon, minLat, maxLon, maxLat] = bboxFilter;
      const safeId = targetDbId.replace(/"/g, "");
      query = query.or(
        `province_id.eq."${safeId}",and(longitude.gte.${minLon},longitude.lte.${maxLon},latitude.gte.${minLat},latitude.lte.${maxLat})`
      );
    } else if (bboxFilter) {
      const [minLon, minLat, maxLon, maxLat] = bboxFilter;
      query = query
        .gte("longitude", minLon)
        .lte("longitude", maxLon)
        .gte("latitude", minLat)
        .lte("latitude", maxLat);
    }

    return query;
  };

  // 1. Fetch global rawWindow & lastUpdated metadata
  const [{ data: minRow }, { data: maxRow }, { data: updRow }] =
    await Promise.all([
      supabase
        .from("hotspots")
        .select("acquisition_datetime")
        .order("acquisition_datetime", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("hotspots")
        .select("acquisition_datetime")
        .order("acquisition_datetime", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("hotspots")
        .select("ingested_at")
        .order("ingested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const rawWindow =
    minRow?.acquisition_datetime && maxRow?.acquisition_datetime
      ? {
          start: new Date(minRow.acquisition_datetime)
            .toISOString()
            .slice(0, 10),
          end: new Date(maxRow.acquisition_datetime).toISOString().slice(0, 10),
        }
      : null;

  const lastUpdated = updRow?.ingested_at
    ? new Date(updRow.ingested_at).toISOString()
    : null;

  // 2. Count exact matching rows
  const countQuery = applyFilters(
    supabase.from("hotspots").select("id", { count: "exact", head: true })
  );
  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new DatabaseProviderError("Failed to count matching hotspots.");
  }

  const total = count ?? 0;
  if (total === 0) {
    return {
      filters: {
        regionId: filters.regionId,
        ...(filters.bbox ? { bbox: filters.bbox } : {}),
        start: filters.start,
        end: filters.end,
        instrument,
      },
      total: 0,
      returned: 0,
      truncated: false,
      hotspots: [],
      rawWindow,
      lastUpdated,
    };
  }

  // 3. Retrieve rows ordered across time window.
  // If total <= effectiveLimit, fetch all.
  // If total > effectiveLimit, fetch evenly spaced pages/slices across the full window.
  let rows: HotspotRow[] = [];

  if (total <= effectiveLimit) {
    const pageSize = 1000;
    for (let offset = 0; offset < total; offset += pageSize) {
      const endOffset = Math.min(total - 1, offset + pageSize - 1);
      const dataQuery = applyFilters(
        supabase
          .from("hotspots")
          .select(
            "id, latitude, longitude, acquisition_datetime, satellite, instrument, confidence, brightness, source_product, province_id"
          )
          .order("acquisition_datetime", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, endOffset)
      );
      const { data, error } = await dataQuery;
      if (error) {
        throw new DatabaseProviderError("Failed to retrieve hotspot records.");
      }
      if (data) {
        rows.push(...(data as HotspotRow[]));
      }
    }
  } else {
    // Sample deterministically across the full [0 .. total - 1] ordered window
    // using evenly spaced bucket reads so every part of the date window is represented.
    const buckets = Math.min(20, effectiveLimit);
    const perBucket = Math.ceil(effectiveLimit / buckets);
    const bucketSpan = total / buckets;

    const sliceRanges: Array<{ startIdx: number; endIdx: number }> = [];
    let nextMinStart = 0;
    for (let b = 0; b < buckets; b++) {
      const startIdx = Math.max(nextMinStart, Math.floor(b * bucketSpan));
      if (startIdx >= total) {
        break;
      }
      const nextBucketStart =
        b + 1 < buckets ? Math.floor((b + 1) * bucketSpan) : total;
      const endIdx = Math.min(
        total - 1,
        Math.max(startIdx, nextBucketStart - 1),
        startIdx + perBucket - 1
      );
      sliceRanges.push({ startIdx, endIdx });
      nextMinStart = endIdx + 1;
    }

    const slicePromises = sliceRanges.map(async ({ startIdx, endIdx }) => {
      const q = applyFilters(
        supabase
          .from("hotspots")
          .select(
            "id, latitude, longitude, acquisition_datetime, satellite, instrument, confidence, brightness, source_product, province_id"
          )
          .order("acquisition_datetime", { ascending: true })
          .order("id", { ascending: true })
          .range(startIdx, endIdx)
      );
      const { data, error } = await q;
      if (error) {
        throw new DatabaseProviderError(
          "Failed to retrieve sampled hotspot records."
        );
      }
      return (data ?? []) as HotspotRow[];
    });

    const sliceResults = await Promise.all(slicePromises);
    const seenIds = new Set<string>();
    const combined: HotspotRow[] = [];
    for (const row of sliceResults.flat()) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        combined.push(row);
      }
    }
    rows = sampleDeterministicallyAcrossTime(combined, effectiveLimit);
  }

  const hotspots = rows.map(mapHotspotRow);

  return {
    filters: {
      regionId: filters.regionId,
      ...(filters.bbox ? { bbox: filters.bbox } : {}),
      start: filters.start,
      end: filters.end,
      instrument,
    },
    total,
    returned: hotspots.length,
    truncated: total > hotspots.length,
    hotspots,
    rawWindow,
    lastUpdated,
  };
}
