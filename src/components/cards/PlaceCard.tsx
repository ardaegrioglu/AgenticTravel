import type { PlaceResult } from "@/lib/types/itinerary";

const CATEGORY_LABEL: Record<PlaceResult["category"], string> = {
  restaurant: "Restaurant",
  museum: "Museum",
  activity: "Activity",
};

interface PlaceCardProps {
  place: PlaceResult;
}

export function PlaceCard({ place }: PlaceCardProps) {
  return (
    <div className="min-w-56 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{place.name}</span>
        {place.rating != null ? (
          <span className="whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
            ★ {place.rating.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{CATEGORY_LABEL[place.category]}</span>
        {place.priceLevel != null ? <span>{"$".repeat(place.priceLevel)}</span> : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{place.address}</p>
      {place.description ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{place.description}</p>
      ) : null}
    </div>
  );
}
