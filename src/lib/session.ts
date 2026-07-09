const THREAD_ID_STORAGE_KEY = "agentictravel:threadId";

/**
 * Returns a stable thread id for this browser, persisted in localStorage,
 * so the server's LangGraph MemorySaver checkpoint (keyed by thread_id) is
 * reused across page reloads instead of starting a fresh conversation.
 * Browser-only — must not be called during server rendering.
 */
export function getOrCreateThreadId(): string {
  const existing = window.localStorage.getItem(THREAD_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.localStorage.setItem(THREAD_ID_STORAGE_KEY, created);
  return created;
}
