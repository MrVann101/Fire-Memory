"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { BBox, Instrument, Metric } from "@/contracts/types";

interface DashboardFilters {
  regionId: string;
  setRegionId: Dispatch<SetStateAction<string>>;
  metric: Metric;
  setMetric: Dispatch<SetStateAction<Metric>>;
  instrument: Instrument | "ALL";
  setInstrument: Dispatch<SetStateAction<Instrument | "ALL">>;
  periodSelection: string | null;
  setPeriodSelection: Dispatch<SetStateAction<string | null>>;
  customBbox: BBox | null;
  setCustomBbox: Dispatch<SetStateAction<BBox | null>>;
}

const DashboardFiltersContext = createContext<DashboardFilters | null>(null);

export function DashboardFiltersProvider({
  children,
  isSimulated,
}: {
  children: ReactNode;
  isSimulated: boolean;
}) {
  const [regionId, setRegionId] = useState(isSimulated ? "PH-BUK" : "PH");
  const [metric, setMetric] = useState<Metric>("harmonized");
  const [instrument, setInstrument] = useState<Instrument | "ALL">("ALL");
  const [periodSelection, setPeriodSelection] = useState<string | null>(
    isSimulated ? "2026-11" : null
  );
  const [customBbox, setCustomBbox] = useState<BBox | null>(null);

  const value = useMemo(
    () => ({
      regionId,
      setRegionId,
      metric,
      setMetric,
      instrument,
      setInstrument,
      periodSelection,
      setPeriodSelection,
      customBbox,
      setCustomBbox,
    }),
    [regionId, metric, instrument, periodSelection, customBbox]
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const filters = useContext(DashboardFiltersContext);
  if (!filters) {
    throw new Error(
      "DashboardFiltersProvider is required to use dashboard filters."
    );
  }
  return filters;
}
