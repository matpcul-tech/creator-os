import { COMMONS_IMAGEINFO, commonsInfo, isLikelyPhoto, isSceneStock, queryWords, stockScore, type CommonsInfo } from "./photo-filter";
import { assignUnique, photoKey } from "./photo-pool";
import { pexelsKey, searchPexels, type ProviderPhoto } from "./pexels";
import { pixabayKey, searchPixabay } from "./pixabay";
import { fallbackQueries, visualQueries, type SceneQueries } from "./visual-queries";
import { anchorQueries, FOOD_WORDS, PEOPLE_WORDS } from "./anchor";

// Wikimedia rate-limits (HTTP 429) any client whose User-Agent has no real contact URL or email.
// See https://meta.wikimedia.org/wiki/User-Agent_policy
export const WIKI_UA =
  "CreatorAI/1.0 (https://creatorai-os.vercel.app; https://github.com/matpcul-tech/creator-os) node-fetch";

export type StockPhoto = {
  src: string; // upstream image URL (used for dedupe and exclude lists)
  url: string; // same-origin proxy URL, safe to draw on a canvas
  key: string; // shared by near duplicates (same object or photo series)
  title: string;
  credit: string; // page for the photo on Commons or Pexels
  attribution: string; // e.g. "Photo by Jane Doe on Pexels" or "Image by Jane from Pixabay"
  provider: "pexels" | "pixabay" | "wikimedia";
  text: string; // tags, alt text, or file name and description, for relevance checks
  score: number;
};

type Found = ProviderPhoto & { info?: CommonsInfo };

const WIKI_PER_QUERY = 30;
const PEXELS_PER_QUERY = 20;
const MAX_QUERIES = 48;
const PIXABAY_PER_QUERY = 50;
const MAX_PEXELS_QUERIES = 24; // Pexels allows 200 requests an hour
const MAX_PIXABAY_QUERIES = 40; // Pixabay allows 100 requests a minute; results are cached for 24 hours
const ENOUGH = 6; // below this, the next source fills in for that query

// Same query, same results: an hour by default, 24 hours for Pixabay (their
// terms require it). Saves quota and speeds up reshuffles.
const resultCache = new Map<string, { at: number; items: Found[] }>();
const HOUR = 60 * 60 * 1000;

async function cached(key: string, run: () => Promise<Found[]>, ttl = HOUR): Promise<Found[]> {
  const hit = resultCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.items;
  const items = await run();
  if (resultCache.size > 600) resultCache.delete(resultCache.keys().next().value as string);
  resultCache.set(key, { at: Date.now(), items });
  return items;
}

