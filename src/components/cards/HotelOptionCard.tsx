import type { HotelOption } from "@/lib/types/itinerary";

interface HotelOptionCardProps {
  hotel: HotelOption;
}

export function HotelOptionCard({ hotel }: HotelOptionCardProps) {
  return (
    <div className="min-w-56 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{hotel.name}</span>
        {hotel.rating != null ? (
          <span className="whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
            ★ {hotel.rating.toFixed(1)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hotel.address}</p>
      <div className="mt-2 flex items-center justify-between text-zinc-600 dark:text-zinc-400">
        <span className="text-xs">
          {hotel.checkInDate} → {hotel.checkOutDate}
        </span>
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {hotel.totalCurrency} {hotel.totalAmount}
        </span>
      </div>
    </div>
  );
}
