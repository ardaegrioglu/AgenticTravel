import { AIMessage } from "@langchain/core/messages";

export interface AskClarificationState {
  clarifyingQuestion: string | null;
}

const FALLBACK_QUESTION =
  "Could you tell me a bit more about the trip — destination, dates, and budget?";

/**
 * Short-circuit node: emits the clarifying question decided by
 * `updatePreferences` as the assistant's turn and ends the graph run,
 * so no search tool is called on a guessed value.
 */
export function askClarification(state: AskClarificationState) {
  return {
    messages: [new AIMessage(state.clarifyingQuestion ?? FALLBACK_QUESTION)],
  };
}
