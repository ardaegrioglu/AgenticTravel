import { Duffel } from "@duffel/api";
import { env } from "@/lib/env";
import type { FlightOption, HotelOption } from "@/lib/types/itinerary";
import type { SearchFlightOffersParams, SearchStaysParams } from "./duffel";

let client: Duffel | null = null;

function getClient(): Duffel {
  if (!client) {
    client = new Duffel({ token: env.DUFFEL_API_KEY! });
  }
  return client;
}

/** Parses an ISO 8601 duration (e.g. "PT7H45M") into whole minutes. */
function parseIsoDurationToMinutes(duration: string | null): number {
  if (!duration) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}

export async function searchFlightOffersLive(
  params: SearchFlightOffersParams,
): Promise<FlightOption[]> {
  const { origin, destination, departureDate, returnDate, passengers, cabinClass } = params;
  const duffel = getClient();

  const slices = [
    {
      origin,
      destination,
      departure_date: departureDate,
      arrival_time: null,
      departure_time: null,
    },
  ];
  if (returnDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: returnDate,
      arrival_time: null,
      departure_time: null,
    });
  }

  const passengerCount = passengers ?? 1;

  const response = await duffel.offerRequests.create({
    slices,
    passengers: Array.from({ length: passengerCount }, () => ({ type: "adult" as const })),
    cabin_class: cabinClass as
      | "economy"
      | "premium_economy"
      | "business"
      | "first"
      | undefined,
    return_offers: true,
  });

  const offers = "offers" in response.data ? response.data.offers : [];

  return offers.slice(0, 5).map((offer) => ({
    id: offer.id,
    stops: Math.max(0, (offer.slices[0]?.segments.length ?? 1) - 1),
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    cabinClass,
    slices: offer.slices.map((slice) => ({
      origin: slice.origin.iata_code ?? origin,
      destination: slice.destination.iata_code ?? destination,
      durationMinutes: parseIsoDurationToMinutes(slice.duration),
      segments: slice.segments.map((segment) => ({
        origin: segment.origin.iata_code ?? origin,
        destination: segment.destination.iata_code ?? destination,
        departingAt: segment.departing_at,
        arrivingAt: segment.arriving_at,
        carrierName: segment.marketing_carrier.name,
        carrierCode: segment.marketing_carrier.iata_code ?? "",
        flightNumber: segment.marketing_carrier_flight_number,
        durationMinutes: parseIsoDurationToMinutes(segment.duration),
      })),
    })),
  }));
}

const DUFFEL_API = "https://api.duffel.com";

/** Native-fetch Duffel call that surfaces the API's real error message. */
async function duffelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DUFFEL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.DUFFEL_API_KEY!}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { errors?: Array<{ message?: string }> };
      message = parsed.errors?.[0]?.message ?? message;
    } catch {
      // body wasn't JSON (e.g. a plain-text 403); keep the raw text
    }
    throw new Error(`Duffel ${response.status}: ${message}`);
  }
  return JSON.parse(text) as T;
}

interface DuffelStayResult {
  cheapest_rate_total_amount: string;
  cheapest_rate_currency: string;
  accommodation: {
    id: string;
    name: string;
    ratings?: Array<{ value: number }> | null;
    photos?: Array<{ url: string }> | null;
    location: { address: { line_one?: string; city_name?: string } };
  };
}

export async function searchStaysLive(
  params: SearchStaysParams,
): Promise<HotelOption[]> {
  const { city, checkInDate, checkOutDate, guests } = params;

  const suggestions = await duffelFetch<{
    data: Array<{ type: string; latitude: number | null; longitude: number | null }>;
  }>(`/places/suggestions?query=${encodeURIComponent(city)}`);
  const place =
    suggestions.data.find((p) => p.type === "city" && p.latitude != null) ??
    suggestions.data.find((p) => p.latitude != null);

  if (!place || place.latitude == null || place.longitude == null) {
    throw new Error(`Could not resolve a location for "${city}".`);
  }

  const response = await duffelFetch<{ data: { results: DuffelStayResult[] } }>(
    "/stays/search",
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          rooms: 1,
          guests: Array.from({ length: guests ?? 1 }, () => ({ type: "adult" })),
          location: {
            radius: 15,
            geographic_coordinates: { latitude: place.latitude, longitude: place.longitude },
          },
        },
      }),
    },
  );

  return response.data.results.slice(0, 5).map((result) => ({
    id: result.accommodation.id,
    name: result.accommodation.name,
    rating: result.accommodation.ratings?.[0]?.value,
    address: [
      result.accommodation.location.address.line_one,
      result.accommodation.location.address.city_name,
    ]
      .filter(Boolean)
      .join(", "),
    city,
    checkInDate,
    checkOutDate,
    totalAmount: result.cheapest_rate_total_amount,
    totalCurrency: result.cheapest_rate_currency,
    thumbnailUrl: result.accommodation.photos?.[0]?.url,
  }));
}

/**
 * Resolves a free-form place name ("New York", "Lisbon") to an IATA code via
 * Duffel's place suggestions. Uses native fetch (see handoff.md re: the SDK
 * under Turbopack). Prefers city codes so metro areas (NYC, LON) cover every
 * airport.
 */
export async function resolveAirportCodeLive(name: string): Promise<string | null> {
  const url = new URL("https://api.duffel.com/places/suggestions");
  url.searchParams.set("query", name);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.DUFFEL_API_KEY!}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Duffel place lookup failed: ${response.status} ${response.statusText}`);
  }
  const { data } = (await response.json()) as {
    data: Array<{ type: string; iata_code?: string | null; iata_city_code?: string | null }>;
  };
  const city = data.find((p) => p.type === "city" && p.iata_code);
  if (city?.iata_code) return city.iata_code;
  const airport = data.find((p) => p.iata_code);
  return airport?.iata_city_code ?? airport?.iata_code ?? null;
}
