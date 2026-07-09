# AgenticTravel — v1 Plan

## Context

The user wants an agentic travel app that helps plan (not book) vacations: chat with an AI agent that searches flights, hotels, and restaurants/museums/activities, then synthesizes a day-by-day itinerary tailored to preferences and budget. This is a from-scratch build — the working directory currently contains only `IDEA.md` with a one-line idea.

Key constraints driving the design:
- **Zero cost.** Every provider must be free-tier, no credit card. LLM: Google AI Studio (Gemini), chosen explicitly by the user over paid options.
- **No booking/checkout.** v1 is search + planning only — no payments, no PCI surface.
- **Single codebase.** User chose Next.js with the LangChain agent running server-side inside Next.js API routes (LangChain.js), not a separate Python service.
- **Amadeus is out.** Their self-service developer portal shuts down July 17, 2026 (days from now) — not worth building against. Verified via web search.

Chosen data providers (free tier, no card, verified via web search):
- **Duffel** — flights *and* hotels/stays under one API key, free sandbox/test mode (`duffel_test_...` tokens).
- **Foursquare Places API** — restaurants/museums/activities, 10k free Pro calls/month.

## Architecture

- **Next.js 16 (App Router, TypeScript, Tailwind v4, `src/` dir)** scaffolded via `create-next-app` defaults.
- **Agent**: a **custom LangGraph `StateGraph`** (not just the prebuilt `createReactAgent`) — needed because feedback must compound as *structured state*, not just live implicitly in the raw transcript. Graph state has two channels:
  - `messages` — the chat history (append reducer), as usual.
  - `preferences` — a structured, evolving object (destination, dates, budget, travelers, interests, dislikes/must-avoid, cabin class, dietary constraints, etc.), shallow-merge reducer, defined via a Zod schema (`lib/agent/preferencesSchema.ts`).

  Nodes:
  1. **`updatePreferences`** — an LLM call using `.withStructuredOutput(preferencesSchema.extend({ clarifyingQuestion: z.string().nullable() }))` that merges the latest human message into `preferences` and decides whether a required field (e.g. destination, dates, budget) is missing or ambiguous for the next search.
  2. Conditional edge: if `clarifyingQuestion` is set → **`askClarification`** node emits that question as the assistant's message and the turn ends (no tool calls spent on a guess). Otherwise → **`agent`**.
  3. **`agent`** — the ReAct tool-calling node, system prompt built dynamically from the current `preferences` state (`systemPrompt.ts` becomes a function of `preferences`, not a static string) so reasoning is grounded in compounded structured state rather than the LLM re-deriving it from the full transcript every turn.
  4. **`tools`** — `ToolNode` wrapping the 3 search tools, loops back to `agent` until no more tool calls, then `END`.

  This is a simpler mechanism than LangGraph's formal `interrupt()`/`Command(resume=...)` primitive (which is designed for pausing around external side effects, e.g. an approval gate before a real booking) — a conditional edge that short-circuits to an "ask a question" node achieves the same "don't guess on risky assumptions" UX for a pure chat back-and-forth, with far less plumbing. Formal `interrupt()` is a reasonable v2 addition if a real booking/checkout step is ever added and needs an explicit approve/reject gate.

  Conversational memory across turns (both `messages` and `preferences`) comes from LangGraph's `MemorySaver` checkpointer keyed by a client-generated `thread_id` (persisted in `localStorage`) — not a hand-rolled memory buffer.
