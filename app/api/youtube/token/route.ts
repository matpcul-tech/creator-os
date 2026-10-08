import { NextResponse } from "next/server";
import { youtubeAccessToken } from "@/lib/publish/youtube-store";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Hands the signed-in owner a short-lived access token so the browser can
// upload the video file directly to YouTube. The refresh token never leaves
// the server. POST only, behind the session gate in middleware.
export async function POST(req: Request) {
  const limit = rateLimit(`yt-token:${clientIp(req)}`, 20, 60);
  if (!limit.ok) return rateLimitResponse(limit);
  try {
    const accessToken = await youtubeAccessToken();
    return NextResponse.json({ accessToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "YouTube isn't connected." }, { status: 400 });
  }
}
