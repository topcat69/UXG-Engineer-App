"use client";

import dynamic from "next/dynamic";

// @vis.gl/react-google-maps loads the Google Maps JS script and touches
// `window` at import time, so it can't be part of the server render — load
// it only in the browser (same pattern as site-map-loader.tsx).
const JobsMap = dynamic(() => import("./jobs-map"), {
  ssr: false,
  loading: () => <div className="bg-muted h-[420px] w-full animate-pulse rounded-lg" />,
});

export default JobsMap;
