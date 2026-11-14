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
  onSelectRegion,
  drawRectangle,
  onDrawComplete,
}: {
  resource: ClientResource<HotspotsResponse>;
  region: Region | null;
  childrenResource: ClientResource<ChildCount[]>;
  regions: Region[];
  imageryDate: string | null;
  onSelectRegion: (regionId: string) => void;
  drawRectangle: boolean;
  onDrawComplete: (bbox: BBox) => void;
}) {
  const response = resource.data;
  const rawWindow = response?.rawWindow;
  const isNationalView = region?.level === "country";

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
              No satellite detections are available in this raw window.
            </span>
          </div>
        )}
      </div>

      <div className="map-metadata">
        <p className="map-attribution">
          Base map: OpenStreetMap. NASA EOSDIS GIBS VIIRS Suomi-NPP true-color
          imagery is requested for{" "}
          {imageryDate ?? "the selected month"} when available; the base map
          remains visible if that dated imagery is unavailable. Hotspot markers
          use NASA FIRMS detections. Detections are thermal observations, not
          confirmed fire incidents.
        </p>
        <p className="raw-window">
          <strong>Raw window:</strong>{" "}
          {rawWindow
            ? `${rawWindow.start} to ${rawWindow.end} (UTC)`
            : response
              ? "No raw-window dates available."
              : resource.error
                ? "Unavailable because hotspot data failed to load."
                : "Loading or not selected."}
        </p>
        {response && (
          <div className="map-response-meta" aria-live="polite">
            <span>
              {response.returned.toLocaleString("en-US")} of{" "}
              {response.total.toLocaleString("en-US")} detections shown
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
              Province bubbles are approximate bbox-center summaries, not
              province boundaries. Select a bubble to drill down.
            </p>
          )}
      </div>
    </section>
  );
}
