import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Instrument = "MODIS" | "VIIRS";
type FactorScope = "province" | "national";

export interface MonthlyInputRow {
  region_id: string;
  year: number;
  month: number;
  instrument: Instrument;
  raw_count: number;
  active_cell_days: number;
  has_coverage: boolean;
}

interface ProvinceMonthPair {
  region_id: string;
  year: number;
  month: number;
  modis: number;
  viirs: number;
}

interface MonthlyPair {
  year: number;
  month: number;
  modis: number;
  viirs: number;
}

export interface HarmonizedRow {
  region_id: string;
  year: number;
  month: number;
  harmonized_count: number;
  is_estimated: boolean;
  method_version: string;
}

export interface FactorRow {
  region_id: string | null;
  factor: number;
  scope: FactorScope;
  method: "median_monthly_viirs_over_modis";
  overlap_years: number[];
  month_count: number;
  correlation: number | null;
  mean_absolute_error: number | null;
  root_mean_square_error: number | null;
  mean_absolute_percentage_error: number | null;
  fallback_reason: string | null;
}

interface Metrics {
  compared_months: number;
  correlation: number | null;
  mean_absolute_error: number | null;
  root_mean_square_error: number | null;
  mean_absolute_percentage_error: number | null;
}

function factorMetrics(metrics: Metrics) {
  return {
    correlation: metrics.correlation,
    mean_absolute_error: metrics.mean_absolute_error,
    root_mean_square_error: metrics.root_mean_square_error,
    mean_absolute_percentage_error: metrics.mean_absolute_percentage_error,
  };
}

const METHOD_VERSION = "median-monthly-viirs-over-modis-v1";
const MIN_PROVINCE_MATCHED_MONTHS = 12;
const MIN_PROVINCE_OVERLAP_YEARS = 3;
const NOAA20_START_YEAR = 2018;
const NOAA20_START_MONTH = 4;
const ANOMALY_MINIMUM_REFERENCE_YEARS = 2;
const ANOMALY_MAD_MULTIPLIER = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMonthlyCounts(value: unknown): MonthlyInputRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Monthly-count input must be a JSON array");
  }
  const rows: MonthlyInputRow[] = [];
  const seen = new Set<string>();
  for (const [index, rawRow] of value.entries()) {
    if (!isRecord(rawRow)) {
      throw new Error(`Monthly-count row ${index + 1} must be an object`);
    }
    const {
      region_id,
      year,
      month,
      instrument,
      raw_count,
      active_cell_days,
      has_coverage,
    } = rawRow;
    if (
      typeof region_id !== "string" ||
      !Number.isInteger(year) ||
      typeof year !== "number" ||
      !Number.isInteger(month) ||
      typeof month !== "number" ||
      month < 1 ||
      month > 12 ||
      (instrument !== "MODIS" && instrument !== "VIIRS") ||
      typeof raw_count !== "number" ||
      !Number.isInteger(raw_count) ||
      raw_count < 0 ||
      typeof active_cell_days !== "number" ||
      !Number.isInteger(active_cell_days) ||
      active_cell_days < 0 ||
      typeof has_coverage !== "boolean"
    ) {
      throw new Error(`Invalid monthly-count row ${index + 1}`);
    }
    if (has_coverage && (raw_count === 0 || active_cell_days === 0)) {
      throw new Error(
        `Detection row ${index + 1} has coverage but no positive count`,
      );
    }
    if (!has_coverage && (raw_count !== 0 || active_cell_days !== 0)) {
      throw new Error(
        `Unknown-coverage row ${index + 1} must not contain nonzero counts`,
      );
    }
    const row: MonthlyInputRow = {
      region_id,
      year,
      month,
      instrument,
      raw_count,
      active_cell_days,
      has_coverage,
    };
    const key = `${region_id}:${year}:${month}:${instrument}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate monthly-count key: ${key}`);
    }
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate a median from an empty set");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function round(value: number): number {
  return Number(value.toFixed(8));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function calculateMetrics(
  pairs: Array<{ modis: number; viirs: number }>,
  factor: number,
): Metrics {
  if (pairs.length === 0) {
    return {
      compared_months: 0,
      correlation: null,
      mean_absolute_error: null,
      root_mean_square_error: null,
      mean_absolute_percentage_error: null,
    };
  }
  const predictions = pairs.map(({ modis }) => modis * factor);
  const observed = pairs.map(({ viirs }) => viirs);
  const meanPrediction =
    predictions.reduce((sum, value) => sum + value, 0) / predictions.length;
  const meanObserved =
    observed.reduce((sum, value) => sum + value, 0) / observed.length;
  const covariance = predictions.reduce(
    (sum, prediction, index) =>
      sum + (prediction - meanPrediction) * (observed[index] - meanObserved),
    0,
  );
  const predictionVariance = predictions.reduce(
    (sum, value) => sum + (value - meanPrediction) ** 2,
    0,
  );
  const observedVariance = observed.reduce(
    (sum, value) => sum + (value - meanObserved) ** 2,
    0,
  );
  const correlation =
    predictionVariance === 0 || observedVariance === 0
      ? null
      : covariance / Math.sqrt(predictionVariance * observedVariance);
  const absoluteErrors = predictions.map((prediction, index) =>
    Math.abs(prediction - observed[index]),
  );
  const meanAbsoluteError =
    absoluteErrors.reduce((sum, error) => sum + error, 0) /
    absoluteErrors.length;
  const rootMeanSquareError = Math.sqrt(
    absoluteErrors.reduce((sum, error) => sum + error ** 2, 0) /
      absoluteErrors.length,
  );
  const meanAbsolutePercentageError =
    (absoluteErrors.reduce(
      (sum, error, index) => sum + error / observed[index],
      0,
    ) /
      absoluteErrors.length) *
    100;
  return {
    compared_months: pairs.length,
    correlation: correlation === null ? null : round(correlation),
    mean_absolute_error: round(meanAbsoluteError),
    root_mean_square_error: round(rootMeanSquareError),
    mean_absolute_percentage_error: round(meanAbsolutePercentageError),
  };
}

