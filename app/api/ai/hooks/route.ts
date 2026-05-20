import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { hookBatchPrompt, hookBatchSchema } from "@/lib/prompts";
import type { PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const topic: string = body.topic ?? "";
  const count = Math.min(Math.max(body.count ?? 6, 1), 12);
  const platform: PlatformId | undefined = body.platform;

  if (!topic) {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  try {
    const raw = await complete({
      user: hookBatchPrompt({ topic, count, platform }),
      jsonSchema: hookBatchSchema as unknown as Record<string, unknown>,
      effort: "high",
      maxTokens: 2000,
    });
    const parsed = JSON.parse(raw) as { hooks: string[] };
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
