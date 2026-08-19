"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { humanize } from "@/lib/format/text";
import type { JobMapMarker, MapCategory } from "@/lib/dashboard/map-markers";

// Distinct colored dots per category rather than Leaflet's single default
// pin icon — the whole point of a "where are the jobs" map is reading
// status at a glance without opening every popup. Orange matches the
// dashboard's own chart color (dashboard-client.tsx's CHART_COLOR).
const CATEGORY_COLORS: Record<MapCategory, string> = {
  on_site: "#F3941D",
  completed: "#16a34a",
  other: "#6b7280",
};

function iconFor(category: MapCategory): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${CATEGORY_COLORS[category]};border:2px solid white;box-shadow:0 0 3px rgba(0,0,0,0.6)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Fits the view to every marker on mount and whenever the marker set changes — a live-updating map is only actually useful if new/moved jobs stay in frame without a manual re-pan. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0]!, 13);
    } else {
      map.fitBounds(points, { padding: [30, 30] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

export default function JobsMap({ markers }: { markers: JobMapMarker[] }) {
  const points: [number, number][] = markers.map((m) => [m.latitude, m.longitude]);
  // UK-centred fallback view for the empty-state case (no jobs with site
  // coordinates yet) — this app's stated userbase, per DECISIONS.md.
  const fallbackCenter: [number, number] = [54.5, -3];

  return (
    <MapContainer
      center={points[0] ?? fallbackCenter}
      zoom={6}
      style={{ height: 420, width: "100%", borderRadius: "0.5rem" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.latitude, m.longitude]} icon={iconFor(m.category)}>
          <Popup>
            <div className="flex flex-col gap-1 text-sm">
              <Link href={`/office/jobs/${m.id}`} className="font-medium underline">
                {m.jobNumber}
              </Link>
              <span>{m.siteName}</span>
              <span className="text-muted-foreground">
                {humanize(m.status)}
                {m.assignedName ? ` · ${m.assignedName}` : ""}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
