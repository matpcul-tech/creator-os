import { streamCompletion } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { scriptPrompt } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 300;

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const title: string = body.title ?? "";
  const platform: PlatformId = body.platform ?? "youtube";
  const context: string | undefined = body.context;
  const partial: string | undefined = typeof body.partial === "string" ? body.partial.slice(0, 40000) : undefined;

  if (!title) {
    return new Response(JSON.stringify({ error: "title required" }), {
      status: 400,
    });
  }

  const hardRules =
    "Hard rules: The first 20 seconds must state a concrete fact or question. One clear takeaway only. No pure recap. No em dashes. No en dashes. Use a period instead. One short sentence per line.";

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await streamCompletion({
      user: scriptPrompt({
        title,
        platform,
        context: `${context ?? ""}\n\n${hardRules}\n\n${thinTitleNote(title) ?? ""}`.trim(),
      }),
      feature: "script",
      noThinking: true,
      maxTokens: 8000,
      partial,
    });
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function thinTitleNote(title: string): string | undefined {
  const words = title.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 3) return undefined;
  return "The title is very short. Stay strictly on the literal topic of the title. Do not switch to a different or broader subject.";
}
