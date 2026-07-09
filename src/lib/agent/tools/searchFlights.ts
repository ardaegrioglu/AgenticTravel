import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchFlightOffers } from "@/lib/providers/duffel";

const schema = z.object({
  origin: z
    .string()
    .describe("IATA airport or city code of the departure location, e.g. 'JFK' or 'NYC'."),
  destination: z
    .string()
    .describe("IATA airport or city code of the arrival location, e.g. 'LIS'."),
  departureDate: z
    .string()
    .describe("Outbound departure date in YYYY-MM-DD format."),
  returnDate: z
    .string()
    .optional()
    .describe(
      "Return departure date in YYYY-MM-DD format, for round trips. Omit for one-way.",
    ),
  passengers: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of adult passengers. Defaults to 1."),
  cabinClass: z
    .string()
    .optional()
    .describe("Cabin class, e.g. 'economy', 'premium_economy', 'business', 'first'."),
});

export const searchFlightsTool = tool(
  async (input) => {
    const result = await searchFlightOffers(input);
    return JSON.stringify(result);
  },
  {
    name: "search_flights",
    description:
      "Search real flight offers between two locations for given dates. " +
      "Use this whenever the user's trip has a known origin, destination, and at least a " +
      "departure date — do not guess dates or airports if they are missing; ask the user " +
      "instead. Returns a JSON object with a `results` array of flight options (carrier, " +
      "stops, duration, total price). Only reference flights that actually appear in the " +
      "returned `results` when talking to the user — never invent flight numbers, times, or " +
      "prices.",
    schema,
  },
);
