"use client";

import dynamic from "next/dynamic";
import type {
  BBox,
  ChildCount,
  HotspotsResponse,
  Region,
} from "@/contracts/types";
import type { ClientResource } from "@/hooks/useClientResource";

const LeafletCanvas = dynamic(() => import("./LeafletCanvas"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Loading map…
    </div>
  ),
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

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="section-heading map-heading sr-only">
        <div>
          <p className="eyebrow">GEOGRAPHIC VIEW</p>
          <h2 id="map-title">Satellite detection map</h2>
        </div>
        <span className="map-range">{region?.name ?? "Select an area"}</span>
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
        />
        {drawRectangle && (
          <div className="map-draw-banner" role="status" aria-live="polite">
            Drag across the map to draw a custom area rectangle.
          </div>
        )}
        {resource.isLoading && (
          <div className="map-state-banner" role="status" aria-live="polite">
            Loading satellite detections…
          </div>
        )}
        {resource.error && (
          <div className="map-state-banner map-state-error" role="alert">
            Hotspot data could not be loaded: {resource.error.message}
          </div>
        )}
        {response && response.total === 0 && (
          <div className="map-empty-state" role="status">
            <span className="map-empty-icon" aria-hidden="true">
              i
            </span>
            <span>
              No satellite thermal hotspots were recorded in this area for the
              selected date window.
            </span>
          </div>
        )}
      </div>

      <div className="map-metadata">
        <p className="map-attribution">
          {isLiveData
            ? "Cloud-free satellite land basemap (NASA EOSDIS GIBS Blue Marble & Esri World Imagery) with NASA reference borders and live NASA FIRMS thermal hotspot layer."
            : `Cloud-free satellite land basemap (NASA EOSDIS GIBS Blue Marble & Esri World Imagery) with NASA reference borders and NASA FIRMS historical detections${imageryDate ? ` (reference period: ${imageryDate})` : ""}.`}{" "}
          Hotspots indicate satellite-detected heat sources—coordinate with BFP
          or barangay responders to verify on the ground.
        </p>
        <p className="map-drilldown-note">
          Zoom to level 10 or closer to view sensor scan footprints: solid
          red-orange circles show high-detail VIIRS (375 m) and dashed orange
          circles show wide-area MODIS (1 km). Circles show satellite scan area,
          not confirmed burn perimeter.
        </p>
        <p className="raw-window">
          <strong>Map detection window:</strong>{" "}
          {rawWindow
            ? `${rawWindow.start} to ${rawWindow.end} (UTC)`
            : response
              ? "No point detections available for this date range."
              : resource.error
                ? "Unavailable because hotspot data failed to load."
                : "Loading selected period…"}
        </p>
        {isLiveData && (
          <p className="map-drilldown-note" role="status">
            Current-period map uses live NASA FIRMS thermal observations for
            CDRRMO situational monitoring. Monthly historical baseline analytics
            remain unchanged.
          </p>
        )}
        {response && (
          <div className="map-response-meta" aria-live="polite">
            <span>
              {response.returned.toLocaleString("en-US")} of{" "}
              {response.total.toLocaleString("en-US")} thermal hotspots shown
            </span>
            {response.truncated && (
              <span className="truncation-note" role="status">
                Result limited to {response.returned.toLocaleString("en-US")}{" "}
                points; zoom or narrow the region to explore.
              </span>
            )}
          </div>
        )}
        {isNationalView && childrenResource.isLoading && (
          <p className="map-drilldown-note" role="status">
            Loading province comparison bubbles…
          </p>
        )}
        {isNationalView && childrenResource.error && (
          <p className="map-drilldown-note map-error-text" role="alert">
            Province comparison is unavailable: {childrenResource.error.message}
          </p>
        )}
        {isNationalView &&
          childrenResource.data &&
          childrenResource.data.length > 0 && (
            <p className="map-drilldown-note">
              Orange-to-red province bubbles show relative hotspot volume at
              each province’s approximate center. Select a bubble to inspect
              that province.
            </p>
          )}
      </div>
    </section>
  );
}
