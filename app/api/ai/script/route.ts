import { streamCompletion } from "@/lib/anthropic";
import { scriptPrompt } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";

export async function POST(req: Request) {
  const body = await req.json();
  const title: string = body.title ?? "";
  const platform: PlatformId = body.platform ?? "youtube";
  const context: string | undefined = body.context;

  if (!title) {
    return new Response(JSON.stringify({ error: "title required" }), {
      status: 400,
    });
  }

  const stream = await streamCompletion({
    user: scriptPrompt({ title, platform, context }),
    effort: "xhigh",
    maxTokens: 8000,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
