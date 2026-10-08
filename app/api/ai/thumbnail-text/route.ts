import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = {
  type: "object",
  properties: {
    options: { type: "array", items: { type: "string" } },
  },
  required: ["options"],
  additionalProperties: false,
};

// Suggest short thumbnail text (3 to 5 words) on the cheap default model.
// Counted against the daily AI budget like every other call.
export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as { title?: unknown; hook?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  const hook = typeof body?.hook === "string" ? body.hook.trim().slice(0, 300) : "";
  if (!title && !hook) {
    return NextResponse.json({ error: "Add a title or hook first." }, { status: 400 });
  }

  try {
    const raw = await complete({
      user: [
        "Write 5 options for video thumbnail text.",
        "Each option is 3 to 5 words, punchy, readable at a glance, no hashtags, no emoji, no quotes, no dashes.",
        "Stay on the exact topic below. Do not invent numbers that are not in the title or hook.",
        `Title: ${title || "(none)"}`,
        `Hook: ${hook || "(none)"}`,
        'Return JSON: {"options": ["..."]}',
      ].join("\n"),
      jsonSchema: schema,
      effort: "low",
      maxTokens: 1500,
      feature: "thumbnail-text",
    });
    const parsed = JSON.parse(raw) as { options?: string[] };
    const options = (parsed.options ?? [])
      .map((o) => o.replace(/[\u2013\u2014]/g, " ").replace(/\s+/g, " ").trim())
      .filter((o) => o.length > 0 && o.split(" ").length <= 6)
      .slice(0, 5);
    return NextResponse.json({ options });
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
