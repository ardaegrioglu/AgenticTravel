import { SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { createModel } from "@/lib/agent/model";
import {
  mergePreferences,
  preferencesUpdateSchema,
  REQUIRED_FOR_SEARCH_DESCRIPTION,
  type Preferences,
} from "@/lib/agent/preferencesSchema";

export interface UpdatePreferencesState {
  messages: BaseMessage[];
  preferences: Preferences;
}

export interface UpdatePreferencesResult {
  preferences: Preferences;
  clarifyingQuestion: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `You extract and update structured trip-planning preferences from a travel chat.

You will be given the current known preferences as JSON and the full conversation so far.
Return the COMPLETE, updated set of preferences: carry forward every field that is still
correct, and only change fields the user has actually specified or revised in the
conversation. Never invent a destination, date, or budget the user hasn't stated.

Also decide whether ${REQUIRED_FOR_SEARCH_DESCRIPTION} is still missing or ambiguous for the
*next* search step. If so, set clarifyingQuestion to a single, concrete question that asks
for exactly what's missing. If everything needed for the next search is known, set
clarifyingQuestion to null — do not ask a question just to be thorough.`;

export async function updatePreferences(
  state: UpdatePreferencesState,
): Promise<UpdatePreferencesResult> {
  const model = createModel({ temperature: 0 }).withStructuredOutput(
    preferencesUpdateSchema,
  );

  const result = await model.invoke([
    new SystemMessage(
      `${EXTRACTION_SYSTEM_PROMPT}\n\nCurrent known preferences (JSON):\n${JSON.stringify(
        state.preferences,
      )}`,
    ),
    ...state.messages,
  ]);

  const { clarifyingQuestion, ...update } = result;
  const preferences = mergePreferences(state.preferences, update);

  return { preferences, clarifyingQuestion: clarifyingQuestion ?? null };
}
