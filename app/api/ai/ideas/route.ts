import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { ideaBatchPrompt, ideaBatchSchema } from "@/lib/prompts";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

type AIIdea = {
  title: string;
  hook: string;
  angle: string;
  platform: string;
  tags: string[];
  score: number;
};

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const count = Math.min(Math.max(body.count ?? 8, 1), 20);
  const topic: string | undefined = body.topic;
  const save: boolean = body.save !== false;

  try {
    const raw = await complete({
      user: ideaBatchPrompt({ count, topic }),
      jsonSchema: ideaBatchSchema as unknown as Record<string, unknown>,
      effort: "high",
      maxTokens: 6000,
    });

    let parsed: { ideas: AIIdea[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI returned non-JSON", raw },
        { status: 500 },
      );
    }

    const ideas = parsed.ideas ?? [];

    if (save) {
      await prisma.idea.createMany({
        data: ideas.map((i) => ({
          title: i.title,
          hook: i.hook,
          angle: i.angle,
          platform: i.platform || "any",
          tags: stringifyJSON(i.tags ?? []),
          score: i.score ?? 0,
          source: "ai",
        })),
      });
    }

    return NextResponse.json({ ideas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
