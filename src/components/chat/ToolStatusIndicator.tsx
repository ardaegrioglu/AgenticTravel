import type { ToolStatusData } from "@/lib/types/chatData";

const TOOL_LABEL: Record<string, string> = {
  search_flights: "Searching flights",
  search_hotels: "Searching hotels",
  search_places: "Searching places",
};

interface ToolStatusIndicatorProps {
  status: ToolStatusData;
}

export function ToolStatusIndicator({ status }: ToolStatusIndicatorProps) {
  const label = TOOL_LABEL[status.toolName] ?? `Running ${status.toolName}`;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status.status === "running"
            ? "animate-pulse bg-amber-500"
            : "bg-emerald-500"
        }`}
      />
      <span>
        {label}
        {status.status === "done" ? " — done" : "…"}
      </span>
    </div>
  );
}
