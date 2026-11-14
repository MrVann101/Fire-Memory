"use client";

import { useCallback } from "react";
import type {
  AnalyticsQuery,
  CalendarResponse,
  HotspotFilters,
} from "@/contracts/types";
import {
  getAnalyticsSummary,
  getCalendar,
  getChildren,
  getHarmonization,
  getHotspots,
  getHotspotWindow,
  getRegions,
} from "@/lib/client/api";
import { useClientResource } from "./useClientResource";

type CalendarQuery = Omit<AnalyticsQuery, "year" | "month">;
type ChildrenQuery = Pick<
  AnalyticsQuery,
  "regionId" | "year" | "month" | "metric"
>;

export function useRegions() {
  const request = useCallback((signal: AbortSignal) => getRegions(signal), []);
  return useClientResource("regions", request, 0);
}

export function useHotspotWindow() {
  const request = useCallback(
    (signal: AbortSignal) => getHotspotWindow(signal),
    []
  );
  return useClientResource("hotspot-window", request, 0);
}

export function useHotspots(
  filters: HotspotFilters | null,
  limit = 2_000,
  enabled = true
) {
  const key = enabled && filters ? JSON.stringify([filters, limit]) : "";
  const request = useCallback(
    (signal: AbortSignal) => {
      if (!filters) {
        return Promise.reject(new Error("Hotspot filters are not available."));
      }
      return getHotspots(filters, limit, signal);
    },
    [filters, limit]
  );
  return useClientResource(key, request);
}

export function useSummary(
  query: AnalyticsQuery | null,
  enabled = true
) {
  const key = enabled && query ? JSON.stringify(query) : "";
  const request = useCallback(
    (signal: AbortSignal) => {
      if (!query) {
        return Promise.reject(new Error("Analytics query is not available."));
      }
      return getAnalyticsSummary(query, signal);
    },
    [query]
  );
  return useClientResource(key, request);
}

export function useCalendar(
  query: CalendarQuery | null,
  enabled = true
) {
  const key = enabled && query ? JSON.stringify(query) : "";
  const request = useCallback(
    (signal: AbortSignal) => {
      if (!query) {
        return Promise.reject(new Error("Calendar query is not available."));
      }
      return getCalendar(query, signal);
    },
    [query]
  );
  return useClientResource<CalendarResponse>(key, request);
}

export function useChildren(
  query: ChildrenQuery | null,
  enabled = true
) {
  const key = enabled && query ? JSON.stringify(query) : "";
  const request = useCallback(
    (signal: AbortSignal) => {
      if (!query) {
        return Promise.reject(new Error("Children query is not available."));
      }
      return getChildren(query, signal);
    },
    [query]
  );
  return useClientResource(key, request);
}

export function useHarmonization(regionId: string | null, enabled = true) {
  const key = enabled && regionId ? regionId : "";
  const request = useCallback(
    (signal: AbortSignal) => {
      if (!regionId) {
        return Promise.reject(new Error("Region selection is not available."));
      }
      return getHarmonization(regionId, signal);
    },
    [regionId]
  );
  return useClientResource(key, request);
}
