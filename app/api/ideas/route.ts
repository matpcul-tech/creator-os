import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    where: { archived: false },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(ideas);
}

export async function POST(req: Request) {
  const body = await req.json();
  const idea = await prisma.idea.create({
    data: {
      title: body.title ?? "Untitled",
      hook: body.hook ?? "",
      angle: body.angle ?? "",
      platform: body.platform ?? "any",
      tags: stringifyJSON(body.tags ?? []),
      score: typeof body.score === "number" ? body.score : 0,
      source: body.source ?? "manual",
    },
  });
  return NextResponse.json(idea);
}
