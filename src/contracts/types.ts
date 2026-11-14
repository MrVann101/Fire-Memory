export type Instrument = "MODIS" | "VIIRS";
export type RegionLevel = "country" | "region" | "province" | "custom";
export type Metric = "harmonized" | "raw";
export type BBox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

export interface Region {
  id: string;
  name: string;
  level: RegionLevel;
  parentId: string | null;
  bbox: BBox;
}

export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  acquisitionDatetime: string;      // ISO 8601, UTC
  satellite: string;
  instrument: Instrument;
  confidence: string | number | null; // original value, not converted
  brightness: number | null;
  sourceProduct: string | null;
}

export interface HotspotFilters {
  regionId: string;                 // a region id, or "custom"
  bbox?: BBox;                      // required when regionId = "custom"
  start: string;                    // YYYY-MM-DD (UTC)
  end: string;                      // YYYY-MM-DD (UTC)
  instrument?: Instrument | "ALL";  // default "ALL"
}

export interface HotspotsResponse {
  filters: HotspotFilters;
  total: number;        // all matching records in the raw window
  returned: number;     // records in this response
  truncated: boolean;   // true if total > returned
  hotspots: Hotspot[];
  rawWindow: { start: string; end: string } | null; // dates with raw points
  lastUpdated: string | null;
}

export type AnomalyLabel =
  | "below_baseline"
  | "near_baseline"
  | "above_baseline"
  | "unusually_high"
  | "not_calculable";   // zero or missing baseline

export interface HarmonizationInfo {
  method: string;                   // e.g. "median ratio of active cell-days"
  targetSensor: "VIIRS";
  overlapYears: number[];
  factor: number | null;            // MODIS to VIIRS-equivalent
  factorScope: "province" | "national";
  correlation: number | null;       // scaled MODIS vs VIIRS in the overlap
  errorPercent: number | null;
  estimatedYears: number[];         // years converted from MODIS
  notes: string[];
}

export interface AnalyticsQuery {
  regionId: string;                 // a region id, or "custom"
  bbox?: BBox;                      // required when regionId = "custom"
  year: number;
  month: number;
  metric: Metric;                   // default "harmonized"
  instrument?: Instrument | "ALL";  // used only when metric = "raw"
}

export interface AnalyticsSummary {
  region: { id: string; name: string; level: RegionLevel };
  period: { year: number; month: number };
  metric: Metric;
  instrument: Instrument | "ALL";   // "ALL" when metric = "harmonized"
  currentCount: number | null;      // null = no data coverage
  currentIsEstimated: boolean;
  byInstrument: { MODIS: number | null; VIIRS: number | null }; // raw counts
  baselineYears: number[];          // complete years used in the median
  estimatedBaselineYears: number[]; // baseline years that are estimated
  historicalMedian: number | null;
  anomalyPercent: number | null;    // null when baseline is 0 or missing
  label: AnomalyLabel;
  approximate: boolean;             // true for custom areas (grid-approximated)
  notes: string[];                  // limitations, e.g. "Only 3 baseline years"
  dataCoverage: { firstDate: string; lastDate: string } | null;
  harmonization: HarmonizationInfo | null;
  lastUpdated: string | null;
}

export interface CalendarCell {
  year: number;
  month: number;
  count: number | null;             // null = no data coverage (NOT zero)
  estimated: boolean;               // true when converted from MODIS
}

export interface CalendarResponse {
  regionId: string;
  metric: Metric;
  instrument: Instrument | "ALL";
  approximate: boolean;
  cells: CalendarCell[];
  harmonization: HarmonizationInfo | null;
}

export interface OverlapPoint {     // for the MODIS vs VIIRS comparison chart
  year: number;
  month: number;
  modis: number | null;             // raw MODIS active cell-days
  modisScaled: number | null;       // MODIS after the factor
  viirs: number | null;
}

export interface HarmonizationResponse {
  regionId: string;
  info: HarmonizationInfo;
  overlap: OverlapPoint[];
}

export interface ChildCount {       // used for national to province view
  regionId: string;
  name: string;
  count: number | null;
}

export interface AiBriefRequest {
  summary: AnalyticsSummary;        // computed analytics only
  question: string;
}

export interface AiBriefResponse {
  answer: string;                   // always shown as "AI interpretation"
  disclaimer: string;
}
