import { getCacheRaw, setCacheRaw } from "@/lib/cache";
import { CACHE_PREFIX, CACHE_TTL, IP_API_BASE } from "../constants";
import type { GeoLocation } from "../types";

function cacheKey(...parts: string[]): string {
  return `${CACHE_PREFIX}${parts.join(":")}`;
}

interface IpApiResponse {
  status: "success" | "fail";
  message?: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
}

export async function detectLocation(ip?: string): Promise<GeoLocation> {
  const key = cacheKey("geo", ip ?? "self");
  const cached = await getCacheRaw<GeoLocation>(key);
  if (cached) return cached;

  const url = ip ? `${IP_API_BASE}/${ip}` : IP_API_BASE;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Geolocation API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as IpApiResponse;

  if (data.status === "fail") {
    throw new Error(
      `Geolocation lookup failed: ${data.message ?? "unknown error"}`,
    );
  }

  const location: GeoLocation = {
    country: data.country,
    countryCode: data.countryCode,
    region: data.regionName,
    city: data.city,
    lat: data.lat,
    lon: data.lon,
    timezone: data.timezone,
  };

  await setCacheRaw(key, location, CACHE_TTL);
  return location;
}
