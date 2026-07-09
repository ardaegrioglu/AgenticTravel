# AgenticTravel — build handoff

Status as of this handoff: **build order steps 0–12 fully done and committed, step 13 blocked, step 14 partially done.** Everything below is written so a fresh session (human or agent) with no memory of this conversation can pick up cleanly.

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

### Step 14 — polish (partially done)

Done: tool-level error handling (was already in place from step 4 — providers return an
`error` field in the JSON envelope instead of throwing), route-level hardening (malformed
JSON body / missing `messages` array now return a clean 400 instead of a 500), loading
states ("Thinking…" pulse, disabled input while streaming), and a pass on the flex-height
layout chain so the message list scrolls inside a fixed viewport instead of growing the
page (see commit "Step 14 (partial)").

Still to do:
- Broader responsive/visual QA — needs real content (long itineraries, several result
  cards at once) to look at, which needs step 13's real keys.
- Was mid-way through re-verifying the route hardening in a browser when this session
  paused; re-run this before trusting it blindly (should be low-risk, it's a small
  self-contained diff, but hasn't been re-observed after the last edit):
  ```
  npm run dev
  curl -X POST localhost:3000/api/chat -H "Content-Type: application/json" -d 'not json'
  # expect 400, not 500
  curl -X POST localhost:3000/api/chat -H "Content-Type: application/json" -d '{}'
  # expect 400, not 500
  ```

### Final Verification section (not run)

The plan's `npm run build` / lint static-check pass hasn't been run as a final combined
step (only run incrementally after each build step, always clean). Do this once step 14
is finished:
```
npm run lint
npm run build
```

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
