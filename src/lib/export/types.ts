export type ExportInstrument = "MODIS" | "VIIRS" | "ALL";
export type ExportMetric = "harmonized" | "raw";

export interface HotspotFiltersForExport {
  regionId: string;
  bbox?: [number, number, number, number];
  start: string;
  end: string;
  instrument?: ExportInstrument;
}

export interface HotspotForExport {
  id: string;
  latitude: number;
  longitude: number;
  acquisitionDatetime: string;
  satellite: string;
  instrument: "MODIS" | "VIIRS";
  confidence: string | number | null;
  brightness: number | null;
  sourceProduct: string | null;
}

export interface AnalyticsCsvRow {
  year: number;
  month: number;
  metric: ExportMetric;
  count: number | null;
  estimated: boolean;
  historicalMedian: number | null;
  anomalyPercent: number | null;
  label: string;
}
