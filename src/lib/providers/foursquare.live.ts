import type { PlaceResult } from "@/lib/types/itinerary";
import type { SearchPlacesParams } from "./foursquare";

export async function searchPlacesLive(
  _params: SearchPlacesParams,
): Promise<PlaceResult[]> {
  throw new Error("Live Foursquare place search is not implemented yet.");
}
