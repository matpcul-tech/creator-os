import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.contact.create({
    data: {
      name: body.name ?? "Untitled",
      handle: body.handle ?? "",
      email: body.email ?? "",
      type: body.type ?? "fan",
      platform: body.platform ?? "",
      notes: body.notes ?? "",
      lastTouchAt: body.lastTouchAt ? new Date(body.lastTouchAt) : null,
    },
  });
  return NextResponse.json(item);
}
