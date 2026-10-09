# AgenticTravel

A chat-based agent (Next.js + LangGraph.js + Gemini) that plans vacations: searches flights, hotels, and restaurants/museums/activities, then proposes a day-by-day itinerary tailored to your stated budget and interests. Search and planning only — no real booking/checkout in v1.

See `IDEA.md` for the product brief and `/Users/ardaegrioglu/.claude/plans/i-want-to-create-woolly-cray.md` for the full implementation plan (architecture, file layout, build order).

## Prerequisites

- Node.js (LTS) and npm
- Three free API keys (no credit card required for any of them):

| Provider | Used for | Get a key |
|---|---|---|
| Google AI Studio | LLM (Gemini, free tier) | https://aistudio.google.com/apikey |
| Duffel | Flights + hotels/stays search (sandbox/test mode) | https://app.duffel.com/join — use the `duffel_test_...` token from your dashboard, not a live key |
| Foursquare Places API | Restaurant/museum/activity search | https://location.foursquare.com — free tier includes 10k Pro calls/month |

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your three keys:

```
GOOGLE_API_KEY=
GOOGLE_GENAI_MODEL=gemini-3.5-flash-lite
DUFFEL_API_KEY=
FOURSQUARE_API_KEY=
```

Then verify the keys actually work (one cheap call per provider, never prints the keys):

```bash
npm run check-keys
```

### Known provider limits

- **Gemini 3.5 Flash Lite (free tier):** 15 requests/minute, 500/day. Each chat turn makes 2–3 LLM calls, so a latency study of N runs costs roughly 3N calls.
- **Duffel Stays** (hotels) is not enabled on new accounts — it returns `403 feature not enabled` until Duffel sales approves it. The app surfaces this as a hotel-search error; flights work with a `duffel_test_` token.
- **Foursquare** uses the new Places API (`places-api.foursquare.com`). Premium fields such as `description` return `429 no credits` on the free tier, so they are not requested.

## Run

```bash
npm run dev
```

Open http://localhost:3000.

## Smoke test

Once running, try:

1. `"Plan me a vacation."` — the agent should ask a clarifying question (destination/dates/budget) rather than guessing.
2. `"Plan me a 3-day trip to Lisbon in September under $1500 total, I like museums and good food."` — should trigger flight/hotel/place search, render result cards, and produce a day-by-day itinerary.
3. A follow-up like `"Actually more nature and parks instead, and make it 5 days."` — should update the trip summary while keeping destination/budget.

Full verification checklist is in the implementation plan.

## Speculative search and latency study

After preferences are extracted, a `speculativeSearch` graph node fires flight, hotel and place searches in parallel (city names are resolved to IATA codes via Duffel) so cards render and the agent can answer without LLM-issued tool calls. Set `SPECULATIVE_SEARCH=false` for the tools-only baseline.

To measure the difference (needs `npm run dev` and live keys; runs serially, ~65s apart, because of the Gemini rate limit):

```bash
npm run latency-study -- --runs 2
```

Results land in `scripts/latency-results.csv`.
