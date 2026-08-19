/**
 * Geocodes a UK postcode via postcodes.io — free, no API key, no rate-limit
 * hassle for this app's scale. Used as the fallback when live GPS isn't
 * available (most commonly: the site is served over plain HTTP, and the
 * Geolocation API refuses to run at all outside a secure context,
 * regardless of the device's own location permission — see DECISIONS.md).
 */
export async function geocodePostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
    if (!response.ok) return null;
    const body = await response.json();
    if (body?.status !== 200 || typeof body?.result?.latitude !== "number" || typeof body?.result?.longitude !== "number") {
      return null;
    }
    return { latitude: body.result.latitude, longitude: body.result.longitude };
  } catch {
    return null;
  }
}
