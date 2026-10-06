const STOP = new Set(
  "the a an and or to for of in on your is it not then with this that from just does have will here what they them their you we our are was were been being be about into over after before than too very really like more most some any can could should would when where who why how its it's don't dont but if so as at by my me".split(
    " ",
  ),
);

const VISUAL: [RegExp, string][] = [
  [/sleep|bed|night|insomnia/, "person sleeping in a dark bedroom"],
  [/morning|wake|alarm/, "sunlit bedroom morning"],
  [/desk|write|draft|document|script/, "person writing at a wooden desk"],
  [/phone|scroll|tiktok|reel|shorts/, "hands holding a smartphone"],
  [/video|camera|film|edit/, "video camera on a table"],
  [/voice|speak|talk|podcast|say|said/, "studio microphone close up"],
  [/city|street|traffic/, "city street in daylight"],
  [/walk|path|journey|road/, "person walking a quiet path"],
  [/money|pay|price|sell|business|client/, "small shop counter cash"],
  [/food|eat|meal|coffee|cafe/, "coffee cup on a cafe table"],
  [/run|gym|lift|workout|fitness/, "person running outdoors"],
  [/clock|time|hour|deadline/, "analog clock close up"],
  [/book|read|study|learn/, "open book on a table"],
  [/computer|laptop|code|screen/, "laptop on a desk by a window"],
  [/people|friend|audience|crowd|team/, "friends talking at a table"],
  [/car|drive|commute/, "car driving on an open road"],
  [/home|house|kitchen/, "sunlit home kitchen"],
  [/idea|think|plan|brain/, "person thinking by a window"],
];

type Stock = { url: string; title: string };

export function clipQuery(line: string): string {
  const lower = line.toLowerCase();
  for (const [pattern, query] of VISUAL) if (pattern.test(lower)) return query;
  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
  return `${[...new Set(words)].slice(0, 4).join(" ") || "daylight landscape"} photograph`;
}

function score(title: string, query: string): number {
  const hay = title.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .reduce((sum, word) => sum + (hay.includes(word) ? 2 : 0), 0);
}

async function search(query: string): Promise<Stock[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=960&gsrsearch=" +
    encodeURIComponent(`${query} filemime:image/jpeg`);
  const response = await fetch(url, { headers: { "User-Agent": "CreatorAI/1.0 (faceless studio; contact creator)" } });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string; url?: string }[] }> };
  };
  return Object.values(data.query?.pages ?? {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (!src || !page.title) return null;
      return { url: src, title: page.title };
    })
    .filter((item): item is Stock => Boolean(item));
}

export async function matchClips(lines: string[]): Promise<(string | null)[]> {
  const used = new Set<string>();
  const out: (string | null)[] = [];
  for (const line of lines) {
    const query = clipQuery(line);
    const found = await search(query).catch(() => [] as Stock[]);
    const ranked = found
      .map((item) => ({ ...item, score: score(item.title, query) }))
      .sort((a, b) => b.score - a.score);
    const pick = ranked.find((item) => !used.has(item.url)) ?? null;
    if (pick) used.add(pick.url);
    out.push(pick ? `/api/ai/clips?u=${encodeURIComponent(pick.url)}` : null);
  }
  return out;
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
