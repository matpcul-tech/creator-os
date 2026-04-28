import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function GET() {
  const profile = await prisma.profile.findFirst();
  return NextResponse.json(profile ?? {});
}

export async function POST(req: Request) {
  const body = await req.json();
  const data: Record<string, unknown> = {
    name: body.name ?? undefined,
    handle: body.handle ?? undefined,
    niche: body.niche ?? undefined,
    audience: body.audience ?? undefined,
    bio: body.bio ?? undefined,
    voice: body.voice ?? undefined,
    goals: body.goals ?? undefined,
    weeklyCadence: body.weeklyCadence ?? undefined,
  };

  if (Array.isArray(body.platforms)) {
    data.platforms = stringifyJSON(body.platforms);
  }
  if (body.complete) {
    data.onboardedAt = new Date();
  }

  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const existing = await prisma.profile.findFirst();
  const profile = existing
    ? await prisma.profile.update({ where: { id: existing.id }, data })
    : await prisma.profile.create({ data });

  return NextResponse.json(profile);
}
