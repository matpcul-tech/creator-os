import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { listAvatars, listVoices } from "@/lib/heygen";
import { prisma } from "@/lib/db";

// GET: list the avatars and voices on the connected HeyGen account so the
// creator can pick their own digital twin and cloned voice once during setup.
export async function GET() {
  try {
    const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);
    const profile = await prisma.profile.findFirst();
    return NextResponse.json({
      avatars,
      voices,
      selected: {
        avatarId: profile?.heygenAvatarId ?? "",
        voiceId: profile?.heygenVoiceId ?? "",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: save the chosen ids. Body: { avatarId, voiceId }
export async function POST(req: Request) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.avatarId === "string") data.heygenAvatarId = body.avatarId;
  if (typeof body.voiceId === "string") data.heygenVoiceId = body.voiceId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "avatarId or voiceId required" }, { status: 400 });
  }

  const existing = await prisma.profile.findFirst();
  const profile = existing
    ? await prisma.profile.update({ where: { id: existing.id }, data })
    : await prisma.profile.create({ data: data as Prisma.ProfileCreateInput });

  return NextResponse.json({
    avatarId: profile.heygenAvatarId,
    voiceId: profile.heygenVoiceId,
  });
}
