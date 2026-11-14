"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type {
  BBox,
  ChildCount,
  Hotspot,
  Region,
} from "@/contracts/types";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

const TRANSPARENT_TILE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

type ActivityBand = "low" | "moderate" | "high" | "very-high";
type BubbleBand = ActivityBand | "no-data";

const BUBBLE_COLORS: Record<BubbleBand, { stroke: string; fill: string }> = {
  low: { stroke: "#ea580c", fill: "#fb923c" },
  moderate: { stroke: "#c2410c", fill: "#f97316" },
  high: { stroke: "#9a3412", fill: "#ea580c" },
  "very-high": { stroke: "#991b1b", fill: "#ef4444" },
  "no-data": { stroke: "#475569", fill: "#64748b" },
};

function getHotspotBand(hotspot: Hotspot): ActivityBand {
  const brightness = hotspot.brightness;
  const confidence = hotspot.confidence;
  const normalizedConfidence =
    typeof confidence === "string" ? confidence.trim().toLowerCase() : null;
  const numericConfidence =
    typeof confidence === "number"
      ? confidence
      : normalizedConfidence !== null && normalizedConfidence !== ""
        ? Number(normalizedConfidence)
        : Number.NaN;

  const isHighConfidence =
    normalizedConfidence === "high" ||
    normalizedConfidence === "h" ||
    (!Number.isNaN(numericConfidence) && numericConfidence >= 80);

  if (isHighConfidence || (brightness !== null && brightness >= 330)) {
    return "very-high";
  }
  if (
    (brightness !== null && brightness >= 315) ||
    (!Number.isNaN(numericConfidence) && numericConfidence >= 65)
  ) {
    return "high";
  }
  if (
    (brightness !== null && brightness >= 300) ||
    normalizedConfidence === "nominal" ||
    normalizedConfidence === "n" ||
    (!Number.isNaN(numericConfidence) && numericConfidence >= 40)
  ) {
    return "moderate";
  }
  return "low";
}

function getActivityBand(count: number, maxCount: number): ActivityBand {
  const relativeCount = maxCount > 0 ? count / maxCount : 0;
  if (relativeCount < 0.25) return "low";
  if (relativeCount < 0.5) return "moderate";
  if (relativeCount < 0.75) return "high";
  return "very-high";
}

function getClusterBand(count: number): ActivityBand {
  if (count >= 100) return "very-high";
  if (count >= 50) return "high";
  if (count >= 10) return "moderate";
  return "low";
}

function displayValue(value: string | number | null): string {
  return value === null ? "Not available" : String(value);
}

const WIDE_POPUP_LABELS = new Set([
  "Acquisition time",
  "Acquisition time (UTC)",
  "CDRRMO guidance",
]);

function popupContent(
  title: string,
  fields: Array<[string, string]>
): HTMLElement {
  const container = document.createElement("div");
  container.className = "detection-popup";
  const heading = document.createElement("h3");
  heading.className = "detection-popup-title";
  heading.textContent = title;
  container.append(heading);

  const list = document.createElement("dl");
  list.className = "detection-popup-grid";
  for (const [label, value] of fields) {
    const field = document.createElement("div");
    field.className = "detection-popup-field";
    if (WIDE_POPUP_LABELS.has(label)) {
      field.classList.add("detection-popup-field--wide");
    }

    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    field.append(term, description);
    list.append(field);
  }
  container.append(list);
  return container;
}

function formatAcquisitionTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(timestamp)} UTC`;
}

function DetectionLayer({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 20,
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const band = getClusterBand(count);
        const size =
          count >= 100 ? 54 : count >= 50 ? 48 : count >= 10 ? 42 : 36;

        return L.divIcon({
          className: `telemetry-cluster telemetry-cluster--${band}`,
          html: `<span>${count.toLocaleString("en-US")}</span>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    for (const hotspot of hotspots) {
      const band = getHotspotBand(hotspot);
      const bandColors = BUBBLE_COLORS[band];
      const sensorResolution =
        hotspot.instrument === "VIIRS"
          ? "375 m grid (VIIRS high-detail)"
          : "1 km grid (MODIS wide-area)";
      const brightnessLabel =
        hotspot.brightness === null
          ? "Not available"
          : `${hotspot.brightness} K`;

      const marker = L.marker([hotspot.latitude, hotspot.longitude], {
        icon: L.divIcon({
          className: "hotspot-marker-icon",
          html: `<span class="hotspot-marker-dot hotspot-marker-dot--${band}" style="background: var(--hotspot-${band}, ${bandColors.fill}); border-color: ${bandColors.stroke};"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        title: `Thermal Hotspot Detection (${hotspot.instrument}): ${hotspot.acquisitionDatetime}`,
        bubblingMouseEvents: false,
      });

      marker.bindPopup(
        popupContent("Thermal Hotspot Detection", [
          ["Latitude", hotspot.latitude.toFixed(5)],
          ["Longitude", hotspot.longitude.toFixed(5)],
          ["Satellite", hotspot.satellite],
          ["Instrument", hotspot.instrument],
          [
            "Acquisition time (UTC)",
            formatAcquisitionTime(hotspot.acquisitionDatetime),
          ],
          ["Sensor Resolution", sensorResolution],
          ["Confidence", displayValue(hotspot.confidence)],
          ["Fire Radiative / Brightness Temp", brightnessLabel],
          ["Source product", displayValue(hotspot.sourceProduct)],
        ]),
        { maxWidth: 440 }
      );
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event.originalEvent);
      });
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [hotspots, map]);

  return null;
}

const FOOTPRINT_MIN_ZOOM = 10;

function getFootprintRadius(hotspot: Hotspot): number {
  return hotspot.instrument === "VIIRS" ? 375 : 1_000;
}

function HotspotFootprintLayer({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.layerGroup();

    const renderFootprints = () => {
      layer.clearLayers();
      if (map.getZoom() < FOOTPRINT_MIN_ZOOM) {
        return;
      }

      const bounds = map.getBounds().pad(0.25);

      for (const hotspot of hotspots) {
        if (!bounds.contains([hotspot.latitude, hotspot.longitude])) {
          continue;
        }
        const isViirs = hotspot.instrument === "VIIRS";
        const radius = getFootprintRadius(hotspot);
        const footprint = L.circle([hotspot.latitude, hotspot.longitude], {
          radius,
          color: isViirs ? "#ea580c" : "#f97316",
          fillColor: isViirs ? "#ef4444" : "#fb923c",
          dashArray: isViirs ? undefined : "4 4",
          fillOpacity: 0.14,
          weight: 1.5,
          bubblingMouseEvents: false,
        });

        footprint.bindTooltip(
          `${hotspot.instrument} sensor resolution (~${radius} m radius — satellite scan area, not confirmed burn perimeter)`,
          { direction: "top", opacity: 0.9 }
        );
        layer.addLayer(footprint);
      }
    };

    map.addLayer(layer);
    renderFootprints();
    map.on("zoomend", renderFootprints);
    map.on("moveend", renderFootprints);

    return () => {
      map.off("zoomend", renderFootprints);
      map.off("moveend", renderFootprints);
      map.removeLayer(layer);
    };
  }, [hotspots, map]);

  return null;
}

function ChildBubbleLayer({
  childCounts,
  regions,
  onSelectRegion,
}: {
  childCounts: ChildCount[];
  regions: Region[];
  onSelectRegion: (regionId: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const layer = L.layerGroup();
    const maxCount = childCounts.reduce(
      (max, child) => Math.max(max, child.count ?? 0),
      0
    );

    for (const child of childCounts) {
      const region = regions.find((candidate) => candidate.id === child.regionId);
      if (!region) {
        continue;
      }

      const [minLongitude, minLatitude, maxLongitude, maxLatitude] =
        region.bbox;
      const latitude = (minLatitude + maxLatitude) / 2;
      const longitude = (minLongitude + maxLongitude) / 2;
      const radius =
        child.count === null || maxCount === 0
          ? 9
          : 8 + Math.sqrt(child.count / maxCount) * 9;
      const countLabel =
        child.count === null
          ? "No data"
          : `${child.count.toLocaleString("en-US")} detections`;
      const band =
        child.count === null
          ? "no-data"
          : getActivityBand(child.count, maxCount);
      const colors = BUBBLE_COLORS[band];
      const bubble = L.circleMarker([latitude, longitude], {
        radius,
        color: colors.stroke,
        weight: 2,
        fillColor: colors.fill,
        fillOpacity: 0.78,
        bubblingMouseEvents: false,
      });
      bubble.on("add", () => {
        const path = bubble.getElement();
        if (!path) {
          return;
        }

        const activateOnKeyDown: EventListener = (event) => {
          if (
            event instanceof KeyboardEvent &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            onSelectRegion(child.regionId);
          }
        };
        const activateOnClick = () => onSelectRegion(child.regionId);
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute(
          "aria-label",
          `${child.name}: ${countLabel}. Select province.`
        );
        path.addEventListener("click", activateOnClick);
        path.addEventListener("keydown", activateOnKeyDown);
        bubble.once("remove", () => {
          path.removeEventListener("click", activateOnClick);
          path.removeEventListener("keydown", activateOnKeyDown);
        });
      });

      const activityLabel =
        band === "very-high"
          ? "Very high relative activity"
          : band === "high"
            ? "High relative activity"
            : band === "moderate"
              ? "Moderate relative activity"
              : band === "low"
                ? "Low relative activity"
                : "No data coverage";

      bubble.bindTooltip(`${child.name}: ${countLabel}`, {
        direction: "top",
        className: "province-bubble-label",
      });
      bubble.bindPopup(
        popupContent(`${child.name} — Province Hotspot Summary`, [
          ["Thermal Hotspot Detections", countLabel],
          ["Relative Activity Level", activityLabel],
          ["Marker Placement", "Approximate province bounding-box center"],
          ["CDRRMO Drill-Down", "Select bubble to inspect province hotspots"],
        ])
      );
      bubble.on("click", () => onSelectRegion(child.regionId));
      layer.addLayer(bubble);
    }

    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [childCounts, map, onSelectRegion, regions]);

  return null;
}

function RegionViewport({ region }: { region: Region | null }) {
  const map = useMap();
  const regionId = region?.id ?? null;
  const bboxWest = region?.bbox[0] ?? null;
  const bboxSouth = region?.bbox[1] ?? null;
  const bboxEast = region?.bbox[2] ?? null;
  const bboxNorth = region?.bbox[3] ?? null;
  const regionLevel = region?.level ?? null;

  useEffect(() => {
    const container = map.getContainer();
    const handleResize = () => {
      map.invalidateSize({ animate: false });
    };
    handleResize();
    const timer = window.setTimeout(handleResize, 60);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handleResize);
      observer.observe(container);
    }
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (
      !regionId ||
      bboxWest === null ||
      bboxSouth === null ||
      bboxEast === null ||
      bboxNorth === null
    ) {
      map.setView([12.5, 122], 5, { animate: false });
      return;
    }

    map.fitBounds(
      [
        [bboxSouth, bboxWest],
        [bboxNorth, bboxEast],
      ],
      {
        padding: [24, 24],
        maxZoom:
          regionLevel === "country" ? 6 : regionLevel === "province" ? 9 : 8,
        animate: false,
      }
    );
  }, [map, regionId, bboxWest, bboxSouth, bboxEast, bboxNorth, regionLevel]);

  return null;
}

function RectangleDrawControl({
  enabled,
  onComplete,
}: {
  enabled: boolean;
  onComplete: (bbox: BBox) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const container = map.getContainer();
    const previousCursor = container.style.cursor;
    let start: L.LatLng | null = null;
    let rectangle: L.Rectangle | null = null;
    container.style.cursor = "crosshair";
    map.dragging.disable();

    const onMouseDown = (event: L.LeafletMouseEvent) => {
      const target = event.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest(".leaflet-control-container, .leaflet-popup")
      ) {
        return;
      }
      if ("button" in event.originalEvent && event.originalEvent.button !== 0) {
        return;
      }
      start = event.latlng;
      rectangle = L.rectangle(L.latLngBounds(start, start), {
        color: "#f97316",
        weight: 2,
        dashArray: "6 4",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    };

    const onMouseMove = (event: L.LeafletMouseEvent) => {
      if (start && rectangle) {
        rectangle.setBounds(L.latLngBounds(start, event.latlng));
      }
    };

    const onMouseUp = () => {
      if (!start || !rectangle) {
        return;
      }
      const bounds = rectangle.getBounds();
      const bbox: BBox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      rectangle.remove();
      rectangle = null;
      start = null;
      onComplete(bbox);
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      rectangle?.remove();
      map.dragging.enable();
      container.style.cursor = previousCursor;
    };
  }, [enabled, map, onComplete]);

  return null;
}

export default function LeafletCanvas({
  hotspots,
  selectedRegion,
  childCounts,
  regions,
  onSelectRegion,
  drawRectangle,
  onRectangleComplete,
}: {
  hotspots: Hotspot[];
  selectedRegion: Region | null;
  childCounts: ChildCount[];
  regions: Region[];
  imageryDate?: string | null;
  useFirmsWms?: boolean;
  firmsWmsLayer?: string;
  onSelectRegion: (regionId: string) => void;
  drawRectangle: boolean;
  onRectangleComplete: (bbox: BBox) => void;
}) {
  return (
    <MapContainer
      center={[12.8, 121.8]}
      zoom={6}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom={true}
      worldCopyJump={true}
      zoomAnimation={true}
      fadeAnimation={true}
      className="leaflet-map"
      aria-label="Cloud-free Philippine thermal hotspot monitoring map"
    >
      <TileLayer
        key="carto-voyager-underlay"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        minZoom={4}
        maxZoom={18}
        maxNativeZoom={18}
        keepBuffer={4}
        errorTileUrl={TRANSPARENT_TILE_DATA_URI}
      />
      <TileLayer
        key="esri-world-imagery-land"
        attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        minZoom={4}
        maxZoom={18}
        maxNativeZoom={13}
        keepBuffer={4}
        errorTileUrl={TRANSPARENT_TILE_DATA_URI}
      />
      <TileLayer
        key="esri-reference-boundaries-labels"
        attribution="Boundaries &amp; Labels &copy; Esri"
        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        minZoom={4}
        maxZoom={18}
        maxNativeZoom={13}
        keepBuffer={4}
        opacity={0.88}
        errorTileUrl={TRANSPARENT_TILE_DATA_URI}
      />
      <RegionViewport region={selectedRegion} />
      <DetectionLayer hotspots={hotspots} />
      <HotspotFootprintLayer hotspots={hotspots} />
      <ChildBubbleLayer
        childCounts={childCounts}
        regions={regions}
        onSelectRegion={onSelectRegion}
      />
      <RectangleDrawControl
        enabled={drawRectangle}
        onComplete={onRectangleComplete}
      />
    </MapContainer>
  );
}
