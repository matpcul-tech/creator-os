import { scoreNarration, voiceConfigured } from "@/lib/cut/narrate";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
  const result = await scoreNarration(text, voiceId);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
