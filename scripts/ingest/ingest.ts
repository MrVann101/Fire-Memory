import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { assignAdmin2Region, loadRegions } from "./load-regions";
import { normalizeCsv } from "./normalize";

type Instrument = "MODIS" | "VIIRS";

interface InputFile {
  path: string;
  instrument: Instrument;
}

interface MonthCounts {
  MODIS: number;
  VIIRS: number;
  normalizedUniqueRows: number;
  acceptedUniqueRows: number;
  duplicateRowsAcrossInputs: number;
  provinceAssignedRows: number;
  regionAssignedRows: number;
  unassignedRows: number;
  rejectedRows: 0;
  databaseRowsInserted: 0;
  localRowsWritten: number;
}

interface RawWindowRecord {
  hotspot: {
    id: string;
    latitude: number;
    longitude: number;
    acquisitionDatetime: string;
    satellite: string;
    instrument: Instrument;
    confidence: string | number | null;
    brightness: number | null;
    sourceProduct: string | null;
  };
  province_id: string | null;
  admin2_region_id: string | null;
  sourceRow: Record<string, string>;
}

interface IngestReport {
  sink: "local-jsonl";
  databaseLoaded: false;
  databaseRowsInserted: 0;
  localRowsWritten: number;
  requestedWindow: { start: string; end: string };
  observedWindow: { start: string; end: string } | null;
  inputFiles: Array<{
    file: string;
    instrument: Instrument;
    sourceRows: number;
    normalizedUniqueRows: number;
    duplicateRows: number;
    outsideWindowRows: number;
    acceptedUniqueRows: number;
    duplicateRowsAcrossInputs: number;
    provinceAssignedRows: number;
    regionAssignedRows: number;
    unassignedRows: number;
    rejectedRows: 0;
    databaseRowsInserted: 0;
    localRowsWritten: number;
  }>;
  inputRows: number;
  normalizedUniqueRows: number;
  sourceDuplicateRows: number;
  rejectedRows: 0;
  outsideWindowRows: number;
  acceptedUniqueRows: number;
  duplicateRowsAcrossInputs: number;
  provinceAssignedRows: number;
  regionAssignedRows: number;
  unassignedRows: number;
  countsByInstrument: Record<Instrument, number>;
  countsByMonth: Record<string, MonthCounts>;
}

function parseDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} is not a valid calendar date`);
  }
  return value;
}

function parseArguments(args: string[]): {
  inputs: InputFile[];
  options: Map<string, string>;
} {
  const inputs: InputFile[] = [];
  const options = new Map<string, string>();
  const valueOptions = new Set([
    "--start",
    "--end",
    "--output",
    "--report",
    "--boundary-dir",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      options.set("help", "true");
      continue;
    }

    if (option === "--modis" || option === "--viirs") {
      const path = args[index + 1];
      if (path === undefined || path.startsWith("--")) {
        throw new Error(`Missing value for ${option}`);
      }
      inputs.push({
        path,
        instrument: option === "--modis" ? "MODIS" : "VIIRS",
      });
      index += 1;
      continue;
    }

    if (!valueOptions.has(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`);
    }
    if (options.has(option)) {
      throw new Error(`Option may only be specified once: ${option}`);
    }
    options.set(option, value);
    index += 1;
  }
  return { inputs, options };
}

