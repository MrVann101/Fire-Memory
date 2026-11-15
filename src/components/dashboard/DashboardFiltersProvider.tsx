"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { BBox, Instrument, Metric } from "@/contracts/types";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n/translations";

const LANGUAGE_STORAGE_KEY = "fire-memory-language";
const LANGUAGE_CHANGE_EVENT = "fire-memory-language-change";

function subscribeLanguage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

function getLanguageSnapshot(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

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
  language: AppLanguage;
  setLanguage: (nextLanguage: AppLanguage) => void;
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
  const language = useSyncExternalStore<AppLanguage>(
    subscribeLanguage,
    getLanguageSnapshot,
    () => "en"
  );

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    const resolved = normalizeLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
    } catch {
      // Ignore storage quota or private-mode errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<AppLanguage>(LANGUAGE_CHANGE_EVENT, { detail: resolved })
      );
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

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
      language,
      setLanguage,
    }),
    [
      regionId,
      metric,
      instrument,
      periodSelection,
      customBbox,
      language,
      setLanguage,
    ]
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
