import { NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/heygen";
import { prisma } from "@/lib/db";

// Poll a render. GET /api/ai/video/{videoId}?contentId=123
// Returns { status, url }. When complete and a contentId is supplied, the MP4
// url is written back onto the content piece so it is ready to publish.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const videoId = params.id;
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const contentId = url.searchParams.get("contentId");

  try {
    const result = await getVideoStatus(videoId);

    if (contentId) {
      const id = Number(contentId);
      if (result.status === "completed" && result.url) {
        await prisma.contentPiece.update({
          where: { id },
          data: { videoUrl: result.url, videoStatus: "completed" },
        }).catch(() => null);
      } else if (result.status === "failed") {
        await prisma.contentPiece.update({
          where: { id },
          data: { videoStatus: "failed" },
        }).catch(() => null);
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
