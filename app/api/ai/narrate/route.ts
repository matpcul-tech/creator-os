import { MAX_VOICE_CHARS, MAX_VOICE_SEGMENTS, scoreNarration, scoreSegments, voiceConfigured } from "@/lib/cut/narrate";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { BudgetExceededError, assertWithinVoiceLimit, dailyVoiceLimit, recordUsage, voicesUsedToday } from "@/lib/ai-budget";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// `left` is how many voice requests today's limit still allows, so the browser can say up front
// when a long script needs more than that instead of stopping part way.
export async function GET() {
  const limit = dailyVoiceLimit();
  const used = await voicesUsedToday().catch(() => null);
  return Response.json({
    ready: voiceConfigured(),
    limit,
    left: used === null ? null : Math.max(0, limit - used),
    maxChars: MAX_VOICE_CHARS,
    maxSegments: MAX_VOICE_SEGMENTS,
  });
}

export async function POST(req: Request) {
  const limit = rateLimit(`voice:${clientIp(req)}`, 40, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as { text?: unknown; voiceId?: unknown; segments?: unknown } | null;
  const segments = Array.isArray(body?.segments) ? body.segments.filter((item): item is string => typeof item === "string") : null;
  const text = segments ? segments.join(" ") : typeof body?.text === "string" ? body.text : "";
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "orion";
  // One request reads a bounded amount so it finishes in time. The app sends long scripts in parts.
  if (text.length > MAX_VOICE_CHARS || (segments && segments.length > MAX_VOICE_SEGMENTS)) {
    return Response.json(
      { ok: false, error: `One voice request reads up to ${MAX_VOICE_CHARS} characters. Send the script in parts.`, code: "too_long" },
      { status: 413 },
    );
  }
  try {
    await assertWithinVoiceLimit();
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return Response.json({ ok: false, error: e.message, code: "budget_exceeded" }, { status: 429 });
    }
    throw e;
  }
  const result = segments ? await scoreSegments(segments, voiceId) : await scoreNarration(text, voiceId);
  // Count every voiceover toward the daily voice limit. The default voice
  // providers are free, so cost is logged as 0 here.
  if (result.ok) await recordUsage({ provider: "voice", feature: "voice", inputTokens: text.length });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
