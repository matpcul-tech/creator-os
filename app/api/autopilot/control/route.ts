import { NextResponse } from "next/server";
import { z } from "zod";
import { canWrite, runNow, setPaused } from "@/lib/autopilot/github";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  action: z.enum(["pause", "resume", "run"]),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const limit = rateLimit(`autopilot:${clientIp(req)}`, 10, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  if (!canWrite()) {
    return NextResponse.json({ error: "Add GITHUB_AUTOPILOT_TOKEN in Vercel to control autopilot from here." }, { status: 400 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const { action, dryRun = false, force = false } = parsed.data;
    if (action === "run") await runNow({ dryRun, force });
    else await setPaused(action === "pause");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
