import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Papa from "papaparse";

type Instrument = "MODIS" | "VIIRS";

interface Hotspot {
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

type SourceRow = Record<string, string>;

interface NormalizedRecord {
  hotspot: Hotspot;
  sourceRow: SourceRow;
}

interface NormalizeResult {
  records: NormalizedRecord[];
  duplicateCount: number;
}

function readField(row: SourceRow, names: string[]): string | null {
  for (const name of names) {
    const key = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase(),
    );
    if (key !== undefined) {
      const value = row[key];
      if (value !== undefined && value.trim() !== "") {
        return value;
      }
    }
  }
  return null;
}

function requiredField(row: SourceRow, names: string[], label: string): string {
  const value = readField(row, names);
  if (value === null) {
    throw new Error(`Missing required ${label} field (${names.join(" or ")})`);
  }
  return value;
}

function parseNumber(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  return parsed;
}

function parseCoordinate(
  row: SourceRow,
  names: string[],
  label: string,
  minimum: number,
  maximum: number,
): number {
  const value = requiredField(row, names, label);
  const coordinate = parseNumber(value, label);
  if (coordinate < minimum || coordinate > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return coordinate;
}

function parseAcquisitionDatetime(row: SourceRow): string {
  const date = requiredField(row, ["acq_date", "acquisition_date"], "date").trim();
  const time = requiredField(row, ["acq_time", "acquisition_time"], "time").trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) {
    throw new Error(`Invalid acquisition date: "${date}"`);
  }

  if (!/^\d{1,4}$/.test(time)) {
    throw new Error(`Invalid UTC acquisition time: "${time}"`);
  }

  const paddedTime = time.padStart(4, "0");
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(paddedTime.slice(0, 2));
  const minute = Number(paddedTime.slice(2, 4));
  const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (
    timestamp.getUTCFullYear() !== year ||
    timestamp.getUTCMonth() !== month - 1 ||
    timestamp.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error(`Impossible UTC acquisition date/time: "${date} ${time}"`);
  }

  return timestamp.toISOString();
}

function parseConfidence(value: string | null): string | number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  const trimmed = value.trim();
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid confidence value: "${value}"`);
    }
    return numeric;
  }
  return value;
}

function parseBrightness(row: SourceRow, instrument: Instrument): number | null {
  const fields =
    instrument === "MODIS"
      ? ["brightness"]
      : ["brightness", "bright_ti4"];
  const value = readField(row, fields);
  return value === null ? null : parseNumber(value, "brightness");
}

function normalizeRow(
  sourceRow: SourceRow,
  instrument: Instrument,
  sourceProduct: string | null,
): NormalizedRecord {
  const rowInstrument = readField(sourceRow, ["instrument"]);
  if (rowInstrument !== null && rowInstrument.toUpperCase() !== instrument) {
    throw new Error(
      `Source instrument "${rowInstrument}" does not match ${instrument}`,
    );
  }

  const rowProduct = readField(sourceRow, [
    "sourceproduct",
    "source_product",
    "product",
  ]);
  if (
    sourceProduct !== null &&
    rowProduct !== null &&
    sourceProduct !== rowProduct
  ) {
    throw new Error(
      `Source product "${rowProduct}" does not match "${sourceProduct}"`,
    );
  }

  const resolvedProduct = sourceProduct ?? rowProduct;
  const latitude = parseCoordinate(
    sourceRow,
    ["latitude", "lat"],
    "latitude",
    -90,
    90,
  );
  const longitude = parseCoordinate(
    sourceRow,
    ["longitude", "lon"],
    "longitude",
    -180,
    180,
  );
  const acquisitionDatetime = parseAcquisitionDatetime(sourceRow);
  const satellite = requiredField(
    sourceRow,
    ["satellite", "platform"],
    "satellite",
  ).trim();
  const confidence = parseConfidence(readField(sourceRow, ["confidence"]));

  const stableSourceFields = Object.entries(sourceRow).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const identity = JSON.stringify({
    instrument,
    satellite,
    latitude,
    longitude,
    acquisitionDatetime,
    sourceProduct: resolvedProduct,
    stableSourceFields,
  });
  const id = `sha256:${createHash("sha256").update(identity).digest("hex")}`;

  return {
    hotspot: {
      id,
      latitude,
      longitude,
      acquisitionDatetime,
      satellite,
      instrument,
      confidence,
      brightness: parseBrightness(sourceRow, instrument),
      sourceProduct: resolvedProduct,
    },
    sourceRow,
  };
}

export function normalizeCsv(
  csvText: string,
  instrument: Instrument,
  sourceProduct: string | null = null,
): NormalizeResult {
  if (sourceProduct !== null && sourceProduct.trim() === "") {
    throw new Error("Source product must not be empty");
  }
  const resolvedSourceProduct = sourceProduct?.trim() ?? null;
  const parsed = Papa.parse<SourceRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    const details = parsed.errors
      .map((error) => `row ${error.row ?? "unknown"}: ${error.message}`)
      .join("; ");
    throw new Error(`CSV parse failed: ${details}`);
  }

  if (parsed.meta.fields === undefined || parsed.data.length === 0) {
    throw new Error("CSV has a header but no data records");
  }

  const uniqueRecords = new Map<string, NormalizedRecord>();
  let duplicateCount = 0;
  for (const [index, sourceRow] of parsed.data.entries()) {
    try {
      const record = normalizeRow(
        sourceRow,
        instrument,
        resolvedSourceProduct,
      );
      if (uniqueRecords.has(record.hotspot.id)) {
        duplicateCount += 1;
      } else {
        uniqueRecords.set(record.hotspot.id, record);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown normalization error";
      throw new Error(`CSV record ${index + 2}: ${message}`);
    }
  }

  return {
    records: [...uniqueRecords.values()],
    duplicateCount,
  };
}

function parseArguments(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      options.set("help", "true");
      continue;
    }
    if (
      !["--input", "--output", "--instrument", "--source-product"].includes(
        option,
      )
    ) {
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
      "Usage: normalize --input <csv> --output <jsonl> --instrument MODIS|VIIRS [--source-product <name>]\n",
    );
    return;
  }

  const inputOption = options.get("--input");
  const outputOption = options.get("--output");
  const instrumentOption = options.get("--instrument");
  if (inputOption === undefined || outputOption === undefined) {
    throw new Error("--input and --output are required");
  }
  if (instrumentOption !== "MODIS" && instrumentOption !== "VIIRS") {
    throw new Error("--instrument must be MODIS or VIIRS");
  }

  const inputPath = resolve(inputOption);
  const outputPath = resolve(outputOption);
  if (!existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }
  const sourceProduct = options.get("--source-product") ?? null;
  const result = normalizeCsv(
    readFileSync(inputPath, "utf8"),
    instrumentOption,
    sourceProduct,
  );
  if (result.records.length === 0) {
    throw new Error("No valid records were produced");
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const output = result.records
    .map((record) => JSON.stringify(record))
    .join("\n");
  writeFileSync(outputPath, `${output}\n`, "utf8");
  process.stdout.write(
    `Wrote ${result.records.length} records to ${outputPath}; duplicates=${result.duplicateCount}\n`,
  );
}

if (process.argv[1] && /(?:^|[\\/])normalize\.(?:ts|js)$/.test(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown normalization error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
