import { env } from "@/lib/env";
import type {
  FlightOption,
  FlightSearchResult,
  HotelOption,
  HotelSearchResult,
} from "@/lib/types/itinerary";

// ---------------------------------------------------------------------------
// Flights
// ---------------------------------------------------------------------------

export interface SearchFlightOffersParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: string;
}

function mockFlightOffers(params: SearchFlightOffersParams): FlightOption[] {
  const { origin, destination, departureDate } = params;
  const durationMinutes = 435;
  const arrival = new Date(`${departureDate}T09:15:00`);
  arrival.setMinutes(arrival.getMinutes() + durationMinutes);

  const makeOption = (
    id: string,
    carrierName: string,
    carrierCode: string,
    flightNumber: string,
    amount: string,
    stops: number,
  ): FlightOption => ({
    id,
    stops,
    totalAmount: amount,
    totalCurrency: "USD",
    cabinClass: params.cabinClass ?? "economy",
    slices: [
      {
        origin,
        destination,
        durationMinutes,
        segments: [
          {
            origin,
            destination,
            departingAt: `${departureDate}T09:15:00`,
            arrivingAt: arrival.toISOString(),
            carrierName,
            carrierCode,
            flightNumber,
            durationMinutes,
          },
        ],
      },
    ],
  });

  return [
    makeOption("off_mock_1", "United Airlines", "UA", "UA912", "412.50", 0),
    makeOption("off_mock_2", "Delta Air Lines", "DL", "DL118", "358.20", 0),
    makeOption("off_mock_3", "Air France", "AF", "AF442", "289.99", 1),
  ];
}

export async function searchFlightOffers(
  params: SearchFlightOffersParams,
): Promise<FlightSearchResult> {
  const query = {
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
  };

  if (env.MOCK_PROVIDERS) {
    return { type: "flights", query, results: mockFlightOffers(params) };
  }

  try {
    const { searchFlightOffersLive } = await import("./duffel.live");
    const results = await searchFlightOffersLive(params);
    return { type: "flights", query, results };
  } catch (err) {
    return {
      type: "flights",
      query,
      results: [],
      error: err instanceof Error ? err.message : "Flight search failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Hotels / Stays
// ---------------------------------------------------------------------------

export interface SearchStaysParams {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  guests?: number;
}

function mockStays(params: SearchStaysParams): HotelOption[] {
  const { city, checkInDate, checkOutDate } = params;

  return [
    {
      id: "acc_mock_1",
      name: `${city} Grand Hotel`,
      rating: 4.5,
      address: `12 Central Ave, ${city}`,
      city,
      checkInDate,
      checkOutDate,
      totalAmount: "340.00",
      totalCurrency: "USD",
    },
    {
      id: "acc_mock_2",
      name: `${city} Boutique Stay`,
      rating: 4.2,
      address: `88 Old Town Sq, ${city}`,
      city,
      checkInDate,
      checkOutDate,
      totalAmount: "255.50",
      totalCurrency: "USD",
    },
    {
      id: "acc_mock_3",
      name: `${city} Budget Inn`,
      rating: 3.6,
      address: `4 Station Rd, ${city}`,
      city,
      checkInDate,
      checkOutDate,
      totalAmount: "148.00",
      totalCurrency: "USD",
    },
  ];
}

export async function searchStays(
  params: SearchStaysParams,
): Promise<HotelSearchResult> {
  const query = {
    city: params.city,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
  };

  if (env.MOCK_PROVIDERS) {
    return { type: "hotels", query, results: mockStays(params) };
  }

  try {
    const { searchStaysLive } = await import("./duffel.live");
    const results = await searchStaysLive(params);
    return { type: "hotels", query, results };
  } catch (err) {
    return {
      type: "hotels",
      query,
      results: [],
      error: err instanceof Error ? err.message : "Hotel search failed",
    };
  }
}
