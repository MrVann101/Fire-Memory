import type {
  HarmonizationInfo,
  HarmonizationResponse,
  OverlapPoint,
} from "@/contracts/types";
import harmonizationMock from "@/mocks/harmonization.json";
import { requireRegionWithDbId } from "@/lib/db/regions";
import {
  DatabaseProviderError,
  getSupabaseServerClient,
  isMocksEnabled,
} from "@/lib/db/supabase";
import { roundToTwoDecimals } from "./labels";

interface FactorRow {
  region_id: string | null;
  scope?: string | null;
  factor: number;
  method: string;
  overlap_years: number[];
  n_months: number;
  correlation: number | null;
  error_percent: number | null;
  estimated_years: number[];
  fallback_reason?: string | null;
  notes: string[];
}

interface MonthlyOverlapRow {
  region_id?: string;
  year: number;
  month: number;
  instrument: "MODIS" | "VIIRS";
  active_cell_days: number;
  has_coverage: boolean;
}

export async function getHarmonizationInfoForRegion(
  regionId: string
): Promise<HarmonizationInfo | null> {
  if (isMocksEnabled()) {
    if (regionId !== "custom") {
      await requireRegionWithDbId(regionId);
    }
    return harmonizationMock.harmonization.info as HarmonizationInfo;
  }

  const supabase = getSupabaseServerClient();

  let scopeRegionId: string | null = regionId;
  if (regionId === "custom") {
    scopeRegionId = null;
  } else {
    const { region, dbId } = await requireRegionWithDbId(regionId);
    scopeRegionId = region.level === "country" ? null : dbId;
  }

  let factorRow: FactorRow | null = null;
  let factorScope: "province" | "national" = "national";

  if (scopeRegionId !== null) {
    const { data: provData, error: provError } = await supabase
      .from("harmonization_factors")
      .select(
        "region_id, scope, factor, method, overlap_years, n_months, correlation, error_percent, estimated_years, fallback_reason, notes"
      )
      .eq("region_id", scopeRegionId)
      .maybeSingle();

    if (provError) {
      throw new DatabaseProviderError(
        "Failed to load province harmonization factor."
      );
    }
    if (provData) {
      factorRow = provData as FactorRow;
      factorScope = factorRow.scope === "national" ? "national" : "province";
    }
  }

  if (!factorRow) {
    const { data: natData, error: natError } = await supabase
      .from("harmonization_factors")
      .select(
        "region_id, scope, factor, method, overlap_years, n_months, correlation, error_percent, estimated_years, fallback_reason, notes"
      )
      .is("region_id", null)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (natError) {
      throw new DatabaseProviderError(
        "Failed to load national harmonization factor."
      );
    }
    if (natData) {
      factorRow = natData as FactorRow;
      factorScope = "national";
    }
  }

  if (!factorRow) {
    return null;
  }

  const notes = [...(factorRow.notes ?? [])];
  if (scopeRegionId !== null && factorScope === "national") {
    notes.push(
      "Province-specific factor unavailable or sparse; using national harmonization factor."
    );
  }

  return {
    method: factorRow.method,
    targetSensor: "VIIRS",
    overlapYears: factorRow.overlap_years ?? [],
    factor: factorRow.factor,
    factorScope,
    correlation: factorRow.correlation,
    errorPercent: factorRow.error_percent,
    estimatedYears: factorRow.estimated_years ?? [],
    notes,
  };
}

export async function getHarmonization(
  regionId: string
): Promise<HarmonizationResponse> {
  if (isMocksEnabled()) {
    const resolved =
      regionId === "custom" ? null : await requireRegionWithDbId(regionId);
    const mock = harmonizationMock.harmonization as HarmonizationResponse;
    return {
      ...mock,
      regionId: resolved ? resolved.region.id : regionId,
    };
  }

  const resolved =
    regionId === "custom" ? null : await requireRegionWithDbId(regionId);
  const canonicalRegionId = resolved ? resolved.region.id : regionId;
  const info = await getHarmonizationInfoForRegion(regionId);

  if (!info) {
    return {
      regionId: canonicalRegionId,
      info: {
        method: "median ratio of active cell-days",
        targetSensor: "VIIRS",
        overlapYears: [],
        factor: null,
        factorScope: "national",
        correlation: null,
        errorPercent: null,
        estimatedYears: [],
        notes: ["Harmonization factors have not been computed yet."],
      },
      overlap: [],
    };
  }

  if (regionId === "custom" || info.overlapYears.length === 0) {
    return {
      regionId: canonicalRegionId,
      info,
      overlap: [],
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("monthly_counts")
    .select("year, month, instrument, active_cell_days, has_coverage")
    .eq("region_id", resolved ? resolved.dbId : regionId)
    .in("year", info.overlapYears)
    .eq("has_coverage", true)
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) {
    throw new DatabaseProviderError(
      "Failed to retrieve overlap series for harmonization."
    );
  }

  let rows = (data ?? []) as MonthlyOverlapRow[];

  if (rows.length === 0 && resolved?.region.level === "region") {
    const { data: childRegions, error: childError } = await supabase
      .from("regions")
      .select("id")
      .eq("parent_id", resolved.dbId)
      .eq("level", "province");
    if (childError) {
      throw new DatabaseProviderError(
        "Failed to resolve provinces for regional overlap series."
      );
    }
    const childIds = ((childRegions ?? []) as Array<{ id: string }>).map(
      (c) => c.id
    );
    if (childIds.length > 0) {
      const { data: regData, error: regError } = await supabase
        .from("monthly_counts")
        .select("year, month, instrument, active_cell_days, has_coverage")
        .in("region_id", childIds)
        .in("year", info.overlapYears)
        .eq("has_coverage", true)
        .order("year", { ascending: true })
        .order("month", { ascending: true });
      if (regError) {
        throw new DatabaseProviderError(
          "Failed to retrieve regional overlap series for harmonization."
        );
      }
      rows = (regData ?? []) as MonthlyOverlapRow[];
    }
  }

  if (
    rows.length === 0 &&
    (resolved?.region.level === "country" ||
      (resolved?.region.level === "region" && info.factorScope === "national"))
  ) {
    const { data: natData, error: natError } = await supabase.rpc(
      "get_national_overlap",
      { p_overlap_years: info.overlapYears }
    );
    if (natError) {
      throw new DatabaseProviderError(
        "Failed to retrieve national overlap series for harmonization."
      );
    }
    rows = ((natData ?? []) as Array<{
      year: number;
      month: number;
      instrument: "MODIS" | "VIIRS";
      active_cell_days: number;
    }>).map((r) => ({ ...r, has_coverage: true }));
  }

  const byPeriod = new Map<string, OverlapPoint>();

  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    let point = byPeriod.get(key);
    if (!point) {
      point = {
        year: row.year,
        month: row.month,
        modis: null,
        modisScaled: null,
        viirs: null,
      };
      byPeriod.set(key, point);
    }

    if (row.instrument === "MODIS") {
      point.modis = (point.modis ?? 0) + row.active_cell_days;
      point.modisScaled =
        info.factor !== null
          ? roundToTwoDecimals(point.modis * info.factor)
          : null;
    } else if (row.instrument === "VIIRS") {
      point.viirs = (point.viirs ?? 0) + row.active_cell_days;
    }
  }

  const overlap = Array.from(byPeriod.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  return {
    regionId: canonicalRegionId,
    info,
    overlap,
  };
}
