import { PlaceCard } from "@/components/cards/PlaceCard";
import type { PlaceSearchResult } from "@/lib/types/itinerary";

interface PlaceResultsGridProps {
  result: PlaceSearchResult;
}

export function PlaceResultsGrid({ result }: PlaceResultsGridProps) {
  if (result.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {result.query.category} search in {result.query.city} failed: {result.error}
      </p>
    );
  }

  if (result.results.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No {result.query.category} results found in {result.query.city}.
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {result.results.map((place) => (
        <PlaceCard key={place.id} place={place} />
      ))}
    </div>
  );
}
