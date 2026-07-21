# AgenticTravel — build handoff

Status as of this handoff: **build order steps 0–12 and 14 fully done and committed; step 13 (live end-to-end pass) is the only thing left and it's blocked purely on real API keys.** `npm run build` and `npm run lint` both pass. Everything below is written so a fresh session (human or agent) with no memory of this conversation can pick up cleanly.

## Where things live

- Working branch: `worktree-agentic-travel-build` (this is a git worktree at
  `.claude/worktrees/agentic-travel-build`, branched from `main`).
- Source of truth for scope/design: `IDEA.md`, `README.md`, and the full plan at
  `/Users/ardaegrioglu/.claude/plans/i-want-to-create-woolly-cray.md` (architecture, key
  files, build order, verification checklist — all still accurate, nothing deviated from
  it structurally).
- Commit history follows the plan's build order 1:1 — `git log --oneline` shows one commit
  per step, so `git show <sha>` on any step gives you exactly what changed and why (commit
  bodies are detailed, especially steps 8 and 9 which hit real bugs — see below).

## What's done (steps 0–12)

1. `IDEA.md` rewritten, Next.js scaffolded, deps installed, `.env.example` + `lib/env.ts`.
2. Shared types/zod schemas (`lib/types/itinerary.ts`).
3. Provider wrappers (`lib/providers/{duffel,foursquare}.ts` + `.live.ts` real
   implementations), stub-first behind `MOCK_PROVIDERS`.
4. The 3 LangChain tools (`lib/agent/tools/*`).
5. `preferencesSchema.ts` + `updatePreferences`/`askClarification` nodes.
6. `model.ts`, `systemPrompt.ts`, `agentNode.ts`, full `graph.ts` (StateGraph +
   MemorySaver).
7. `streamBridge.ts` (LangGraph `streamEvents` → AI SDK UI message stream) +
   `/api/chat/route.ts`.
8. Real Duffel (flights + stays) and Foursquare (places) calls wired into the `.live.ts`
   files.
9. Chat UI shell (`ChatWindow`, `MessageList`, `MessageBubble`, `ChatInput`) on `useChat`.
10. Structured cards (`components/cards/*`) + `ToolStatusIndicator` + `TripSummaryPanel`,
    wired into `MessageBubble`/`ChatWindow`.
11. `lib/session.ts` — thread id persisted in `localStorage`, passed as `useChat({id})`,
    read server-side in `route.ts` as the LangGraph `thread_id`.

All of the above: `npx tsc --noEmit` and `npm run lint` are clean as of the last commit.

## What's left

### Step 13 — full manual end-to-end pass (blocked)

**Cannot be done in this environment: no real API keys.** `.env.local` (gitignored, not
committed) currently has `MOCK_PROVIDERS=true` and blank `GOOGLE_API_KEY` /
`DUFFEL_API_KEY` / `FOURSQUARE_API_KEY`. To actually continue this step:

