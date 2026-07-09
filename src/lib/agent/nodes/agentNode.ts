import { SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { createModel } from "@/lib/agent/model";
import { buildSystemPrompt } from "@/lib/agent/systemPrompt";
import { tools } from "@/lib/agent/tools";
import type { Preferences } from "@/lib/agent/preferencesSchema";

export interface AgentNodeState {
  messages: BaseMessage[];
  preferences: Preferences;
}

/**
 * The ReAct tool-calling node. System prompt is rebuilt from the current
 * `preferences` state on every call, so reasoning is grounded in the
 * compounded structured state rather than re-derived from the transcript.
 */
export async function agentNode(state: AgentNodeState) {
  const model = createModel({ temperature: 0.4 }).bindTools(tools);
  const systemMessage = new SystemMessage(buildSystemPrompt(state.preferences));

  const response = await model.invoke([systemMessage, ...state.messages]);

  return { messages: [response] };
}
