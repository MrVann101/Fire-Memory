import type { ChildCount, Metric } from "@/contracts/types";
import { getChildProvinces, requireRegion } from "@/lib/db/regions";
import {
  DatabaseProviderError,
  getSupabaseServerClient,
  isMocksEnabled,
} from "@/lib/db/supabase";
import { roundToTwoDecimals } from "./labels";

export async function getChildCounts(
  regionId: string,
  year: number,
  month: number,
  metric: Metric
): Promise<ChildCount[]> {
  const region = await requireRegion(regionId);

  // Provinces return an empty array per contract
  if (region.level !== "country" && region.level !== "region") {
    return [];
  }

  const children = await getChildProvinces(region.id);
  if (children.length === 0) {
    return [];
  }

  if (isMocksEnabled()) {
    return children.map((child) => ({
      regionId: child.id,
      name: child.name,
      count: child.id === "PH-BUK" ? 38 : child.id === "PH-PAL" ? 21 : 8,
    }));
  }

  const supabase = getSupabaseServerClient();
  const childIds = children.map((c) => c.id);

  if (metric === "harmonized") {
    const { data, error } = await supabase
      .from("monthly_harmonized")
      .select("region_id, harmonized_count")
      .in("region_id", childIds)
      .eq("year", year)
      .eq("month", month);

    if (error) {
      throw new DatabaseProviderError(
        "Failed to load child province harmonized counts."
      );
    }

    const byRegion = new Map<string, number | null>();
    for (const row of data ?? []) {
      byRegion.set(
        row.region_id,
        row.harmonized_count !== null
          ? roundToTwoDecimals(row.harmonized_count)
          : null
      );
    }

    return children.map((child) => ({
      regionId: child.id,
      name: child.name,
      count: byRegion.get(child.id) ?? null,
    }));
  }

  // Raw metric sums across instruments with coverage for each child province
  const { data, error } = await supabase
    .from("monthly_counts")
    .select("region_id, raw_count, has_coverage")
    .in("region_id", childIds)
    .eq("year", year)
    .eq("month", month)
    .eq("has_coverage", true);

  if (error) {
    throw new DatabaseProviderError("Failed to load child province raw counts.");
  }

  const sums = new Map<string, number>();
  for (const row of data ?? []) {
    sums.set(row.region_id, (sums.get(row.region_id) ?? 0) + row.raw_count);
  }

  return children.map((child) => ({
    regionId: child.id,
    name: child.name,
    count: sums.has(child.id) ? (sums.get(child.id) ?? null) : null,
  }));
}
