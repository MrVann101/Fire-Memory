import Papa from "papaparse";
import type { BBox, Hotspot, Instrument } from "@/contracts/types";
import { DatabaseProviderError } from "@/lib/db/supabase";

const FIRMS_AREA_URL =
  "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const MAX_DAY_RANGE = 5;

export type FirmsInstrument = Instrument | "ALL";

interface FirmsRow {
  [key: string]: string | undefined;
}

export interface FirmsAreaQuery {
  bbox: BBox;
  instrument: FirmsInstrument;
  days?: number;
  date?: string;
  start?: string;
  end?: string;
  limit: number;
}

export interface FirmsAreaResult {
  hotspots: Hotspot[];
  total: number;
  truncated: boolean;
  rawWindow: { start: string; end: string } | null;
  lastUpdated: string;
}

export function getFirmsSources(
  instrument: FirmsInstrument
): string[] {
  if (instrument === "MODIS") {
    return ["MODIS_NRT"];
  }
  if (instrument === "VIIRS") {
    return ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"];
  }
  return ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"];
}

function getValue(row: FirmsRow, ...names: string[]): string | undefined {
  for (const name of names) {
    const key = Object.keys(row).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase()
    );
    const value = key ? row[key] : undefined;
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseConfidence(value: string | undefined): string | number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && /^-?\d+(?:\.\d+)?$/.test(trimmed)
    ? parsed
    : trimmed;
}

function parseAcquisitionDatetime(row: FirmsRow): string | null {
  const date = getValue(row, "acq_date", "acquisition_date");
  const time = getValue(row, "acq_time", "acquisition_time") ?? "0000";
  if (!date) {
    return null;
  }
  const digits = time.replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const iso = new Date(
    `${date}T${digits.slice(0, 2)}:${digits.slice(2)}:00.000Z`
  );
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

function mapRow(row: FirmsRow, source: string, index: number): Hotspot | null {
  const latitude = parseNumber(getValue(row, "latitude"));
  const longitude = parseNumber(getValue(row, "longitude"));
  const acquisitionDatetime = parseAcquisitionDatetime(row);
  if (
    latitude === null ||
    longitude === null ||
    acquisitionDatetime === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const instrument: Instrument = source.startsWith("MODIS")
    ? "MODIS"
    : "VIIRS";
  const satellite =
    getValue(row, "satellite") ??
    (source.includes("NOAA20") ? "N20" : instrument);
  const identity = [
    source,
    acquisitionDatetime,
    latitude,
    longitude,
    satellite,
    index,
  ].join(":");

  return {
    id: `firms-${identity}`,
    latitude,
    longitude,
    acquisitionDatetime,
    satellite,
    instrument,
    confidence: parseConfidence(getValue(row, "confidence")),
    brightness: parseNumber(
      instrument === "MODIS"
        ? getValue(row, "brightness")
        : getValue(row, "bright_ti4", "brightness")
    ),
    sourceProduct: source,
  };
}

async function fetchSource(
  mapKey: string,
  source: string,
  query: FirmsAreaQuery
): Promise<Hotspot[]> {
  const [west, south, east, north] = query.bbox;
  const path = [
    FIRMS_AREA_URL,
    encodeURIComponent(mapKey),
    source,
    `${west},${south},${east},${north}`,
    String(query.days),
  ];
  if (query.date) {
    path.push(query.date);
  }

  let response: Response;
  try {
    response = await fetch(path.join("/"), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DatabaseProviderError("FIRMS recent-data request failed.");
  }

  if (!response.ok) {
    throw new DatabaseProviderError(
      `FIRMS recent-data request failed (${response.status}).`
    );
  }

  let csv: string;
  try {
    csv = await response.text();
  } catch {
    throw new DatabaseProviderError("FIRMS response could not be read.");
  }

  const parsed = Papa.parse<FirmsRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new DatabaseProviderError("FIRMS returned invalid CSV data.");
  }

  return parsed.data
    .map((row, index) => mapRow(row, source, index))
    .filter((hotspot): hotspot is Hotspot => hotspot !== null);
}

export async function fetchFirmsArea(
  query: FirmsAreaQuery
): Promise<FirmsAreaResult> {
  if (
    (query.start && !query.end) ||
    (!query.start && query.end) ||
    (query.days !== undefined &&
      (!Number.isInteger(query.days) ||
        query.days < 1 ||
        query.days > MAX_DAY_RANGE))
  ) {
    throw new DatabaseProviderError("FIRMS day range must be between 1 and 5.");
  }

  const mapKey = process.env.FIRMS_MAP_KEY?.trim();
  if (!mapKey) {
    throw new DatabaseProviderError(
      "FIRMS_MAP_KEY is not configured for recent-data requests."
    );
  }

  const sourceResults: Hotspot[][] = [];
  if (query.start && query.end) {
    if (query.start > query.end) {
      throw new DatabaseProviderError(
        "FIRMS start date must be before or equal to end date."
      );
    }

    let cursor = query.start;
    while (cursor <= query.end) {
      const cursorDate = new Date(`${cursor}T00:00:00.000Z`);
      const chunkEnd = new Date(cursorDate);
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + MAX_DAY_RANGE - 1);
      const end = chunkEnd.toISOString().slice(0, 10) < query.end
        ? chunkEnd.toISOString().slice(0, 10)
        : query.end;
      const days =
        Math.round(
          (new Date(`${end}T00:00:00.000Z`).getTime() -
            cursorDate.getTime()) /
            86_400_000
        ) + 1;
      const chunkResults = await Promise.all(
        getFirmsSources(query.instrument).map((source) =>
          fetchSource(mapKey, source, {
            ...query,
            days,
            date: cursor,
          })
        )
      );
      sourceResults.push(...chunkResults);
      cursorDate.setUTCDate(cursorDate.getUTCDate() + days);
      cursor = cursorDate.toISOString().slice(0, 10);
    }
  } else {
    const sourceResultsForLatest = await Promise.all(
      getFirmsSources(query.instrument).map((source) =>
        fetchSource(mapKey, source, {
          ...query,
          days: query.days ?? 5,
        })
      )
    );
    sourceResults.push(...sourceResultsForLatest);
  }
  const allHotspots = sourceResults
    .flat()
    .sort((a, b) =>
      a.acquisitionDatetime.localeCompare(b.acquisitionDatetime)
    );
  const hotspots = allHotspots.slice(0, query.limit);
  const dates = allHotspots.map((hotspot) =>
    hotspot.acquisitionDatetime.slice(0, 10)
  );

  return {
    hotspots,
    total: allHotspots.length,
    truncated: allHotspots.length > hotspots.length,
    rawWindow:
      dates.length > 0
        ? { start: dates[0], end: dates[dates.length - 1] }
        : null,
    lastUpdated: new Date().toISOString(),
  };
}