function isBeforeNoaa20Start(year: number, month: number): boolean {
  return (
    year < NOAA20_START_YEAR ||
    (year === NOAA20_START_YEAR && month < NOAA20_START_MONTH)
  );
}

function seasonalAnomalyConsistency(pairs: MonthlyPair[]) {
  let bothAnomalies = 0;
  let modisOnlyAnomaly = 0;
  let viirsOnlyAnomaly = 0;
  let neitherAnomaly = 0;
  let comparedMonths = 0;

  for (let month = 1; month <= 12; month += 1) {
    const monthPairs = pairs.filter((pair) => pair.month === month);
    for (const pair of monthPairs) {
      const reference = monthPairs.filter(
        (candidate) => candidate.year !== pair.year,
      );
      if (reference.length < ANOMALY_MINIMUM_REFERENCE_YEARS) {
        continue;
      }
      const modisValues = reference.map(({ modis }) => modis);
      const viirsValues = reference.map(({ viirs }) => viirs);
      const modisMedian = median(modisValues);
      const viirsMedian = median(viirsValues);
      const modisMad = median(
        modisValues.map((value) => Math.abs(value - modisMedian)),
      );
      const viirsMad = median(
        viirsValues.map((value) => Math.abs(value - viirsMedian)),
      );
      const modisAnomaly =
        pair.modis >
        modisMedian + ANOMALY_MAD_MULTIPLIER * 1.4826 * modisMad;
      const viirsAnomaly =
        pair.viirs >
        viirsMedian + ANOMALY_MAD_MULTIPLIER * 1.4826 * viirsMad;
      comparedMonths += 1;
      if (modisAnomaly && viirsAnomaly) {
        bothAnomalies += 1;
      } else if (modisAnomaly) {
        modisOnlyAnomaly += 1;
      } else if (viirsAnomaly) {
        viirsOnlyAnomaly += 1;
      } else {
        neitherAnomaly += 1;
      }
    }
  }

  const anomalyUnion = bothAnomalies + modisOnlyAnomaly + viirsOnlyAnomaly;
  return {
    rule: "For each calendar month, flag a value above the leave-one-year-out median plus 2 x 1.4826 x MAD; compare only months with at least two reference years.",
    minimumReferenceYears: ANOMALY_MINIMUM_REFERENCE_YEARS,
    comparedMonths,
    bothAnomalies,
    modisOnlyAnomaly,
    viirsOnlyAnomaly,
    neitherAnomaly,
    agreementRate:
      comparedMonths === 0
        ? null
        : round((bothAnomalies + neitherAnomaly) / comparedMonths),
    positiveJaccard:
      anomalyUnion === 0 ? null : round(bothAnomalies / anomalyUnion),
  };
}

