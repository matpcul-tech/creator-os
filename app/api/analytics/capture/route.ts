import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// URL → analytics snapshot via oEmbed (where available) and best-effort
// heuristics. oEmbed gives us title/author/HTML but not engagement counts
// — for those, the user fills in the numbers and submits.
//
// Real value here: detecting platform + content ID from a URL so the user
// can record a snapshot without retyping context.

type Platform =
  | "x"
  | "youtube"
  | "youtube_shorts"
  | "tiktok"
  | "instagram"
  | "instagram_reels"
  | "linkedin"
  | "threads"
  | "substack"
  | "blog";

function detectPlatform(url: string): Platform | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "twitter.com" || h === "x.com" || h === "mobile.twitter.com") return "x";
    if (h === "youtube.com" || h === "m.youtube.com") {
      if (u.pathname.startsWith("/shorts/")) return "youtube_shorts";
      return "youtube";
    }
    if (h === "youtu.be") return "youtube";
    if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return "tiktok";
    if (h === "instagram.com") {
      if (u.pathname.startsWith("/reel/")) return "instagram_reels";
      return "instagram";
    }
    if (h === "linkedin.com" || h.endsWith(".linkedin.com")) return "linkedin";
    if (h === "threads.net" || h === "threads.com") return "threads";
    if (h.endsWith("substack.com")) return "substack";
    return "blog";
  } catch {
    return null;
  }
}

async function tryOembed(url: string): Promise<Record<string, unknown> | null> {
  // X / YouTube / Threads / TikTok all expose a public oEmbed endpoint.
  const provider = detectPlatform(url);
  let endpoint: string | null = null;
  if (provider === "x") {
    endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
  } else if (provider === "youtube" || provider === "youtube_shorts") {
    endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  } else if (provider === "tiktok") {
    endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  } else if (provider === "instagram" || provider === "instagram_reels") {
    // IG oEmbed requires a Facebook app token — skip silently.
    return null;
  } else if (provider === "threads") {
    // Threads has no public oEmbed; skip.
    return null;
  }
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "CreatorOS/1.0" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const url: string = body.url ?? "";
  const stats = body.stats ?? {};

  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const platform = detectPlatform(url);
  if (!platform) return NextResponse.json({ error: "Unrecognized URL" }, { status: 400 });

  const oembed = await tryOembed(url);

  const snap = await prisma.analyticsSnapshot.create({
    data: {
      platform,
      views: Number(stats.views ?? 0),
      likes: Number(stats.likes ?? 0),
      comments: Number(stats.comments ?? 0),
      shares: Number(stats.shares ?? 0),
      saves: Number(stats.saves ?? 0),
      followers: Number(stats.followers ?? 0),
      capturedAt: new Date(),
    },
  });

  return NextResponse.json({
    snapshot: snap,
    platform,
    oembed: oembed
      ? {
          title: oembed.title ?? null,
          author: oembed.author_name ?? null,
          provider: oembed.provider_name ?? null,
        }
      : null,
  });
}
