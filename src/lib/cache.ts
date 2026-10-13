import Redis from "ioredis";

// Shared cache backed by Redis when REDIS_URL is set; otherwise (or if Redis
// is unreachable) it degrades to a per-process in-memory Map so the app never
// depends on Redis being up.

const memory = new Map<string, { expires: number; value: string }>();
let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) return (client = null);
  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => console.warn(`[cache] redis: ${err.message}`));
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const redis = getClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // fall through to memory
    }
  }
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return JSON.parse(hit.value) as T;
  return undefined;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const raw = JSON.stringify(value);
  memory.set(key, { expires: Date.now() + ttlSeconds * 1000, value: raw });
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.set(key, raw, "EX", ttlSeconds);
  } catch {
    // memory copy already written
  }
}
