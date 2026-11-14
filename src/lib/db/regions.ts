import type { BBox, Region, RegionLevel } from "@/contracts/types";
import regionsMock from "@/mocks/regions.json";
import boundariesRegions from "../../../data/boundaries/regions.json";
import { getSupabaseServerClient, isMocksEnabled, DatabaseProviderError } from "./supabase";
import { RegionNotFoundError } from "./validation";

interface RegionRow {
  id: string;
  name: string;
  level: string;
  parent_id: string | null;
  bbox: unknown;
}

export interface ResolvedRegion {
  region: Region;
  dbId: string;
}

export const COUNTRY_GEOBOUNDARIES_ID = "PHL-ADM0-24100683B85265433280220";

const SHORT_CODE_TO_GEOBOUNDARIES_ID: Record<string, string> = {
  PH: COUNTRY_GEOBOUNDARIES_ID,
  "PH-BUK": "PHL-ADM2-2640588B97736443103823",
  "PH-DAV": "PHL-ADM2-2640588B9806973652018",
  "PH-NUE": "PHL-ADM2-2640588B46982966730152",
  "PH-PAL": "PHL-ADM2-2640588B20950743061684",
  "PH-BAT": "PHL-ADM2-2640588B23864872837062",
};

const GEOBOUNDARIES_ID_TO_SHORT_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_CODE_TO_GEOBOUNDARIES_ID).map(([shortCode, geoId]) => [geoId, shortCode])
);

const SHORT_CODE_TO_NAME: Record<string, string> = {
  PH: "The Philippines",
  "PH-BUK": "Bukidnon",
  "PH-DAV": "Davao del Sur",
  "PH-NUE": "Nueva Ecija",
  "PH-PAL": "Palawan",
  "PH-BAT": "Batanes",
};

function normalizeBBox(raw: unknown): BBox {
  if (
    Array.isArray(raw) &&
    raw.length === 4 &&
    raw.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return [raw[0], raw[1], raw[2], raw[3]];
  }
  return [116.9, 4.5, 126.6, 21.1];
}

async function fetchRegionRecords(): Promise<ResolvedRegion[]> {
  if (isMocksEnabled()) {
    return (regionsMock.regions as Region[]).map((region) => ({
      region,
      dbId: region.id,
    }));
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id, name, level, parent_id, bbox")
    .order("level", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new DatabaseProviderError("Failed to retrieve regions from database.");
  }

  const rows = (data ?? []) as RegionRow[];
  const countryRawIds = new Set<string>(["PH", COUNTRY_GEOBOUNDARIES_ID]);
  for (const row of rows) {
    if (row.level === "country") {
      countryRawIds.add(row.id);
    }
  }

  return rows.map((row) => {
    const isCountry = row.level === "country" || countryRawIds.has(row.id);
    const normalizedId = isCountry ? "PH" : row.id;
    const normalizedParentId =
      row.parent_id && countryRawIds.has(row.parent_id) ? "PH" : row.parent_id;

    return {
      region: {
        id: normalizedId,
        name: row.name,
        level: row.level as RegionLevel,
        parentId: normalizedParentId,
        bbox: normalizeBBox(row.bbox),
      },
      dbId: row.id,
    };
  });
}

export async function listRegions(): Promise<Region[]> {
  const records = await fetchRegionRecords();
  return records.map((r) => r.region);
}

export async function requireRegionWithDbId(regionId: string): Promise<ResolvedRegion> {
  const records = await fetchRegionRecords();
  const trimmed = regionId.trim();
  const geoAlias = SHORT_CODE_TO_GEOBOUNDARIES_ID[trimmed];
  const shortAlias = GEOBOUNDARIES_ID_TO_SHORT_CODE[trimmed];
  const nameAlias =
    SHORT_CODE_TO_NAME[trimmed] ?? (shortAlias ? SHORT_CODE_TO_NAME[shortAlias] : undefined);

  const found =
    records.find((r) => r.region.id === trimmed || r.dbId === trimmed) ??
    (geoAlias
      ? records.find((r) => r.dbId === geoAlias || r.region.id === geoAlias)
      : undefined) ??
    (shortAlias
      ? records.find((r) => r.region.id === shortAlias || r.dbId === shortAlias)
      : undefined) ??
    (nameAlias
      ? records.find((r) => r.region.name.toLowerCase() === nameAlias.toLowerCase())
      : undefined);

  if (found) {
    return found;
  }

  if (isMocksEnabled()) {
    const boundaryMatch = (boundariesRegions as Region[]).find(
      (b) => b.id === trimmed
    );
    if (boundaryMatch) {
      const isCountry = boundaryMatch.level === "country" || boundaryMatch.id === COUNTRY_GEOBOUNDARIES_ID;
      return {
        region: {
          id: isCountry ? "PH" : boundaryMatch.id,
          name: boundaryMatch.name,
          level: boundaryMatch.level as RegionLevel,
          parentId:
            boundaryMatch.parentId === COUNTRY_GEOBOUNDARIES_ID
              ? "PH"
              : boundaryMatch.parentId,
          bbox: normalizeBBox(boundaryMatch.bbox),
        },
        dbId: boundaryMatch.id,
      };
    }
  }

  throw new RegionNotFoundError(regionId);
}

export async function requireRegion(regionId: string): Promise<Region> {
  const resolved = await requireRegionWithDbId(regionId);
  return resolved.region;
}

export async function getChildProvinces(parentId: string): Promise<Region[]> {
  const records = await fetchRegionRecords();
  const parentResolved = await requireRegionWithDbId(parentId).catch(() => null);
  const canonicalParentId = parentResolved ? parentResolved.region.id : parentId;
  const rawParentDbId = parentResolved ? parentResolved.dbId : parentId;

  return records
    .filter(
      (r) =>
        r.region.level === "province" &&
        (r.region.parentId === canonicalParentId || r.region.parentId === rawParentDbId)
    )
    .map((r) => r.region);
}
