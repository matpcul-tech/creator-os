import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stringifyJSON } from "@/lib/utils";

// Mark a content piece as published. Optionally records per-platform
// live URLs the user pasted in after posting.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const urls = (body.urls ?? {}) as Record<string, string>;

  const cleaned = Object.fromEntries(
    Object.entries(urls)
      .map(([k, v]) => [k, (v ?? "").trim()])
      .filter(([, v]) => v.length > 0),
  );

  // Merge with URLs saved earlier so posting one platform at a time keeps
  // the others. A new value for the same platform replaces the old one.
  const existing = await prisma.contentPiece.findUnique({ where: { id }, select: { publishUrls: true } });
  let previous: Record<string, string> = {};
  try {
    previous = JSON.parse(existing?.publishUrls || "{}") as Record<string, string>;
  } catch {
    previous = {};
  }
  const merged = { ...previous, ...cleaned };

  // First non-empty URL becomes the canonical publishUrl.
  const firstUrl = Object.values(merged)[0] ?? "";

  const item = await prisma.contentPiece.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: new Date(),
      publishUrl: firstUrl,
      publishUrls: stringifyJSON(merged),
    },
  });

  return NextResponse.json(item);
}
