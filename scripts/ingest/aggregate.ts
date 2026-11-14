import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { assignAdmin2Region, loadRegions } from "./load-regions";
import { normalizeCsv } from "./normalize";

type Instrument = "MODIS" | "VIIRS";
type NormalizedRecord = ReturnType<typeof normalizeCsv>["records"][number];

export interface MonthlyCount {
  region_id: string;
  year: number;
  month: number;
  instrument: Instrument;
  raw_count: number;
  active_cell_days: number;
  has_coverage: true;
}

export interface MonthlyGridCount {
  cell_id: string;
  latitude: number;
  longitude: number;
  year: number;
  month: number;
  instrument: Instrument;
  raw_count: number;
  active_cell_days: number;
}

export interface AggregateInput {
  file: string;
  instrument: Instrument;
  sourceRows: number;
  duplicateRows: number;
  records: NormalizedRecord[];
}

interface AggregateStats {
  row: Omit<MonthlyCount, "active_cell_days">;
  cellDays: Set<string>;
}

interface GridStats {
  row: Omit<MonthlyGridCount, "active_cell_days">;
  cellDays: Set<string>;
}

interface YearInstrumentStats {
  year: number;
  instrument: Instrument;
  normalizedUniqueRows: number;
  duplicateRowsAcrossInputs: number;
  provinceRows: number;
  regionRows: number;
  unassignedRows: number;
  detectionMonths: Set<string>;
  firstDetectionDate: string | null;
  lastDetectionDate: string | null;
}

interface FileStats {
  file: string;
  instrument: Instrument;
  sourceRows: number;
  normalizedUniqueRows: number;
  duplicateRows: number;
  duplicateRowsAcrossInputs: number;
  provinceRows: number;
  regionRows: number;
  unassignedRows: number;
}

export interface AggregateResult {
  monthlyCounts: MonthlyCount[];
  monthlyGridCounts: MonthlyGridCount[];
  report: {
    sink: "local-json";
    databaseLoaded: false;
    databaseRowsInserted: 0;
    sourceRowsRead: number;
    normalizedUniqueRows: number;
    sourceDuplicateRows: number;
    duplicateRowsAcrossInputs: number;
    provinceRowsAggregated: number;
    regionRowsExcluded: number;
    unassignedRowsExcluded: number;
    monthlyCountRowsWritten: number;
    monthlyGridCountRowsWritten: number;
    inputFiles: FileStats[];
    coverageByYearInstrument: Array<{
      year: number;
      instrument: Instrument;
      normalizedUniqueRows: number;
      duplicateRowsAcrossInputs: number;
      provinceRows: number;
      regionRows: number;
      unassignedRows: number;
      detectionMonths: string[];
      firstDetectionDate: string | null;
      lastDetectionDate: string | null;
      coverageStatus: "detections-present; completeness-unknown";
    }>;
  };
}

