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

function displayValue(value: string | number | null): string {
  return value === null ? "Not available" : String(value);
}

function popupContent(
  title: string,
  fields: Array<[string, string]>
): HTMLElement {
  const container = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = title;
  container.append(heading);

  const list = document.createElement("dl");
  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    list.append(term, description);
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
    });

    for (const hotspot of hotspots) {
      const marker = L.marker([hotspot.latitude, hotspot.longitude], {
        icon: L.divIcon({
          className: "hotspot-marker-icon",
          html: '<span class="hotspot-marker-dot"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        title: `Satellite detection: ${hotspot.acquisitionDatetime}`,
        bubblingMouseEvents: false,
      });

      marker.bindPopup(
        popupContent("Satellite detection", [
          ["Latitude", hotspot.latitude.toFixed(5)],
          ["Longitude", hotspot.longitude.toFixed(5)],
          ["Acquisition time", formatAcquisitionTime(hotspot.acquisitionDatetime)],
          ["Satellite", hotspot.satellite],
          ["Instrument", hotspot.instrument],
          ["Confidence", displayValue(hotspot.confidence)],
          ["Brightness", displayValue(hotspot.brightness)],
          ["Source product", displayValue(hotspot.sourceProduct)],
        ]),
        { maxWidth: 300 }
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
      const bubble = L.circleMarker([latitude, longitude], {
        radius,
        color: "#143f50",
        weight: 2,
        fillColor: "#368d85",
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

      bubble.bindTooltip(`${child.name}: ${countLabel}`, {
        permanent: true,
        direction: "top",
        className: "province-bubble-label",
      });
      bubble.bindPopup(
        popupContent(child.name, [
          ["Satellite detections", countLabel],
          ["Location", "Approximate center of region bounding box"],
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

  useEffect(() => {
    if (!region) {
      map.setView([12.5, 122], 5);
      return;
    }

    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = region.bbox;
    map.fitBounds(
      [
        [minLatitude, minLongitude],
        [maxLatitude, maxLongitude],
      ],
      {
        padding: [24, 24],
        maxZoom:
          region.level === "country" ? 6 : region.level === "province" ? 9 : 8,
      }
    );
  }, [map, region]);

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
        color: "#bd4e2f",
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
  onSelectRegion: (regionId: string) => void;
  drawRectangle: boolean;
  onRectangleComplete: (bbox: BBox) => void;
}) {
  return (
    <MapContainer
      center={[12.5, 122]}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom={false}
      className="leaflet-map"
      aria-label="Map centered on the Philippines"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <RegionViewport region={selectedRegion} />
      <DetectionLayer hotspots={hotspots} />
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
