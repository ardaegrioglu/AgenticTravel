// Verifies the live API keys in .env.local with one cheap call per provider.
// Usage: npm run check-keys   (never prints key values)
const env = process.env;
let failed = false;

function report(name, ok, detail) {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    report(name, true, detail);
  } catch (err) {
    report(name, false, err instanceof Error ? err.message : String(err));
  }
}

async function expectOk(res) {
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`HTTP ${res.status} ${res.statusText} ${body}`);
  }
  return res.json();
}

if (env.MOCK_PROVIDERS === "true") {
  console.log("WARN  MOCK_PROVIDERS=true — the app will not call Duffel/Foursquare.");
}

await check("Google Gemini", async () => {
  if (!env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is empty");
  const model = env.GOOGLE_GENAI_MODEL || "gemini-3.5-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GOOGLE_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK" }] }] }),
    },
  );
  const data = await expectOk(res);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("no text in response");
  return `model ${model} replied`;
});

await check("Duffel", async () => {
  if (!env.DUFFEL_API_KEY) throw new Error("DUFFEL_API_KEY is empty");
  if (!env.DUFFEL_API_KEY.startsWith("duffel_test_")) {
    console.log("WARN  DUFFEL_API_KEY is not a duffel_test_ token (live inventory!)");
  }
  const res = await fetch("https://api.duffel.com/places/suggestions?query=Lisbon", {
    headers: {
      Authorization: `Bearer ${env.DUFFEL_API_KEY}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
    },
  });
  const { data } = await expectOk(res);
  const hit = data.find((p) => p.iata_code);
  if (!hit) throw new Error("no place with an IATA code returned");
  return `Lisbon → ${hit.iata_code}`;
});

await check("Foursquare", async () => {
  if (!env.FOURSQUARE_API_KEY) throw new Error("FOURSQUARE_API_KEY is empty");
  const url = new URL("https://places-api.foursquare.com/places/search");
  url.searchParams.set("query", "restaurant");
  url.searchParams.set("near", "Lisbon");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.FOURSQUARE_API_KEY}`,
      "X-Places-Api-Version": "2025-06-17",
      Accept: "application/json",
    },
  });
  const data = await expectOk(res);
  const first = data.results?.[0];
  if (!first?.fsq_place_id) throw new Error("no result with fsq_place_id");
  return `found "${first.name}"`;
});

if (env.SERPAPI_API_KEY) {
  await check("SerpApi (Google Hotels)", async () => {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_hotels");
    url.searchParams.set("q", "Lisbon hotels");
    // Dates a month out keep results available; this spends 1 of the monthly searches.
    const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    url.searchParams.set("check_in_date", d(30));
    url.searchParams.set("check_out_date", d(33));
    url.searchParams.set("api_key", env.SERPAPI_API_KEY);
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`HTTP ${res.status} ${data.error ?? res.statusText}`);
    const priced = (data.properties ?? []).filter((p) => p.total_rate || p.rate_per_night);
    if (priced.length === 0) throw new Error("no properties with a price in the response");
    return `${priced.length} priced hotels`;
  });
} else {
  console.log("SKIP  SerpApi — SERPAPI_API_KEY not set (hotel prices fall back to Foursquare names)");
}

process.exit(failed ? 1 : 0);
