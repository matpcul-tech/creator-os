import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { z } from "zod";
import { authorizeProduce } from "@/lib/produce/auth";
import { renderThumbnailPng, THUMB_EXPORT, type ThumbExportFormat } from "@/lib/thumbnail/card";

export const maxDuration = 60;

const schema = z.object({
  text: z.string().min(1).max(80),
  format: z.enum(["youtube", "vertical"]),
  scale: z.number().min(0.6).max(1.6).optional(),
  store: z.boolean().optional(),
});

// POST /api/thumbnails/render draws the channel card and returns a PNG.
// store: true uploads that PNG and returns its public URL instead.
export async function POST(req: Request) {
  const auth = authorizeProduce(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid thumbnail" }, { status: 400 });
  }
  const format = parsed.data.format as ThumbExportFormat;
  const png = renderThumbnailPng(parsed.data.text, format, parsed.data.scale ?? 1);
  const size = THUMB_EXPORT[format];
  if (parsed.data.store) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not set." }, { status: 500 });
    }
    const blob = await put(`thumbnails/${format}-${size.w}x${size.h}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
    });
    return NextResponse.json({ url: blob.url, width: size.w, height: size.h, format });
  }
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