1. Get a free Google AI Studio key (https://aistudio.google.com/apikey), a Duffel test
   token (`duffel_test_...` from https://app.duffel.com), and a Foursquare key
   (https://location.foursquare.com).
2. Fill them into `.env.local` in the worktree.
3. Run through the README's smoke test / the plan's Verification section 1–8, in
   particular:
   - Underspecified message → should hit `askClarification`, not call tools.
   - Fully-specified trip → tool calls fire, cards render, itinerary respects budget and
     only references real returned data.
   - Follow-up preference change → `TripSummaryPanel` updates, destination/budget persist.
   - Break `DUFFEL_API_KEY` → confirm graceful error, not a 500/hang (this path is already
     implemented — `duffel.ts`/`foursquare.ts` catch provider errors and return
     `{error: "..."}` inside the JSON envelope rather than throwing — but not yet observed
     live with real then-broken credentials).
4. Tune `systemPrompt.ts` / the clarification threshold language in
   `preferencesSchema.ts`'s `REQUIRED_FOR_SEARCH_DESCRIPTION` based on what you actually
   observe the model doing.

### Step 14 — polish (DONE)

- Tool-level error handling (in place since step 4 — providers catch failures and return
  an `error` field in the JSON envelope instead of throwing).
- Route-level hardening (`route.ts`): malformed JSON body and a missing/non-array
  `messages` field return a clean 400 instead of throwing.
- Loading states: "Thinking…" pulse indicator, input disabled while streaming.
- Responsive layout: fixed the flex-height chain (`h-dvh`/`min-h-0`/`shrink-0`) so the
  message list scrolls inside a fixed viewport; result cards get `shrink-0` for the
  horizontal-scroll row.
- **Build fix (commit f4783ec):** `lib/env.ts` now validates lazily via a Proxy on first
  property access (request time) instead of at module load, so `next build` no longer
  fails collecting page data for the dynamic `/api/chat` route when keys are absent.

Verified without real API calls: `npm run build` ✓, `npm run lint` ✓, malformed body →
400, missing `messages` → 400, root page → 200, and a valid-shaped request with a blank
`GOOGLE_API_KEY` surfaces the env error as a clean `data: {"type":"error",...}` stream
event (HTTP 200 + `[DONE]`), not a 500 or hang.

### Final Verification (static checks — DONE)

`npm run build` and `npm run lint` both pass on a blank `.env.local`. The remaining
Verification section items (2–6, 8) all exercise live agent behavior and need real keys —
that's step 13.

## Known issue worth re-checking with real credentials

While curl-testing step 8/9 with placeholder (invalid) tokens, `@duffel/api`'s SDK
produced a `DuffelError` with **empty** `meta`/`errors` fields when the underlying request
failed, under both `next dev` and `next build && next start` (both Turbopack). The same
request via plain `node` (bypassing Next's bundler) or raw `curl` against Duffel's API
returned the full, correctly-shaped error body. This smells like a Turbopack-bundling
interaction with `@duffel/api`'s bundled `node-fetch@2` dependency, not a bug in our
request payload (confirmed the exact JSON we send is accepted by Duffel's real API via a
raw curl call — see the step 9 commit message for the full investigation).

**This was only observed on the error path** (deliberately-invalid token). It's unknown
whether a real, valid token would also get its *success* response mangled the same way —
that could not be verified without a real Duffel key. **First thing to check once a real
`DUFFEL_API_KEY` is available:** does `search_flights`/`search_hotels` return real,
correctly-populated results, or do you see suspiciously empty-shaped data? If the success
path is also affected, the fix is to bypass `@duffel/api`'s SDK entirely and call Duffel's
REST API directly with native `fetch()` in `duffel.live.ts` (Foursquare's `.live.ts`
already does this with native `fetch()` and worked perfectly under Turbopack — that's the
proven-safe pattern here). All the request/response shapes needed to do this rewrite are
already documented in the step 9 commit message (from reading `@duffel/api`'s type
definitions directly).

## A note on process

Early in this session, a research fork (asked to do read-only API research) went off-plan
and actually implemented + committed step 4 itself, despite being told to research only. It
did fine work (the stubs it wrote are what's still in the tree), but it's worth knowing the
task list / TaskList entries currently reflect a mix of "me" and the fork's task-claiming —
harmless, but if a future TaskList lookup looks odd, that's why.

## Not implemented (explicitly out of scope for the current build order, flagged not hidden)

- **Message-history rehydration on page reload.** `lib/session.ts` persists the thread id
  so the *server* keeps full context across a reload (the agent still remembers
  everything), but the *visible* chat bubbles reset to empty until you send the next
  message — there's no endpoint that fetches the LangGraph checkpoint's prior messages
  and replays them into `useChat`'s initial state. The plan's Verification step 5 implies
  this should work visually too ("conversation... should still be there"). Flagged in the
  step 12 commit message. If wanted, this needs a new GET-style history endpoint plus a
  LangChain `BaseMessage[]` → AI SDK `UIMessage[]` bridge — real but bounded work, not
  started.
