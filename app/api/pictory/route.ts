import { NextResponse } from "next/server";
import { createStoryboard, storyboardStatus } from "@/lib/pictory";

export async function POST(req: Request) {
  if (!process.env.PICTORY_API_KEY) {
    return NextResponse.json({ error: "Add PICTORY_API_KEY in Vercel, then redeploy." }, { status: 400 });
  }
  const body = await req.json();
  const title = String(body.title || "Creator OS cut");
  const script = String(body.script || "").trim();
  if (script.length < 20) return NextResponse.json({ error: "Script is too short." }, { status: 400 });
  try {
    const job = await createStoryboard(title, script);
    return NextResponse.json({ jobId: job.jobId || job.data?.jobId || null, raw: job });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function GET(req: Request) {
  if (!process.env.PICTORY_API_KEY) {
    return NextResponse.json({ error: "Add PICTORY_API_KEY in Vercel, then redeploy." }, { status: 400 });
  }
  const jobId = new URL(req.url).searchParams.get("jobId") || "";
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  try {
    return NextResponse.json(await storyboardStatus(jobId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