async function searchWikimedia(query: string, offset: number): Promise<Found[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${WIKI_PER_QUERY}&gsroffset=${offset}&${COMMONS_IMAGEINFO}&iiurlwidth=960&gsrsearch=` +
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
    if (!info || !isLikelyPhoto(info) || !isSceneStock(info)) continue;
    out.push({
      src: info.thumburl || info.url,
      title: info.title,
      credit: info.descriptionurl || "Wikimedia Commons",
      attribution: "Wikimedia Commons",
      provider: "wikimedia",
      text: "",
      info,
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

const PERSON = /\b(person|people|persons|human|woman|women|man|men|girl|boy|child|children|kid|couple|senior|seniors|elderly|grandmother|grandfather|runner|athlete|family|adult|lady|guy)\b/;
// Tags that mark the whole photo as an animal photo, wherever they appear.
const ANIMAL_ANYWHERE = /\b(animal|animals|wildlife|mammal|reptile|amphibian|ornithology|pet|pets|zoo|aquarium)\b/;
const ANIMAL = /\b(animals?|duck|ducks|bird|birds|waterfowl|bear|polar bear|penguin|cat|cats|kitten|dog|dogs|puppy|canine|feline|horse|cow|sheep|pig|monkey|macaque|primate|fish|insect|butterfly|squirrel|rabbit|deer|turtle|tortoise|frog|seal|otter|swan|goose|wildlife|pets?)\b/;

const JEWELRY = /\b(wedding|bride|groom|marriage|engagement|diamonds?|jewel(?:ry|lery)|gold ring|wedding rings?)\b/;

// Children and babies only fit lines that are about kids.
const CHILD = /\b(child|children|kid|kids|baby|babies|toddler|toddlers|infant|infants|newborn|schoolchild|schoolchildren|preschool|kindergarten)\b/;

export function childPenalty(text: string, query: string): number {
  return CHILD.test(text.toLowerCase()) && !CHILD.test(query.toLowerCase()) ? 4 : 0;
}

/** Food photos only fit food queries, and photos led by people only fit queries that ask for people. */
export function offTopicPenalty(text: string, lead: string, query: string): number {
  const q = query.toLowerCase();
  let penalty = 0;
  if (FOOD_WORDS.test(lead) && !FOOD_WORDS.test(q)) penalty += 4;
  else if (FOOD_WORDS.test(text) && !FOOD_WORDS.test(q)) penalty += 1.5;
  if (PEOPLE_WORDS.test(lead) && !PEOPLE_WORDS.test(q)) penalty += 1.5;
  return penalty;
}

// A query word matches at the start of a word ("ring" fits "rings", not "breading" or "spring").
const wordRe = new Map<string, RegExp>();
export function mentions(hay: string, word: string): boolean {
  if (word === "person" || word === "people" || word === "human") return PERSON.test(hay);
  let re = wordRe.get(word);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    if (wordRe.size > 2000) wordRe.clear();
    wordRe.set(word, re);
  }
  return re.test(hay);
}

/**
 * Score a Pexels or Pixabay photo from its alt text or tags. Their search is
 * loose (Pixabay sorts by popularity), so most of the query has to show up in
 * the tags, tags near the front count more, and animal photos are dropped
 * unless the query asks for animals. Pexels ranks ahead of Pixabay.
 */
export function stockSiteScore(provider: "pexels" | "pixabay", text: string, query: string): number | null {
  const words = queryWords(query);
  const lower = text.toLowerCase();
  const tags = lower.split(",").map((t) => t.trim()).filter(Boolean);
  const lead = (provider === "pixabay" ? tags.slice(0, 3).join(" ") : lower.split(/\s+/).slice(0, 8).join(" "));
  const has = mentions;
  let hits = 0;
  let leadHits = 0;
  for (const word of words) {
    if (has(lower, word)) hits += 1;
    if (has(lead, word)) leadHits += 1;
  }
  if (lower && words.length) {
    const required = provider === "pexels" ? 1 : words.length <= 2 ? words.length : words.length - 1;
    if (hits < required) return null;
    if ((ANIMAL.test(lead) || ANIMAL_ANYWHERE.test(lower)) && !ANIMAL.test(query.toLowerCase())) return null;
    // A ring search should not turn up wedding jewelry.
    if (JEWELRY.test(lower) && !JEWELRY.test(query.toLowerCase())) return null;
  }
  const aiMade = /\bai generated\b|\bai art\b|\bgenerated by ai\b/.test(lower) ? 1.5 : 0;
  // Photos whose tags cover more of the query rank higher.
  const coverage = words.length ? (3 * hits) / words.length : 0;
  return (provider === "pexels" ? 7 : 6) + hits + leadHits * 0.75 + coverage - aiMade - childPenalty(lower, query) - offTopicPenalty(lower, lead, query);
}

/** Score one result against the query that found it. Null when it does not fit the query. */
export function scoreFor(item: Found, query: string): number | null {
  if (item.provider === "pexels" || item.provider === "pixabay") return stockSiteScore(item.provider, item.text, query);
  if (!item.info) return null;
  const { overlap, titleHits, score } = stockScore(item.info, query);
  const words = queryWords(query).length;
  // The title has to mention the query, and most of the query has to show up
  // somewhere in the title, description, or categories.
  if (titleHits < 1) return null;
  if (overlap < Math.min(2, Math.max(1, Math.ceil(words / 2)))) return null;
  const hay = `${item.info.title} ${item.info.description ?? ""}`;
  const lower = hay.toLowerCase();
  return score + (words ? (2 * overlap) / words : 0) - childPenalty(lower, query) - offTopicPenalty(lower, item.info.title.toLowerCase(), query);
}

/** True when the text mentions at least one of the words (stems). */
export function relevantTo(text: string, words: string[]): boolean {
  if (!words.length) return true;
  const hay = text.toLowerCase();
  return words.some((word) => mentions(hay, word));
}

export function shootKey(item: Pick<Found, "provider" | "title" | "attribution" | "src">): string {
  const subject = item.title.replace(/\s*\((?:Pixabay|Pexels)[^)]*\)\s*$/i, "").trim().toLowerCase();
  const who = item.attribution.toLowerCase();
  if (!subject || /^(pixabay|pexels) photo \d+$/.test(subject) || !/\b(by)\b/.test(who)) return `u:${item.src}`;
  return `s:${item.provider}|${who}|${subject}`;
}

function toStock(item: Found, score: number): StockPhoto {
  return {
    src: item.src,
    url: `/api/ai/clips?u=${encodeURIComponent(item.src)}`,
    // Wikimedia: near duplicates share a cleaned file name. Stock sites: the same
    // photographer with the same leading tags or alt text is one shoot.
    key: item.provider === "wikimedia" ? photoKey(item.title, item.src) : shootKey(item),
    title: item.title,
    credit: item.credit,
    attribution: item.attribution,
    provider: item.provider,
    text: item.provider === "wikimedia" ? `${item.title} ${item.info?.description ?? ""}`.toLowerCase() : item.text.toLowerCase(),
    score,
  };
}

/** Rank everything the given queries found, best first, one entry per photo. */
export function rankFor(queries: string[], results: Map<string, Found[]>): StockPhoto[] {
  const best = new Map<string, StockPhoto>();
  queries.forEach((query, qi) => {
    for (const item of results.get(query) ?? []) {
      const raw = scoreFor(item, query);
      if (raw === null) continue;
      const score = raw - qi * 0.5; // earlier queries describe the scene best
      const prev = best.get(item.src);
      if (!prev || score > prev.score) best.set(item.src, toStock(item, score));
    }
  });
  return [...best.values()].sort((a, b) => b.score - a.score);
}

/**
 * One photo per line, no repeats or near repeats across the video, plus a
 * spare pool for "another photo". Queries come from the AI (cached per
 * script) or from keywords. `exclude` lists photos (src or key) already
 * shown; `offset` pages deeper into the results.
 */
export async function pickPhotos(opts: {
  lines: string[];
  topic?: string;
  exclude?: string[];
  offset?: number;
  extra?: number;
  queries?: SceneQueries | null;
  ask?: (prompt: string, maxTokens: number) => Promise<string>;
}): Promise<{ picks: (StockPhoto | null)[]; pool: StockPhoto[]; queries: SceneQueries; querySource: string }> {
  const offset = Math.max(0, Math.min(500, Math.floor(opts.offset ?? 0)));
  const topic = (opts.topic ?? "").trim();
  let querySource = "client";
  let sq: SceneQueries;
  if (opts.queries) sq = opts.queries;
  else if (opts.ask) {
    const got = await visualQueries(opts.lines, topic, opts.ask);
    querySource = got.source;
    sq = { scenes: got.scenes, topic: got.topic };
  } else {
    querySource = "keywords";
    sq = fallbackQueries(opts.lines, topic);
  }
  // Every scene stays on the topic: vague lines inherit the current subject or the title.
  sq = anchorQueries(opts.lines, topic, sq, querySource === "ai" || querySource === "cache" || querySource === "client");
  const topicQueries = sq.topic.length ? sq.topic : sq.scenes[0] ?? [];

  // Unique queries: the topic first so a fallback pool exists, then every
  // scene's first query, then the second and third while there is room.
  const queries: string[] = [];
  const add = (q: string | undefined) => {
    if (q && !queries.includes(q) && queries.length < MAX_QUERIES) queries.push(q);
  };
  topicQueries.forEach(add);
  for (let rank = 0; rank < 3; rank++) sq.scenes.forEach((list) => add(list[rank]));

  // Source order: Pexels if its key is set, then Pixabay if its key is set, then Wikimedia.
  const usePexels = Boolean(pexelsKey());
  const usePixabay = Boolean(pixabayKey());
  const results = new Map<string, Found[]>();
  const fetchPage = async (page: number, only: string[] = queries) => {
    const lists = await runLimited(
      only.map((q) => async () => {
        const qi = queries.indexOf(q);
        let items: Found[] = [];
        if (usePexels && qi < MAX_PEXELS_QUERIES) {
          const pexelsPage = 1 + Math.floor(offset / PEXELS_PER_QUERY) + page;
          items = await cached(`p|${q}|${pexelsPage}`, () => searchPexels(q, pexelsPage, PEXELS_PER_QUERY)).catch(() => []);
        }
        if (usePixabay && items.length < ENOUGH && qi < MAX_PIXABAY_QUERIES) {
          const pixabayPage = 1 + Math.floor(offset / PIXABAY_PER_QUERY) + page;
          const pix = await cached(`x|${q}|${pixabayPage}`, () => searchPixabay(q, pixabayPage, PIXABAY_PER_QUERY), 24 * HOUR).catch(() => []);
          items = [...items, ...pix];
        }
        if (items.length < ENOUGH) {
          const wikiOffset = offset + page * WIKI_PER_QUERY;
          const wiki = await cached(`w|${q}|${wikiOffset}`, () => searchWikimedia(q, wikiOffset)).catch(() => []);
          items = [...items, ...wiki];
        }
        return items;
      }),
      4,
    );
    only.forEach((q, i) => results.set(q, [...(results.get(q) ?? []), ...lists[i]]));
    return lists.some((list) => list.length > 0);
  };

  const exclude = new Set(opts.exclude ?? []);
  const build = () => {
    const perScene = sq.scenes.map((list) => rankFor(list, results));
    const fallback = rankFor([...topicQueries, ...queries.filter((q) => !topicQueries.includes(q))], results);
    // A line only borrows from the shared pool when the photo matches at least
    // one important word of that line's own queries.
    const sceneWords = sq.scenes.map((list) => [...new Set(list.flatMap(queryWords))]);
    const picks = assignUnique(perScene, (index) => fallback.filter((item) => relevantTo(item.text, sceneWords[index] ?? [])), exclude);
    const used = new Set<string>();
    picks.forEach((p) => p && (used.add(p.src), used.add(p.key)));
    // Spares for "another photo" and swaps: the lines' own matches first, then
    // shared photos, and only ones that match at least one word of some line.
    const allWords = [...new Set(sceneWords.flat())];
    const spareOrder = [...perScene.flat().sort((a, b) => b.score - a.score), ...fallback].filter((item) => relevantTo(item.text, allWords));
    const fresh: StockPhoto[] = [];
    for (const item of spareOrder) {
      if (exclude.has(item.src) || exclude.has(item.key) || used.has(item.src) || used.has(item.key)) continue;
      used.add(item.key);
      fresh.push(item);
    }
    return { picks, fresh, unique: new Set(picks.filter(Boolean).map((p) => p!.key)).size };
  };

  // Page through results until every line has its own photo and the spare
  // pool is full, or the sources run dry. At most three pages.
  const want = opts.lines.length;
  const extra = Math.max(0, opts.extra ?? 0);
  let result = { picks: [] as (StockPhoto | null)[], fresh: [] as StockPhoto[], unique: 0 };
  for (let page = 0; page < 3; page++) {
    // Later pages only search for scenes still without a photo, plus the topic for spares.
    const missing = result.picks.length
      ? [...new Set([...topicQueries, ...sq.scenes.flatMap((list, i) => (result.picks[i] ? [] : list))])].filter((q) => queries.includes(q))
      : queries;
    const more = await fetchPage(page, page === 0 ? queries : missing.length ? missing : topicQueries.filter((q) => queries.includes(q)));
    result = build();
    if (!more || (result.unique >= want && result.fresh.length >= extra)) break;
  }
  return { picks: result.picks, pool: result.fresh.slice(0, extra), queries: sq, querySource };
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
    const host = target.hostname;
    const allowed = ["upload.wikimedia.org", "thumb.wikimedia.org", "images.pexels.com", "pixabay.com", "cdn.pixabay.com"];
    if (!allowed.includes(host)) return null;
    return target.toString();
  } catch {
    return null;
  }
}
