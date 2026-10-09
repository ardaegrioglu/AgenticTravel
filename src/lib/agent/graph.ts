import { isAIMessage } from "@langchain/core/messages";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { agentNode } from "@/lib/agent/nodes/agentNode";
import { askClarification } from "@/lib/agent/nodes/askClarification";
import { updatePreferences } from "@/lib/agent/nodes/updatePreferences";
import { speculativeSearch } from "@/lib/agent/nodes/speculativeSearch";
import { mergePreferences, type Preferences } from "@/lib/agent/preferencesSchema";
import type { SearchResult } from "@/lib/types/itinerary";
import { tools } from "@/lib/agent/tools";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Graph state: chat messages (append reducer, via the prebuilt annotation)
// plus a structured `preferences` object (shallow-merge reducer), an
// ephemeral `clarifyingQuestion` used only to route the current turn, and a
// growing `preFetchedResults` array that accumulates every speculative search
// fired so far across the conversation.
// ---------------------------------------------------------------------------

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  preferences: Annotation<Preferences>({
    reducer: mergePreferences,
    default: () => ({}),
  }),
  clarifyingQuestion: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  preFetchedResults: Annotation<SearchResult[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

function routeAfterUpdatePreferences(
  state: typeof AgentState.State,
  config?: { configurable?: Record<string, unknown> },
): "askClarification" | "speculativeSearch" | "agent" {
  if (state.clarifyingQuestion) return "askClarification";
  // A per-request override (dev-only, see route.ts) lets the latency study
  // alternate modes without restarting the server.
  const override = config?.configurable?.speculative;
  const speculative = typeof override === "boolean" ? override : env.SPECULATIVE_SEARCH;
  return speculative ? "speculativeSearch" : "agent";
}

function routeAfterAgent(state: typeof AgentState.State): "tools" | typeof END {
  const last = state.messages[state.messages.length - 1];
  // Inside streamEvents the model returns an AIMessageChunk, which is NOT an
  // `instanceof AIMessage`; `isAIMessage` checks the message type instead, so
  // it accepts both. (An instanceof check silently ended every tool-calling
  // turn with no tools run and no reply.)
  if (last && isAIMessage(last) && (last.tool_calls?.length ?? 0) > 0) {
    return "tools";
  }
  return END;
}

const toolNode = new ToolNode(tools);

const graph = new StateGraph(AgentState)
  .addNode("updatePreferences", updatePreferences)
  .addNode("askClarification", askClarification)
  .addNode("speculativeSearch", speculativeSearch)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "updatePreferences")
  .addConditionalEdges("updatePreferences", routeAfterUpdatePreferences, {
    askClarification: "askClarification",
    speculativeSearch: "speculativeSearch",
    agent: "agent",
  })
  .addEdge("askClarification", END)
  .addEdge("speculativeSearch", "agent")
  .addConditionalEdges("agent", routeAfterAgent, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent");

// In-process only: conversation + preferences state resets on server
// restart. Documented v1 simplification — see IDEA.md's out-of-scope list.
const checkpointer = new MemorySaver();

export const compiledGraph = graph.compile({ checkpointer });
