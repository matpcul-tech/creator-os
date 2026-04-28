import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await prisma.contentPiece.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.contentPiece.create({
    data: {
      title: body.title ?? "Untitled",
      status: body.status ?? "idea",
      platforms: stringifyJSON(body.platforms ?? []),
      body: body.body ?? "",
      variants: stringifyJSON(body.variants ?? {}),
      hook: body.hook ?? "",
      cta: body.cta ?? "",
      tags: stringifyJSON(body.tags ?? []),
      thumbnailIdea: body.thumbnailIdea ?? "",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      notes: body.notes ?? "",
    },
  });
  return NextResponse.json(item);
}
