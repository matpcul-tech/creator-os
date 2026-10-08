import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { connectorFor } from "@/lib/publish/connectors";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = {
  type: "object",
  properties: { caption: { type: "string" } },
  required: ["caption"],
  additionalProperties: false,
};

// Writes one caption for one platform. Default model, counted toward the cap.
export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as
    | { platform?: unknown; title?: unknown; script?: unknown; draft?: unknown }
    | null;
  const platform = typeof body?.platform === "string" ? body.platform : "";
  const plat = PLATFORMS[platform as PlatformId];
  if (!plat) return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  const title = typeof body?.title === "string" ? body.title.slice(0, 300) : "";
  const script = typeof body?.script === "string" ? body.script.slice(0, 4000) : "";
  const draft = typeof body?.draft === "string" ? body.draft.slice(0, 2000) : "";
  const max = connectorFor(platform)?.captionLimit ?? plat.charLimit ?? 2200;

  try {
    const raw = await complete({
      user: [
        `Write a post caption for ${plat.name} for this short faceless video.`,
        `Hard limit: ${max} characters. Keep it well under that for short-form platforms.`,
        "Open with a hook line. Add 2 to 4 relevant hashtags at the end where the platform uses them. No em dashes.",
        platform.startsWith("youtube") ? "For YouTube, write a description: 2 short paragraphs, then hashtags." : "",
        `Video title: ${title || "(none)"}`,
        script ? `Script:\n${script}` : "",
        draft ? `Improve this draft caption instead of starting over:\n${draft}` : "",
        'Return JSON: {"caption": "..."}',
      ].filter(Boolean).join("\n"),
      jsonSchema: schema,
      effort: "low",
      maxTokens: 2000,
      feature: "caption",
    });
    const parsed = JSON.parse(raw) as { caption?: string };
    const caption = (parsed.caption ?? "").replace(/[\u2014]/g, ", ").slice(0, max);
    return NextResponse.json({ caption });
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
