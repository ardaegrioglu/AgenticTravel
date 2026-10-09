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
clarifyingQuestion to an empty string "" — do not ask a question just to be thorough,
and never put a placeholder like "null" or "none" in it.`;

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : ((part as { text?: string }).text ?? "")))
      .join("");
  }
  return "";
}

const MAX_ATTEMPTS = 3;
const RETRY_NUDGE =
  "Your previous extraction was incomplete. Re-read the user's messages carefully and fill in " +
  "EVERY field they stated: origin, destination, exact dates (YYYY-MM-DD), trip length, " +
  "travelers, budget amount and currency, and interests.";
const FALLBACK_QUESTION =
  "Where would you like to go, when are you thinking of traveling, and what's your budget?";

/** True when the trip can't be searched yet (no destination or no timing info). */
function lacksSearchBasics(p: Preferences): boolean {
  return !p.destination || !(p.departureDate || p.durationDays);
}

export async function updatePreferences(
  state: UpdatePreferencesState,
): Promise<UpdatePreferencesResult> {
  // Plain JSON mode + zod validation instead of withStructuredOutput: on
  // Gemini Flash Lite, tool/function-calling structured output deterministically
  // dropped fields for some phrasings (e.g. returned only {origin} for
  // "from London to Rome departing …"), while JSON mode extracted all of them.
  const model = createModel({ temperature: 0, json: true });
  const fieldList = Object.entries(preferencesUpdateSchema.shape)
    .map(([key, field]) => `- ${key}: ${(field as { description?: string }).description ?? ""}`)
    .join("\n");

  // Gemini accepts exactly one system message, so a retry nudge is appended to
  // it rather than sent as a second one.
  const buildMessages = (nudge?: string) => [
    new SystemMessage(
      `${EXTRACTION_SYSTEM_PROMPT}\n\nRespond with ONLY a JSON object using these optional keys ` +
        `(omit anything unknown):\n${fieldList}\n\nCurrent known preferences (JSON):\n${JSON.stringify(
        state.preferences,
      )}${nudge ? `\n\n${nudge}` : ""}`,
    ),
    ...state.messages,
  ];

  let preferences = state.preferences;
  let question: string | null = null;

  // Gemini's structured output is occasionally flaky: it can return a partial
  // object (e.g. only `origin`) or throw a parse error, even at temperature 0.
  // The dead-end state is "trip not searchable AND no clarifying question",
  // where nothing downstream would ever respond, so retry before accepting it.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await model.invoke(buildMessages(attempt === 1 ? undefined : RETRY_NUDGE));
      const { clarifyingQuestion, ...update } = preferencesUpdateSchema.parse(
        JSON.parse(contentToText(raw.content).replace(/^```(?:json)?|```$/g, "").trim()),
      );
      preferences = mergePreferences(state.preferences, update);

      // Gemini also tends to fill an optional string field with a sentinel
      // ("null"/"none"/…) instead of omitting it. Left as-is, that truthy
      // string would wrongly trip the clarification short-circuit and stop
      // the agent from ever searching. Treat sentinels and blanks as "no question".
      const trimmed =
        typeof clarifyingQuestion === "string" ? clarifyingQuestion.trim() : "";
      const isRealQuestion =
        trimmed.length > 0 &&
        !["null", "none", "n/a", "na", "undefined"].includes(trimmed.toLowerCase());
      question = isRealQuestion ? trimmed : null;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      continue;
    }

    if (question || !lacksSearchBasics(preferences)) break;
  }

  // Still a dead end after retrying: ask rather than go silent.
  if (!question && lacksSearchBasics(preferences)) question = FALLBACK_QUESTION;

  return { preferences, clarifyingQuestion: question };
}
