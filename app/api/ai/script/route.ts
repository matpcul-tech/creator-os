import { streamCompletion } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { scriptPrompt } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  continuationRuleNote,
  injectPreviousResult,
  readOptionalFinite,
  rewriteFeedback,
  ruleRejection,
  scriptRuleViolations,
} from "@/lib/script-rules";
import { joinContinuation, readStream, type StreamState } from "@/lib/stream-protocol";

// Long scripts can take a while to stream, and may auto-continue. Pro plan allows this.
export const maxDuration = 300;

const HARD_RULE_CONTEXT =
  "No em dashes. No en dashes. The opening (hook section, or the first 50 words) must contain a concrete fact or a question: a question mark, number, date, percent, dollar amount, or named entity. End with an explicit takeaway or close line, for example: Takeaway: one sentence the viewer should remember.";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const title: string = body.title ?? "";
  const platform: PlatformId = body.platform ?? "youtube";
  const context: string | undefined = body.context;
  // Text already written, when the user presses Continue after a stream stopped.
  const partial: string | undefined = typeof body.partial === "string" ? body.partial.slice(0, 40000) : undefined;

  if (!title) {
    return new Response(JSON.stringify({ error: "title required" }), {
      status: 400,
    });
  }

  const lastCtr = readOptionalFinite(body.lastCtr, "lastCtr");
  const lastRetention = readOptionalFinite(body.lastRetention, "lastRetention");
  if (!lastCtr.ok || !lastRetention.ok) {
    const problems = [!lastCtr.ok ? lastCtr.error : "", !lastRetention.ok ? lastRetention.error : ""].filter(Boolean);
    return jsonError({ error: problems.join(". ") }, 400);
  }

  try {
    // Performance numbers, when the client sends them, are part of the script prompt.
    const enforcedContext = [context, HARD_RULE_CONTEXT].filter(Boolean).join("\n\n");
    const user = injectPreviousResult(
      scriptPrompt({ title, platform, context: thinTitleNote(title, enforcedContext) }),
      lastCtr.value,
      lastRetention.value,
    );

    const first = await generateDraft(user, partial);
    // A paused or failed stream keeps the existing Continue / error behavior.
    if (!first.state.done) return textResponse(first.raw);

    const full = draftText(partial, first.state.text);
    const violations = scriptRuleViolations(full);
    if (violations.length === 0) return textResponse(first.raw);

    // One retry with feedback, then reject the draft if it still misses a rule.
    const second = partial?.trim()
      ? await generateDraft(user, partial, continuationRuleNote(violations))
      : await generateDraft(`${user}\n\n${rewriteFeedback(violations, full)}`);
    if (!second.state.done) return textResponse(second.raw);

    const again = scriptRuleViolations(draftText(partial, second.state.text));
    if (again.length === 0) return textResponse(second.raw);
    return jsonError(ruleRejection(again), 422);
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

async function generateDraft(
  user: string,
  partial?: string,
  continuationNote?: string,
): Promise<{ raw: string; state: StreamState }> {
  const stream = await streamCompletion({
    user,
    feature: "script",
    noThinking: true,
    maxTokens: 8000,
    partial,
    continuationNote,
  });
  const raw = await textFromStream(stream);
  return { raw, state: readStream(raw) };
}

function draftText(partial: string | undefined, generated: string): string {
  if (!partial?.trim()) return generated.trim();
  return joinContinuation(partial, generated);
}

async function textFromStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: !done });
    }
    raw += decoder.decode();
    return raw;
  } finally {
    reader.releaseLock();
  }
}

function textResponse(body: string): Response {
  return new Response(body, { headers: TEXT_HEADERS });
}

function jsonError(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Short titles make the model drift. Pin it to the literal topic.
function thinTitleNote(title: string, context?: string): string | undefined {
  const words = title.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 3) return context;
  const note =
    "The title is very short. Stay strictly on the literal topic of the title. Do not switch to a different or broader subject.";
  return context ? `${context}\n\n${note}` : note;
}
