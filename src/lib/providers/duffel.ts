import { env } from "@/lib/env";
import { cacheGet, cacheSet } from "@/lib/cache";
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

  // Skip Duffel entirely while we know the account lacks Stays access, so each
  // search doesn't pay for a doomed round-trip before falling back.
  if (Date.now() >= staysUnavailableUntil) {
    try {
      const { searchStaysLive } = await import("./duffel.live");
      const results = await searchStaysLive(params);
      return { type: "hotels", query, results: results.map((h) => ({ ...h, source: "duffel" as const })) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hotel search failed";
      if (message.includes("403")) staysUnavailableUntil = Date.now() + STAYS_RETRY_MS;
      return fallbackToFoursquareLodging(params, query, message);
    }
  }
  return fallbackToFoursquareLodging(params, query, "Duffel Stays is not enabled for this account");
}

/** Duffel Stays 403s on accounts without access; remember that for a while. */
let staysUnavailableUntil = 0;
const STAYS_RETRY_MS = 10 * 60 * 1000;

// SerpApi's free tier is 250 searches/month, so identical searches are cached
// and a quota/auth failure pauses the tier for a while.
const GOOGLE_CACHE_TTL_S = 6 * 60 * 60;
const GOOGLE_RETRY_MS = 60 * 60 * 1000;
let googleUnavailableUntil = 0;

/** Priced hotels from Google Hotels via SerpApi; null if unavailable or empty. */
async function searchGoogleHotels(params: SearchStaysParams): Promise<HotelOption[] | null> {
  if (!env.SERPAPI_API_KEY || Date.now() < googleUnavailableUntil) return null;

  const key = "hotels:google:" + [params.city, params.checkInDate, params.checkOutDate, params.guests ?? 1]
    .join("|")
    .toLowerCase();
  const cached = await cacheGet<HotelOption[]>(key);
  if (cached) return cached;

  try {
    const { searchGoogleHotelsLive } = await import("./serpapi.live");
    console.log(`[serpapi] google_hotels search: ${key}`);
    const hotels = await searchGoogleHotelsLive(params);
    if (hotels.length === 0) return null;
    await cacheSet(key, hotels, GOOGLE_CACHE_TTL_S);
    return hotels;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    console.warn(`[serpapi] ${message}`);
    if (/\b(401|403|429)\b/.test(message)) googleUnavailableUntil = Date.now() + GOOGLE_RETRY_MS;
    return null;
  }
}

/**
 * Fallbacks when Duffel Stays fails: priced Google Hotels results if a
 * SerpApi key is configured, otherwise Foursquare listings. These have no price
 * or availability, which the UI and prompt handle explicitly. If Foursquare
 * fails too, report the original Duffel error.
 */
async function fallbackToFoursquareLodging(
  params: SearchStaysParams,
  query: HotelSearchResult["query"],
  duffelError: string,
): Promise<HotelSearchResult> {
  const priced = await searchGoogleHotels(params);
  if (priced) return { type: "hotels", query, results: priced };

  try {
    const { searchLodgingLive } = await import("./foursquare.live");
    const places = await searchLodgingLive(params.city);
    return {
      type: "hotels",
      query,
      results: places.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: params.city,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        source: "foursquare" as const,
      })),
    };
  } catch {
    return { type: "hotels", query, results: [], error: duffelError };
  }
}

// ---------------------------------------------------------------------------
// Airport / city code resolution
// ---------------------------------------------------------------------------

const CODE_CACHE_TTL_S = 24 * 60 * 60;

/**
 * Turns "Lisbon" / "New York" / "JFK" into an IATA code. Three-letter inputs
 * pass through. Returns null if the place can't be resolved (callers should
 * skip the flight search rather than send a junk code to Duffel).
 */
export async function resolveAirportCode(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  if (env.MOCK_PROVIDERS) return trimmed.slice(0, 3).toUpperCase();

  const key = `airport:${trimmed.toLowerCase()}`;
  const cachedCode = await cacheGet<string>(key);
  if (cachedCode) return cachedCode;

  try {
    const { resolveAirportCodeLive } = await import("./duffel.live");
    const code = await resolveAirportCodeLive(trimmed);
    if (code) await cacheSet(key, code, CODE_CACHE_TTL_S);
    return code;
  } catch {
    return null;
  }
}
