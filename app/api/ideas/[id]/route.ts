import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const body = await req.json();
  const data: Record<string, unknown> = {
    title: body.title,
    hook: body.hook,
    angle: body.angle,
    platform: body.platform,
    score: body.score,
    archived: body.archived,
  };
  if (Array.isArray(body.tags)) data.tags = stringifyJSON(body.tags);
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const idea = await prisma.idea.update({ where: { id }, data });
  return NextResponse.json(idea);
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  await prisma.idea.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
