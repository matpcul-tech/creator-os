import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { BudgetExceededError, assertWithinVoiceLimit, recordUsage } from "@/lib/ai-budget";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Priority 1 production endpoint for Creator OS.
 * Accepts a script package (full script + scene cards) and returns ElevenLabs audio + render instructions.
 * Full MP4 assembly can be layered on top later.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`produce:${clientIp(req)}`, 10, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as {
    script?: string;
    scenes?: Array<{ title: string; narration: string; visual: string; duration?: number }>;
    voiceId?: string;
  } | null;

  if (!body?.script || !Array.isArray(body.scenes) || body.scenes.length === 0) {
    return Response.json({ ok: false, error: "Script and at least one scene card required" }, { status: 400 });
  }

  const voiceId = body.voiceId || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return Response.json({ ok: false, error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
  }

  try {
    await assertWithinVoiceLimit();
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return Response.json({ ok: false, error: e.message, code: "budget_exceeded" }, { status: 429 });
    }
    throw e;
  }

  // Generate audio for the full script via ElevenLabs
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: body.script,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    return Response.json({ ok: false, error: `ElevenLabs failed: ${err}` }, { status: 502 });
  }

  const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
  const audioBase64 = audioBuffer.toString("base64");

  await recordUsage({ provider: "elevenlabs", feature: "produce", inputTokens: body.script.length });

  return Response.json({
    ok: true,
    audioBase64,
    audioMime: "audio/mpeg",
    scenes: body.scenes,
    voiceId,
    // Render instructions for downstream FFmpeg / visual assembly
    renderPlan: {
      format: "vertical",
      durationEstimate: Math.ceil(body.script.length / 15), // rough seconds
      visualStyle: "diagrams-or-branded-background",
      captions: true,
    },
  });
}
