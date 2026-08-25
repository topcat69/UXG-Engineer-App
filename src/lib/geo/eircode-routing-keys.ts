/**
 * Approximate centroid (post-town level, not the exact building) for each
 * of Ireland's 139 Eircode routing keys — the first 3 characters of any
 * Eircode, e.g. "D22" in "D22 XH22". Sourced from An Post's published list
 * of routing areas (see
 * https://en.wikipedia.org/wiki/List_of_Eircode_routing_areas_in_Ireland),
 * paired with each post town's approximate coordinates. A routing key can
 * cover a handful of small towns (e.g. A63 spans Greystones, Delgany,
 * Kilcoole...); one representative town's coordinates stand in for the
 * whole key, since a routing key's real-world span is only ever a few km.
 *
 * Exists in place of a live geocoding call for Ireland: this app relied on
 * Nominatim (OpenStreetMap's free public geocoder) for Irish postcodes, but
 * that turned out to be unreliable in production for a server-side caller —
 * see DECISIONS.md's Nominatim-related addenda. A routing key only ever
 * places a pin at post-town accuracy, which is all this app's dashboard map
 * needs — it's plotting "where in the country is the work", not turn-by-
 * turn directions — and a static table can't be rate-limited, blocked, or
 * flaky.
 */
export const EIRCODE_ROUTING_KEY_CENTROIDS: Record<string, { latitude: number; longitude: number }> = {
  A41: { latitude: 53.517, longitude: -6.283 },
  A42: { latitude: 53.583, longitude: -6.417 },
  A45: { latitude: 53.567, longitude: -6.367 },
  A63: { latitude: 53.144, longitude: -6.067 },
  A67: { latitude: 52.981, longitude: -6.044 },
  A75: { latitude: 54.117, longitude: -6.733 },
  A81: { latitude: 53.975, longitude: -6.717 },
  A82: { latitude: 53.726, longitude: -6.876 },
  A83: { latitude: 53.45, longitude: -6.783 },
  A84: { latitude: 53.508, longitude: -6.407 },
  A85: { latitude: 53.508, longitude: -6.5 },
  A86: { latitude: 53.417, longitude: -6.483 },
  A91: { latitude: 54.0, longitude: -6.417 },
  A92: { latitude: 53.719, longitude: -6.348 },
  A94: { latitude: 53.294, longitude: -6.178 },
  A96: { latitude: 53.283, longitude: -6.117 },
  A98: { latitude: 53.203, longitude: -6.112 },
  C15: { latitude: 53.653, longitude: -6.682 },
  D01: { latitude: 53.3498, longitude: -6.2603 },
  D02: { latitude: 53.338, longitude: -6.2591 },
  D03: { latitude: 53.3661, longitude: -6.2078 },
  D04: { latitude: 53.3298, longitude: -6.2286 },
  D05: { latitude: 53.3838, longitude: -6.2108 },
  D06: { latitude: 53.3239, longitude: -6.2653 },
  D6W: { latitude: 53.3096, longitude: -6.2825 },
  D07: { latitude: 53.362, longitude: -6.2789 },
  D08: { latitude: 53.3417, longitude: -6.2986 },
  D09: { latitude: 53.3775, longitude: -6.2569 },
  D10: { latitude: 53.3419, longitude: -6.3583 },
  D11: { latitude: 53.3889, longitude: -6.3011 },
  D12: { latitude: 53.3195, longitude: -6.3193 },
  D13: { latitude: 53.3966, longitude: -6.1319 },
  D14: { latitude: 53.2938, longitude: -6.256 },
  D15: { latitude: 53.3866, longitude: -6.3778 },
  D16: { latitude: 53.2809, longitude: -6.2622 },
  D17: { latitude: 53.39, longitude: -6.205 },
  D18: { latitude: 53.2732, longitude: -6.2019 },
  D20: { latitude: 53.355, longitude: -6.395 },
  D22: { latitude: 53.3225, longitude: -6.3939 },
  D24: { latitude: 53.286, longitude: -6.372 },
  E21: { latitude: 52.374, longitude: -7.922 },
  E25: { latitude: 52.517, longitude: -7.883 },
  E32: { latitude: 52.347, longitude: -7.413 },
  E34: { latitude: 52.475, longitude: -8.158 },
  E41: { latitude: 52.683, longitude: -7.8 },
  E45: { latitude: 52.862, longitude: -8.198 },
  E53: { latitude: 52.95, longitude: -7.783 },
  E91: { latitude: 52.355, longitude: -7.7 },
  F12: { latitude: 53.717, longitude: -9.0 },
  F23: { latitude: 53.857, longitude: -9.299 },
  F26: { latitude: 54.115, longitude: -9.157 },
  F28: { latitude: 53.803, longitude: -9.52 },
  F31: { latitude: 53.628, longitude: -9.221 },
  F35: { latitude: 53.767, longitude: -8.767 },
  F42: { latitude: 53.633, longitude: -8.183 },
  F45: { latitude: 53.758, longitude: -8.492 },
  F52: { latitude: 53.972, longitude: -8.299 },
  F56: { latitude: 54.083, longitude: -8.517 },
  F91: { latitude: 54.27, longitude: -8.469 },
  F92: { latitude: 54.95, longitude: -7.733 },
  F93: { latitude: 54.833, longitude: -7.483 },
  F94: { latitude: 54.653, longitude: -8.11 },
  H12: { latitude: 53.991, longitude: -7.361 },
  H14: { latitude: 54.1, longitude: -7.433 },
  H16: { latitude: 54.067, longitude: -7.083 },
  H18: { latitude: 54.249, longitude: -6.968 },
  H23: { latitude: 54.183, longitude: -7.233 },
  H53: { latitude: 53.331, longitude: -8.221 },
  H54: { latitude: 53.517, longitude: -8.85 },
  H62: { latitude: 53.195, longitude: -8.569 },
  H65: { latitude: 53.299, longitude: -8.744 },
  H71: { latitude: 53.489, longitude: -10.02 },
  H91: { latitude: 53.271, longitude: -9.057 },
  K32: { latitude: 53.611, longitude: -6.182 },
  K34: { latitude: 53.578, longitude: -6.112 },
  K36: { latitude: 53.451, longitude: -6.152 },
  K45: { latitude: 53.526, longitude: -6.167 },
  K56: { latitude: 53.524, longitude: -6.096 },
  K67: { latitude: 53.46, longitude: -6.218 },
  K78: { latitude: 53.357, longitude: -6.447 },
  N37: { latitude: 53.424, longitude: -7.941 },
  N39: { latitude: 53.728, longitude: -7.796 },
  N41: { latitude: 53.946, longitude: -8.09 },
  N91: { latitude: 53.526, longitude: -7.339 },
  P12: { latitude: 51.9, longitude: -8.967 },
  P14: { latitude: 51.85, longitude: -8.817 },
  P17: { latitude: 51.707, longitude: -8.523 },
  P24: { latitude: 51.85, longitude: -8.294 },
  P25: { latitude: 51.917, longitude: -8.167 },
  P31: { latitude: 51.888, longitude: -8.598 },
  P32: { latitude: 51.983, longitude: -8.733 },
  P36: { latitude: 51.95, longitude: -7.85 },
  P43: { latitude: 51.817, longitude: -8.383 },
  P47: { latitude: 51.717, longitude: -9.117 },
  P51: { latitude: 52.133, longitude: -8.65 },
  P56: { latitude: 52.356, longitude: -8.674 },
  P61: { latitude: 52.139, longitude: -8.273 },
  P67: { latitude: 52.267, longitude: -8.267 },
  P72: { latitude: 51.75, longitude: -8.733 },
  P75: { latitude: 51.683, longitude: -9.45 },
  P81: { latitude: 51.55, longitude: -9.267 },
  P85: { latitude: 51.622, longitude: -8.87 },
  R14: { latitude: 52.992, longitude: -6.989 },
  R21: { latitude: 52.697, longitude: -6.971 },
  R32: { latitude: 53.033, longitude: -7.3 },
  R35: { latitude: 53.274, longitude: -7.493 },
  R42: { latitude: 53.096, longitude: -7.909 },
  R45: { latitude: 53.344, longitude: -7.05 },
  R51: { latitude: 53.158, longitude: -6.911 },
  R56: { latitude: 53.15, longitude: -6.817 },
  R93: { latitude: 52.837, longitude: -6.934 },
  R95: { latitude: 52.654, longitude: -7.245 },
  T12: { latitude: 51.899, longitude: -8.476 },
  T23: { latitude: 51.91, longitude: -8.465 },
  T34: { latitude: 51.967, longitude: -8.65 },
  T45: { latitude: 51.897, longitude: -8.339 },
  T56: { latitude: 52.0, longitude: -8.35 },
  V14: { latitude: 52.717, longitude: -8.867 },
  V15: { latitude: 52.639, longitude: -9.484 },
  V23: { latitude: 51.948, longitude: -10.233 },
  V31: { latitude: 52.45, longitude: -9.483 },
  V35: { latitude: 52.4, longitude: -8.583 },
  V42: { latitude: 52.45, longitude: -9.05 },
  V92: { latitude: 52.27, longitude: -9.703 },
  V93: { latitude: 52.06, longitude: -9.504 },
  V94: { latitude: 52.664, longitude: -8.627 },
  V95: { latitude: 52.844, longitude: -8.986 },
  W12: { latitude: 53.183, longitude: -6.8 },
  W23: { latitude: 53.381, longitude: -6.593 },
  W34: { latitude: 53.138, longitude: -7.059 },
  W91: { latitude: 53.217, longitude: -6.667 },
  X35: { latitude: 52.089, longitude: -7.622 },
  X42: { latitude: 52.2, longitude: -7.417 },
  X91: { latitude: 52.259, longitude: -7.11 },
  Y14: { latitude: 52.794, longitude: -6.15 },
  Y21: { latitude: 52.503, longitude: -6.568 },
  Y25: { latitude: 52.674, longitude: -6.295 },
  Y34: { latitude: 52.396, longitude: -6.944 },
  Y35: { latitude: 52.337, longitude: -6.463 },
};

/**
 * A routing key is always the first 3 characters of an Eircode (letter,
 * digit, digit-or-letter — e.g. "D01", "T12", "D6W") — checked structurally
 * before the table lookup so a mistyped or unrelated string (this only ever
 * runs after postcodes.io has already failed to place it in the UK) can't
 * accidentally match a real routing key's letter+digit pattern by
 * coincidence and produce a wrong-country pin.
 */
const ROUTING_KEY_PATTERN = /^[A-Z]\d[A-Z0-9]/;

export function centroidForRoutingKey(postcode: string): { latitude: number; longitude: number } | null {
  const key = postcode.trim().toUpperCase().replace(/\s+/g, "").slice(0, 3);
  if (!ROUTING_KEY_PATTERN.test(key)) return null;
  return EIRCODE_ROUTING_KEY_CENTROIDS[key] ?? null;
}
