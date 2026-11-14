import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MonthlyCount, MonthlyGridCount } from "./aggregate";
import type { HarmonizedRow, FactorRow } from "./harmonize";

type Instrument = "MODIS" | "VIIRS";
type RegionLevel = "country" | "region" | "province";
type BBox = [number, number, number, number];
type DatabaseRow = Record<string, unknown>;
type InputMonthlyCount = Omit<MonthlyCount, "has_coverage"> & {
  has_coverage: boolean;
};
type TableName =
  | "regions"
  | "harmonization_factors"
  | "monthly_counts"
  | "monthly_harmonized"
  | "monthly_grid_counts"
  | "hotspots";

interface RegionInput {
  id: string;
  name: string;
  level: RegionLevel;
  parentId: string | null;
  bbox: BBox;
}

interface HotspotInput {
  id: string;
  latitude: number;
  longitude: number;
  acquisitionDatetime: string;
  satellite: string;
  instrument: Instrument;
  confidence: string | number | null;
  brightness: number | null;
  sourceProduct: string | null;
}

interface RawWindowInput {
  hotspot: HotspotInput;
  province_id: string | null;
}

export interface IngestArtifacts {
  regions: RegionInput[];
  monthlyCounts: InputMonthlyCount[];
  monthlyHarmonized: HarmonizedRow[];
  monthlyGridCounts: MonthlyGridCount[];
  factors: FactorRow[];
  hotspots: RawWindowInput[];
}

export interface DatabasePayloads {
  regions: DatabaseRow[];
  harmonization_factors: DatabaseRow[];
  monthly_counts: DatabaseRow[];
  monthly_harmonized: DatabaseRow[];
  monthly_grid_counts: DatabaseRow[];
  hotspots: DatabaseRow[];
}

interface LoaderOptions {
  dryRun: boolean;
  inputDirectory: string;
  regionsFile: string;
  hotspotsFile: string | undefined;
  limit: number | undefined;
  batchSize: number;
}

interface WriteStats {
  table: TableName;
  inserted: number | null;
  updated: number | null;
  skipped: number;
  durationMs: number;
}

const COUNTRY_DATABASE_ID = "PH";
const NATIONAL_FACTOR_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1000;
const PAGE_SIZE = 1000;

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

function nullableString(value: unknown, context: string): string | null {
  if (value === null) {
    return null;
  }
  return requiredString(value, context);
}

function finiteNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, context: string): number {
  const parsed = finiteNumber(value, context);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${context} must be a non-negative integer`);
  }
  return parsed;
}

function requiredBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be a boolean`);
  }
  return value;
}

function parseInstrument(value: unknown, context: string): Instrument {
  if (value !== "MODIS" && value !== "VIIRS") {
    throw new Error(`${context} must be MODIS or VIIRS`);
  }
  return value;
}

function parseBBox(value: unknown, context: string): BBox {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
  ) {
    throw new Error(`${context} must contain four finite coordinates`);
  }
  return [value[0], value[1], value[2], value[3]];
}

function parseRegion(value: unknown, index: number): RegionInput {
  const context = `Region row ${index + 1}`;
  const row = asRecord(value, context);
  const level = row.level;
  if (level !== "country" && level !== "region" && level !== "province") {
    throw new Error(`${context}.level is invalid`);
  }
  const parentId =
    row.parentId === null ? null : requiredString(row.parentId, `${context}.parentId`);
  return {
    id: requiredString(row.id, `${context}.id`),
    name: requiredString(row.name, `${context}.name`),
    level,
    parentId,
    bbox: parseBBox(row.bbox, `${context}.bbox`),
  };
}

function parseMonthlyCount(value: unknown, index: number): InputMonthlyCount {
  const context = `Monthly-count row ${index + 1}`;
  const row = asRecord(value, context);
  const month = nonNegativeInteger(row.month, `${context}.month`);
  if (month < 1 || month > 12) {
    throw new Error(`${context}.month must be from 1 to 12`);
  }
  return {
    region_id: requiredString(row.region_id, `${context}.region_id`),
    year: nonNegativeInteger(row.year, `${context}.year`),
    month,
    instrument: parseInstrument(row.instrument, `${context}.instrument`),
    raw_count: nonNegativeInteger(row.raw_count, `${context}.raw_count`),
    active_cell_days: nonNegativeInteger(
      row.active_cell_days,
      `${context}.active_cell_days`,
    ),
    has_coverage: requiredBoolean(row.has_coverage, `${context}.has_coverage`),
  };
}

