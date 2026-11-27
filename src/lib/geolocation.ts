import { normalizeCity } from "./city-location";
import { publicProviderJson, record, type FetchJson } from "./public-provider";
export type CityLocation = {
  city: string;
  region: string;
  country: string;
  source: "OpenStreetMap";
};
export function validCoordinates(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}
export function parseGeocodedCity(value: unknown): CityLocation | null {
  const data = record(value),
    address = record(data.address);
  // Do not mistake a county/state for a city when no settlement was returned.
  const city = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.hamlet,
  ]
    .map(normalizeCity)
    .find(Boolean);
  if (!city) return null;
  return {
    city,
    region: normalizeCity(address.state),
    country: normalizeCity(address.country),
    source: "OpenStreetMap",
  };
}
export async function reverseGeocode(
  lat: number,
  lon: number,
  get: FetchJson = publicProviderJson,
): Promise<CityLocation | null> {
  if (!validCoordinates(lat, lon)) throw new Error("Invalid coordinates");
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  // City-level lookup: discard extra precision before transmission. Never persist coordinates.
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    zoom: "10",
    addressdetails: "1",
    "accept-language": "ru",
  }).toString();
  return parseGeocodedCity(await get(url.href));
}
