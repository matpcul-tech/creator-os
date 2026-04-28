import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function GET() {
  const brand = await prisma.brand.findFirst();
  return NextResponse.json(brand ?? {});
}

export async function POST(req: Request) {
  const body = await req.json();
  const data: Record<string, unknown> = {
    primaryColor: body.primaryColor ?? undefined,
    accentColor: body.accentColor ?? undefined,
    bgColor: body.bgColor ?? undefined,
    fgColor: body.fgColor ?? undefined,
    headingFont: body.headingFont ?? undefined,
    bodyFont: body.bodyFont ?? undefined,
    logoEmoji: body.logoEmoji ?? undefined,
    logoUrl: body.logoUrl ?? undefined,
  };
  if (Array.isArray(body.taglines)) data.taglines = stringifyJSON(body.taglines);
  if (Array.isArray(body.voiceRules)) data.voiceRules = stringifyJSON(body.voiceRules);
  if (Array.isArray(body.doNotUse)) data.doNotUse = stringifyJSON(body.doNotUse);

  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const existing = await prisma.brand.findFirst();
  const brand = existing
    ? await prisma.brand.update({ where: { id: existing.id }, data })
    : await prisma.brand.create({ data });

  return NextResponse.json(brand);
}