- **LLM**: `@langchain/google-genai`'s `ChatGoogleGenerativeAI`, model `gemini-2.5-flash` (Google AI Studio free tier) — confirm exact current free-tier model name at implementation time since these shift.
- **Chat UI transport**: Vercel AI SDK (`ai` + `@ai-sdk/react`'s `useChat`) for the client-side streaming/message-state plumbing — well-supported, avoids hand-rolling SSE parsing. The LangGraph → AI SDK bridge is **hand-written** (not the generic LangChain adapter), since that gives control over mapping specific tool-call events onto specific UI card types (flight/hotel/place). Fallback if this integration proves fiddly: plain SSE + manual `fetch` reader on the client — simpler and easier to debug, timebox the SDK route first.
- **Tools** (LangChain `tool()` + Zod schemas, each returns a JSON string with structured results):
  - `search_flights` → `lib/providers/duffel.ts: searchFlightOffers()`
  - `search_hotels` → `lib/providers/duffel.ts: searchStays()`
  - `search_places` → `lib/providers/foursquare.ts: searchPlaces()` (category: restaurant/museum/activity)
  - Itinerary synthesis is **not** a separate tool — it's the agent's own final-turn markdown output, governed by a system prompt requiring it to only write the plan after calling relevant tools and to reference actual returned data (not invented flights/prices).
- **No database in v1** — `MemorySaver` is in-process (resets on server restart); explicitly a documented v1 simplification with an obvious upgrade path later (`langgraph-checkpoint-sqlite`/`-postgres`).

## Key Files

```
src/app/api/chat/route.ts          # POST handler: builds agent, streams response
src/lib/agent/graph.ts             # custom StateGraph wiring: state schema + nodes + edges + MemorySaver
src/lib/agent/preferencesSchema.ts # Zod schema for the structured preferences/constraints state
src/lib/agent/nodes/updatePreferences.ts  # merges latest message into preferences, flags clarifyingQuestion
src/lib/agent/nodes/askClarification.ts   # short-circuit node: emits the clarifying question, ends turn
src/lib/agent/nodes/agentNode.ts   # ReAct tool-calling node (system prompt built from preferences)
src/lib/agent/model.ts             # ChatGoogleGenerativeAI factory
src/lib/agent/systemPrompt.ts      # fn(preferences) -> persona + itinerary rules + tool-usage instructions
src/lib/agent/tools/{searchFlights,searchHotels,searchPlaces}.ts
src/lib/agent/streamBridge.ts      # LangGraph streamEvents -> AI SDK UI message stream (incl. preferences data part)
src/lib/providers/duffel.ts        # Duffel flights + stays wrapper (via @duffel/api)
src/lib/providers/foursquare.ts    # Foursquare Places wrapper (plain fetch)
src/lib/types/itinerary.ts         # FlightOption/HotelOption/PlaceResult types + zod schemas
src/lib/env.ts                     # zod-validated env accessor, fails fast if keys missing
src/components/chat/{ChatWindow,MessageList,MessageBubble,ChatInput,ToolStatusIndicator}.tsx
src/components/chat/TripSummaryPanel.tsx  # small "trip so far" panel driven by the preferences data part
src/components/cards/{FlightOptionCard,HotelOptionCard,PlaceCard}.tsx + *ResultsGrid.tsx
.env.example                       # GOOGLE_API_KEY, GOOGLE_GENAI_MODEL, DUFFEL_API_KEY, FOURSQUARE_API_KEY
```

Dependencies: `next react react-dom typescript tailwindcss @tailwindcss/postcss ai @ai-sdk/react @langchain/core @langchain/langgraph @langchain/google-genai @duffel/api zod@^3 react-markdown remark-gfm`.

## Documentation

- **`IDEA.md`** gets rewritten (it currently only holds the original one-line seed idea) into a short project brief: problem statement, v1 feature scope (trip planning + flight/hotel/place search, no booking), explicitly out-of-scope items, and a one-paragraph architecture summary — a durable reference for "what this project is," independent of implementation detail.
- **`README.md`** (already in the file tree) covers the practical setup/run path: prerequisites, `npm install`, obtaining the three free-tier API keys (Google AI Studio, Duffel test token, Foursquare) and filling `.env.local`, `npm run dev`, and a pointer to the verification steps below as a smoke test.
- No other markdown files are needed for v1 scope — avoid adding docs (e.g. CONTRIBUTING, ARCHITECTURE) beyond these two until the project actually grows enough to need them.

## Build Order

0. Rewrite `IDEA.md` with the finalized project brief (see Documentation above).
1. Scaffold Next.js (TS, Tailwind, App Router, `src/`, ESLint).
2. Install dependencies; add `.env.example` + `lib/env.ts`.
3. Define shared types (`lib/types/itinerary.ts`).
4. Build provider wrappers **stubbed first** (hardcoded fixtures behind a `MOCK_PROVIDERS` flag) so agent/UI can be iterated without live network calls.
5. Implement the 3 tools against the stubs, with carefully-written descriptions (tool selection quality depends on these).
6. Define `preferencesSchema.ts` and implement `updatePreferences` + `askClarification` nodes; unit-sanity-check the merge/clarify logic standalone (e.g. feed it a couple of sample transcripts) before wiring into the full graph.
7. Implement `model.ts`, `systemPrompt.ts` (as a function of `preferences`), `agentNode.ts`, and assemble the full `StateGraph` in `graph.ts` (updatePreferences → conditional edge → askClarification|agent ⇄ tools → END), with `MemorySaver`. Sanity-check the agent loop standalone before touching the UI.
8. Implement `streamBridge.ts` + `/api/chat/route.ts`; verify via `curl` that it streams coherently, including the clarification short-circuit path.
9. Swap stubs for real Duffel/Foursquare calls; fix real-API shape mismatches (Duffel's two-step offer-request→offers flow, Foursquare category IDs).
10. Build chat UI shell (`ChatWindow`, `MessageList`, `ChatInput`) wired to `useChat`.
11. Add structured card rendering driven by data parts + `ToolStatusIndicator` + `TripSummaryPanel` (renders the current `preferences` state).
12. Wire up `thread_id` persistence (`lib/session.ts`, `localStorage`).
13. Full manual end-to-end pass; tune system prompt / clarification thresholds based on observed behavior.
14. Polish: error handling per tool (catch provider failures, return explainable JSON rather than 500ing), loading states, responsive styling.

## Verification

1. `npm run dev`, load the chat UI, confirm no console errors.
2. Send an underspecified message: *"Plan me a vacation."* Confirm the agent does **not** call any search tools on a guess — it should hit the `askClarification` short-circuit and ask for destination/dates/budget instead.
3. Send: *"Plan me a 3-day trip to Lisbon in September under $1500 total, I like museums and good food."* Confirm tool-status indicators fire for all three tools, result cards render with real Duffel sandbox / Foursquare data, the `TripSummaryPanel` reflects the parsed preferences (Lisbon, 3 days, $1500, museums+food), and the final itinerary references that actual data and respects budget.
4. Follow-up in the same session: *"Actually I don't like museums, more nature and parks instead, and make it 5 days."* Confirm the `TripSummaryPanel` updates (interests swapped, duration changed) while destination/budget are retained — this validates the `preferences` state is merging correctly across turns, not just living in raw transcript.
5. Refresh the browser tab — conversation and trip summary should still be there (client `threadId` persistence + server checkpoint reuse of both `messages` and `preferences`).
6. Temporarily break `DUFFEL_API_KEY` — confirm the agent explains the failure conversationally rather than the route 500ing or the UI hanging.
7. Check the Network tab confirms `/api/chat` streams (chunked), not a single buffered response.
8. Spot-check usage against each provider's free-tier dashboard to confirm nowhere near limits.
