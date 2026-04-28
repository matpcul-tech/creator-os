import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.sponsor.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.sponsor.create({
    data: {
      brand: body.brand ?? "Untitled",
      contactName: body.contactName ?? "",
      contactEmail: body.contactEmail ?? "",
      status: body.status ?? "prospect",
      amount: typeof body.amount === "number" ? body.amount : 0,
      deliverables: body.deliverables ?? "",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? "",
    },
  });
  return NextResponse.json(item);
}