function cellIndex(coordinate: number, cellsPerDegree: number): number {
  return Math.floor(coordinate * cellsPerDegree);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareAggregateRows(
  left: { year: number; month: number; instrument: Instrument; region_id?: string; cell_id?: string },
  right: { year: number; month: number; instrument: Instrument; region_id?: string; cell_id?: string },
): number {
  return (
    left.year - right.year ||
    left.month - right.month ||
    compareText(left.instrument, right.instrument) ||
    compareText(left.region_id ?? left.cell_id ?? "", right.region_id ?? right.cell_id ?? "")
  );
}

export class MonthlyAggregateBuilder {
  private readonly monthlyCounts = new Map<string, AggregateStats>();
  private readonly monthlyGridCounts = new Map<string, GridStats>();
  private readonly seenIds = new Set<string>();
  private readonly yearStats = new Map<string, YearInstrumentStats>();
  private readonly inputFiles: FileStats[] = [];
  private sourceRowsRead = 0;
  private normalizedUniqueRows = 0;
  private sourceDuplicateRows = 0;
  private duplicateRowsAcrossInputs = 0;
  private provinceRowsAggregated = 0;
  private regionRowsExcluded = 0;
  private unassignedRowsExcluded = 0;

  constructor(private readonly boundaries: ReturnType<typeof loadRegions>) {}

  addFile(input: AggregateInput): void {
    if (input.sourceRows !== input.records.length + input.duplicateRows) {
      throw new Error(`Source row counts do not reconcile for ${input.file}`);
    }

    this.sourceRowsRead += input.sourceRows;
    this.normalizedUniqueRows += input.records.length;
    this.sourceDuplicateRows += input.duplicateRows;
    const fileStats: FileStats = {
      file: basename(input.file),
      instrument: input.instrument,
      sourceRows: input.sourceRows,
      normalizedUniqueRows: input.records.length,
      duplicateRows: input.duplicateRows,
      duplicateRowsAcrossInputs: 0,
      provinceRows: 0,
      regionRows: 0,
      unassignedRows: 0,
    };
    this.inputFiles.push(fileStats);

    for (const { hotspot } of input.records) {
      if (hotspot.instrument !== input.instrument) {
        throw new Error(`Instrument mismatch in ${input.file}`);
      }

      const date = hotspot.acquisitionDatetime.slice(0, 10);
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const yearKey = `${year}:${input.instrument}`;
      const yearStats = this.yearStats.get(yearKey) ?? {
        year,
        instrument: input.instrument,
        normalizedUniqueRows: 0,
        duplicateRowsAcrossInputs: 0,
        provinceRows: 0,
        regionRows: 0,
        unassignedRows: 0,
        detectionMonths: new Set<string>(),
        firstDetectionDate: null,
        lastDetectionDate: null,
      };
      yearStats.normalizedUniqueRows += 1;
      const monthString = `${year}-${String(month).padStart(2, "0")}`;
      yearStats.detectionMonths.add(monthString);
      yearStats.firstDetectionDate =
        yearStats.firstDetectionDate === null || date < yearStats.firstDetectionDate
          ? date
          : yearStats.firstDetectionDate;
      yearStats.lastDetectionDate =
        yearStats.lastDetectionDate === null || date > yearStats.lastDetectionDate
          ? date
          : yearStats.lastDetectionDate;

      if (this.seenIds.has(hotspot.id)) {
        this.duplicateRowsAcrossInputs += 1;
        fileStats.duplicateRowsAcrossInputs += 1;
        yearStats.duplicateRowsAcrossInputs += 1;
        this.yearStats.set(yearKey, yearStats);
        continue;
      }
      this.seenIds.add(hotspot.id);

      const admin2RegionId = assignAdmin2Region(
        hotspot.latitude,
        hotspot.longitude,
        this.boundaries,
      );
      const matchedRegion =
        admin2RegionId === null
          ? undefined
          : this.boundaries.admin2.find(
              ({ region }) => region.id === admin2RegionId,
            )?.region;

      if (admin2RegionId !== null && matchedRegion === undefined) {
        throw new Error(`Assigned boundary ID is missing: ${admin2RegionId}`);
      }

      if (matchedRegion?.level === "province" && admin2RegionId !== null) {
        const key = `${admin2RegionId}:${year}:${month}:${input.instrument}`;
        const aggregate = this.monthlyCounts.get(key) ?? {
          row: {
            region_id: admin2RegionId,
            year,
            month,
            instrument: input.instrument,
            raw_count: 0,
            has_coverage: true,
          },
          cellDays: new Set<string>(),
        };
        aggregate.row.raw_count += 1;
        const latitudeCell = cellIndex(hotspot.latitude, 100);
        const longitudeCell = cellIndex(hotspot.longitude, 100);
        aggregate.cellDays.add(`${date}:${latitudeCell}:${longitudeCell}`);
        this.monthlyCounts.set(key, aggregate);
        this.provinceRowsAggregated += 1;
        fileStats.provinceRows += 1;
        yearStats.provinceRows += 1;
      } else if (matchedRegion?.level === "region") {
        this.regionRowsExcluded += 1;
        fileStats.regionRows += 1;
        yearStats.regionRows += 1;
      } else {
        this.unassignedRowsExcluded += 1;
        fileStats.unassignedRows += 1;
        yearStats.unassignedRows += 1;
      }

      const latitudeCell = cellIndex(hotspot.latitude, 10);
      const longitudeCell = cellIndex(hotspot.longitude, 10);
      const cellId = `0.1:${latitudeCell}:${longitudeCell}`;
      const gridKey = `${cellId}:${year}:${month}:${input.instrument}`;
      const gridAggregate = this.monthlyGridCounts.get(gridKey) ?? {
        row: {
          cell_id: cellId,
          latitude: (latitudeCell + 0.5) / 10,
          longitude: (longitudeCell + 0.5) / 10,
          year,
          month,
          instrument: input.instrument,
          raw_count: 0,
        },
        cellDays: new Set<string>(),
      };
      gridAggregate.row.raw_count += 1;
      gridAggregate.cellDays.add(`${date}:${latitudeCell}:${longitudeCell}`);
      this.monthlyGridCounts.set(gridKey, gridAggregate);
      this.yearStats.set(yearKey, yearStats);
    }
  }

  result(): AggregateResult {
    const monthlyCounts: MonthlyCount[] = [...this.monthlyCounts.values()]
      .map(({ row, cellDays }) => ({
        ...row,
        active_cell_days: cellDays.size,
      }))
      .sort(compareAggregateRows);
    const monthlyGridCounts: MonthlyGridCount[] = [
      ...this.monthlyGridCounts.values(),
    ]
      .map(({ row, cellDays }) => ({
        ...row,
        active_cell_days: cellDays.size,
      }))
      .sort(compareAggregateRows);
    const coverageByYearInstrument = [...this.yearStats.values()]
      .map((stats) => ({
        year: stats.year,
        instrument: stats.instrument,
        normalizedUniqueRows: stats.normalizedUniqueRows,
        duplicateRowsAcrossInputs: stats.duplicateRowsAcrossInputs,
        provinceRows: stats.provinceRows,
        regionRows: stats.regionRows,
        unassignedRows: stats.unassignedRows,
        detectionMonths: [...stats.detectionMonths].sort(compareText),
        firstDetectionDate: stats.firstDetectionDate,
        lastDetectionDate: stats.lastDetectionDate,
        coverageStatus: "detections-present; completeness-unknown" as const,
      }))
      .sort(
        (left, right) =>
          left.year - right.year || compareText(left.instrument, right.instrument),
      );

    return {
      monthlyCounts,
      monthlyGridCounts,
      report: {
        sink: "local-json",
        databaseLoaded: false,
        databaseRowsInserted: 0,
        sourceRowsRead: this.sourceRowsRead,
        normalizedUniqueRows: this.normalizedUniqueRows,
        sourceDuplicateRows: this.sourceDuplicateRows,
        duplicateRowsAcrossInputs: this.duplicateRowsAcrossInputs,
        provinceRowsAggregated: this.provinceRowsAggregated,
        regionRowsExcluded: this.regionRowsExcluded,
        unassignedRowsExcluded: this.unassignedRowsExcluded,
        monthlyCountRowsWritten: monthlyCounts.length,
        monthlyGridCountRowsWritten: monthlyGridCounts.length,
        inputFiles: this.inputFiles,
        coverageByYearInstrument,
      },
    };
  }
}

function parseArguments(args: string[]): {
  inputs: Array<{ path: string; instrument: Instrument }>;
  outputDirectory: string | undefined;
  help: boolean;
} {
  const inputs: Array<{ path: string; instrument: Instrument }> = [];
  let outputDirectory: string | undefined;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      help = true;
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
    if (option !== "--output-dir" || outputDirectory !== undefined) {
      throw new Error(`Unknown or repeated option: ${option}`);
    }
    outputDirectory = args[index + 1];
    if (outputDirectory === undefined || outputDirectory.startsWith("--")) {
      throw new Error("Missing value for --output-dir");
    }
    index += 1;
  }
  return { inputs, outputDirectory, help };
}

