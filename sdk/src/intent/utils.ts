export function safeJson<T = unknown>(raw: string, debug = false): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    if (debug) {
      console.warn("[safeJson] Failed to parse:", err, "raw snippet:", raw.slice(0, 200));
    }
    return null;
  }
}
