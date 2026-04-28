import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const data: Record<string, unknown> = {
    name: body.name,
    handle: body.handle,
    email: body.email,
    type: body.type,
    platform: body.platform,
    notes: body.notes,
  };
  if (body.lastTouchAt !== undefined)
    data.lastTouchAt = body.lastTouchAt ? new Date(body.lastTouchAt) : null;
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const item = await prisma.contact.update({
    where: { id: Number(params.id) },
    data,
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  await prisma.contact.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
