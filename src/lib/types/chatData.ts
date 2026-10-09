import type { UIMessage } from "ai";
import type { Preferences } from "@/lib/agent/preferencesSchema";
import type { SearchResult } from "@/lib/types/itinerary";

// ---------------------------------------------------------------------------
// Custom AI SDK UI data parts emitted by streamBridge.ts and consumed by the
// chat UI (ToolStatusIndicator, TripSummaryPanel, *ResultsGrid components).
// Keys here become the `data-${key}` part type on the wire.
// ---------------------------------------------------------------------------

export interface ToolStatusData {
  toolName: string;
  status: "running" | "done";
}

export type ChatDataParts = {
  toolStatus: ToolStatusData;
  searchResult: SearchResult;
  preferences: Preferences;
  /** Server-side latency milestone (ms since request start). Transient: not stored on messages. */
  timing: { event: "preferences" | "firstCard" | "firstText" | "end"; ms: number };
};

/** The app's concrete UIMessage type, parameterized with our custom data parts. */
export type AppUIMessage = UIMessage<unknown, ChatDataParts>;
