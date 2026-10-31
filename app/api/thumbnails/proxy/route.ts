import { NextResponse } from "next/server";

const HOSTS = new Set([
  "images.pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
]);

// Same-origin copy of a stock photo so the thumbnail canvas can export it.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Missing image url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "That image host is not allowed." }, { status: 400 });
  }
  const upstream = await fetch(target, { redirect: "error" }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "That photo didn't load." }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") || "";
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "That file is not an image." }, { status: 415 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
