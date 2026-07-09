import { AIMessage } from "@langchain/core/messages";
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
import { mergePreferences, type Preferences } from "@/lib/agent/preferencesSchema";
import { tools } from "@/lib/agent/tools";

// ---------------------------------------------------------------------------
// Graph state: chat messages (append reducer, via the prebuilt annotation)
// plus a structured `preferences` object (shallow-merge reducer) and an
// ephemeral `clarifyingQuestion` used only to route the current turn.
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
});

function routeAfterUpdatePreferences(
  state: typeof AgentState.State,
): "askClarification" | "agent" {
  return state.clarifyingQuestion ? "askClarification" : "agent";
}

function routeAfterAgent(state: typeof AgentState.State): "tools" | typeof END {
  const last = state.messages[state.messages.length - 1];
  if (last instanceof AIMessage && (last.tool_calls?.length ?? 0) > 0) {
    return "tools";
  }
  return END;
}

const toolNode = new ToolNode(tools);

const graph = new StateGraph(AgentState)
  .addNode("updatePreferences", updatePreferences)
  .addNode("askClarification", askClarification)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "updatePreferences")
  .addConditionalEdges("updatePreferences", routeAfterUpdatePreferences, {
    askClarification: "askClarification",
    agent: "agent",
  })
  .addEdge("askClarification", END)
  .addConditionalEdges("agent", routeAfterAgent, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent");

// In-process only: conversation + preferences state resets on server
// restart. Documented v1 simplification — see IDEA.md's out-of-scope list.
const checkpointer = new MemorySaver();

export const compiledGraph = graph.compile({ checkpointer });
