import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Real trend feed. Pulls public sources (no API keys required):
// - Reddit /r/{niche}/hot.json
// - Hacker News front page via Algolia
// - Subreddit picks come from the creator's niche keywords.
//
// Cached in-memory for 10 minutes per request handler instance.

type Trend = {
  source: "reddit" | "hn";
  title: string;
  url: string;
  score: number;
  comments: number;
  subreddit?: string;
  author?: string;
  age: string;
};

let cache: { items: Trend[]; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

const NICHE_KEYWORDS_TO_SUBS: Record<string, string[]> = {
  ai: ["artificial", "MachineLearning", "OpenAI", "ChatGPT", "LocalLLaMA"],
  creator: ["NewTubers", "CreatorEconomy", "PartneredYoutube"],
  productivity: ["productivity", "getdisciplined", "selfimprovement"],
  startup: ["startups", "Entrepreneur", "SaaS", "indiehackers"],
  marketing: ["marketing", "SocialMediaMarketing", "growmybusiness"],
  writing: ["writing", "writers", "selfpublish"],
  design: ["Design", "graphic_design", "userexperience"],
  tech: ["technology", "programming", "webdev"],
  fitness: ["Fitness", "bodyweightfitness", "loseit"],
  finance: ["personalfinance", "investing", "fatFIRE"],
};

const DEFAULT_SUBS = ["popular", "InternetIsBeautiful", "todayilearned"];

function inferSubs(niche: string): string[] {
  const lower = niche.toLowerCase();
  const matched: string[] = [];
  for (const [keyword, subs] of Object.entries(NICHE_KEYWORDS_TO_SUBS)) {
    if (lower.includes(keyword)) matched.push(...subs);
  }
  return matched.length > 0 ? matched.slice(0, 4) : DEFAULT_SUBS;
}

function relativeAge(unixSeconds: number): string {
  const sec = Math.floor(Date.now() / 1000) - unixSeconds;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

async function fetchReddit(sub: string): Promise<Trend[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
      headers: { "User-Agent": "CreatorOS/1.0" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const children = json?.data?.children ?? [];
    return children
      .filter((c: { data?: { stickied?: boolean } }) => !c.data?.stickied)
      .map((c: { data: { title: string; permalink: string; ups: number; num_comments: number; subreddit: string; author: string; created_utc: number } }): Trend => ({
        source: "reddit",
        title: c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        score: c.data.ups,
        comments: c.data.num_comments,
        subreddit: c.data.subreddit,
        author: c.data.author,
        age: relativeAge(c.data.created_utc),
      }));
  } catch {
    return [];
  }
}

async function fetchHN(): Promise<Trend[]> {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10",
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const hits = json?.hits ?? [];
    return hits.map((h: { title?: string; story_title?: string; url?: string; objectID: string; points?: number; num_comments?: number; author?: string; created_at_i: number }): Trend => ({
      source: "hn" as const,
      title: h.title ?? h.story_title ?? "",
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points ?? 0,
      comments: h.num_comments ?? 0,
      author: h.author,
      age: relativeAge(h.created_at_i),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";

  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ items: cache.items, cached: true });
  }

  const profile = await prisma.profile.findFirst().catch(() => null);
  const niche = profile?.niche ?? "";
  const subs = inferSubs(niche);

  const [hn, ...redditBatches] = await Promise.all([
    fetchHN(),
    ...subs.map(fetchReddit),
  ]);

  const items: Trend[] = [...redditBatches.flat(), ...hn]
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  cache = { items, at: Date.now() };
  return NextResponse.json({ items, cached: false, subs });
}
