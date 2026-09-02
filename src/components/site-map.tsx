"use client";

import { useState } from "react";
import { APIProvider, InfoWindow, Map, Marker } from "@vis.gl/react-google-maps";

export default function SiteMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const position = { lat: latitude, lng: longitude };

  if (!apiKey) {
    return (
      <div className="bg-muted flex h-[240px] w-full items-center justify-center rounded-lg p-4 text-center">
        <p className="text-muted-foreground text-sm">
          Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={position}
        defaultZoom={15}
        style={{ height: 240, width: "100%", borderRadius: "0.5rem" }}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <Marker position={position} onClick={() => setOpen(true)} />
        {open && (
          <InfoWindow position={position} onCloseClick={() => setOpen(false)}>
            {label}
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