function runCli(): void {
  const { inputs, options } = parseArguments(process.argv.slice(2));
  if (options.has("help")) {
    process.stdout.write(
      "Usage: ingest --modis <csv> [--modis <csv> ...] --viirs <csv> [--viirs <csv> ...] --start YYYY-MM-DD --end YYYY-MM-DD --output <jsonl> [--report <json>] [--boundary-dir <directory>]\n",
    );
    return;
  }

  const startOption = options.get("--start");
  const endOption = options.get("--end");
  const outputOption = options.get("--output");
  if (
    startOption === undefined ||
    endOption === undefined ||
    outputOption === undefined
  ) {
    throw new Error("--start, --end, and --output are required");
  }
  if (!inputs.some(({ instrument }) => instrument === "MODIS")) {
    throw new Error("At least one --modis CSV is required");
  }
  if (!inputs.some(({ instrument }) => instrument === "VIIRS")) {
    throw new Error("At least one --viirs CSV is required");
  }

  const start = parseDate(startOption, "--start");
  const end = parseDate(endOption, "--end");
  if (start > end) {
    throw new Error("--start must not be after --end");
  }

  const boundaries = loadRegions(options.get("--boundary-dir") ?? "data/boundaries");
  const regionById = new Map(
    boundaries.admin2.map(({ region }) => [region.id, region]),
  );
  const uniqueRecords = new Map<string, RawWindowRecord>();
  const inputFileReports: IngestReport["inputFiles"] = [];
  let inputRows = 0;
  let normalizedUniqueRows = 0;
  let sourceDuplicateRows = 0;
  let outsideWindowRows = 0;
  let duplicateRowsAcrossInputs = 0;
  let provinceAssignedRows = 0;
  let regionAssignedRows = 0;
  let unassignedRows = 0;
  const countsByInstrument: Record<Instrument, number> = {
    MODIS: 0,
    VIIRS: 0,
  };
  const countsByMonth: IngestReport["countsByMonth"] = {};

  for (const input of inputs) {
    const inputPath = resolve(input.path);
    if (!existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    const normalized = normalizeCsv(
      readFileSync(inputPath, "utf8"),
      input.instrument,
    );
    const fileSourceRows =
      normalized.records.length + normalized.duplicateCount;
    inputRows += fileSourceRows;
    normalizedUniqueRows += normalized.records.length;
    sourceDuplicateRows += normalized.duplicateCount;
    inputFileReports.push({
      file: basename(inputPath),
      instrument: input.instrument,
      sourceRows: fileSourceRows,
      normalizedUniqueRows: normalized.records.length,
      duplicateRows: normalized.duplicateCount,
      outsideWindowRows: 0,
      acceptedUniqueRows: 0,
      duplicateRowsAcrossInputs: 0,
      provinceAssignedRows: 0,
      regionAssignedRows: 0,
      unassignedRows: 0,
      rejectedRows: 0,
      databaseRowsInserted: 0,
      localRowsWritten: 0,
    });
    const fileReport = inputFileReports[inputFileReports.length - 1];

    for (const normalizedRecord of normalized.records) {
      const { hotspot, sourceRow } = normalizedRecord;
      const acquisitionDate = hotspot.acquisitionDatetime.slice(0, 10);
      if (acquisitionDate < start || acquisitionDate > end) {
        outsideWindowRows += 1;
        fileReport.outsideWindowRows += 1;
        continue;
      }
      const month = hotspot.acquisitionDatetime.slice(0, 7);
      const monthCounts = (countsByMonth[month] ??= {
        MODIS: 0,
        VIIRS: 0,
        normalizedUniqueRows: 0,
        acceptedUniqueRows: 0,
        duplicateRowsAcrossInputs: 0,
        provinceAssignedRows: 0,
        regionAssignedRows: 0,
        unassignedRows: 0,
        rejectedRows: 0,
        databaseRowsInserted: 0,
        localRowsWritten: 0,
      });
      monthCounts.normalizedUniqueRows += 1;
      if (uniqueRecords.has(hotspot.id)) {
        duplicateRowsAcrossInputs += 1;
        fileReport.duplicateRowsAcrossInputs += 1;
        monthCounts.duplicateRowsAcrossInputs += 1;
        continue;
      }

      const admin2RegionId = assignAdmin2Region(
        hotspot.latitude,
        hotspot.longitude,
        boundaries,
      );
      const matchedRegion =
        admin2RegionId === null ? undefined : regionById.get(admin2RegionId);
      if (admin2RegionId !== null && matchedRegion === undefined) {
        throw new Error(`Assigned boundary ID is missing from regions: ${admin2RegionId}`);
      }

      const provinceId =
        matchedRegion?.level === "province" ? admin2RegionId : null;
      const specialRegionId =
        matchedRegion?.level === "region" ? admin2RegionId : null;
      if (provinceId !== null) {
        provinceAssignedRows += 1;
        fileReport.provinceAssignedRows += 1;
        monthCounts.provinceAssignedRows += 1;
      } else if (specialRegionId !== null) {
        regionAssignedRows += 1;
        fileReport.regionAssignedRows += 1;
        monthCounts.regionAssignedRows += 1;
      } else {
        unassignedRows += 1;
        fileReport.unassignedRows += 1;
        monthCounts.unassignedRows += 1;
      }
      fileReport.acceptedUniqueRows += 1;
      fileReport.localRowsWritten += 1;
      monthCounts.acceptedUniqueRows += 1;
      monthCounts.localRowsWritten += 1;
      monthCounts[hotspot.instrument] += 1;

      uniqueRecords.set(hotspot.id, {
        hotspot,
        province_id: provinceId,
        admin2_region_id: specialRegionId,
        sourceRow,
      });
      countsByInstrument[hotspot.instrument] += 1;
    }
  }

  const records = [...uniqueRecords.values()];
  if (records.length === 0) {
    throw new Error("No records fall within the requested raw window");
  }
  const observedDates = records
    .map(({ hotspot }) => hotspot.acquisitionDatetime.slice(0, 10))
    .sort();
  const report: IngestReport = {
    sink: "local-jsonl",
    databaseLoaded: false,
    databaseRowsInserted: 0,
    localRowsWritten: records.length,
    requestedWindow: { start, end },
    observedWindow: {
      start: observedDates[0],
      end: observedDates[observedDates.length - 1],
    },
    inputFiles: inputFileReports,
    inputRows,
    normalizedUniqueRows,
    sourceDuplicateRows,
    rejectedRows: 0,
    outsideWindowRows,
    acceptedUniqueRows: records.length,
    duplicateRowsAcrossInputs,
    provinceAssignedRows,
    regionAssignedRows,
    unassignedRows,
    countsByInstrument,
    countsByMonth: Object.fromEntries(
      Object.entries(countsByMonth).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
  };

  const outputPath = resolve(outputOption);
  if (!outputPath.toLowerCase().endsWith(".jsonl")) {
    throw new Error("--output must end with .jsonl");
  }
  const reportPath = resolve(
    options.get("--report") ??
      outputPath.replace(/\.jsonl$/i, ".report.json"),
  );
  if (outputPath === reportPath) {
    throw new Error("--report must not overwrite the JSONL output");
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(outputPath, "", "utf8");
  for (let offset = 0; offset < records.length; offset += 1000) {
    const batch = records.slice(offset, offset + 1000);
    appendFileSync(
      outputPath,
      `${batch.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8",
    );
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${records.length} unique raw-window records in batches; province=${provinceAssignedRows}, region=${regionAssignedRows}, unassigned=${unassignedRows}, rejected=0, duplicates=${sourceDuplicateRows + duplicateRowsAcrossInputs}\n`,
  );
  process.stdout.write(`Report: ${reportPath}; sink=local-jsonl, databaseLoaded=false\n`);
}

if (process.argv[1] && /(?:^|[\\/])ingest\.(?:ts|js)$/.test(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingestion error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