function parseHarmonizedRow(value: unknown, index: number): HarmonizedRow {
  const context = `Harmonized row ${index + 1}`;
  const row = asRecord(value, context);
  const month = nonNegativeInteger(row.month, `${context}.month`);
  if (month < 1 || month > 12) {
    throw new Error(`${context}.month must be from 1 to 12`);
  }
  return {
    region_id: requiredString(row.region_id, `${context}.region_id`),
    year: nonNegativeInteger(row.year, `${context}.year`),
    month,
    harmonized_count: finiteNumber(row.harmonized_count, `${context}.harmonized_count`),
    is_estimated: requiredBoolean(row.is_estimated, `${context}.is_estimated`),
    method_version: requiredString(row.method_version, `${context}.method_version`),
  };
}

function parseGridCount(value: unknown, index: number): MonthlyGridCount {
  const context = `Monthly-grid row ${index + 1}`;
  const row = asRecord(value, context);
  const month = nonNegativeInteger(row.month, `${context}.month`);
  if (month < 1 || month > 12) {
    throw new Error(`${context}.month must be from 1 to 12`);
  }
  return {
    cell_id: requiredString(row.cell_id, `${context}.cell_id`),
    latitude: finiteNumber(row.latitude, `${context}.latitude`),
    longitude: finiteNumber(row.longitude, `${context}.longitude`),
    year: nonNegativeInteger(row.year, `${context}.year`),
    month,
    instrument: parseInstrument(row.instrument, `${context}.instrument`),
    raw_count: nonNegativeInteger(row.raw_count, `${context}.raw_count`),
    active_cell_days: nonNegativeInteger(
      row.active_cell_days,
      `${context}.active_cell_days`,
    ),
  };
}

function nullableMetric(value: unknown, context: string): number | null {
  return value === null ? null : finiteNumber(value, context);
}

function parseFactor(value: unknown, index: number): FactorRow {
  const context = `Harmonization-factor row ${index + 1}`;
  const row = asRecord(value, context);
  const regionId = nullableString(row.region_id, `${context}.region_id`);
  const scope = row.scope;
  if (scope !== "province" && scope !== "national") {
    throw new Error(`${context}.scope is invalid`);
  }
  if (row.method !== "median_monthly_viirs_over_modis") {
    throw new Error(`${context}.method is invalid`);
  }
  if (!Array.isArray(row.overlap_years)) {
    throw new Error(`${context}.overlap_years must be an array`);
  }
  const overlapYears = row.overlap_years.map((year, yearIndex) =>
    nonNegativeInteger(year, `${context}.overlap_years[${yearIndex}]`),
  );
  return {
    region_id: regionId,
    factor: finiteNumber(row.factor, `${context}.factor`),
    scope,
    method: "median_monthly_viirs_over_modis",
    overlap_years: overlapYears,
    month_count: nonNegativeInteger(row.month_count, `${context}.month_count`),
    correlation: nullableMetric(row.correlation, `${context}.correlation`),
    mean_absolute_error: nullableMetric(
      row.mean_absolute_error,
      `${context}.mean_absolute_error`,
    ),
    root_mean_square_error: nullableMetric(
      row.root_mean_square_error,
      `${context}.root_mean_square_error`,
    ),
    mean_absolute_percentage_error: nullableMetric(
      row.mean_absolute_percentage_error,
      `${context}.mean_absolute_percentage_error`,
    ),
    fallback_reason: nullableString(row.fallback_reason, `${context}.fallback_reason`),
  };
}

