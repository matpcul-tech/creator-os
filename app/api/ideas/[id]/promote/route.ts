import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Promote an Idea to a draft ContentPiece in the planner.
export async function POST(
  _: Request,
  { params }: { params: { id: string } },
) {
  const idea = await prisma.idea.findUnique({
    where: { id: Number(params.id) },
  });
  if (!idea) return NextResponse.json({ error: "not found" }, { status: 404 });

  const platforms = idea.platform === "any" ? "[]" : JSON.stringify([idea.platform]);

  const piece = await prisma.contentPiece.create({
    data: {
      title: idea.title,
      hook: idea.hook,
      status: "draft",
      platforms,
      tags: idea.tags,
      notes: idea.angle,
    },
  });

  await prisma.idea.update({
    where: { id: idea.id },
    data: { archived: true },
  });

  return NextResponse.json(piece);
}
