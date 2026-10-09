import type { UIMessageStreamWriter } from "ai";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { compiledGraph } from "@/lib/agent/graph";
import type { Preferences } from "@/lib/agent/preferencesSchema";
import { searchResultSchema } from "@/lib/types/itinerary";
import type { AppUIMessage } from "@/lib/types/chatData";

// Node names whose completed output message should be surfaced to the user
// as assistant text: the normal ReAct agent turn, and the clarification
// short-circuit turn.
const ASSISTANT_TEXT_NODES = new Set(["agent", "askClarification"]);

function extractToolOutputText(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "content" in output) {
    const content = (output as { content: unknown }).content;
    if (typeof content === "string") return content;
  }
  return null;
}

export interface StreamGraphOptions {
  writer: UIMessageStreamWriter<AppUIMessage>;
  input: { messages: BaseMessage[] };
  threadId: string;
  /** Overrides env.SPECULATIVE_SEARCH for this request (dev-only A/B testing). */
  speculative?: boolean;
}

/**
 * Hand-written bridge from LangGraph's classic `streamEvents` (v2) event
 * stream to the AI SDK's UI message stream, so specific tool-call events map
 * onto specific typed data parts (tool status, search results, preferences)
 * instead of everything collapsing into plain text.
 *
 * The speculativeSearch node fires all applicable searches in parallel after
 * preferences are extracted and dispatches a custom event as each one
 * finishes; those are streamed to the UI as search-result data parts so each
 * card renders immediately, before the agent node synthesizes its response.
 */
export async function streamGraphToUIMessageStream({
  writer,
  input,
  threadId,
  speculative,
}: StreamGraphOptions): Promise<void> {
  const events = compiledGraph.streamEvents(input, {
    version: "v2",
    configurable: { thread_id: threadId, speculative },
  });

  // Latency milestones, reported once each as transient data parts so the
  // latency study script can compare speculative vs. tool-call flows.
  const startedAt = performance.now();
  const marked = new Set<string>();
  const mark = (event: "preferences" | "firstCard" | "firstText" | "end") => {
    if (marked.has(event)) return;
    marked.add(event);
    writer.write({
      type: "data-timing",
      data: { event, ms: Math.round(performance.now() - startedAt) },
      transient: true,
    });
  };

  for await (const event of events) {
    switch (event.event) {
      case "on_tool_start": {
        writer.write({
          type: "data-toolStatus",
          id: event.run_id,
          data: { toolName: event.name, status: "running" },
        });
        break;
      }

      case "on_tool_end": {
        writer.write({
          type: "data-toolStatus",
          id: event.run_id,
          data: { toolName: event.name, status: "done" },
        });

        const text = extractToolOutputText(event.data?.output);
        if (text) {
          const parsed = searchResultSchema.safeParse(JSON.parse(text));
          if (parsed.success) {
            writer.write({ type: "data-searchResult", data: parsed.data });
            mark("firstCard");
          }
        }
        break;
      }

      // speculativeSearch dispatches one of these per search as it finishes,
      // so cards stream in incrementally instead of after the slowest search.
      case "on_custom_event": {
        if (event.name === "searchResult") {
          const parsed = searchResultSchema.safeParse(event.data);
          if (parsed.success) {
            writer.write({ type: "data-searchResult", data: parsed.data });
            mark("firstCard");
          }
        }
        break;
      }

      case "on_chain_end": {
        if (event.name === "updatePreferences") {
          const output = event.data?.output as { preferences?: Preferences } | undefined;
          if (output?.preferences) {
            writer.write({ type: "data-preferences", data: output.preferences });
            mark("preferences");
          }
        }

        if (ASSISTANT_TEXT_NODES.has(event.name)) {
          const output = event.data?.output as { messages?: AIMessage[] } | undefined;
          const message = output?.messages?.[0];
          const text = typeof message?.content === "string" ? message.content : "";
          if (text.trim().length > 0) {
            mark("firstText");
            writer.write({ type: "text-start", id: event.run_id });
            writer.write({ type: "text-delta", id: event.run_id, delta: text });
            writer.write({ type: "text-end", id: event.run_id });
          }
        }
        break;
      }

      default:
        break;
    }
  }

  mark("end");
}
