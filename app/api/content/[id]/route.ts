import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  const item = await prisma.contentPiece.findUnique({
    where: { id: Number(params.id) },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const body = await req.json();
  const data: Record<string, unknown> = {
    title: body.title,
    status: body.status,
    body: body.body,
    hook: body.hook,
    cta: body.cta,
    thumbnailIdea: body.thumbnailIdea,
    notes: body.notes,
  };

  if (Array.isArray(body.platforms)) data.platforms = stringifyJSON(body.platforms);
  if (body.variants) data.variants = stringifyJSON(body.variants);
  if (Array.isArray(body.tags)) data.tags = stringifyJSON(body.tags);
  if (body.scheduledAt !== undefined)
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.publishedAt !== undefined)
    data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;

  if (body.status === "published" && !body.publishedAt) {
    data.publishedAt = new Date();
  }

  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const item = await prisma.contentPiece.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  await prisma.contentPiece.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
