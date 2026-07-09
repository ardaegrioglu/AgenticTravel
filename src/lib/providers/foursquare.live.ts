import { env } from "@/lib/env";
import type { PlaceCategory, PlaceResult } from "@/lib/types/itinerary";
import type { SearchPlacesParams } from "./foursquare";

const FOURSQUARE_SEARCH_URL = "https://api.foursquare.com/v3/places/search";

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
  fsq_id: string;
  name: string;
  location?: {
    address?: string;
    formatted_address?: string;
  };
  rating?: number;
  price?: number;
  distance?: number;
  description?: string;
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
    "fsq_id,name,location,rating,price,distance,description",
  );

  const response = await fetch(url, {
    headers: {
      Authorization: env.FOURSQUARE_API_KEY!,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Foursquare place search failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as FoursquareSearchResponse;

  return data.results.map((place) => ({
    id: place.fsq_id,
    name: place.name,
    category,
    address: place.location?.formatted_address ?? place.location?.address ?? city,
    rating: place.rating,
    priceLevel: place.price,
    distanceMeters: place.distance,
    description: place.description,
  }));
}
