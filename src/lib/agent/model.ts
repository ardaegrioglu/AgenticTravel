import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { env } from "@/lib/env";

export function createModel(options?: { temperature?: number }): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: env.GOOGLE_GENAI_MODEL,
    apiKey: env.GOOGLE_API_KEY,
    temperature: options?.temperature ?? 0.3,
  });
}
