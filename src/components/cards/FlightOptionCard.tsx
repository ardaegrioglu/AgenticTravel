import type { FlightOption } from "@/lib/types/itinerary";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

interface FlightOptionCardProps {
  flight: FlightOption;
}

export function FlightOptionCard({ flight }: FlightOptionCardProps) {
  const outbound = flight.slices[0];
  const firstSegment = outbound?.segments[0];
  const lastSegment = outbound?.segments[outbound.segments.length - 1];

  return (
    <div className="min-w-56 shrink-0 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {firstSegment?.carrierName ?? "Flight"}
        </span>
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {flight.totalCurrency} {flight.totalAmount}
        </span>
      </div>
      {outbound ? (
        <div className="mt-2 flex items-center justify-between text-zinc-600 dark:text-zinc-400">
          <span>
            {outbound.origin} {firstSegment ? formatTime(firstSegment.departingAt) : ""}
          </span>
          <span className="px-2 text-xs text-zinc-400">
            {formatDuration(outbound.durationMinutes)}
            {flight.stops > 0 ? ` · ${flight.stops} stop${flight.stops > 1 ? "s" : ""}` : " · nonstop"}
          </span>
          <span>
            {outbound.destination} {lastSegment ? formatTime(lastSegment.arrivingAt) : ""}
          </span>
        </div>
      ) : null}
      {flight.cabinClass ? (
        <div className="mt-1 text-xs capitalize text-zinc-400">
          {flight.cabinClass.replace("_", " ")}
        </div>
      ) : null}
    </div>
  );
}
