"use client";

import dynamic from "next/dynamic";
import { useDashboardFilters } from "@/components/dashboard/DashboardFiltersProvider";
import type {
  BBox,
  ChildCount,
  HotspotsResponse,
  Region,
} from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";
import { getTranslations } from "@/lib/i18n/translations";

function MapLoadingFallback() {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  return (
    <div className="map-loading" role="status">
      {t.map.loadingMap}
    </div>
  );
}

const LeafletCanvas = dynamic(() => import("./LeafletCanvas"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

export default function MapView({
  resource,
  region,
  childrenResource,
  regions,
  imageryDate,
  isLiveData,
  onSelectRegion,
  drawRectangle,
  onDrawComplete,
}: {
  resource: ClientResource<HotspotsResponse>;
  region: Region | null;
  childrenResource: ClientResource<ChildCount[]>;
  regions: Region[];
  imageryDate: string | null;
  isLiveData?: boolean;
  onSelectRegion: (regionId: string) => void;
  drawRectangle: boolean;
  onDrawComplete: (bbox: BBox) => void;
}) {
  const { language } = useDashboardFilters();
  const t = getTranslations(language);
  const response = resource.data;
  const rawWindow = response?.rawWindow;
  const isNationalView = region?.level === "country";
  const liveWindowDays = rawWindow
    ? Math.round(
        (Date.parse(rawWindow.end) - Date.parse(rawWindow.start)) /
          (24 * 60 * 60 * 1000)
      ) + 1
    : 1;
  const firmsWmsLayer =
    liveWindowDays <= 1
      ? "fires_viirs_24,fires_modis_24"
      : liveWindowDays <= 2
        ? "fires_viirs_48,fires_modis_48"
        : liveWindowDays <= 3
          ? "fires_viirs_72,fires_modis_72"
          : "fires_viirs_7,fires_modis_7";

  const intensitySteps = [
    { key: "low" as const, label: "Low", color: "var(--hotspot-low, #fb923c)" },
    {
      key: "moderate" as const,
      label: "Moderate",
      color: "var(--hotspot-moderate, #f97316)",
    },
    { key: "high" as const, label: "High", color: "var(--hotspot-high, #ea580c)" },
    {
      key: "very-high" as const,
      label: "Very High",
      color: "var(--hotspot-very-high, #ef4444)",
    },
  ];

  const activeCountLabel =
    language === "ceb"
      ? `${response?.returned.toLocaleString("en-US") ?? 0} aktibo`
      : language === "fil"
        ? `${response?.returned.toLocaleString("en-US") ?? 0} aktibo`
        : `${response?.returned.toLocaleString("en-US") ?? 0} active`;

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="section-heading map-heading sr-only">
        <div>
          <p className="eyebrow">GEOGRAPHIC VIEW</p>
          <h2 id="map-title">{t.nav.map}</h2>
        </div>
        <span className="map-range">{region?.name ?? t.shell.summaryCard.region}</span>
      </div>

      <div className="map-viewport">
        <LeafletCanvas
          hotspots={response?.hotspots ?? []}
          selectedRegion={region}
          childCounts={isNationalView ? childrenResource.data ?? [] : []}
          regions={regions}
          imageryDate={imageryDate}
          useFirmsWms={Boolean(isLiveData)}
          firmsWmsLayer={firmsWmsLayer}
          onSelectRegion={onSelectRegion}
          drawRectangle={drawRectangle}
          onRectangleComplete={onDrawComplete}
          language={language}
        />
        {drawRectangle && (
          <div className="map-draw-banner" role="status" aria-live="polite">
            {t.map.drawAreaBanner}
          </div>
        )}
        {resource.isLoading && (
          <div className="map-state-banner" role="status" aria-live="polite">
            {t.map.loadingHotspots}
          </div>
        )}
        {resource.error && (
          <div className="map-state-banner map-state-error" role="alert">
            {t.map.hotspotErrorTitle}: {resource.error.message}
          </div>
        )}
        {response && response.total === 0 && (
          <div className="map-empty-state" role="status">
            <span className="map-empty-icon" aria-hidden="true">
              i
            </span>
            <span>
              {t.map.noDetectionsTitle}. {t.map.noDetectionsBody}
            </span>
          </div>
        )}
      </div>

      <div className="map-metadata" aria-label={t.map.intensityTitle}>
        <div
          className="map-legend-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span
            className="map-legend-title"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--foreground)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
            }}
          >
            {language === "en" ? "Hotspot Intensity Scale" : t.map.intensityTitle}
          </span>
          {response && (
            <span
              className="map-legend-count"
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--accent)",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {activeCountLabel}
            </span>
          )}
        </div>

        <div
          className="map-intensity-scale"
          role="list"
          aria-label={t.map.intensityTitle}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "6px",
          }}
        >
          {intensitySteps.map((step) => (
            <div
              key={step.key}
              className="map-intensity-step"
              role="listitem"
              style={{ display: "grid", gap: "4px" }}
            >
              <span
                className="map-intensity-swatch"
                aria-hidden="true"
                style={{
                  display: "block",
                  height: "6px",
                  borderRadius: "999px",
                  background: step.color,
                }}
              />
              <span
                className="map-intensity-label"
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "var(--muted)",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  lineHeight: 1.2,
                }}
              >
                {t.map.intensityBands[step.key] ?? step.label}
              </span>
            </div>
          ))}
        </div>

        <p
          className="map-legend-sub"
          style={{
            margin: 0,
            fontSize: "10px",
            color: "var(--muted)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.3,
          }}
        >
          VIIRS 375m · MODIS 1km
          {rawWindow
            ? ` · ${rawWindow.start} ${t.shell.summaryCard.dateRangeTo} ${rawWindow.end}`
            : ""}
        </p>
      </div>
    </section>
  );
}
