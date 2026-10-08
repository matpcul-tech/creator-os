import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// GET /api/thumbnails?contentId=1  -> thumbnails attached to that piece (newest first)
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("contentId");
  const contentId = raw ? Number(raw) : NaN;
  if (!Number.isInteger(contentId)) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }
  const items = await prisma.thumbnail.findMany({
    where: { contentId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json(items);
}

const MAX_DATA_URL = 3_000_000; // about 2.2 MB of image data

const schema = z.object({
  contentId: z.number().int().positive().nullable().optional(),
  format: z.enum(["youtube", "vertical"]),
  text: z.string().max(200).default(""),
  dataUrl: z
    .string()
    .max(MAX_DATA_URL, "That image is too large to save.")
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Not a PNG or JPEG image."),
});

// POST: save a thumbnail, optionally attached to a content piece.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid thumbnail" },
      { status: 400 },
    );
  }
  const { contentId, format, text, dataUrl } = parsed.data;
  if (contentId) {
    const piece = await prisma.contentPiece.findUnique({ where: { id: contentId }, select: { id: true } });
    if (!piece) return NextResponse.json({ error: "Content piece not found" }, { status: 404 });
  }
  const item = await prisma.thumbnail.create({
    data: { contentId: contentId ?? null, format, text, dataUrl },
    select: { id: true, contentId: true, format: true, text: true, createdAt: true },
  });
  return NextResponse.json(item);
}
