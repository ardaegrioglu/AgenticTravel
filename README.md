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
GOOGLE_GENAI_MODEL=gemini-2.5-flash
DUFFEL_API_KEY=
FOURSQUARE_API_KEY=
```

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