function parseHotspot(value: unknown, index: number): RawWindowInput {
  const context = `Raw-window row ${index + 1}`;
  const row = asRecord(value, context);
  const hotspot = asRecord(row.hotspot, `${context}.hotspot`);
  const confidence = hotspot.confidence;
  if (
    confidence !== null &&
    typeof confidence !== "string" &&
    typeof confidence !== "number"
  ) {
    throw new Error(`${context}.hotspot.confidence is invalid`);
  }
  return {
    hotspot: {
      id: requiredString(hotspot.id, `${context}.hotspot.id`),
      latitude: finiteNumber(hotspot.latitude, `${context}.hotspot.latitude`),
      longitude: finiteNumber(hotspot.longitude, `${context}.hotspot.longitude`),
      acquisitionDatetime: requiredString(
        hotspot.acquisitionDatetime,
        `${context}.hotspot.acquisitionDatetime`,
      ),
      satellite: requiredString(hotspot.satellite, `${context}.hotspot.satellite`),
      instrument: parseInstrument(hotspot.instrument, `${context}.hotspot.instrument`),
      confidence,
      brightness:
        hotspot.brightness === null
          ? null
          : finiteNumber(hotspot.brightness, `${context}.hotspot.brightness`),
      sourceProduct: nullableString(
        hotspot.sourceProduct,
        `${context}.hotspot.sourceProduct`,
      ),
    },
    province_id: nullableString(row.province_id, `${context}.province_id`),
  };
}

function readJsonRows<T>(
  path: string,
  label: string,
  parse: (value: unknown, index: number) => T,
): T[] {
  if (!existsSync(path)) {
    throw new Error(`${label} input does not exist: ${path}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} input must be a JSON array`);
  }
  return parsed.map(parse);
}

