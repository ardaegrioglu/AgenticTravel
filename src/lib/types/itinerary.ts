import { z } from "zod";

// ---------------------------------------------------------------------------
// Flights
// ---------------------------------------------------------------------------

export const flightSegmentSchema = z.object({
  origin: z.string().describe("IATA airport code, e.g. LIS"),
  destination: z.string().describe("IATA airport code, e.g. JFK"),
  departingAt: z.string().describe("ISO 8601 local departure datetime"),
  arrivingAt: z.string().describe("ISO 8601 local arrival datetime"),
  carrierName: z.string(),
  carrierCode: z.string(),
  flightNumber: z.string(),
  durationMinutes: z.number().int().nonnegative(),
});
export type FlightSegment = z.infer<typeof flightSegmentSchema>;

export const flightSliceSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  durationMinutes: z.number().int().nonnegative(),
  segments: z.array(flightSegmentSchema).min(1),
});
export type FlightSlice = z.infer<typeof flightSliceSchema>;

export const flightOptionSchema = z.object({
  id: z.string(),
  slices: z.array(flightSliceSchema).min(1),
  stops: z.number().int().nonnegative(),
  totalAmount: z.string().describe("Decimal string, e.g. '412.50'"),
  totalCurrency: z.string().describe("ISO 4217 currency code, e.g. USD"),
  cabinClass: z.string().optional(),
});
export type FlightOption = z.infer<typeof flightOptionSchema>;

// ---------------------------------------------------------------------------
// Hotels / Stays
// ---------------------------------------------------------------------------

export const hotelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number().min(0).max(5).optional(),
  address: z.string(),
  city: z.string(),
  checkInDate: z.string().describe("YYYY-MM-DD"),
  checkOutDate: z.string().describe("YYYY-MM-DD"),
  totalAmount: z
    .string()
    .optional()
    .describe("Decimal string, e.g. '340.00'. Absent when the source has no pricing."),
  totalCurrency: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  source: z
    .enum(["duffel", "google", "foursquare"])
    .optional()
    .describe(
      "Where the listing came from. Google prices are estimates; Foursquare listings carry no price or availability.",
    ),
});
export type HotelOption = z.infer<typeof hotelOptionSchema>;

// ---------------------------------------------------------------------------
// Places (restaurants / museums / activities)
// ---------------------------------------------------------------------------

export const placeCategorySchema = z.enum(["restaurant", "museum", "activity"]);
export type PlaceCategory = z.infer<typeof placeCategorySchema>;

export const placeResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: placeCategorySchema,
  address: z.string(),
  rating: z.number().min(0).max(10).optional(),
  priceLevel: z.number().int().min(1).max(4).optional(),
  distanceMeters: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});
export type PlaceResult = z.infer<typeof placeResultSchema>;

// ---------------------------------------------------------------------------
// Tool result envelopes
//
// Each search tool returns one of these (JSON-stringified) as its output.
// The streamBridge parses tool outputs back into these shapes to emit as
// typed AI SDK data parts so the UI can render cards instead of raw text.
// ---------------------------------------------------------------------------

export const flightSearchResultSchema = z.object({
  type: z.literal("flights"),
  query: z.object({
    origin: z.string(),
    destination: z.string(),
    departureDate: z.string(),
    returnDate: z.string().optional(),
  }),
  results: z.array(flightOptionSchema),
  error: z.string().optional(),
});
export type FlightSearchResult = z.infer<typeof flightSearchResultSchema>;

export const hotelSearchResultSchema = z.object({
  type: z.literal("hotels"),
  query: z.object({
    city: z.string(),
    checkInDate: z.string(),
    checkOutDate: z.string(),
  }),
  results: z.array(hotelOptionSchema),
  error: z.string().optional(),
});
export type HotelSearchResult = z.infer<typeof hotelSearchResultSchema>;

export const placeSearchResultSchema = z.object({
  type: z.literal("places"),
  query: z.object({
    city: z.string(),
    category: placeCategorySchema,
  }),
  results: z.array(placeResultSchema),
  error: z.string().optional(),
});
export type PlaceSearchResult = z.infer<typeof placeSearchResultSchema>;

export const searchResultSchema = z.discriminatedUnion("type", [
  flightSearchResultSchema,
  hotelSearchResultSchema,
  placeSearchResultSchema,
]);
export type SearchResult = z.infer<typeof searchResultSchema>;
