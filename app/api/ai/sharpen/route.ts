import { sharpenCards } from "@/lib/cut/narrate";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limit = rateLimit(`sharpen:${clientIp(req)}`, 20, 60);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = (await req.json().catch(() => null)) as { narrations?: unknown } | null;
  const narrations = Array.isArray(body?.narrations)
    ? body.narrations.filter((item): item is string => typeof item === "string")
    : [];
  const result = await sharpenCards(narrations);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
