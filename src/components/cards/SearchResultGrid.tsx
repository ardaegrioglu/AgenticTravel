import { FlightResultsGrid } from "@/components/cards/FlightResultsGrid";
import { HotelResultsGrid } from "@/components/cards/HotelResultsGrid";
import { PlaceResultsGrid } from "@/components/cards/PlaceResultsGrid";
import type { SearchResult } from "@/lib/types/itinerary";

interface SearchResultGridProps {
  result: SearchResult;
}

/** Dispatches a tool's search result envelope to its matching results grid. */
export function SearchResultGrid({ result }: SearchResultGridProps) {
  switch (result.type) {
    case "flights":
      return <FlightResultsGrid result={result} />;
    case "hotels":
      return <HotelResultsGrid result={result} />;
    case "places":
      return <PlaceResultsGrid result={result} />;
    default:
      return null;
  }
}
