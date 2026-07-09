import type { Preferences } from "@/lib/agent/preferencesSchema";

interface TripSummaryPanelProps {
  preferences: Preferences;
}

function formatDates(preferences: Preferences): string | null {
  if (preferences.departureDate && preferences.returnDate) {
    return `${preferences.departureDate} → ${preferences.returnDate}`;
  }
  if (preferences.departureDate) return `From ${preferences.departureDate}`;
  if (preferences.durationDays) return `${preferences.durationDays} day trip`;
  return null;
}

export function TripSummaryPanel({ preferences }: TripSummaryPanelProps) {
  const hasAnything = Object.values(preferences).some((value) =>
    Array.isArray(value) ? value.length > 0 : value != null,
  );

  if (!hasAnything) return null;

  const dates = formatDates(preferences);
  const budget =
    preferences.budgetAmount != null
      ? `${preferences.budgetCurrency ?? ""} ${preferences.budgetAmount}`.trim()
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Trip so far</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-700 dark:text-zinc-300">
          {preferences.destination ? (
            <span>
              📍{" "}
              {preferences.origin
                ? `${preferences.origin} → ${preferences.destination}`
                : preferences.destination}
            </span>
          ) : null}
          {dates ? <span>🗓️ {dates}</span> : null}
          {budget ? <span>💰 {budget}</span> : null}
          {preferences.travelers ? <span>👥 {preferences.travelers}</span> : null}
          {preferences.interests?.length ? (
            <span>✨ {preferences.interests.join(", ")}</span>
          ) : null}
          {preferences.dislikes?.length ? (
            <span>🚫 {preferences.dislikes.join(", ")}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
