import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } },
) {
  await prisma.revenueEntry.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
