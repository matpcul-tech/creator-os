import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.revenueEntry.findMany({
    orderBy: { date: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.revenueEntry.create({
    data: {
      source: body.source ?? "sponsor",
      label: body.label ?? "Untitled",
      amount: typeof body.amount === "number" ? body.amount : 0,
      date: body.date ? new Date(body.date) : new Date(),
      contentId: body.contentId ?? null,
      notes: body.notes ?? "",
    },
  });
  return NextResponse.json(item);
}
