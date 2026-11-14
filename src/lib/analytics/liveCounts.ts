import type { Hotspot } from "@/contracts/types";
import type { AnalyticsSummaryForAi } from "@/lib/ai/request";

export interface LiveCountsSnapshot {
  viirs: number;
  modis: number;
  harmonized: number;
}

const LIVE_FIRMS_NOTE =
  "Live NASA FIRMS active cell-days included for VIIRS and MODIS.";

/**
 * Counts unique active UTC date + 0.01-degree grid cell combinations per instrument.
 */
export function countLiveCellDays(
  hotspots: Hotspot[],
  instrument: "MODIS" | "VIIRS"
): number {
  const cells = new Set(
    hotspots
      .filter((hotspot) => hotspot.instrument === instrument)
      .map((hotspot) => {
        const latitudeCell = Math.floor(hotspot.latitude * 100);
        const longitudeCell = Math.floor(hotspot.longitude * 100);
        return `${hotspot.acquisitionDatetime.slice(0, 10)}:${latitudeCell}:${longitudeCell}`;
      })
  );
  return cells.size;
}

/**
 * Merges real live FIRMS (or loaded map hotspot) VIIRS & MODIS counts into an
 * AnalyticsSummary when monthly archive fields are incomplete or a live window is active.
 */
export function mergeLiveCountsIntoSummary(
  summary: AnalyticsSummaryForAi,
  liveCounts: LiveCountsSnapshot | null,
  hotspots: Hotspot[] = []
): AnalyticsSummaryForAi {
  const canInferFromHotspots = liveCounts === null && hotspots.length > 0;
  const viirsFromHotspots =
    canInferFromHotspots && summary.instrument !== "MODIS"
      ? countLiveCellDays(hotspots, "VIIRS")
      : null;
  const modisFromHotspots =
    canInferFromHotspots && summary.instrument !== "VIIRS"
      ? countLiveCellDays(hotspots, "MODIS")
      : null;

  const mergedViirs =
    liveCounts !== null
      ? liveCounts.viirs
      : (summary.byInstrument.VIIRS ?? viirsFromHotspots);
  const mergedModis =
    liveCounts !== null
      ? liveCounts.modis
      : (summary.byInstrument.MODIS ?? modisFromHotspots);

  let mergedCurrentCount = summary.currentCount;
  if (mergedCurrentCount === null) {
    if (liveCounts !== null) {
      mergedCurrentCount =
        summary.metric === "raw"
          ? summary.instrument === "MODIS"
            ? liveCounts.modis
            : summary.instrument === "VIIRS"
              ? liveCounts.viirs
              : liveCounts.viirs + liveCounts.modis
          : liveCounts.harmonized;
    } else if (mergedViirs !== null || mergedModis !== null) {
      mergedCurrentCount =
        summary.metric === "raw"
          ? summary.instrument === "MODIS"
            ? (mergedModis ?? 0)
            : summary.instrument === "VIIRS"
              ? (mergedViirs ?? 0)
              : (mergedViirs ?? 0) + (mergedModis ?? 0)
          : (mergedViirs ?? 0);
    }
  }

  const changed =
    mergedViirs !== summary.byInstrument.VIIRS ||
    mergedModis !== summary.byInstrument.MODIS ||
    mergedCurrentCount !== summary.currentCount;

  if (!changed) {
    return summary;
  }

  const notes =
    liveCounts !== null && !summary.notes.includes(LIVE_FIRMS_NOTE)
      ? [...summary.notes, LIVE_FIRMS_NOTE]
      : summary.notes;

  return {
    ...summary,
    currentCount: mergedCurrentCount,
    byInstrument: {
      MODIS: mergedModis,
      VIIRS: mergedViirs,
    },
    notes,
  };
}
