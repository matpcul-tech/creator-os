import { allowedImage, matchClips, WIKI_UA } from "@/lib/cut/clips";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST(req: Request) {
  const limit = rateLimit(`clips:${clientIp(req)}`, 20, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body.lines.filter((line): line is string => typeof line === "string").slice(0, 20) : [];
  if (!lines.length) return Response.json({ clips: [] });
  const clips = await matchClips(lines.map((line) => line.slice(0, 280)));
  return Response.json({ clips });
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  const target = allowedImage(raw);
  if (!target) return new Response("no", { status: 400 });
  const image = await fetch(target, {
    headers: { "User-Agent": WIKI_UA },
    redirect: "follow",
  });
  if (!image.ok) return new Response("miss", { status: 404 });
  const type = image.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response("no", { status: 415 });
  return new Response(image.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
  });
}
