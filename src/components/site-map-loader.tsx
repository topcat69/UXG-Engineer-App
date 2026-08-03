"use client";

import dynamic from "next/dynamic";

// react-leaflet touches `window` at import time, so it can't be part of the
// server render — load it only in the browser.
const SiteMap = dynamic(() => import("./site-map"), {
  ssr: false,
  loading: () => <div className="bg-muted h-[240px] w-full animate-pulse rounded-lg" />,
});

export default SiteMap;
