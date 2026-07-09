import { z } from "zod";

// ---------------------------------------------------------------------------
// Structured, evolving trip preferences.
//
// Every field is optional because the object is filled in progressively over
// the conversation (shallow-merged turn over turn) rather than required up
// front. See lib/agent/nodes/updatePreferences.ts for how it's populated and
// lib/agent/graph.ts for the shallow-merge reducer.
// ---------------------------------------------------------------------------

export const preferencesSchema = z.object({
  origin: z
    .string()
    .optional()
    .describe("Departure city or airport, e.g. 'New York' or 'JFK'."),
  destination: z.string().optional().describe("Destination city, e.g. 'Lisbon'."),
  departureDate: z.string().optional().describe("Outbound date, YYYY-MM-DD."),
  returnDate: z.string().optional().describe("Return date, YYYY-MM-DD."),
  durationDays: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Trip length in days, if exact dates aren't known yet."),
  travelers: z.number().int().min(1).optional().describe("Number of travelers."),
  budgetAmount: z.number().min(1).optional().describe("Total trip budget."),
  budgetCurrency: z
    .string()
    .optional()
    .describe("ISO 4217 currency code for the budget, e.g. 'USD'."),
  interests: z
    .array(z.string())
    .optional()
    .describe("Stated interests to weave into the itinerary, e.g. ['museums', 'good food']."),
  dislikes: z
    .array(z.string())
    .optional()
    .describe("Things to avoid, e.g. ['crowds', 'museums']."),
  cabinClass: z
    .string()
    .optional()
    .describe("Preferred flight cabin class, e.g. 'economy' or 'business'."),
  dietaryConstraints: z
    .array(z.string())
    .optional()
    .describe("Dietary constraints, e.g. ['vegetarian', 'gluten-free']."),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const REQUIRED_FOR_SEARCH_DESCRIPTION =
  "destination, at least an approximate departure date (or trip duration), and a budget";

// ---------------------------------------------------------------------------
// Output schema for the updatePreferences LLM call: the merged preferences
// plus an optional clarifying question when a required field is still
// missing or ambiguous for the next search step.
// ---------------------------------------------------------------------------

export const preferencesUpdateSchema = preferencesSchema.extend({
  clarifyingQuestion: z
    .string()
    .optional()
    .describe(
      `If ${REQUIRED_FOR_SEARCH_DESCRIPTION} is still missing or ambiguous after this ` +
        "update, put a single, concrete clarifying question here to ask the user before " +
        "any search is attempted. Omit this field entirely otherwise.",
    ),
});

export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

/**
 * Shallow-merges a partial preferences update into existing preferences.
 * Keys that are `undefined` in `update` leave the existing value untouched,
 * so the LLM only needs to emit the fields it's confident about.
 */
export function mergePreferences(
  current: Preferences,
  update: Partial<Preferences>,
): Preferences {
  const merged: Preferences = { ...current };
  for (const key of Object.keys(update) as Array<keyof Preferences>) {
    const value = update[key];
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
