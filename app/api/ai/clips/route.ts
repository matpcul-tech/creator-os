import { allowedImage, pickPhotos, WIKI_UA } from "@/lib/cut/clips";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_LINES = 60;

function strings(value: unknown, max: number, len: number): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, max).map((v) => v.slice(0, len)) : [];
}

export async function POST(req: Request) {
  const limit = rateLimit(`clips:${clientIp(req)}`, 20, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  const body = (await req.json().catch(() => null)) as
    | { lines?: unknown; topic?: unknown; exclude?: unknown; offset?: unknown; extra?: unknown }
    | null;
  const lines = strings(body?.lines, MAX_LINES, 280);
  if (!lines.length) return Response.json({ clips: [], items: [], pool: [] });
  const topic = typeof body?.topic === "string" ? body.topic.slice(0, 300) : "";
  const exclude = strings(body?.exclude, 500, 1000);
  const offset = typeof body?.offset === "number" ? body.offset : 0;
  const extra = typeof body?.extra === "number" ? Math.max(0, Math.min(40, Math.floor(body.extra))) : 0;
  const { picks, pool } = await pickPhotos({ lines, topic, exclude, offset, extra });
  const view = (p: (typeof pool)[number]) => ({ src: p.src, url: p.url, title: p.title, credit: p.credit });
  return Response.json({
    clips: picks.map((p) => p?.url ?? null),
    items: picks.map((p) => (p ? view(p) : null)),
    pool: pool.map(view),
  });
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