export function harmonizeMonthlyCounts(rows: MonthlyInputRow[]) {
  const observedYears = {
    MODIS: new Set<number>(),
    VIIRS: new Set<number>(),
  };
  const rowsByProvinceMonth = new Map<
    string,
    { region_id: string; year: number; month: number; MODIS?: number; VIIRS?: number }
  >();

  for (const row of rows) {
    if (!row.has_coverage) {
      continue;
    }
    observedYears[row.instrument].add(row.year);
    const key = `${row.region_id}:${row.year}:${row.month}`;
    const group = rowsByProvinceMonth.get(key) ?? {
      region_id: row.region_id,
      year: row.year,
      month: row.month,
    };
    if (group[row.instrument] !== undefined) {
      throw new Error(`Duplicate province/month instrument value: ${key}`);
    }
    group[row.instrument] = row.active_cell_days;
    rowsByProvinceMonth.set(key, group);
  }

  const candidateOverlapYears = [...observedYears.MODIS]
    .filter((year) => observedYears.VIIRS.has(year))
    .sort((left, right) => left - right);
  if (candidateOverlapYears.length === 0) {
    throw new Error("No years contain detections from both instruments");
  }
  const candidateYearSet = new Set(candidateOverlapYears);
  const provincePairs: ProvinceMonthPair[] = [];
  const provinceIds = new Set<string>();
  for (const group of rowsByProvinceMonth.values()) {
    provinceIds.add(group.region_id);
    if (
      candidateYearSet.has(group.year) &&
      group.MODIS !== undefined &&
      group.VIIRS !== undefined &&
      group.MODIS > 0 &&
      group.VIIRS > 0
    ) {
      provincePairs.push({
        region_id: group.region_id,
        year: group.year,
        month: group.month,
        modis: group.MODIS,
        viirs: group.VIIRS,
      });
    }
  }
  if (provincePairs.length === 0) {
    throw new Error("No province/month pairs have positive detections in both instruments");
  }

  const nationalPairsByMonth = new Map<string, MonthlyPair>();
  for (const pair of provincePairs) {
    const key = `${pair.year}:${pair.month}`;
    const nationalPair = nationalPairsByMonth.get(key) ?? {
      year: pair.year,
      month: pair.month,
      modis: 0,
      viirs: 0,
    };
    nationalPair.modis += pair.modis;
    nationalPair.viirs += pair.viirs;
    nationalPairsByMonth.set(key, nationalPair);
  }
  const nationalPairs = [...nationalPairsByMonth.values()].sort(
    (left, right) => left.year - right.year || left.month - right.month,
  );
  const nationalFactor = round(
    median(nationalPairs.map(({ modis, viirs }) => viirs / modis)),
  );
  const nationalMetrics = calculateMetrics(nationalPairs, nationalFactor);
  const pairsByProvince = new Map<string, ProvinceMonthPair[]>();
  for (const pair of provincePairs) {
    const pairs = pairsByProvince.get(pair.region_id) ?? [];
    pairs.push(pair);
    pairsByProvince.set(pair.region_id, pairs);
  }

  const factors: FactorRow[] = [];
  const factorsByProvince = new Map<string, FactorRow>();
  const nationalFactorRow: FactorRow = {
    region_id: null,
    factor: nationalFactor,
    scope: "national",
    method: "median_monthly_viirs_over_modis",
    overlap_years: [...new Set(nationalPairs.map(({ year }) => year))].sort(),
    month_count: nationalPairs.length,
    ...factorMetrics(nationalMetrics),
    fallback_reason: null,
  };
  factors.push(nationalFactorRow);

  let provinceFactorCount = 0;
  let nationalFallbackCount = 0;
  for (const regionId of [...provinceIds].sort()) {
    const pairs = pairsByProvince.get(regionId) ?? [];
    const overlapYears = [...new Set(pairs.map(({ year }) => year))].sort();
    const meetsMonthMinimum = pairs.length >= MIN_PROVINCE_MATCHED_MONTHS;
    const meetsYearMinimum = overlapYears.length >= MIN_PROVINCE_OVERLAP_YEARS;
    const scope: FactorScope =
      meetsMonthMinimum && meetsYearMinimum ? "province" : "national";
    const factor =
      scope === "province"
        ? round(median(pairs.map(({ modis, viirs }) => viirs / modis)))
        : nationalFactor;
    const fallbackReason =
      scope === "province"
        ? null
        : !meetsMonthMinimum && !meetsYearMinimum
          ? "below_month_and_year_minimums"
          : !meetsMonthMinimum
            ? "below_month_minimum"
            : "below_year_minimum";
    const provinceMetrics = calculateMetrics(pairs, factor);
    const factorRow: FactorRow = {
      region_id: regionId,
      factor,
      scope,
      method: "median_monthly_viirs_over_modis",
      overlap_years: overlapYears,
      month_count: pairs.length,
      ...factorMetrics(provinceMetrics),
      fallback_reason: fallbackReason,
    };
    factors.push(factorRow);
    factorsByProvince.set(regionId, factorRow);
    if (scope === "province") {
      provinceFactorCount += 1;
    } else {
      nationalFallbackCount += 1;
    }
  }

  const allProvinceMonthKeys = [...rowsByProvinceMonth.keys()].sort((left, right) =>
    compareProvinceMonthKeys(left, right),
  );
  const harmonized: HarmonizedRow[] = [];
  let modisOnlyUnknownCoverageRows = 0;
  for (const key of allProvinceMonthKeys) {
    const group = rowsByProvinceMonth.get(key);
    if (group === undefined) {
      throw new Error(`Missing province/month group: ${key}`);
    }
    if (group.VIIRS !== undefined) {
      harmonized.push({
        region_id: group.region_id,
        year: group.year,
        month: group.month,
        harmonized_count: group.VIIRS,
        is_estimated: false,
        method_version: METHOD_VERSION,
      });
      continue;
    }
    if (group.MODIS === undefined) {
      continue;
    }
    if (!isBeforeNoaa20Start(group.year, group.month)) {
      modisOnlyUnknownCoverageRows += 1;
      continue;
    }
    const factorRow = factorsByProvince.get(group.region_id);
    if (factorRow === undefined) {
      throw new Error(`No calibration factor for province ${group.region_id}`);
    }
    harmonized.push({
      region_id: group.region_id,
      year: group.year,
      month: group.month,
      harmonized_count: round(group.MODIS * factorRow.factor),
      is_estimated: true,
      method_version: METHOD_VERSION,
    });
  }
  harmonized.sort(
    (left, right) =>
      left.year -
        right.year ||
      left.month - right.month ||
      compareText(left.region_id, right.region_id),
  );

  const looPredictions: Array<{ modis: number; viirs: number }> = [];
  const leaveOneYearOutFolds = [];
  for (const heldOutYear of [...new Set(nationalPairs.map(({ year }) => year))]) {
    const trainingPairs = nationalPairs.filter(
      ({ year }) => year !== heldOutYear,
    );
    if (trainingPairs.length === 0) {
      continue;
    }
    const trainingFactor = round(
      median(trainingPairs.map(({ modis, viirs }) => viirs / modis)),
    );
    const heldOutPairs = nationalPairs.filter(
      ({ year }) => year === heldOutYear,
    );
    looPredictions.push(
      ...heldOutPairs.map(({ modis, viirs }) => ({
        modis: modis * trainingFactor,
        viirs,
      })),
    );
    leaveOneYearOutFolds.push({
      heldOutYear,
      trainingFactor,
      ...calculateMetrics(heldOutPairs, trainingFactor),
    });
  }

  const estimatedYears = [
    ...new Set(
      harmonized
        .filter(({ is_estimated }) => is_estimated)
        .map(({ year }) => year),
    ),
  ].sort((left, right) => left - right);
  factors.sort(
    (left, right) =>
      compareText(left.region_id ?? "", right.region_id ?? "") ||
      compareText(left.scope, right.scope),
  );

  return {
    monthlyHarmonized: harmonized,
    factors,
    report: {
      method: METHOD_VERSION,
      target: "VIIRS",
      overlapStatus: "candidate years only; Philippine coverage is unverified",
      candidateOverlapYears,
      matchedProvinceMonths: provincePairs.length,
      matchedNationalMonths: nationalPairs.length,
      factorThresholds: {
        minimumProvinceMatchedMonths: MIN_PROVINCE_MATCHED_MONTHS,
        minimumProvinceOverlapYears: MIN_PROVINCE_OVERLAP_YEARS,
        status: "VERIFY until agreed",
      },
      factorSummary: {
        nationalFactor,
        nationalScope: "matched province/months only; special ADM2 and unassigned points excluded",
        provinceFactorCount,
        nationalFallbackCount,
      },
      estimatedRows: harmonized.filter(({ is_estimated }) => is_estimated).length,
      estimatedYears,
      modisOnlyUnknownCoverageRows,
      unobservedMonthsFilledAsZero: 0,
      validation: {
        nationalInSample: nationalMetrics,
        leaveOneYearOut: {
          heldOutYears: leaveOneYearOutFolds.map(({ heldOutYear }) => heldOutYear),
          ...calculateMetrics(looPredictions, 1),
          folds: leaveOneYearOutFolds,
        },
        anomalyConsistency: seasonalAnomalyConsistency(nationalPairs),
      },
      notes: [
        "Calibration years are inferred from detection-bearing input years, not verified archive coverage.",
        "Only province/month rows with detections in both sensors contribute to calibration; absent values are not treated as zero.",
        "MODIS-only months after the NOAA-20 global start are omitted when local VIIRS province coverage is unknown.",
        "The series is not evidence that MODIS and VIIRS are equivalent.",
      ],
    },
  };
}

