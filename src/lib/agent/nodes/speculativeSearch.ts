import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import type { RunnableConfig } from "@langchain/core/runnables";
import { resolveAirportCode, searchFlightOffers, searchStays } from "@/lib/providers/duffel";
import { searchPlaces } from "@/lib/providers/foursquare";
import type { Preferences } from "@/lib/agent/preferencesSchema";
import type { PlaceCategory, SearchResult } from "@/lib/types/itinerary";

export interface SpeculativeSearchState {
  preferences: Preferences;
  preFetchedResults: SearchResult[];
}

/** Upper bound per provider call so one slow API can't stall the whole turn. */
const SEARCH_TIMEOUT_MS = 15_000;

interface PendingSearch {
  run: () => Promise<SearchResult>;
  /** Result substituted if `run` rejects or times out. */
  fallback: SearchResult;
}

/**
 * Fires all applicable searches in parallel based on mature preferences.
 *
 * Runs after `updatePreferences` and before the ReAct agent node. When the
 * preferences already cover what's needed (destination + dates), it kicks off
 * every relevant search speculatively so the agent can synthesize an answer
 * without a tool-call round-trip.
 *
 * Returns ONLY the results fetched this turn: the `preFetchedResults` reducer
 * appends, so returning the existing list would duplicate it every turn.
 * Searches whose query already appears in `preFetchedResults` are skipped.
 */
export async function speculativeSearch(
  state: SpeculativeSearchState,
  config?: RunnableConfig,
): Promise<{ preFetchedResults: SearchResult[] }> {
  const { preferences: p, preFetchedResults: existing } = state;
  const pending: PendingSearch[] = [];

  // --- Flights -------------------------------------------------------------
  // Needs origin, destination, and a departure date. Duffel wants IATA codes,
  // but preferences hold free-form names, so resolve them first.
  if (p.origin && p.destination && p.departureDate) {
    const [origin, destination] = await Promise.all([
      resolveAirportCode(p.origin),
      resolveAirportCode(p.destination),
    ]);
    if (origin && destination) {
      const query = {
        origin,
        destination,
        departureDate: p.departureDate,
        returnDate: p.returnDate,
      };
      if (!hasResult(existing, "flights", query)) {
        pending.push({
          run: () =>
            searchFlightOffers({
              ...query,
              passengers: p.travelers,
              cabinClass: p.cabinClass,
            }),
          fallback: { type: "flights", query, results: [], error: "Flight search timed out" },
        });
      }
    }
  }

  // --- Hotels --------------------------------------------------------------
  // Needs a city + check-in/check-out dates. Check-in/check-out are derived
  // from the trip's departure/return dates when not stated separately.
  if (p.destination && p.departureDate) {
    const checkInDate = p.departureDate;
    const checkOutDate =
      p.returnDate ?? addDays(checkInDate, p.durationDays ?? 3);
    const query = { city: p.destination, checkInDate, checkOutDate };
    if (!hasResult(existing, "hotels", query)) {
      pending.push({
        run: () => searchStays({ ...query, guests: p.travelers }),
        fallback: { type: "hotels", query, results: [], error: "Hotel search timed out" },
      });
    }
  }

  // --- Places --------------------------------------------------------------
  // Needs a city. Fire once per category, chosen from stated interests or
  // all three categories as a fallback.
  if (p.destination) {
    for (const category of deriveCategories(p.interests)) {
      const query = { city: p.destination, category };
      if (!hasResult(existing, "places", query)) {
        pending.push({
          run: () => searchPlaces(query),
          fallback: { type: "places", query, results: [], error: "Place search timed out" },
        });
      }
    }
  }

  // Emit each result the moment its search settles (not after the slowest one)
  // so the UI can render cards incrementally; the stream bridge forwards the
  // "searchResult" custom events. The node still returns the full list for
  // state, which the agent needs before it can synthesize.
  const fetched = await Promise.all(
    pending.map(async ({ run, fallback }) => {
      const result = await withTimeout(run(), SEARCH_TIMEOUT_MS, fallback);
      await dispatchCustomEvent("searchResult", result, config).catch(() => {});
      return result;
    }),
  );
  return { preFetchedResults: fetched };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasResult(
  existing: SearchResult[],
  type: SearchResult["type"],
  query: Record<string, unknown>,
): boolean {
  return existing.some((result) => {
    if (result.type !== type) return false;
    const resultQuery = result.query as Record<string, unknown>;
    return Object.keys(query).every(
      (k) => resultQuery[k] === query[k],
    );
  });
}

/** UTC arithmetic so the result doesn't drift with the server's timezone. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Resolves to `fallback` if `promise` rejects or takes longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise.catch(() => fallback), timeout]).finally(() =>
    clearTimeout(timer),
  );
}

const INTEREST_TO_CATEGORY: Record<string, PlaceCategory[]> = {
  food: ["restaurant"],
  restaurant: ["restaurant"],
  restaurants: ["restaurant"],
  dining: ["restaurant"],
  museum: ["museum"],
  museums: ["museum"],
  culture: ["museum", "activity"],
  history: ["museum"],
  art: ["museum"],
  activity: ["activity"],
  activities: ["activity"],
  outdoor: ["activity"],
  nature: ["activity"],
  tour: ["activity"],
  tours: ["activity"],
  sightseeing: ["activity", "museum"],
  walking: ["activity"],
};

/**
 * Maps stated interests onto place categories. Falls back to all three
 * categories when nothing maps, so the agent always has something to work
 * with.
 */
function deriveCategories(interests?: string[]): PlaceCategory[] {
  if (!interests || interests.length === 0) {
    return ["restaurant", "museum", "activity"];
  }
  const cats = new Set<PlaceCategory>();
  for (const interest of interests) {
    // Substring match so phrases like "good restaurants" or "street food" hit.
    const text = interest.toLowerCase();
    for (const [keyword, mapped] of Object.entries(INTEREST_TO_CATEGORY)) {
      if (text.includes(keyword)) mapped.forEach((c) => cats.add(c));
    }
  }
  return cats.size > 0 ? [...cats] : ["restaurant", "museum", "activity"];
}
