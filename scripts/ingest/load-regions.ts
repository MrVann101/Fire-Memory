import { bbox as turfBbox, booleanPointInPolygon, point } from "@turf/turf";
import type { MultiPolygon, Polygon } from "geojson";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RegionLevel = "country" | "region" | "province";
type BBox = [number, number, number, number];

interface Region {
  id: string;
  name: string;
  level: RegionLevel;
  parentId: string | null;
  bbox: BBox;
}

interface BoundaryProperties {
  shapeName: string;
  shapeID: string;
  shapeGroup: string;
  shapeType: string;
}

interface BoundaryFeature {
  type: "Feature";
  geometry: Polygon | MultiPolygon;
  properties: BoundaryProperties;
}

interface RegionBoundary {
  region: Region;
  feature: BoundaryFeature;
}

export interface LoadedRegions {
  regions: Region[];
  country: RegionBoundary;
  admin2: RegionBoundary[];
}

const NON_PROVINCE_ADM2_NAMES = new Set([
  "City of Isabela",
  "Cotabato City",
  "NCR, City of Manila, First District",
  "NCR, Fourth District",
  "NCR, Second District",
  "NCR, Third District",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoordinateTree(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  if (typeof value[0] === "number") {
    return (
      value.length >= 2 &&
      value.length <= 3 &&
      typeof value[1] === "number" &&
      value.every((coordinate) => typeof coordinate === "number")
    );
  }

  return value.every(isCoordinateTree);
}

function isBoundaryFeature(
  value: unknown,
  expectedShapeType: "ADM0" | "ADM2",
): value is BoundaryFeature {
  if (!isRecord(value) || value.type !== "Feature") {
    return false;
  }
  const properties = value.properties;
  const geometry = value.geometry;
  if (!isRecord(properties) || !isRecord(geometry)) {
    return false;
  }
  if (
    typeof properties.shapeName !== "string" ||
    properties.shapeName.trim() === "" ||
    typeof properties.shapeID !== "string" ||
    properties.shapeID.trim() === "" ||
    properties.shapeGroup !== "PHL" ||
    properties.shapeType !== expectedShapeType
  ) {
    return false;
  }
  if (
    (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
    !isCoordinateTree(geometry.coordinates)
  ) {
    return false;
  }
  return true;
}

function loadGeoJsonFeatures(
  filePath: string,
  expectedShapeType: "ADM0" | "ADM2",
): BoundaryFeature[] {
  if (!existsSync(filePath)) {
    throw new Error(`Boundary file does not exist: ${filePath}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (
    !isRecord(parsed) ||
    parsed.type !== "FeatureCollection" ||
    !Array.isArray(parsed.features)
  ) {
    throw new Error(`Invalid GeoJSON FeatureCollection: ${filePath}`);
  }

  const features: BoundaryFeature[] = [];
  const seenIds = new Set<string>();
  for (const [index, rawFeature] of parsed.features.entries()) {
    if (!isBoundaryFeature(rawFeature, expectedShapeType)) {
      throw new Error(
        `Invalid ${expectedShapeType} boundary feature ${index + 1} in ${filePath}`,
      );
    }

    const id = `${rawFeature.properties.shapeType}-${rawFeature.properties.shapeID}`;
    if (seenIds.has(id)) {
      throw new Error(`Duplicate boundary ID "${id}" in ${filePath}`);
    }
    seenIds.add(id);

    const bounds = turfBbox(rawFeature, { recompute: true });
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bounds;
    if (
      !Number.isFinite(minLongitude) ||
      !Number.isFinite(minLatitude) ||
      !Number.isFinite(maxLongitude) ||
      !Number.isFinite(maxLatitude) ||
      minLongitude < -180 ||
      maxLongitude > 180 ||
      minLatitude < -90 ||
      maxLatitude > 90 ||
      minLongitude >= maxLongitude ||
      minLatitude >= maxLatitude
    ) {
      throw new Error(`Invalid WGS84 bounds for boundary "${id}"`);
    }

    features.push(rawFeature);
  }
  return features;
}

function asRegion(
  feature: BoundaryFeature,
  level: RegionLevel,
  parentId: string | null,
): Region {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = turfBbox(
    feature,
    { recompute: true },
  );
  return {
    id: `PHL-${feature.properties.shapeType}-${feature.properties.shapeID}`,
    name: feature.properties.shapeName,
    level,
    parentId,
    bbox: [minLongitude, minLatitude, maxLongitude, maxLatitude],
  };
}

export function loadRegions(boundaryDirectory = "data/boundaries"): LoadedRegions {
  const countryFeatures = loadGeoJsonFeatures(
    resolve(boundaryDirectory, "geoBoundaries-PHL-ADM0_simplified.geojson"),
    "ADM0",
  );
  if (countryFeatures.length !== 1) {
    throw new Error(`Expected one Philippines country feature, got ${countryFeatures.length}`);
  }

  const countryRegion = asRegion(countryFeatures[0], "country", null);
  const admin2Features = loadGeoJsonFeatures(
    resolve(boundaryDirectory, "geoBoundaries-PHL-ADM2_simplified.geojson"),
    "ADM2",
  );
  const admin2 = admin2Features.map((feature) => {
    const isNonProvince = NON_PROVINCE_ADM2_NAMES.has(
      feature.properties.shapeName,
    );
    return {
      feature,
      region: asRegion(
        feature,
        isNonProvince ? "region" : "province",
        countryRegion.id,
      ),
    };
  });
  const regions = [countryRegion, ...admin2.map(({ region }) => region)];

  return {
    regions,
    country: { region: countryRegion, feature: countryFeatures[0] },
    admin2,
  };
}

export function assignAdmin2Region(
  latitude: number,
  longitude: number,
  loaded: LoadedRegions,
): string | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Point coordinates must be finite WGS84 latitude/longitude");
  }

  const pointFeature = point([longitude, latitude]);
  const matches = loaded.admin2.filter(({ region, feature }) => {
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = region.bbox;
    if (
      longitude < minLongitude ||
      longitude > maxLongitude ||
      latitude < minLatitude ||
      latitude > maxLatitude
    ) {
      return false;
    }
    return booleanPointInPolygon(pointFeature, feature);
  });

  return matches.length === 1 ? matches[0].region.id : null;
}

function parseArguments(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      options.set("help", "true");
      continue;
    }
    if (!["--boundary-dir", "--output"].includes(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    options.set(option, value);
    index += 1;
  }
  return options;
}

function runCli(): void {
  const options = parseArguments(process.argv.slice(2));
  if (options.has("help")) {
    process.stdout.write(
      "Usage: load-regions --output <json> [--boundary-dir <directory>]\n",
    );
    return;
  }
  const outputOption = options.get("--output");
  if (outputOption === undefined) {
    throw new Error("--output is required");
  }

  const loaded = loadRegions(options.get("--boundary-dir") ?? "data/boundaries");
  const outputPath = resolve(outputOption);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(loaded.regions, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${loaded.regions.length} regions (${loaded.admin2.length} ADM2 units) to ${outputPath}\n`,
  );
}

if (process.argv[1] && /(?:^|[\\/])load-regions\.(?:ts|js)$/.test(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown region-loading error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
