import type { Preferences } from "@/lib/agent/preferencesSchema";
import type { SearchResult } from "@/lib/types/itinerary";

/**
 * Builds the agent's system prompt as a function of the current structured
 * preferences state (not the raw transcript), so tool-use reasoning is
 * grounded in what's actually been compounded across turns.
 *
 * When `preFetchedResults` is non-empty, the prompt includes a summary of
 * those pre-fetched searches and instructs the agent not to redundantly
 * re-call tools for queries already covered — it should synthesize from
 * what's already in context.
 */
export function buildSystemPrompt(
  preferences: Preferences,
  preFetchedResults: SearchResult[],
): string {
  const preFetchedSection = preFetchedResults.length > 0
    ? `\n\nPre-fetched search results already in context (from speculative search this turn). ` +
      `You MUST reference these by name when discussing options — do NOT re-call a search ` +
      `tool for a query already covered below:\n${summarizeResults(preFetchedResults)}\n`
    : "";

  return `You are AgenticTravel, a conversational trip-planning assistant. You help the user
plan (not book) a vacation by searching real flights, hotels, and restaurants/museums/
activities, then proposing a day-by-day itinerary.

Known trip preferences so far (JSON, may be partial):
${JSON.stringify(preferences, null, 2)}
${preFetchedSection}
Tools available: search_flights, search_hotels, search_places.

Rules:
- Call search_flights only once origin, destination, and at least a departure date are
  known. Call search_hotels only once destination and at least a check-in date are known.
  Call search_places once destination is known — call it once per category (restaurant,
  museum, activity) relevant to the user's stated interests.
- Never invent flight numbers, carriers, hotel names, prices, or place names. Only
  reference options that actually appear in a tool's returned \`results\` or in the
  pre-fetched results above. If a tool returns an \`error\` or empty \`results\`, say so
  plainly instead of making something up.
- Only write the final day-by-day itinerary after you have called the relevant search
  tools for this turn (or already have their results from earlier in the conversation
  or from pre-fetched results). The itinerary must respect the stated budget and reference
  actual returned flights, hotels, and places by name.
- Keep responses focused on the trip. If the user asks about booking or checkout, remind
  them this is a search-and-plan assistant only — no bookings are made.`;
}

/**
 * Renders pre-fetched results as compact text the model can quote from. Only
 * the most recent search per kind (flights / hotels / places-per-category) is
 * included, so results from superseded dates or destinations don't leak into
 * the itinerary.
 */
function summarizeResults(results: SearchResult[]): string {
  const latest = new Map<string, SearchResult>();
  for (const r of results) {
    latest.set(r.type === "places" ? `places:${r.query.category}` : r.type, r);
  }

  return [...latest.values()].map(formatResult).join("\n\n");
}

function formatResult(r: SearchResult): string {
  if (r.error) return `${heading(r)}\n  ERROR: ${r.error}`;
  if (r.results.length === 0) return `${heading(r)}\n  (no results)`;

  switch (r.type) {
    case "flights":
      return [
        heading(r),
        ...r.results.map((f) => {
          const legs = f.slices
            .map((s) => {
              const first = s.segments[0];
              const last = s.segments[s.segments.length - 1];
              const carriers = [...new Set(s.segments.map((g) => g.carrierName))].join("/");
              return `${s.origin}→${s.destination} ${first.departingAt} – ${last.arrivingAt} (${carriers}, ${s.durationMinutes} min)`;
            })
            .join("; ");
          return `  - ${f.totalCurrency} ${f.totalAmount}, ${f.stops} stop(s): ${legs}`;
        }),
      ].join("\n");
    case "hotels":
      return [
        heading(r),
        ...r.results.map(
          (h) =>
            `  - ${h.name}${h.rating ? ` (${h.rating}★)` : ""}, ${h.address}: ` +
            (h.totalAmount
              ? `${h.totalCurrency} ${h.totalAmount} total` +
                (h.source === "google" ? " (Google Hotels estimate, not a bookable rate)" : "")
              : "price and availability unknown (do not estimate a price)"),
        ),
      ].join("\n");
    case "places":
      return [
        heading(r),
        ...r.results.map(
          (pl) =>
            `  - ${pl.name}, ${pl.address}${pl.description ? ` — ${pl.description}` : ""}`,
        ),
      ].join("\n");
  }
}

function heading(r: SearchResult): string {
  switch (r.type) {
    case "flights":
      return `Flights ${r.query.origin} → ${r.query.destination} on ${r.query.departureDate}` +
        (r.query.returnDate ? ` (return ${r.query.returnDate})` : "") + ":";
    case "hotels":
      return `Hotels in ${r.query.city} (${r.query.checkInDate} → ${r.query.checkOutDate}):`;
    case "places":
      return `${r.query.category} places in ${r.query.city}:`;
  }
}
