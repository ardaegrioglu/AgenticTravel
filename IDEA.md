# AgenticTravel

## Problem

Planning a trip means juggling flight search, hotel search, and figuring out what to actually do once you land (restaurants, museums, activities) — usually across several disconnected tools, then manually stitching it all into a day-by-day plan that fits a budget. AgenticTravel is a chat-based agent that does this stitching for you: describe the trip you want, and it searches real flight/hotel/place data and proposes a coherent itinerary, refining it as you give feedback.

## v1 Scope

- Conversational trip planning: chat UI where the user describes destination, dates, budget, and interests.
- Flight search (comparison only, via Duffel).
- Hotel search (comparison only, via Duffel Stays).
- Restaurant / museum / activity recommendations woven into the itinerary (via Foursquare Places), matched to stated interests.
- Structured, evolving preference state: the agent tracks destination, dates, budget, travelers, interests, and dislikes as explicit state that compounds across the conversation, rather than re-deriving it from scratch each turn.
- Clarifying questions before guessing: if a required detail (destination, dates, budget) is missing or ambiguous, the agent asks rather than spending a search on an assumption.

## Explicitly Out of Scope (v1)

- Real booking / checkout / payment. No money moves and no reservations are actually made — this is a search-and-plan assistant, not a transactional booking engine.
- User accounts, auth, or saved trips across sessions (conversation state lives in-memory for the life of a chat thread).
- A persistent database. Conversation/preference state is checkpointed in-process only.

## Architecture Summary

A single Next.js (App Router) app. The agent runs server-side inside a Next.js API route as a custom LangGraph `StateGraph`, powered by Google Gemini (Google AI Studio free tier) via `@langchain/google-genai`. The graph tracks two pieces of state — the chat `messages` and a structured `preferences` object — and either asks a clarifying question or calls tools (`search_flights`, `search_hotels`, `search_places`, backed by Duffel and Foursquare's free tiers) before synthesizing a markdown itinerary. The Next.js frontend uses the Vercel AI SDK (`useChat`) for streaming, with a hand-written bridge from LangGraph's event stream to the AI SDK's UI message stream so structured results render as cards rather than plain text.

See `/Users/ardaegrioglu/.claude/plans/i-want-to-create-woolly-cray.md` for the full implementation plan.
