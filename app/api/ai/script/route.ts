import { streamCompletion } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { scriptPrompt } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const title: string = body.title ?? "";
  const platform: PlatformId = body.platform ?? "youtube";
  const context: string | undefined = body.context;

  if (!title) {
    return new Response(JSON.stringify({ error: "title required" }), {
      status: 400,
    });
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await streamCompletion({
      user: scriptPrompt({ title, platform, context: thinTitleNote(title, context) }),
      feature: "script",
      maxTokens: 8000,
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

// Short titles make the model drift. Pin it to the literal topic.
function thinTitleNote(title: string, context?: string): string | undefined {
  const words = title.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 3) return context;
  const note =
    "The title is very short. Stay strictly on the literal topic of the title. Do not switch to a different or broader subject.";
  return context ? `${context}\n\n${note}` : note;
}
