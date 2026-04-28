import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.analyticsSnapshot.findMany({
    orderBy: { capturedAt: "desc" },
    take: 200,
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.analyticsSnapshot.create({
    data: {
      contentId: body.contentId ?? null,
      platform: body.platform ?? "x",
      views: body.views ?? 0,
      likes: body.likes ?? 0,
      comments: body.comments ?? 0,
      shares: body.shares ?? 0,
      saves: body.saves ?? 0,
      followers: body.followers ?? 0,
      capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
    },
  });
  return NextResponse.json(item);
}
