"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, Marker, InfoWindow, useMap, useApiIsLoaded } from "@vis.gl/react-google-maps";
import Link from "next/link";
import { humanize } from "@/lib/format/text";
import type { JobMapMarker, MapCategory } from "@/lib/dashboard/map-markers";

// Distinct colored dots per category rather than one default pin — the
// whole point of a "where are the jobs" map is reading status at a glance
// without opening every marker. Same hex values as dashboard-client.tsx's
// legend, and previously jobs-map.tsx's Leaflet divIcon colors.
const CATEGORY_COLORS: Record<MapCategory, string> = {
  on_site: "#FF7A00",
  scheduled: "#2563eb",
  revisit: "#0d9488",
  provisional: "#db2777",
};

function iconFor(category: MapCategory): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: CATEGORY_COLORS[category],
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

/** Fits the view to every marker on mount and whenever the marker set changes — a live-updating map is only actually useful if new/moved jobs stay in frame without a manual re-pan. */
function FitBounds({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]!);
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

function JobsMapInner({ markers }: { markers: JobMapMarker[] }) {
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);
  // The Google Maps script loads asynchronously, after this component's
  // first render — building a marker icon references the `google` global
  // (google.maps.SymbolPath), which doesn't exist yet on that first pass.
  // Gate marker rendering on the API actually being loaded rather than
  // crashing the whole tree with a ReferenceError; markers pop in a beat
  // after the base map, same as any other async-script-dependent widget.
  const apiIsLoaded = useApiIsLoaded();
  const points = markers.map((m) => ({ lat: m.latitude, lng: m.longitude }));
  // UK-centred fallback view for the empty-state case (no jobs with site
  // coordinates yet) — this app's stated userbase, per DECISIONS.md.
  const fallbackCenter = { lat: 54.5, lng: -3 };
  const openMarker = markers.find((m) => m.id === openMarkerId) ?? null;

  return (
    <Map
      defaultCenter={points[0] ?? fallbackCenter}
      defaultZoom={6}
      style={{ height: 420, width: "100%", borderRadius: "0.5rem" }}
      gestureHandling="greedy"
      disableDefaultUI={false}
    >
      <FitBounds points={points} />
      {apiIsLoaded &&
        markers.map((m) => (
          <Marker
            key={m.id}
            position={{ lat: m.latitude, lng: m.longitude }}
            icon={iconFor(m.category)}
            onClick={() => setOpenMarkerId(m.id)}
          />
        ))}
      {openMarker && (
        <InfoWindow
          position={{ lat: openMarker.latitude, lng: openMarker.longitude }}
          onCloseClick={() => setOpenMarkerId(null)}
        >
          <div className="flex flex-col gap-1 text-sm">
            <Link href={`/office/jobs/${openMarker.id}`} className="font-medium underline">
              {openMarker.jobNumber}
            </Link>
            <span>{openMarker.siteName}</span>
            <span className="text-muted-foreground">
              {humanize(openMarker.status)}
              {openMarker.assignedName ? ` · ${openMarker.assignedName}` : ""}
            </span>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}

export default function JobsMap({ markers }: { markers: JobMapMarker[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="bg-muted flex h-[420px] w-full items-center justify-center rounded-lg p-4 text-center">
        <p className="text-muted-foreground text-sm">
          Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <JobsMapInner markers={markers} />
    </APIProvider>
  );
}
