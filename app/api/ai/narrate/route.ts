import { scoreNarration, voiceConfigured } from "@/lib/cut/narrate";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { BudgetExceededError, assertWithinVoiceLimit, recordUsage } from "@/lib/ai-budget";

export const maxDuration = 60;

export async function GET() {
  return Response.json({ ready: voiceConfigured() });
}

export async function POST(req: Request) {
  const limit = rateLimit(`voice:${clientIp(req)}`, 40, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as { text?: unknown; voiceId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "orion";
  try {
    await assertWithinVoiceLimit();
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return Response.json({ ok: false, error: e.message, code: "budget_exceeded" }, { status: 429 });
    }
    throw e;
  }
  const result = await scoreNarration(text, voiceId);
  // Count every voiceover toward the daily voice limit. The default voice
  // providers are free, so cost is logged as 0 here.
  if (result.ok) await recordUsage({ provider: "voice", feature: "voice", inputTokens: text.length });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
