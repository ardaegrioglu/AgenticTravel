import { env } from "@/lib/env";
import type { HotelOption } from "@/lib/types/itinerary";
import type { SearchStaysParams } from "./duffel";

const SERPAPI_URL = "https://serpapi.com/search.json";

// Subset of SerpApi's google_hotels response we read. Field names come from
// SerpApi's documented schema; every field is treated as optional because the
// payload varies by property (verify against a live response when changing).
interface SerpApiProperty {
  name?: string;
  /** "hotel" or "vacation rental" */
  type?: string;
  description?: string;
  overall_rating?: number;
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
  property_token?: string;
  images?: Array<{ thumbnail?: string }>;
}

interface SerpApiHotelsResponse {
  properties?: SerpApiProperty[];
  error?: string;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Hotel prices scraped from Google Hotels by SerpApi. Prices are Google's
 * displayed estimates (cheapest provider), not bookable offers.
 */
export async function searchGoogleHotelsLive(params: SearchStaysParams): Promise<HotelOption[]> {
  const { city, checkInDate, checkOutDate, guests } = params;

  const url = new URL(SERPAPI_URL);
  url.searchParams.set("engine", "google_hotels");
  url.searchParams.set("q", `${city} hotels`);
  url.searchParams.set("check_in_date", checkInDate);
  url.searchParams.set("check_out_date", checkOutDate);
  url.searchParams.set("adults", String(guests ?? 1));
  url.searchParams.set("currency", "USD");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", env.SERPAPI_API_KEY!);

  const response = await fetch(url);
  const data = (await response.json().catch(() => ({}))) as SerpApiHotelsResponse;
  if (!response.ok || data.error) {
    // Never include the request URL: it contains the API key.
    throw new Error(`SerpApi ${response.status}: ${data.error ?? response.statusText}`);
  }

  const nights = nightsBetween(checkInDate, checkOutDate);
  const options: HotelOption[] = [];

  // Google mixes in vacation rentals; list actual hotels first.
  const properties = [...(data.properties ?? [])].sort(
    (a, b) => Number(b.type === "hotel") - Number(a.type === "hotel"),
  );

  for (const p of properties) {
    if (!p.name) continue;
    const total =
      p.total_rate?.extracted_lowest ??
      (p.rate_per_night?.extracted_lowest != null
        ? p.rate_per_night.extracted_lowest * nights
        : undefined);

    options.push({
      id: p.property_token ?? `serp_${options.length}_${p.name}`,
      name: p.name,
      rating:
        p.overall_rating != null ? Math.min(5, Math.max(0, p.overall_rating)) : undefined,
      address: p.description ?? city,
      city,
      checkInDate,
      checkOutDate,
      totalAmount: total != null ? total.toFixed(2) : undefined,
      totalCurrency: total != null ? "USD" : undefined,
      thumbnailUrl: p.images?.[0]?.thumbnail,
      source: "google",
    });
    if (options.length === 5) break;
  }

  return options;
}
