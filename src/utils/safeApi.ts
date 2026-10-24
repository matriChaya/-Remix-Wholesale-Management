/**
 * Safe API response and JSON parsing utilities.
 * Eliminates "Unexpected end of JSON input" and unhandled syntax errors.
 */

/**
 * Safely parse any API response as JSON without throwing "Unexpected end of JSON input".
 * Uses the required fail-safe pattern:
 *   const text = await res.text();
 *   const data = text ? JSON.parse(text) : {};
 */
export async function safeParseResponse<T = any>(res: Response, fallback: T = {} as T): Promise<T> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('[SafeApi] Non-JSON or empty response handled gracefully:', err);
    return fallback;
  }
}

/**
 * Safely parse a JSON string with fallback.
 */
export function safeJsonParse<T = any>(str: string | null | undefined, fallback: T): T {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safe fetch wrapper that always returns parsed data and never throws unhandled JSON parse exceptions.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: T = {} as T
): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    let data: T = fallback;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text) as T;
      } catch (parseErr) {
        console.warn('[SafeFetchJson] JSON parse warning on response:', parseErr);
        data = fallback;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch (netErr: any) {
    console.warn('[SafeFetchJson] Network error handled:', netErr?.message);
    return { ok: false, status: 0, data: fallback };
  }
}
