import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { authorizeProduce } from "@/lib/produce/auth";
import { createJob, ensureContent, newJobId, patchJob, viewJob } from "@/lib/produce/jobs";
import { runProduceJob } from "@/lib/produce/pipeline";
import { parseProduceBody } from "@/lib/produce/validate";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

// Starts a faceless render and returns immediately. Poll GET /api/produce/{jobId}.
// Session cookie (Studio) or Authorization: Bearer CREATOR_OS_API_TOKEN.
export async function POST(req: Request) {
  const auth = authorizeProduce(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = rateLimit(`produce:${clientIp(req)}`, 8, 10 * 60);
  if (!limit.ok) return rateLimitResponse(limit);

  let body: ReturnType<typeof parseProduceBody>;
  try {
    body = parseProduceBody(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const jobId = newJobId();
  try {
    await createJob(jobId, body.contentId, body);
    const contentId = await ensureContent({
      contentId: body.contentId,
      title: body.title,
      aspect: body.aspect,
      script: body.scenes.map((scene) => scene.narration).join("\n\n"),
      jobId,
    });
    const row = await patchJob(jobId, { contentId });
    const task = runProduceJob(jobId);
    waitUntil(task);
    return NextResponse.json({ ...viewJob(row), contentId, poll: `/api/produce/${jobId}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the render.";
    const status = /not found/i.test(message) ? 404 : 500;
    await patchJob(jobId, { status: "failed", error: message, message }).catch(() => undefined);
    console.error("produce start failed", jobId, message);
    return NextResponse.json({ error: message }, { status });
  }
}
