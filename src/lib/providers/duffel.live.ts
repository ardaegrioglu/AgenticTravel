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

export async function searchStaysLive(
  params: SearchStaysParams,
): Promise<HotelOption[]> {
  const { city, checkInDate, checkOutDate, guests } = params;
  const duffel = getClient();

  const suggestions = await duffel.suggestions.list({ name: city });
  const place =
    suggestions.data.find((p) => p.type === "city" && p.latitude != null) ??
    suggestions.data.find((p) => p.latitude != null);

  if (!place || place.latitude == null || place.longitude == null) {
    throw new Error(`Could not resolve a location for "${city}".`);
  }

  const guestCount = guests ?? 1;

  const response = await duffel.stays.search({
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    rooms: 1,
    guests: Array.from({ length: guestCount }, () => ({ type: "adult" as const })),
    location: {
      radius: 15,
      geographic_coordinates: { latitude: place.latitude, longitude: place.longitude },
    },
  });

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