function compareProvinceMonthKeys(left: string, right: string): number {
  const [leftRegion, leftYear, leftMonth] = left.split(":");
  const [rightRegion, rightYear, rightMonth] = right.split(":");
  return (
    compareText(leftRegion, rightRegion) ||
    Number(leftYear) - Number(rightYear) ||
    Number(leftMonth) - Number(rightMonth)
  );
}

function parseArguments(args: string[]): {
  input: string | undefined;
  outputDirectory: string | undefined;
  help: boolean;
} {
  const options = new Map<string, string>();
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help") {
      help = true;
      continue;
    }
    if (option !== "--input" && option !== "--output-dir") {
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
  return {
    input: options.get("--input"),
    outputDirectory: options.get("--output-dir"),
    help,
  };
}

function runCli(): void {
  const { input, outputDirectory, help } = parseArguments(
    process.argv.slice(2),
  );
  if (help) {
    process.stdout.write(
      "Usage: harmonize --input <monthly-counts.json> --output-dir <directory>\n",
    );
    return;
  }
  if (input === undefined || outputDirectory === undefined) {
    throw new Error("--input and --output-dir are required");
  }
  const inputPath = resolve(input);
  if (!existsSync(inputPath)) {
    throw new Error(`Monthly-count input does not exist: ${inputPath}`);
  }
  const rows = parseMonthlyCounts(
    JSON.parse(readFileSync(inputPath, "utf8")) as unknown,
  );
  const result = harmonizeMonthlyCounts(rows);
  const directory = resolve(outputDirectory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "monthly-harmonized.json"),
    `${JSON.stringify(result.monthlyHarmonized, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(directory, "harmonization-factors.json"),
    `${JSON.stringify(result.factors, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(directory, "harmonization-report.json"),
    `${JSON.stringify(result.report, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `Wrote ${result.monthlyHarmonized.length} harmonized rows and ${result.factors.length} factors; estimated=${result.report.estimatedRows}, unknown-coverage MODIS-only=${result.report.modisOnlyUnknownCoverageRows}\n`,
  );
}

if (process.argv[1] && /(?:^|[\\/])harmonize\.(?:ts|js)$/.test(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown harmonization error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
