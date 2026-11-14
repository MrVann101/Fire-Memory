import type { BBox, Region, RegionLevel } from "@/contracts/types";
import regionsMock from "@/mocks/regions.json";
import { getSupabaseServerClient, isMocksEnabled, DatabaseProviderError } from "./supabase";
import { RegionNotFoundError } from "./validation";

interface RegionRow {
  id: string;
  name: string;
  level: string;
  parent_id: string | null;
  bbox: unknown;
}

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

function mapRegionRow(row: RegionRow): Region {
  return {
    id: row.id,
    name: row.name,
    level: row.level as RegionLevel,
    parentId: row.parent_id,
    bbox: normalizeBBox(row.bbox),
  };
}

export async function listRegions(): Promise<Region[]> {
  if (isMocksEnabled()) {
    return regionsMock.regions as Region[];
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

  return (data ?? []).map((row) => mapRegionRow(row as RegionRow));
}

export async function requireRegion(regionId: string): Promise<Region> {
  const all = await listRegions();
  const found = all.find((r) => r.id === regionId);
  if (!found) {
    throw new RegionNotFoundError(regionId);
  }
  return found;
}

export async function getChildProvinces(parentId: string): Promise<Region[]> {
  const all = await listRegions();
  return all.filter((r) => r.parentId === parentId && r.level === "province");
}