function runCli(): void {
  const { inputs, outputDirectory, help } = parseArguments(
    process.argv.slice(2),
  );
  if (help) {
    process.stdout.write(
      "Usage: aggregate --modis <csv> [--modis <csv> ...] --viirs <csv> [--viirs <csv> ...] --output-dir <directory>\n",
    );
    return;
  }
  if (outputDirectory === undefined) {
    throw new Error("--output-dir is required");
  }
  if (!inputs.some(({ instrument }) => instrument === "MODIS")) {
    throw new Error("At least one --modis CSV is required");
  }
  if (!inputs.some(({ instrument }) => instrument === "VIIRS")) {
    throw new Error("At least one --viirs CSV is required");
  }

  const builder = new MonthlyAggregateBuilder(loadRegions());
  for (const input of inputs) {
    const inputPath = resolve(input.path);
    if (!existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    const normalized = normalizeCsv(
      readFileSync(inputPath, "utf8"),
      input.instrument,
    );
    builder.addFile({
      file: inputPath,
      instrument: input.instrument,
      sourceRows: normalized.records.length + normalized.duplicateCount,
      duplicateRows: normalized.duplicateCount,
      records: normalized.records,
    });
    process.stdout.write(
      `Processed ${basename(inputPath)}: source=${normalized.records.length + normalized.duplicateCount}, normalized=${normalized.records.length}, duplicates=${normalized.duplicateCount}\n`,
    );
  }

  const result = builder.result();
  const directory = resolve(outputDirectory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "monthly-counts.json"),
    `${JSON.stringify(result.monthlyCounts, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(directory, "monthly-grid-counts.json"),
    `${JSON.stringify(result.monthlyGridCounts, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(directory, "aggregate-report.json"),
    `${JSON.stringify(result.report, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `Wrote ${result.monthlyCounts.length} province-month rows and ${result.monthlyGridCounts.length} grid-month rows; sink=local-json, databaseLoaded=false\n`,
  );
}

if (process.argv[1] && /(?:^|[\\/])aggregate\.(?:ts|js)$/.test(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown aggregation error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
