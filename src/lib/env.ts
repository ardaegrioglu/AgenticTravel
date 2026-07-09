import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v?.toLowerCase() === "true");

const baseSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
  GOOGLE_GENAI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  DUFFEL_API_KEY: z.string().optional(),
  FOURSQUARE_API_KEY: z.string().optional(),
  MOCK_PROVIDERS: boolFromString,
});

function loadEnv() {
  const parsed = baseSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }

  const data = parsed.data;

  if (!data.MOCK_PROVIDERS) {
    const missing: string[] = [];
    if (!data.DUFFEL_API_KEY) missing.push("DUFFEL_API_KEY");
    if (!data.FOURSQUARE_API_KEY) missing.push("FOURSQUARE_API_KEY");
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables (MOCK_PROVIDERS is false): ${missing.join(", ")}`,
      );
    }
  }

  return data;
}

export const env = loadEnv();
