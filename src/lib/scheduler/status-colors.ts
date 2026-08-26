// Pure status -> color-bucket mapping for the scheduler board's job
// cards — no Leaflet/DOM involved, so it's independently testable, same
// convention as map-markers.ts. Deliberately its own, finer-grained
// bucketing rather than reusing map-markers.ts's 3-category one: a
// day-planning board benefits from telling "on hold" and "cancelled"
// apart from a plain "scheduled" card, which the map's coarser
// on_site/completed/other split doesn't need to.

export type StatusColorBucket = "draft" | "provisional" | "upcoming" | "active" | "review" | "done" | "hold" | "cancelled";

const STATUS_BUCKETS: Record<string, StatusColorBucket> = {
  draft: "draft",
  provisional: "provisional",
  scheduled: "upcoming",
  dispatched: "upcoming",
  accepted: "upcoming",
  travelling: "active",
  on_site: "active",
  in_progress: "active",
  submitted: "review",
  under_review: "review",
  approved: "done",
  closed: "done",
  on_hold: "hold",
  cancelled: "cancelled",
};

/** Falls back to "upcoming" for any status not explicitly listed — a scheduled-looking card is the safest default for an unrecognised value, rather than defaulting to an alarming color. */
export function statusColorBucket(status: string): StatusColorBucket {
  return STATUS_BUCKETS[status] ?? "upcoming";
}

/** Light background + left accent border per bucket, so status reads at a glance without opening the card. */
export const STATUS_COLOR_CLASSES: Record<StatusColorBucket, string> = {
  draft: "bg-gray-50 border-l-gray-400",
  provisional: "bg-pink-50 border-l-pink-500",
  upcoming: "bg-blue-50 border-l-blue-500",
  active: "bg-orange-50 border-l-orange-500",
  review: "bg-purple-50 border-l-purple-500",
  done: "bg-green-50 border-l-green-500",
  hold: "bg-yellow-50 border-l-yellow-500",
  cancelled: "bg-red-50 border-l-red-500",
};

/**
 * Solid-color dot classes for the legend — a separate literal map rather
 * than deriving these from STATUS_COLOR_CLASSES at runtime (e.g. string-
 * replacing "border-l-" with "bg-"): Tailwind's build-time scanner only
 * generates CSS for class names it finds as literal strings in source, so
 * a class assembled at runtime that never appears literally anywhere
 * would silently render with no styling at all.
 */
export const STATUS_SWATCH_CLASSES: Record<StatusColorBucket, string> = {
  draft: "bg-gray-400",
  provisional: "bg-pink-500",
  upcoming: "bg-blue-500",
  active: "bg-orange-500",
  review: "bg-purple-500",
  done: "bg-green-500",
  hold: "bg-yellow-500",
  cancelled: "bg-red-500",
};
