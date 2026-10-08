import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = {
  type: "object",
  properties: { angles: { type: "array", items: { type: "string" } } },
  required: ["angles"],
  additionalProperties: false,
};

// Turns a short or broad title ("Longevity science") into 3 specific angles.
// Small and fast: default (cheap) model, low effort, no extended thinking,
// small max tokens. Counted against the daily AI budget.
export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as
    | { title?: unknown; platform?: unknown; context?: unknown }
    | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Add a title first." }, { status: 400 });
  const plat = PLATFORMS[(typeof body?.platform === "string" ? body.platform : "") as PlatformId];
  const context = typeof body?.context === "string" ? body.context.trim().slice(0, 600) : "";

  try {
    const raw = await complete({
      user: [
        `The creator typed a short or broad video topic: "${title}".`,
        "Suggest exactly 3 specific, punchy angles for a short faceless video on this topic.",
        'Example: for "Longevity science", an angle could be "5 habits longevity researchers actually follow".',
        "Each angle is a ready-to-use video title of 4 to 10 words. Make each one concrete and different from the others.",
        "Stay on the topic. Fit the creator's niche from the profile when it is set.",
        plat ? `Platform: ${plat.name}.` : "",
        context ? `Extra context from the creator: ${context}` : "",
        "Do not use em dashes or en dashes. Use commas or plain words instead. No quotes, no emoji, no hashtags.",
        'Return JSON only: {"angles": ["...", "...", "..."]}',
      ].filter(Boolean).join("\n"),
      jsonSchema: schema,
      effort: "low",
      noThinking: true,
      maxTokens: 300,
      feature: "angles",
    });
    const parsed = JSON.parse(raw) as { angles?: string[] };
    const angles = (parsed.angles ?? [])
      .map((a) => a.replace(/\s*[\u2012\u2013\u2014\u2015]\s*/g, ", ").replace(/["\u201C\u201D]/g, "").replace(/\s+/g, " ").trim())
      .filter((a) => a.length > 3)
      .slice(0, 3);
    if (angles.length === 0) {
      return NextResponse.json({ error: "No angles came back." }, { status: 502 });
    }
    return NextResponse.json({ angles });
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
