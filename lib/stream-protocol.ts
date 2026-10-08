// How a streamed AI script tells the browser it finished, or why it did not.
// The server ends every stream with exactly one marker line. A stream with no
// marker was cut off on the way (network drop, function killed), and the
// browser treats that like an error, offering Continue.

export const DONE_MARKER = "\n[[cai:done]]";
export const ERROR_MARKER = "\n[[cai:error]]";

export type StreamState = { text: string; done: boolean; error: string | null };

/** Split a (possibly partial) stream buffer into the script text and its ending. */
export function readStream(buf: string): StreamState {
  const errAt = buf.indexOf(ERROR_MARKER);
  if (errAt >= 0) {
    const error = buf.slice(errAt + ERROR_MARKER.length).trim() || "The writer stopped early.";
    return { text: buf.slice(0, errAt).trimEnd(), done: false, error };
  }
  const doneAt = buf.indexOf(DONE_MARKER);
  if (doneAt >= 0) return { text: buf.slice(0, doneAt).trimEnd(), done: true, error: null };
  // Hide a marker that is still arriving, e.g. "\n[[cai:do".
  const tail = buf.lastIndexOf("\n[[");
  const text = tail >= 0 && buf.length - tail < 20 ? buf.slice(0, tail) : buf;
  return { text, done: false, error: null };
}

/** Continue automatically only when the model hit its token limit, and only a few times. */
export function shouldContinue(stopReason: string | null | undefined, round: number, maxRounds = 3): boolean {
  return stopReason === "max_tokens" && round < maxRounds;
}

export const CONTINUE_NUDGE =
  "You stopped before the end. Continue the script from exactly where it stops. " +
  "Begin your reply by repeating the last five words written so far, word for word, then keep going. " +
  "Do not restart, do not summarize, and do not add any note about continuing.";

/** The conversation for a continuation: the original ask, what was written, and a nudge. */
export function continuationMessages(user: string, soFar: string): { role: "user" | "assistant"; content: string }[] {
  const written = soFar.trimEnd();
  if (!written) return [{ role: "user", content: user }];
  return [
    { role: "user", content: user },
    { role: "assistant", content: written },
    { role: "user", content: CONTINUE_NUDGE },
  ];
}

/**
 * Join a continuation onto what came before. The model is asked to repeat the
 * last few words, so the overlap is removed. Without an overlap the pieces are
 * joined with a space, or a line break when the next piece starts a new line.
 */
export function joinContinuation(prev: string, next: string): string {
  const body = prev.trimEnd();
  const add = next.replace(/^\s+/, "");
  if (!body) return add;
  if (!add) return body;
  const window = body.slice(-300);
  for (let len = Math.min(window.length, add.length); len >= 8; len--) {
    if (window.endsWith(add.slice(0, len))) return body + add.slice(len);
  }
  // Loose match: the repeated words may differ in spacing or line breaks.
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  const tailWords = norm(body).trim().split(" ").slice(-5);
  for (let count = tailWords.length; count >= 3; count--) {
    const phrase = tailWords.slice(-count).join(" ");
    const head = norm(add).trimStart();
    if (head.startsWith(phrase)) {
      // Drop the same number of words from the start of the continuation.
      let rest = add;
      for (let i = 0; i < count; i++) rest = rest.replace(/^\s*\S+/, "");
      return body + rest;
    }
  }
  const sep = /^\n/.test(next) || /[.!?]$/.test(body) ? "\n\n" : " ";
  return body + sep + add;
}
