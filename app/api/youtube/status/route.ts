import { NextResponse } from "next/server";
import { youtubeStatus } from "@/lib/publish/youtube-store";

export async function GET() {
  return NextResponse.json(await youtubeStatus());
}
