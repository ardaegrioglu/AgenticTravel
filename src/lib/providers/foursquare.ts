import { env } from "@/lib/env";
import type {
  PlaceCategory,
  PlaceResult,
  PlaceSearchResult,
} from "@/lib/types/itinerary";

export interface SearchPlacesParams {
  city: string;
  category: PlaceCategory;
  limit?: number;
}

const MOCK_PLACES: Record<PlaceCategory, Array<Omit<PlaceResult, "id" | "category">>> = {
  restaurant: [
    {
      name: "Taverna do Bairro",
      address: "Rua das Flores 22",
      rating: 9.1,
      priceLevel: 2,
      distanceMeters: 450,
      description: "Family-run spot known for grilled fish and local wine.",
    },
    {
      name: "Mercado Central Food Hall",
      address: "Praça do Comércio 5",
      rating: 8.6,
      priceLevel: 2,
      distanceMeters: 900,
      description: "Bustling food hall with a dozen local vendors.",
    },
    {
      name: "Casa Nova Bistro",
      address: "Avenida da Liberdade 140",
      rating: 8.9,
      priceLevel: 3,
      distanceMeters: 1200,
      description: "Modern take on traditional regional dishes.",
    },
  ],
  museum: [
    {
      name: "Museum of Modern Art",
      address: "Rua do Museu 10",
      rating: 9.3,
      priceLevel: 2,
      distanceMeters: 700,
      description: "Rotating contemporary exhibits in a converted warehouse.",
    },
    {
      name: "National History Museum",
      address: "Largo do Carmo 3",
      rating: 8.8,
      priceLevel: 1,
      distanceMeters: 1500,
      description: "Permanent collection spanning the region's history.",
    },
  ],
  activity: [
    {
      name: "Old Town Walking Tour",
      address: "Meets at Praça Central",
      rating: 9.0,
      priceLevel: 1,
      distanceMeters: 300,
      description: "Guided 2-hour walking tour through the historic quarter.",
    },
    {
      name: "Riverside Park",
      address: "Marginal do Rio",
      rating: 8.7,
      priceLevel: 1,
      distanceMeters: 1100,
      description: "Large waterfront park with bike rentals and viewpoints.",
    },
  ],
};

function mockPlaces(params: SearchPlacesParams): PlaceResult[] {
  const fixtures = MOCK_PLACES[params.category];
  const limit = params.limit ?? fixtures.length;
  return fixtures.slice(0, limit).map((fixture, i) => ({
    id: `place_mock_${params.category}_${i + 1}`,
    category: params.category,
    ...fixture,
    address: `${fixture.address}, ${params.city}`,
  }));
}

export async function searchPlaces(
  params: SearchPlacesParams,
): Promise<PlaceSearchResult> {
  const query = { city: params.city, category: params.category };

  if (env.MOCK_PROVIDERS) {
    return { type: "places", query, results: mockPlaces(params) };
  }

  try {
    const { searchPlacesLive } = await import("./foursquare.live");
    const results = await searchPlacesLive(params);
    return { type: "places", query, results };
  } catch (err) {
    return {
      type: "places",
      query,
      results: [],
      error: err instanceof Error ? err.message : "Place search failed",
    };
  }
}
