import { STILL_WORDS } from "@/lib/cut/direct";
import type { StillId } from "@/lib/cut/types";

// Splitting a pasted script into cards, matching a photo to each card, and naming the file.
// Pure functions so they can run on the server, in the browser, or in a quick node test.

const MIN_WORDS = 6;
const MAX_WORDS = 18;
const LONG_SENTENCE = 24;
const MAX_CARDS = 60;

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function sentences(line: string): string[] {
  const parts = line.match(/[^.!?]+(?:[.!?]+["\u201d']?|$)/g) ?? [line];
  const out: string[] = [];
  for (const raw of parts) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (words(sentence).length <= LONG_SENTENCE) {
      out.push(sentence);
      continue;
    }
    // A very long sentence becomes several cards, broken at commas when possible.
    let buf = "";
    for (const clause of sentence.split(/(?<=[,;:])\s+/)) {
      const next = buf ? `${buf} ${clause}` : clause;
      if (buf && words(next).length > MAX_WORDS) {
        out.push(buf);
        buf = clause;
      } else {
        buf = next;
      }
    }
    while (words(buf).length > LONG_SENTENCE) {
      const all = words(buf);
      out.push(all.slice(0, MAX_WORDS).join(" "));
      buf = all.slice(MAX_WORDS).join(" ");
    }
    if (buf) out.push(buf);
  }
  return out;
}

/**
 * One card per line when the script has line breaks. A line with several sentences, or a pasted
 * paragraph, is split by sentence, and short sentences are grouped so each card is a few seconds long.
 */
export function splitCards(lines: string[]): string[] {
  const cards: string[] = [];
  for (const line of lines) {
    const start = cards.length;
    let buf = "";
    for (const sentence of sentences(line)) {
      if (!buf) {
        buf = sentence;
      } else if (words(buf).length < MIN_WORDS && words(`${buf} ${sentence}`).length <= MAX_WORDS) {
        buf = `${buf} ${sentence}`;
      } else {
        cards.push(buf);
        buf = sentence;
      }
    }
    if (buf) {
      const last = cards.length - 1;
      // A short tail joins the card before it, as long as that card came from the same line.
      if (last >= start && words(buf).length < 4 && words(`${cards[last]} ${buf}`).length <= MAX_WORDS) {
        cards[last] = `${cards[last]} ${buf}`;
      } else {
        cards.push(buf);
      }
    }
  }
  return cards.slice(0, MAX_CARDS);
}

const STOP = new Set(
  (
    "a about above after again against all almost also always am an and any are aren't as at be because been before being below " +
    "between both but by can can't cannot could couldn't did didn't do does doesn't doing don't dont down during each even ever every " +
    "few for from further get gets getting got had hadn't has hasn't have haven't having he her here hers herself him himself his how " +
    "i i'm if in into is isn't it it's its itself just keep keeps kind know last least less let let's like little lot make makes many " +
    "may me might more most much must my myself need never next no nor not now of off often on once one only or other our ours " +
    "ourselves out over own really right said same say says see she should shouldn't simple so some something still such sure take " +
    "than that that's the their theirs them themselves then there there's these they they're thing things think this those through " +
    "to too try two three four five six seven eight nine ten under until up upon us use used very want wants was wasn't way we we're " +
    "well were weren't what what's when where which while who whom why will with without won't would wouldn't yet you you'll you're " +
    "your yours yourself yourselves going go goes went gone come comes came put puts give gives tell tells told start starts started " +
    "people person everyone everybody someone nobody day days week time times year years"
  ).split(/\s+/),
);

/** Words worth searching for: no stopwords, no numbers, no tiny words. */
export function keywords(line: string): string[] {
  const out: string[] = [];
  for (const raw of line.toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/)) {
    const word = raw.replace(/^['-]+|['-]+$/g, "");
    if (word.length < 4 || STOP.has(word) || out.includes(word)) continue;
    out.push(word);
  }
  return out;
}

function root(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length > 5 && lower.endsWith("ing")) return lower.slice(0, -3);
  if (lower.length > 4 && lower.endsWith("ed")) return lower.slice(0, -2);
  if (lower.length > 4 && lower.endsWith("es")) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

type Theme = { test: RegExp; query: string; tags: string[]; still: StillId };

// Ordered by how specific the picture is. The theme with the most hits in the card wins.
const THEMES: Theme[] = [
  { test: /\b(timer|stopwatch|countdown|minutes?|seconds?)\b/g, query: "kitchen timer", tags: ["timer", "clock", "stopwatch"], still: "desk" },
  { test: /\b(rings?|ringing|alarm|buzz|buzzes)\b/g, query: "alarm clock", tags: ["alarm", "clock", "bell"], still: "desk" },
  { test: /\b(clock|hours?|deadline|late|early)\b/g, query: "wall clock", tags: ["clock", "watch"], still: "desk" },
  { test: /\b(tasks?|to-?do|lists?|checklist|chores?|errands?)\b/g, query: "notebook and pen", tags: ["notebook", "pen", "list", "checklist"], still: "paper" },
  { test: /\b(finish|finished|finishing|complete|completed|done|goal|goals)\b/g, query: "runner crossing finish line", tags: ["runner", "crossing", "finish", "marathon"], still: "path" },
  { test: /\b(trick|tip|tips|hack|secret|rule)\b/g, query: "notebook pencil desk", tags: ["notebook", "pencil", "desk"], still: "paper" },
  { test: /\b(write|writing|draft|document|script|journal|notes?)\b/g, query: "person writing notebook desk", tags: ["writing", "notebook", "desk", "pen"], still: "desk" },
  { test: /\b(focus|work|working|productive|productivity|office|laptop|computer)\b/g, query: "laptop on desk", tags: ["laptop", "desk", "computer", "office"], still: "desk" },
  { test: /\b(phone|scroll|scrolling|social media|tiktok|reels?|shorts|notifications?)\b/g, query: "hands holding smartphone", tags: ["smartphone", "phone", "mobile"], still: "phone" },
  { test: /\b(video|camera|film|filming|edit|editing)\b/g, query: "video camera", tags: ["camera", "video"], still: "phone" },
  { test: /\b(voice|speak|speaking|talk|podcast|microphone)\b/g, query: "studio microphone", tags: ["microphone", "studio", "podcast"], still: "mic" },
  { test: /\b(sleep|sleeping|bed|bedtime|night|insomnia)\b/g, query: "bedroom at night", tags: ["bedroom", "bed", "night", "sleep"], still: "city" },
  { test: /\b(morning|wake|sunrise|coffee|breakfast)\b/g, query: "morning coffee cup", tags: ["coffee", "cup", "morning", "mug"], still: "cafe" },
  { test: /\b(walk|walking|run|running|cardio|treadmill|fitness|exercise|workout|gym)\b/g, query: "person running outdoors", tags: ["running", "runner", "jogging", "run"], still: "path" },
  { test: /\b(lift|lifting|muscle|strength|weights?|deadlift)\b/g, query: "weight training gym", tags: ["weight", "gym", "barbell", "dumbbell"], still: "path" },
  { test: /\b(food|eat|eating|meal|diet|cook|cooking|kitchen)\b/g, query: "healthy meal plate", tags: ["meal", "food", "plate", "salad"], still: "cafe" },
  { test: /\b(friends?|lonely|social|together|family)\b/g, query: "friends talking together", tags: ["friends", "people", "together"], still: "crowd" },
  { test: /\b(money|price|pay|paid|sell|sales|business|client|income)\b/g, query: "cash register shop counter", tags: ["shop", "cash", "money", "store"], still: "city" },
  { test: /\b(study|studies|research|science|data|book|books|read|reading|learn)\b/g, query: "open book on table", tags: ["book", "library", "reading"], still: "paper" },
  { test: /\b(city|street|traffic|commute|drive|car)\b/g, query: "city street daylight", tags: ["street", "city", "road"], still: "city" },
  { test: /\b(idea|ideas|think|thinking|plan|planning|decide|decision)\b/g, query: "person thinking by window", tags: ["window", "thinking", "thought"], still: "cafe" },
  { test: /\b(start|begin|beginning|first step|habit|habits|routine)\b/g, query: "first step stairs", tags: ["step", "stairs", "staircase"], still: "path" },
  { test: /\b(quit|quitting|stop|stuck|procrastinate|procrastination|lazy)\b/g, query: "work left unfinished", tags: ["unfinished", "work"], still: "cafe" },
];

export type PhotoPlan = { queries: string[]; tags: string[]; still: StillId };

/** What to search for on a card, what a good photo title should mention, and the built-in still to fall back on. */
export function photoPlan(line: string): PhotoPlan {
  const lower = line.toLowerCase();
  let best: Theme | null = null;
  let bestHits = 0;
  for (const theme of THEMES) {
    const hits = lower.match(theme.test)?.length ?? 0;
    if (hits > bestHits) {
      best = theme;
      bestHits = hits;
    }
  }
  const keys = keywords(line);
  const queries: string[] = [];
  if (best) queries.push(best.query);
  if (keys.length) queries.push(`${keys.slice(0, 3).join(" ")} photograph`);
  if (!queries.length) queries.push("quiet desk morning light");
  const tags = [...new Set([...(best?.tags ?? []), ...keys])];
  return { queries, tags, still: best?.still ?? stillFor(line) };
}

export function stillFor(line: string): StillId {
  const hay = line.toLowerCase();
  let pick: StillId = "desk";
  let top = 0;
  for (const [id, list] of Object.entries(STILL_WORDS) as [StillId, string[]][]) {
    const score = list.reduce((sum, word) => sum + (new RegExp(`\\b${word}`).test(hay) ? 1 : 0), 0);
    if (score > top) {
      pick = id;
      top = score;
    }
  }
  return pick;
}

const JUNK = /\b(map|logo|diagram|chart|graph|coat of arms|flag|seal|emblem|icon|scan|page \d+|plate \d+|cover|poster|stamp|banknote|coin|screenshot|svg|manuscript|engraving|illustration|drawing|painting|portrait of|mascots?|costumes?|sausages?|cartoon|toys?|figurines?|statue|crossed out|etching|lithograph|lccn|rp-p-o|sk-a-\d+)\b|\b1[4-8]\d\d\b/i;

/** How well a Commons file title fits the card. Zero or less means use the built-in still instead. */
export function scorePhoto(title: string, plan: PhotoPlan): number {
  const clean = title.replace(/^File:/i, "").replace(/\.[a-z]+$/i, "").replace(/[_\-.,()]+/g, " ").toLowerCase();
  const roots = new Set(clean.split(/\s+/).filter((word) => word.length > 2).map(root));
  let score = 0;
  plan.tags.forEach((tag, index) => {
    if (roots.has(root(tag))) score += index < 3 ? 2 : 1;
  });
  if (JUNK.test(clean)) score -= 3;
  return score;
}

const DEFAULT_TITLE_WORDS = 8;

/** A short title from the first sentence of a script. */
export function titleFromScript(script: string): string {
  const first = (script.trim().split(/\n+/)[0] ?? "").trim();
  const sentence = (first.match(/[^.!?]+/)?.[0] ?? first).trim();
  const list = words(sentence);
  const cut = list.slice(0, DEFAULT_TITLE_WORDS).join(" ");
  return cut.replace(/[,;:]+$/, "");
}

/** A safe download name from the title, or from the script's first line when there is no title. */
export function fileNameFor(title: string, script: string): string {
  const base = (title.trim() || titleFromScript(script) || "faceless")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "faceless"}.webm`;
}
