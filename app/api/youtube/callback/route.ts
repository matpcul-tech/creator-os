import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, googleCredentials, redirectUriFor } from "@/lib/publish/youtube-oauth";
import { saveYouTubeTokens } from "@/lib/publish/youtube-store";

async function channelTitle(accessToken: string): Promise<string> {
  // Best effort. youtube.upload scope may not allow reading the channel.
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { items?: { snippet?: { title?: string } }[] };
    return json.items?.[0]?.snippet?.title ?? "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const done = (result: string) => {
    const res = NextResponse.redirect(`${origin}/integrations?youtube=${result}`);
    res.cookies.set("yt_oauth_state", "", { path: "/api/youtube", maxAge: 0 });
    return res;
  };

  const creds = googleCredentials();
  if (!creds) return done("not_configured");
  if (url.searchParams.get("error")) return done("denied");

  const state = url.searchParams.get("state") || "";
  const expected = req.cookies.get("yt_oauth_state")?.value || "";
  const code = url.searchParams.get("code") || "";
  if (!code || !state || state !== expected) return done("failed");

  try {
    const tokens = await exchangeCode({ code, ...creds, redirectUri: redirectUriFor(origin) });
    await saveYouTubeTokens(tokens, await channelTitle(tokens.accessToken));
    return done("connected");
  } catch (e) {
    console.error("[youtube] oauth callback failed", e instanceof Error ? e.message : e);
    return done("failed");
  }
}