function readHotspots(path: string): RawWindowInput[] {
  if (!existsSync(path)) {
    throw new Error(`Raw-window input does not exist: ${path}`);
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON in raw-window row ${index + 1}`);
      }
      return parseHotspot(parsed, index);
    });
}

export function readIngestArtifacts(
  inputDirectory = "data/processed",
  regionsFile = "data/boundaries/regions.json",
  hotspotsFile = resolve(inputDirectory, "raw-window-2024-01-01-to-2025-12-31.jsonl"),
): IngestArtifacts {
  const directory = resolve(inputDirectory);
  return {
    regions: readJsonRows(resolve(regionsFile), "Regions", parseRegion),
    monthlyCounts: readJsonRows(
      resolve(directory, "monthly-counts.json"),
      "Monthly-count",
      parseMonthlyCount,
    ),
    monthlyHarmonized: readJsonRows(
      resolve(directory, "monthly-harmonized.json"),
      "Harmonized",
      parseHarmonizedRow,
    ),
    monthlyGridCounts: readJsonRows(
      resolve(directory, "monthly-grid-counts.json"),
      "Monthly-grid",
      parseGridCount,
    ),
    factors: readJsonRows(
      resolve(directory, "harmonization-factors.json"),
      "Harmonization-factor",
      parseFactor,
    ),
    hotspots: readHotspots(resolve(hotspotsFile)),
  };
}

function assertUniqueKeys(
  rows: DatabaseRow[],
  columns: string[],
  table: string,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify(columns.map((column) => row[column] ?? null));
    if (seen.has(key)) {
      throw new Error(`Duplicate ${table} key: ${key}`);
    }
    seen.add(key);
  }
}

function keyFor(row: Record<string, unknown>, columns: string[]): string {
  return JSON.stringify(columns.map((column) => row[column] ?? null));
}

function formatMetric(value: number, suffix = ""): string {
  return `${value}${suffix}`;
}

export function mapArtifactsToDatabase(
  artifacts: IngestArtifacts,
): DatabasePayloads {
  if (artifacts.regions.length === 0) {
    throw new Error("Region input is empty");
  }
  const sourceRegionById = new Map(
    artifacts.regions.map((region) => [region.id, region]),
  );
  if (sourceRegionById.size !== artifacts.regions.length) {
    throw new Error("Region input contains duplicate IDs");
  }
  const countries = artifacts.regions.filter(({ level }) => level === "country");
  if (countries.length !== 1) {
    throw new Error(`Expected one country region, got ${countries.length}`);
  }
  const databaseIdBySourceId = new Map(
    artifacts.regions.map((region) => [
      region.id,
      region.level === "country" ? COUNTRY_DATABASE_ID : region.id,
    ]),
  );
  const databaseRegionIds = new Set(databaseIdBySourceId.values());
  if (databaseRegionIds.size !== artifacts.regions.length) {
    throw new Error("Database region ID mapping creates duplicate IDs");
  }
  for (const region of artifacts.regions) {
    if (region.parentId !== null && !databaseIdBySourceId.has(region.parentId)) {
      throw new Error(`Region ${region.id} refers to missing parent ${region.parentId}`);
    }
  }
  const provinceIds = new Set(
    artifacts.regions
      .filter(({ level }) => level === "province")
      .map(({ id }) => id),
  );

  const regions: DatabaseRow[] = artifacts.regions.map((region) => ({
    id: databaseIdBySourceId.get(region.id),
    name: region.name,
    level: region.level,
    parent_id:
      region.parentId === null
        ? null
        : databaseIdBySourceId.get(region.parentId) ?? null,
    bbox: region.bbox,
  }));
  const monthlyCounts: DatabaseRow[] = artifacts.monthlyCounts.map((row) => {
    if (!provinceIds.has(row.region_id)) {
      throw new Error(`Monthly-count row refers to unknown province ${row.region_id}`);
    }
    if (!row.has_coverage && (row.raw_count !== 0 || row.active_cell_days !== 0)) {
      throw new Error(`Unknown-coverage row has counts for ${row.region_id}`);
    }
    return {
      region_id: row.region_id,
      year: row.year,
      month: row.month,
      instrument: row.instrument,
      raw_count: row.raw_count,
      active_cell_days: row.active_cell_days,
      has_coverage: row.has_coverage,
    };
  });
  const monthlyHarmonized: DatabaseRow[] = artifacts.monthlyHarmonized.map((row) => {
    if (!provinceIds.has(row.region_id)) {
      throw new Error(`Harmonized row refers to unknown province ${row.region_id}`);
    }
    return {
      region_id: row.region_id,
      year: row.year,
      month: row.month,
      harmonized_count: row.harmonized_count,
      is_estimated: row.is_estimated,
      method_version: row.method_version,
    };
  });
  const monthlyGridCounts: DatabaseRow[] = artifacts.monthlyGridCounts.map((row) => ({
    cell_id: row.cell_id,
    cell_lat: row.latitude,
    cell_lon: row.longitude,
    year: row.year,
    month: row.month,
    instrument: row.instrument,
    raw_count: row.raw_count,
    active_cell_days: row.active_cell_days,
  }));
  const estimatedYearsByRegion = new Map<string, Set<number>>();
  for (const row of artifacts.monthlyHarmonized) {
    if (row.is_estimated) {
      const years = estimatedYearsByRegion.get(row.region_id) ?? new Set<number>();
      years.add(row.year);
      estimatedYearsByRegion.set(row.region_id, years);
    }
  }
  const allEstimatedYears = new Set(
    [...estimatedYearsByRegion.values()].flatMap((years) => [...years]),
  );
  const factors: DatabaseRow[] = artifacts.factors.map((factor) => {
    if (factor.region_id !== null && !provinceIds.has(factor.region_id)) {
      throw new Error(`Factor refers to unknown province ${factor.region_id}`);
    }
    const estimatedYears =
      factor.region_id === null
        ? [...allEstimatedYears]
        : [...(estimatedYearsByRegion.get(factor.region_id) ?? new Set<number>())];
    const notes = [
      `scope=${factor.scope}`,
      ...(factor.fallback_reason === null
        ? []
        : [`fallback_reason=${factor.fallback_reason}`]),
      ...(factor.mean_absolute_error === null
        ? []
        : [`MAE=${formatMetric(factor.mean_absolute_error, " active_cell_days")}`]),
      ...(factor.root_mean_square_error === null
        ? []
        : [`RMSE=${formatMetric(factor.root_mean_square_error, " active_cell_days")}`]),
      ...(factor.mean_absolute_percentage_error === null
        ? []
        : [`MAPE=${formatMetric(factor.mean_absolute_percentage_error, "%")}`]),
    ];
    return {
      ...(factor.region_id === null ? { id: NATIONAL_FACTOR_ID } : {}),
      region_id: factor.region_id,
      factor: factor.factor,
      method: factor.method,
      overlap_years: factor.overlap_years,
      n_months: factor.month_count,
      correlation: factor.correlation,
      error_percent: factor.mean_absolute_percentage_error,
      estimated_years: estimatedYears.sort((left, right) => left - right),
      notes,
    };
  });
  const hotspots: DatabaseRow[] = artifacts.hotspots.map(({ hotspot, province_id }) => {
    if (province_id !== null && !provinceIds.has(province_id)) {
      throw new Error(`Hotspot refers to unknown province ${province_id}`);
    }
    return {
      source_id: hotspot.id,
      source_key: hotspot.id,
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      acquisition_datetime: hotspot.acquisitionDatetime,
      satellite: hotspot.satellite,
      instrument: hotspot.instrument,
      confidence: hotspot.confidence === null ? null : String(hotspot.confidence),
      brightness: hotspot.brightness,
      source_product: hotspot.sourceProduct,
      province_id,
    };
  });

  const payloads: DatabasePayloads = {
    regions,
    harmonization_factors: factors,
    monthly_counts: monthlyCounts,
    monthly_harmonized: monthlyHarmonized,
    monthly_grid_counts: monthlyGridCounts,
    hotspots,
  };
  for (const [table, rows] of Object.entries(payloads)) {
    if (rows.length === 0) {
      throw new Error(`${table} payload is empty`);
    }
  }
  assertUniqueKeys(regions, ["id"], "regions");
  assertUniqueKeys(monthlyCounts, ["region_id", "year", "month", "instrument"], "monthly_counts");
  assertUniqueKeys(monthlyHarmonized, ["region_id", "year", "month"], "monthly_harmonized");
  assertUniqueKeys(monthlyGridCounts, ["cell_id", "year", "month", "instrument"], "monthly_grid_counts");
  assertUniqueKeys(hotspots, ["source_key"], "hotspots");
  const factorKeys = factors.map((row) =>
    row.region_id === null ? ["national", row.id] : ["region", row.region_id],
  );
  if (new Set(factorKeys.map((key) => JSON.stringify(key))).size !== factors.length) {
    throw new Error("Harmonization-factor input contains duplicate region keys");
  }
  if (factors.filter(({ region_id }) => region_id === null).length !== 1) {
    throw new Error("Expected exactly one national harmonization factor");
  }
  return payloads;
}

function parseArguments(args: string[]): LoaderOptions {
  const values = new Map<string, string>();
  let dryRun = true;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--dry-run") {
      if (values.has("--dry-run")) {
        throw new Error("Option may only be specified once: --dry-run");
      }
      dryRun = true;
      values.set("--dry-run", "true");
      continue;
    }
    if (option === "--apply") {
      if (apply) {
        throw new Error("Option may only be specified once: --apply");
      }
      apply = true;
      dryRun = false;
      continue;
    }
    if (!["--input-dir", "--regions", "--hotspots", "--limit", "--batch-size"].includes(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    if (values.has(option)) {
      throw new Error(`Option may only be specified once: ${option}`);
    }
    values.set(option, value);
    index += 1;
  }
  if (apply && values.has("--dry-run")) {
    throw new Error("--apply and --dry-run cannot be used together");
  }
  const limitValue = values.get("--limit");
  const batchValue = values.get("--batch-size");
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  const batchSize = batchValue === undefined ? DEFAULT_BATCH_SIZE : Number(batchValue);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new Error(`--batch-size must be from 1 to ${MAX_BATCH_SIZE}`);
  }
  const inputDirectory = resolve(values.get("--input-dir") ?? "data/processed");
  return {
    dryRun,
    inputDirectory,
    regionsFile: resolve(values.get("--regions") ?? "data/boundaries/regions.json"),
    hotspotsFile:
      values.has("--hotspots")
        ? resolve(values.get("--hotspots") ?? "")
        : undefined,
    limit,
    batchSize,
  };
}

function keyFromRow(row: DatabaseRow, columns: string[]): string {
  return keyFor(row, columns);
}

async function selectAll(
  client: SupabaseClient,
  table: TableName,
  columns: string[],
): Promise<DatabaseRow[]> {
  const rows: DatabaseRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(columns.join(","));
    for (const column of columns) {
      query = query.order(column, { ascending: true, nullsFirst: true });
    }
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Could not inspect ${table} before upsert (${error.code ?? "unknown"})`);
    }
    const page = (data ?? []).map((row, index) =>
      asRecord(row, `Existing ${table} row ${offset + index + 1}`),
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function boundedRows(rows: DatabaseRow[], limit: number | undefined): DatabaseRow[] {
  return limit === undefined ? rows : rows.slice(0, limit);
}

function writeProgress(stats: WriteStats): void {
  process.stdout.write(`${JSON.stringify(stats)}\n`);
}

async function upsertTable(
  client: SupabaseClient,
  table: Exclude<TableName, "harmonization_factors">,
  rows: DatabaseRow[],
  conflictColumns: string,
  keyColumns: string[],
  limit: number | undefined,
  batchSize: number,
): Promise<WriteStats> {
  const startedAt = Date.now();
  const selected = table === "regions" ? rows : boundedRows(rows, limit);
  const skipped = rows.length - selected.length;
  const existingRows = await selectAll(client, table, keyColumns);
  const existingKeys = new Set(
    existingRows.map((row) => keyFromRow(row, keyColumns)),
  );
  let inserted = 0;
  let updated = 0;
  for (let offset = 0; offset < selected.length; offset += batchSize) {
    const batch = selected.slice(offset, offset + batchSize);
    for (const row of batch) {
      const key = keyFromRow(row, keyColumns);
      if (existingKeys.has(key)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }
    const { error } = await client
      .from(table)
      .upsert(batch, { onConflict: conflictColumns });
    if (error) {
      throw new Error(`Could not upsert ${table} (${error.code ?? "unknown"})`);
    }
    for (const row of batch) {
      existingKeys.add(keyFromRow(row, keyColumns));
    }
    writeProgress({
      table,
      inserted,
      updated,
      skipped,
      durationMs: Date.now() - startedAt,
    });
  }
  return {
    table,
    inserted,
    updated,
    skipped,
    durationMs: Date.now() - startedAt,
  };
}

async function upsertFactors(
  client: SupabaseClient,
  rows: DatabaseRow[],
  limit: number | undefined,
  batchSize: number,
): Promise<WriteStats> {
  const startedAt = Date.now();
  const ordered = [...rows].sort((left, right) =>
    left.region_id === null ? -1 : right.region_id === null ? 1 : 0,
  );
  const selected = boundedRows(ordered, limit);
  const skipped = rows.length - selected.length;
  const existingRows = await selectAll(client, "harmonization_factors", ["id", "region_id"]);
  const existingNational = existingRows.filter((row) => row.region_id === null);
  if (existingNational.length > 1) {
    throw new Error("Multiple national factor rows exist; resolve them before loading");
  }
  const existingRegionIds = new Set(
    existingRows
      .filter((row) => typeof row.region_id === "string")
      .map((row) => String(row.region_id)),
  );
  const provinceRows = selected.filter((row) => row.region_id !== null);
  const nationalRow = selected.find((row) => row.region_id === null);
  let inserted = 0;
  let updated = 0;
  for (let offset = 0; offset < provinceRows.length; offset += batchSize) {
    const batch = provinceRows.slice(offset, offset + batchSize);
    for (const row of batch) {
      if (existingRegionIds.has(String(row.region_id))) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }
    const { error } = await client
      .from("harmonization_factors")
      .upsert(batch, { onConflict: "region_id" });
    if (error) {
      throw new Error(`Could not upsert harmonization_factors (${error.code ?? "unknown"})`);
    }
    for (const row of batch) {
      existingRegionIds.add(String(row.region_id));
    }
  }
  if (nationalRow !== undefined) {
    const existingNationalId = existingNational[0]?.id;
    if (
      existingNationalId !== undefined &&
      (typeof existingNationalId !== "string" || existingNationalId.trim() === "")
    ) {
      throw new Error("Existing national factor has an invalid ID");
    }
    const row = {
      ...nationalRow,
      id: existingNationalId ?? NATIONAL_FACTOR_ID,
    };
    const { error } = await client
      .from("harmonization_factors")
      .upsert([row], { onConflict: "id" });
    if (error) {
      throw new Error(`Could not upsert national harmonization factor (${error.code ?? "unknown"})`);
    }
    if (existingNational.length === 0) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }
  const stats = {
    table: "harmonization_factors" as const,
    inserted,
    updated,
    skipped,
    durationMs: Date.now() - startedAt,
  };
  writeProgress(stats);
  return stats;
}

function dryRunStats(
  table: TableName,
  rows: DatabaseRow[],
  limit: number | undefined,
  startedAt: number,
): WriteStats {
  const selectedCount =
    table === "regions" || limit === undefined
      ? rows.length
      : Math.min(rows.length, limit);
  return {
    table,
    inserted: null,
    updated: null,
    skipped: rows.length - selectedCount,
    durationMs: Date.now() - startedAt,
  };
}

async function runLoader(options: LoaderOptions): Promise<void> {
  const hotspotsFile =
    options.hotspotsFile ??
    resolve(options.inputDirectory, "raw-window-2024-01-01-to-2025-12-31.jsonl");
  const artifacts = readIngestArtifacts(
    options.inputDirectory,
    options.regionsFile,
    hotspotsFile,
  );
  const payloads = mapArtifactsToDatabase(artifacts);
  const tableOrder: TableName[] = [
    "regions",
    "harmonization_factors",
    "monthly_counts",
    "monthly_harmonized",
    "monthly_grid_counts",
    "hotspots",
  ];
  process.stdout.write(
    `Validated payloads: ${tableOrder
      .map((table) => `${table}=${payloads[table].length}`)
      .join(", ")}\n`,
  );
  if (options.dryRun) {
    for (const table of tableOrder) {
      writeProgress(
        dryRunStats(table, payloads[table], options.limit, Date.now()),
      );
    }
    process.stdout.write(
      "Dry run complete; inserted/updated counts are unknown and no Supabase connection was opened.\n",
    );
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Live loading requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the process environment.",
    );
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await upsertTable(client, "regions", payloads.regions, "id", ["id"], undefined, options.batchSize);
  await upsertFactors(
    client,
    payloads.harmonization_factors,
    options.limit,
    options.batchSize,
  );
  await upsertTable(
    client,
    "monthly_counts",
    payloads.monthly_counts,
    "region_id,year,month,instrument",
    ["region_id", "year", "month", "instrument"],
    options.limit,
    options.batchSize,
  );
  await upsertTable(
    client,
    "monthly_harmonized",
    payloads.monthly_harmonized,
    "region_id,year,month",
    ["region_id", "year", "month"],
    options.limit,
    options.batchSize,
  );
  await upsertTable(
    client,
    "monthly_grid_counts",
    payloads.monthly_grid_counts,
    "cell_id,year,month,instrument",
    ["cell_id", "year", "month", "instrument"],
    options.limit,
    options.batchSize,
  );
  await upsertTable(
    client,
    "hotspots",
    payloads.hotspots,
    "source_key",
    ["source_key"],
    options.limit,
    options.batchSize,
  );
}

function main(): void {
  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown loader error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  };
  if (process.argv.slice(2).includes("--help")) {
    process.stdout.write(
      "Usage: load-supabase [--dry-run | --apply] [--input-dir <directory>] [--regions <json>] [--hotspots <jsonl>] [--limit <rows-per-table>] [--batch-size <1-1000>]\n",
    );
    return;
  }
  try {
    const options = parseArguments(process.argv.slice(2));
    void runLoader(options).catch(reportError);
  } catch (error) {
    reportError(error);
  }
}

if (process.argv[1] && /(?:^|[\\/])load-supabase\.(?:ts|js)$/.test(process.argv[1])) {
  main();
}
