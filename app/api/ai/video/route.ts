import { NextResponse } from "next/server";
import { renderAvatarVideo, type HeyGenEngine } from "@/lib/heygen";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Submit a script for rendering into the creator's avatar + voice.
// Body: { script, title?, contentId?, avatarId?, voiceId?, engine? }
// avatarId/voiceId fall back to the creator's saved ids on Profile.
// If contentId is given, the piece is marked generating and stamped with the
// videoId so the poller can attach the finished MP4.
export async function POST(req: Request) {
  // Renders cost real money per minute, so this limit is tighter than text.
  const limit = rateLimit(`video:${clientIp(req)}`, 10, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json();
  const script: string = (body.script ?? "").trim();
  const title: string | undefined = body.title;
  const contentId: number | undefined = body.contentId
    ? Number(body.contentId)
    : undefined;
  const engine: HeyGenEngine = body.engine === "avatar_iv" ? "avatar_iv" : "avatar_v";

  if (!script) {
    return NextResponse.json({ error: "script required" }, { status: 400 });
  }

  // Simple cost guard. A minute of speech is roughly 150 words / ~900 chars.
  // Refuse anything that would bill as an unexpectedly long render.
  const MAX_CHARS = 6000;
  if (script.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `script too long for a render (${script.length} chars, cap ${MAX_CHARS})` },
      { status: 400 },
    );
  }

  const profile = await prisma.profile.findFirst();
  const avatarId: string = body.avatarId || profile?.heygenAvatarId || "";
  const voiceId: string = body.voiceId || profile?.heygenVoiceId || "";

  if (!avatarId || !voiceId) {
    return NextResponse.json(
      { error: "No avatar/voice set up yet. Connect HeyGen in integrations first." },
      { status: 400 },
    );
  }

  try {
    const { videoId, status } = await renderAvatarVideo({
      script,
      avatarId,
      voiceId,
      title,
      engine,
    });

    if (contentId) {
      await prisma.contentPiece.update({
        where: { id: contentId },
        data: { videoId, videoStatus: "generating", videoUrl: "" },
      }).catch(() => null);
    }

    return NextResponse.json({ videoId, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
