import { NextResponse } from "next/server";
import { complete } from "@/lib/anthropic";
import { BudgetExceededError, budgetErrorResponse } from "@/lib/ai-budget";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { DISCLOSURE, cleanName, finalize, hashtagsFor, templateScript, type ShopScript } from "@/lib/shop/video";

const schema = {
  type: "object",
  properties: {
    hook: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
    cta: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["hook", "lines", "cta", "caption", "hashtags"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const limit = rateLimit(`ai:${clientIp(req)}`, 30, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  const body = (await req.json().catch(() => ({}))) as {
    name?: string; category?: string; price?: number; benefits?: string; audience?: string; avoid?: string[];
  };
  const name = cleanName(String(body.name ?? "")).slice(0, 200);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const input = { name, category: body.category, price: Number(body.price) || undefined, benefits: body.benefits, audience: body.audience };

  const prompt = `Write a TikTok Shop affiliate video script for a real person holding and demoing the product on camera.
Product: ${name}
Category: ${body.category ?? "unknown"}
Price: ${input.price ? "$" + input.price : "unknown"}
What the creator noticed using it: ${body.benefits || "not given; keep claims general and honest"}
Audience: ${body.audience || "general TikTok shoppers"}
Rules:
- hook: one punchy first line under 12 words that stops the scroll.
- lines: 3 to 5 short spoken lines (under 16 words each) that show the product in use. Only claims a buyer can see in the video or on the product page. No medical, income, or before and after promises. Do not change size, color, or features.
- cta: one line pointing to the orange cart or product link.
- Do NOT include the disclosure; the app adds "${DISCLOSURE}" automatically.
- caption: one short post caption line, no hashtags.
- hashtags: 4 to 6 relevant hashtags including #tiktokshop.
- Never use em dashes or en dashes.
${body.avoid?.length ? `- Do not reuse these earlier hooks: ${body.avoid.slice(0, 10).join(" | ")}` : ""}`;

  try {
    const raw = await complete({ user: prompt, jsonSchema: schema, feature: "shop-script", maxTokens: 2000 });
    const parsed = JSON.parse(raw) as ShopScript;
    if (!parsed.hook || !Array.isArray(parsed.lines)) throw new Error("bad shape");
    const merged = { ...parsed, hashtags: Array.from(new Set([...(parsed.hashtags ?? []), ...hashtagsFor(input)])).slice(0, 8) };
    return NextResponse.json({ script: finalize(merged), source: "ai" });
  } catch (e) {
    if (e instanceof BudgetExceededError) return budgetErrorResponse(e);
    // AI not configured or failed: fall back to the template so the tool still works.
    return NextResponse.json({ script: templateScript(input), source: "template" });
  }
}
