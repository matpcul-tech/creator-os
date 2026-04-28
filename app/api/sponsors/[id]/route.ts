import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const data: Record<string, unknown> = {
    brand: body.brand,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    status: body.status,
    amount: typeof body.amount === "number" ? body.amount : undefined,
    deliverables: body.deliverables,
    notes: body.notes,
  };
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const item = await prisma.sponsor.update({
    where: { id: Number(params.id) },
    data,
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  await prisma.sponsor.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
