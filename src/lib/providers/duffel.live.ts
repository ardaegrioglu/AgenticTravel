import type { FlightOption, HotelOption } from "@/lib/types/itinerary";
import type { SearchFlightOffersParams, SearchStaysParams } from "./duffel";

export async function searchFlightOffersLive(
  _params: SearchFlightOffersParams,
): Promise<FlightOption[]> {
  throw new Error("Live Duffel flight search is not implemented yet.");
}

export async function searchStaysLive(
  _params: SearchStaysParams,
): Promise<HotelOption[]> {
  throw new Error("Live Duffel stays search is not implemented yet.");
}
