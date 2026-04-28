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

  // First non-empty URL becomes the canonical publishUrl.
  const firstUrl = Object.values(cleaned)[0] ?? "";

  const item = await prisma.contentPiece.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: new Date(),
      publishUrl: firstUrl,
      publishUrls: stringifyJSON(cleaned),
    },
  });

  return NextResponse.json(item);
}
