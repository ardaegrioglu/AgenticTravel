import { HotelOptionCard } from "@/components/cards/HotelOptionCard";
import type { HotelSearchResult } from "@/lib/types/itinerary";

interface HotelResultsGridProps {
  result: HotelSearchResult;
}

export function HotelResultsGrid({ result }: HotelResultsGridProps) {
  if (result.error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        Hotel search for {result.query.city} failed: {result.error}
      </p>
    );
  }

  if (result.results.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No hotels found in {result.query.city}.
      </p>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {result.results.map((hotel) => (
        <HotelOptionCard key={hotel.id} hotel={hotel} />
      ))}
    </div>
  );
}
