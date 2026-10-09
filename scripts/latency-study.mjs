// Compares user-visible latency of speculative search (ON) vs. LLM-driven
// tool calling only (OFF). Needs `npm run dev` running with live keys.
//
//   node scripts/latency-study.mjs [--runs 3] [--gap 15] [--url http://localhost:3000]
//
// Modes alternate run-by-run (ON, OFF, ON, OFF…) to cancel API drift. Runs are
// serial and spaced by --gap seconds because the Gemini free tier allows only
// ~15 requests/minute. Writes scripts/latency-results.csv and prints medians.
import { writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const RUNS = Number(arg("runs", 3));
const GAP_S = Number(arg("gap", 15));
const URL_BASE = arg("url", "http://localhost:3000");

// Each run gets unique dates so the server's hotel cache (6h, keyed on
// city+dates) can't hand one mode free results the other had to pay for.
const day = (offset) => new Date(Date.UTC(2027, 0, 5 + offset)).toISOString().slice(0, 10);
const PROMPTS = [
  (n) =>
    `Plan a 5 day trip from New York to Lisbon departing ${day(n)} returning ${day(n + 5)}, budget $2500 total, I love food and museums.`,
  (n) =>
    `Plan a long weekend from London to Rome departing ${day(n)} returning ${day(n + 3)}, budget 1500 USD, I like history and good restaurants.`,
];
let uniqueCounter = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOnce(prompt, speculative, id) {
  const t0 = performance.now();
  const res = await fetch(`${URL_BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-speculative-search": String(speculative) },
    body: JSON.stringify({
      id,
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: prompt }] }],
    }),
  });
  const out = { clientFirstCardMs: null, clientEndMs: null, cards: 0, error: "", server: {} };
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const part = JSON.parse(line.slice(6));
      const now = Math.round(performance.now() - t0);
      if (part.type === "data-searchResult") {
        out.cards++;
        out.clientFirstCardMs ??= now;
      } else if (part.type === "data-timing") {
        out.server[part.data.event] = part.data.ms;
      } else if (part.type === "error") {
        out.error = String(part.errorText).slice(0, 120);
      }
    }
  }
  out.clientEndMs = Math.round(performance.now() - t0);
  return out;
}

const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};

const rows = [];
let first = true;
for (let r = 0; r < RUNS; r++) {
  for (const [pi, prompt] of PROMPTS.entries()) {
    // Alternate which mode goes first so neither always benefits from warm caches.
    const order = (r + pi) % 2 === 0 ? [true, false] : [false, true];
    for (const speculative of order) {
      if (!first) await sleep(GAP_S * 1000);
      first = false;
      const id = `study-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const o = await runOnce(prompt(uniqueCounter++ * 7), speculative, id);
      const row = {
        prompt: pi,
        run: r,
        mode: speculative ? "speculative" : "tools-only",
        firstCardMs: o.clientFirstCardMs,
        finalAnswerMs: o.clientEndMs,
        prefsMs: o.server.preferences ?? null,
        cards: o.cards,
        error: o.error,
        // A run that produced no cards was a clarification or failure, not a real planning turn.
        valid: !o.error && o.cards > 0,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
}

const header = Object.keys(rows[0]).join(",");
writeFileSync(
  new URL("./latency-results.csv", import.meta.url),
  [header, ...rows.map((x) => Object.values(x).map((v) => JSON.stringify(v ?? "")).join(","))].join("\n"),
);

console.log("\nMedians over successful runs (ms):");
for (const mode of ["speculative", "tools-only"]) {
  const all = rows.filter((x) => x.mode === mode);
  const ok = all.filter((x) => x.valid);
  console.log(
    `${mode.padEnd(12)} valid=${ok.length}/${all.length}  firstCard=${median(ok.map((x) => x.firstCardMs))}  finalAnswer=${median(ok.map((x) => x.finalAnswerMs))}`,
  );
}
