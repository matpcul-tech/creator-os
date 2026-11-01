// Browser call for one batch of stock photos. A stalled route must reject,
// or the Studio status stays on "Finding photos" with the counter at 0.

import { PhotoSearchError } from "./place-photos";

const CLIPS_TIMEOUT_MS = 30000;

export async function clipsRequest<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(CLIPS_TIMEOUT_MS);
  const merged = signal ? AbortSignal.any([signal, timeout]) : timeout;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/ai/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: merged,
      });
    } catch (error) {
      throw asSearchError(error);
    }
    if (res.status === 429 && attempt === 0) {
      const waitMs = Math.min(10, Number(res.headers.get("retry-after")) || 3) * 1000;
      await wait(waitMs, merged);
      if (merged.aborted) throw asSearchError(merged.reason);
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok) {
      const message = typeof json.error === "string" && json.error.trim() ? json.error.trim() : "Photo search failed.";
      throw new PhotoSearchError(message);
    }
    return json as T;
  }
  throw new PhotoSearchError("Photo search failed.");
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(asSearchError(signal.reason));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

function asSearchError(error: unknown): Error {
  if (error instanceof PhotoSearchError) return error;
  if (error instanceof Error && error.name === "AbortError") return error;
  if (error instanceof Error && error.name === "TimeoutError") return new PhotoSearchError("Photo search timed out.");
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "TimeoutError") {
    return new PhotoSearchError("Photo search timed out.");
  }
  return new PhotoSearchError("Photo search failed.");
}
