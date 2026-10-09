import { env } from "@/lib/env";
import type { PlaceCategory, PlaceResult } from "@/lib/types/itinerary";
import type { SearchPlacesParams } from "./foursquare";

// Foursquare migrated to the new Places API on May 15, 2026.
// Old: https://api.foursquare.com/v3/places/search (now 410 Gone)
// New: https://places-api.foursquare.com/places/search
// Key changes: fsq_id → fsq_place_id; rating/price/description removed from
// place objects (the new API doesn't expose them); versioning via header.
// `description` is a Premium field: requesting it on the free tier returns 429
// "no API credits remaining", so it is deliberately not requested.
const FOURSQUARE_SEARCH_URL =
  "https://places-api.foursquare.com/places/search";

const FOURSQUARE_API_VERSION = "2025-06-17";

// Foursquare's numeric category taxonomy is easy to get subtly wrong (and
// wrong IDs fail silently with empty results), so we drive category
// filtering via the full-text `query` param instead, which is well-defined
// and doesn't depend on memorized IDs.
const CATEGORY_QUERY: Record<PlaceCategory, string> = {
  restaurant: "restaurant",
  museum: "museum",
  activity: "things to do",
};

interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  location?: {
    address?: string;
    formatted_address?: string;
  };
  distance?: number;
}

interface FoursquareSearchResponse {
  results: FoursquarePlace[];
}

export async function searchPlacesLive(
  params: SearchPlacesParams,
): Promise<PlaceResult[]> {
  const { city, category, limit } = params;

  const url = new URL(FOURSQUARE_SEARCH_URL);
  url.searchParams.set("near", city);
  url.searchParams.set("query", CATEGORY_QUERY[category]);
  url.searchParams.set("limit", String(limit ?? 5));
  url.searchParams.set(
    "fields",
    "fsq_place_id,name,location,distance",
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.FOURSQUARE_API_KEY!}`,
      "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Foursquare place search failed: ${response.status} ${response.statusText} — ${body}`,
    );
  }

  const data = (await response.json()) as FoursquareSearchResponse;

  return data.results.map((place) => ({
    id: place.fsq_place_id,
    name: place.name,
    category,
    address: place.location?.formatted_address ?? place.location?.address ?? city,
    distanceMeters: place.distance,
  }));
}

/**
 * Hotel listings from Foursquare, used when Duffel Stays isn't available.
 * Foursquare's free tier has no price, rating or availability, so these are
 * "places to consider staying", not bookable offers.
 */
export async function searchLodgingLive(
  city: string,
  limit = 5,
): Promise<Array<{ id: string; name: string; address: string; distanceMeters?: number }>> {
  const url = new URL(FOURSQUARE_SEARCH_URL);
  url.searchParams.set("near", city);
  url.searchParams.set("query", "hotel");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "fsq_place_id,name,location,distance");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.FOURSQUARE_API_KEY!}`,
      "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Foursquare lodging search failed: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as FoursquareSearchResponse;
  return data.results.map((place) => ({
    id: place.fsq_place_id,
    name: place.name,
    address: place.location?.formatted_address ?? place.location?.address ?? city,
    distanceMeters: place.distance,
  }));
}
