import { NextResponse } from "next/server";
import { authorizeProduce } from "@/lib/produce/auth";
import { readJob, viewJob } from "@/lib/produce/jobs";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = authorizeProduce(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id;
  if (!/^prod_[a-f0-9]{24}$/.test(id)) {
    return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  }
  const row = await readJob(id);
  if (!row) return NextResponse.json({ error: "Unknown job." }, { status: 404 });
  return NextResponse.json(viewJob(row));
}
