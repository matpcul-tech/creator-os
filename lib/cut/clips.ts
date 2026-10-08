import { photoPlan, scorePhoto, keywords } from "./builder-cards";
import { COMMONS_IMAGEINFO, commonsInfo, isLikelyPhoto, photoBonus } from "./photo-filter";
import { assignUnique } from "./photo-pool";

// Wikimedia rate-limits (HTTP 429) any client whose User-Agent has no real contact URL or email.
// See https://meta.wikimedia.org/wiki/User-Agent_policy
export const WIKI_UA =
  "CreatorAI/1.0 (https://creatorai-os.vercel.app; https://github.com/matpcul-tech/creator-os) node-fetch";

export type StockPhoto = {
  src: string; // upstream Wikimedia URL (used for dedupe and exclude lists)
  url: string; // same-origin proxy URL, safe to draw on a canvas
  title: string;
  credit: string; // file page on Commons
  score: number;
};

const PER_QUERY = 30;
const MAX_QUERIES = 30;

type Found = Omit<StockPhoto, "score"> & { bonus: number };

async function search(query: string, offset: number): Promise<Found[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${PER_QUERY}&gsroffset=${offset}&${COMMONS_IMAGEINFO}&iiurlwidth=960&gsrsearch=` +
    encodeURIComponent(`${query} filemime:image/jpeg`);
  const response = await fetch(url, { headers: { "User-Agent": WIKI_UA, "Api-User-Agent": WIKI_UA } });
  if (!response.ok) {
    console.warn("clip search", response.status, query);
    return [];
  }
  const data = (await response.json()) as { query?: { pages?: Record<string, Parameters<typeof commonsInfo>[0]> } };
  const out: Found[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = commonsInfo(page);
    if (!info || !isLikelyPhoto(info)) continue;
    const src = info.thumburl || info.url;
    out.push({
      src,
      url: `/api/ai/clips?u=${encodeURIComponent(src)}`,
      title: info.title,
      credit: info.descriptionurl || "Wikimedia Commons",
      bonus: photoBonus(info),
    });
  }
  return out;
}

async function runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      out[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

/**
 * One photo per line, no repeats across the video, plus a spare pool for
 * "another photo". Queries come from each line's key nouns and themes, with
 * the topic as a fallback. `exclude` lists photos already shown; `offset`
 * pages deeper into the search results.
 */
export async function pickPhotos(opts: {
  lines: string[];
  topic?: string;
  exclude?: string[];
  offset?: number;
  extra?: number;
}): Promise<{ picks: (StockPhoto | null)[]; pool: StockPhoto[] }> {
  const offset = Math.max(0, Math.min(500, Math.floor(opts.offset ?? 0)));
  const plans = opts.lines.map((line) => photoPlan(line));
  const topic = (opts.topic ?? "").trim();
  const topicKeys = keywords(topic).slice(0, 3);
  const topicPlan = topic ? photoPlan(topic) : null;
  const topicQueries = topic
    ? [...new Set([...(topicPlan?.queries ?? []), topicKeys.length ? `${topicKeys.join(" ")} photo` : ""].filter(Boolean))]
    : [];

  // Unique queries, topic first so the fallback pool always exists.
  const queries: string[] = [];
  const add = (q: string) => {
    if (q && !queries.includes(q) && queries.length < MAX_QUERIES) queries.push(q);
  };
  topicQueries.forEach(add);
  // Every line's main query first, then the second variants while there is room.
  plans.forEach((plan) => add(plan.queries[0]));
  plans.forEach((plan) => add(plan.queries[1]));

  const byQuery = new Map<string, Found[]>();
  const fetchPage = async (page: number) => {
    const results = await runLimited(
      queries.map((q) => () => search(q, page).catch(() => [] as Found[])),
      4,
    );
    queries.forEach((q, i) => byQuery.set(q, [...(byQuery.get(q) ?? []), ...results[i]]));
    return results.some((list) => list.length > 0);
  };

  const score = (item: Found, plan: ReturnType<typeof photoPlan>) => scorePhoto(item.title, plan) + item.bonus;
  const clean = ({ bonus: _bonus, ...rest }: Found, value: number): StockPhoto => ({ ...rest, score: value });
  const fallbackPlan = topicPlan ?? { queries: [], tags: [], still: "desk" as const };
  const exclude = new Set(opts.exclude ?? []);

  const build = () => {
    const perScene = plans.map((plan) => {
      const seen = new Set<string>();
      const list: StockPhoto[] = [];
      for (const q of plan.queries.slice(0, 2)) {
        for (const item of byQuery.get(q) ?? []) {
          if (seen.has(item.src)) continue;
          seen.add(item.src);
          list.push(clean(item, score(item, plan)));
        }
      }
      // Only photos that mention what the line is about count as its own.
      return list.filter((item) => item.score >= 1).sort((a, b) => b.score - a.score);
    });
    const fallback: StockPhoto[] = [];
    const seenFallback = new Set<string>();
    for (const q of [...topicQueries, ...queries]) {
      for (const item of byQuery.get(q) ?? []) {
        if (seenFallback.has(item.src)) continue;
        seenFallback.add(item.src);
        fallback.push(clean(item, score(item, fallbackPlan)));
      }
    }
    fallback.sort((a, b) => b.score - a.score);
    const picks = assignUnique(perScene, fallback, exclude);
    const usedNow = new Set(picks.filter(Boolean).map((p) => p!.src));
    const fresh = fallback.filter((item) => !exclude.has(item.src) && !usedNow.has(item.src));
    return { picks, fresh, unique: usedNow.size };
  };

  // Page through the results until every line has its own photo and the spare
  // pool is full, or Commons runs dry. At most three pages.
  const want = opts.lines.length;
  const extra = Math.max(0, opts.extra ?? 0);
  let result = { picks: [] as (StockPhoto | null)[], fresh: [] as StockPhoto[], unique: 0 };
  for (let page = 0; page < 3; page++) {
    const more = await fetchPage(offset + page * PER_QUERY);
    result = build();
    if (!more || (result.unique >= want && result.fresh.length >= extra)) break;
  }
  return { picks: result.picks, pool: result.fresh.slice(0, extra) };
}

/** Back-compat: proxied photo URL per line, or null. */
export async function matchClips(lines: string[], topic?: string): Promise<(string | null)[]> {
  const { picks } = await pickPhotos({ lines, topic });
  return picks.map((p) => p?.url ?? null);
}

export function allowedImage(raw: string): string | null {
  try {
    const target = new URL(raw);
    if (target.protocol !== "https:") return null;
    if (target.hostname !== "upload.wikimedia.org" && target.hostname !== "thumb.wikimedia.org") return null;
    return target.toString();
  } catch {
    return null;
  }
}
