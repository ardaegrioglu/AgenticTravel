import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchStays } from "@/lib/providers/duffel";

const schema = z.object({
  city: z.string().describe("City to search for hotels/stays in, e.g. 'Lisbon'."),
  checkInDate: z.string().describe("Check-in date in YYYY-MM-DD format."),
  checkOutDate: z.string().describe("Check-out date in YYYY-MM-DD format."),
  guests: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of guests. Defaults to 1."),
});

export const searchHotelsTool = tool(
  async (input) => {
    const result = await searchStays(input);
    return JSON.stringify(result);
  },
  {
    name: "search_hotels",
    description:
      "Search real hotel/stay offers in a city for given check-in and check-out dates. " +
      "Use this whenever the user's trip has a known destination city and at least a " +
      "check-in date — do not guess the city or dates if they are missing; ask the user " +
      "instead. Returns a JSON object with a `results` array of hotel options (name, " +
      "rating, address, total price). Only reference hotels that actually appear in the " +
      "returned `results` when talking to the user — never invent hotel names or prices.",
    schema,
  },
);
