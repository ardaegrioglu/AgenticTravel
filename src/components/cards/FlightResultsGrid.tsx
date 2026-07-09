import { FlightOptionCard } from "@/components/cards/FlightOptionCard";
import type { FlightSearchResult } from "@/lib/types/itinerary";

interface FlightResultsGridProps {
  result: FlightSearchResult;
}

export function FlightResultsGrid({ result }: FlightResultsGridProps) {
  if (result.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        Flight search for {result.query.origin} → {result.query.destination} failed:{" "}
        {result.error}
      </p>
    );
  }

  if (result.results.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No flights found for {result.query.origin} → {result.query.destination}.
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {result.results.map((flight) => (
        <FlightOptionCard key={flight.id} flight={flight} />
      ))}
    </div>
  );
}
