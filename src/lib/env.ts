import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v?.toLowerCase() === "true");

const baseSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
  GOOGLE_GENAI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  DUFFEL_API_KEY: z.string().optional(),
  FOURSQUARE_API_KEY: z.string().optional(),
  // Optional: enables priced hotel results via SerpApi Google Hotels.
  SERPAPI_API_KEY: z.string().optional(),
  MOCK_PROVIDERS: boolFromString,
  // Defaults to on; set to "false" to fall back to LLM-driven tool calls only
  // (used as the baseline when measuring speculative search latency).
  SPECULATIVE_SEARCH: z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase() !== "false"),
});

type Env = z.infer<typeof baseSchema>;

function loadEnv(): Env {
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

// Validation is deferred until the first property access (i.e. at request
// time), not at module evaluation. This lets `next build` collect page data
// for the dynamic /api/chat route without valid keys present; a request that
// actually needs the config still fails fast with the same clear error.
let cached: Env | undefined;

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    cached ??= loadEnv();
    return cached[prop as keyof Env];
  },
});
