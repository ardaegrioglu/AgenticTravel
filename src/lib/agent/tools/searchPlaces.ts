import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchPlaces } from "@/lib/providers/foursquare";
import { placeCategorySchema } from "@/lib/types/itinerary";

const schema = z.object({
  city: z.string().describe("City to search for places in, e.g. 'Lisbon'."),
  category: placeCategorySchema.describe(
    "One of 'restaurant', 'museum', or 'activity'. Call this tool once per category " +
      "that's relevant to the user's stated interests.",
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Max number of results to return. Defaults to a small curated set."),
});

export const searchPlacesTool = tool(
  async (input) => {
    const result = await searchPlaces(input);
    return JSON.stringify(result);
  },
  {
    name: "search_places",
    description:
      "Search real restaurants, museums, or activities in a city, matched to the user's " +
      "stated interests. Use this once the destination city is known — call it once per " +
      "relevant category (e.g. call with category='restaurant' and again with " +
      "category='museum' if the user cares about both). Returns a JSON object with a " +
      "`results` array of places (name, address, rating, price level). Only reference " +
      "places that actually appear in the returned `results` when talking to the user — " +
      "never invent restaurant, museum, or activity names.",
    schema,
  },
);
