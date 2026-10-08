// Keeps every scene's photo search on the video's topic.
// A line that names a concrete subject (a product, a device, a measurable thing) searches for it.
// A vague line ("Most people are shocked by what they find") inherits the subject the script was
// just talking about, or the video's topic, instead of searching its literal words.

import { photoPlan } from "./builder-cards";
import type { SceneQueries } from "./visual-queries";

export type Subject = { name: string; queries: string[] };

// Ordered from specific to general; the first match wins.
const SUBJECTS: { test: RegExp; subject: Subject }[] = [
  { test: /\boura\b/i, subject: { name: "Oura Ring", queries: ["ring hand", "smartwatch sleep", "fitness tracker"] } },
  { test: /\bwhoop\b/i, subject: { name: "WHOOP", queries: ["fitness tracker wrist", "fitness band", "wearable tracker"] } },
  { test: /\b(cgms?|continuous glucose|glucose (?:monitors?|sensors?)|dexcom|freestyle libre|blood sugar)\b/i, subject: { name: "CGM", queries: ["glucose monitor", "blood glucose meter", "diabetes sensor"] } },
  { test: /\bgarmin\b/i, subject: { name: "Garmin", queries: ["garmin watch", "sports watch", "smartwatch fitness"] } },
  { test: /\bapple watch\b/i, subject: { name: "Apple Watch", queries: ["apple watch", "smartwatch wrist"] } },
  { test: /\bfitbit\b/i, subject: { name: "Fitbit", queries: ["fitbit", "fitness tracker wrist"] } },
  { test: /\beight sleep\b|\bmattress\b/i, subject: { name: "Eight Sleep", queries: ["mattress bed", "bedroom bed", "bed pillow"] } },
  { test: /\b(heart rate variability|hrv|resting heart rate|heart rate)\b/i, subject: { name: "heart rate", queries: ["heart rate monitor", "pulse measurement", "smartwatch heart rate"] } },
  { test: /\bvo2 ?max\b|\bzone (?:two|2)\b|\bintervals?\b/i, subject: { name: "VO2 max", queries: ["treadmill running", "cardio training", "cycling workout"] } },
  { test: /\b(wearables?|fitness trackers?|health trackers?|smart ?watch(?:es)?|trackers?|(?:the|a|your|my) watch)\b/i, subject: { name: "wearables", queries: ["smartwatch wrist", "fitness tracker", "wearable technology"] } },
];

const WEAK_THEMES = new Set([
  "kitchen timer",
  "alarm clock",
  "wall clock",
  "runner crossing finish line",
  "notebook pencil desk",
  "open book on table",
  "person thinking by window",
  "first step stairs",
  "work left unfinished",
  "cash register shop counter",
  "notebook and pen",
  "friends talking together",
]);

export const PEOPLE_WORDS = /\b(people|person|persons|man|men|woman|women|girl|girls|boy|boys|guy|lady|couple|crowd|family|friends?|face|portrait|businessman|athletes?|runners?|doctor|scientists?|researchers?|he|she|him|her)\b/i;
export const CHILD_WORDS = /\b(child|children|kids?|baby|babies|toddlers?|infants?|newborn|son|daughter)\b/i;
export const FOOD_WORDS = /\b(food|foods|meal|meals|eat|eating|dinner|lunch|breakfast|snack|oatmeal|steak|fruit|vegetables?|dessert|pizza|burger|fried|wine|drink|coffee|cook|cooking|kitchen|diet|plate|sugar)\b/i;

/** The concrete subject a piece of text names, if any. */
export function subjectOf(text: string): Subject | null {
  for (const entry of SUBJECTS) if (entry.test.test(text)) return entry.subject;
  return null;
}

/** True when the line gives a photographer nothing concrete to shoot. */
export function isVague(line: string): boolean {
  if (subjectOf(line) || FOOD_WORDS.test(line)) return false;
  const plan = photoPlan(line);
  const theme = plan.queries[0];
  return !theme || theme.endsWith(" photograph") || WEAK_THEMES.has(theme) || theme === "quiet desk morning light";
}

/** Drops queries that show people, children or food when the line is not about them. */
export function keepQuery(query: string, line: string): boolean {
  if (CHILD_WORDS.test(query) && !CHILD_WORDS.test(line)) return false;
  if (FOOD_WORDS.test(query) && !FOOD_WORDS.test(line)) return false;
  if (PEOPLE_WORDS.test(query) && !PEOPLE_WORDS.test(line)) return false;
  return true;
}

/** Topic queries from the title: its subject when it names one, then the given topic queries. */
export function topicQueries(title: string, given: string[] = []): string[] {
  const subject = subjectOf(title);
  const out = [...(subject?.queries ?? []), ...given.filter((q) => keepQuery(q, title) && !q.endsWith(" photograph"))];
  if (!out.length && title.trim()) out.push(...photoPlan(title).queries.filter((q) => !q.endsWith(" photograph") && q !== "quiet desk morning light"));
  return [...new Set(out)].slice(0, 4);
}

// A subject carries over to the vague lines right after it, for about one section of the script.
const CARRY_LINES = 6;

/**
 * Anchors every scene's queries to the topic. Concrete lines keep their own queries (people, kids
 * and food only when the line is about them). A line naming a subject searches for that subject
 * first. Queries written by the model are kept as each line's own picture. Vague lines with keyword
 * queries take the last subject from the previous few lines, or the topic, rotating
 * through its queries so neighbouring lines draw different photos.
 */
export function anchorQueries(lines: string[], title: string, sq: SceneQueries, fromModel = false): SceneQueries {
  const topic = topicQueries(title, sq.topic);
  let last: { subject: Subject; at: number } | null = null;
  const scenes = lines.map((line, index) => {
    // Literal keyword queries ("glass wine photograph") only stay for food lines, where the words are the picture.
    // Themes picked up from abstract words ("data" gives an open book, "late" a wall clock) are dropped too.
    const own = (sq.scenes[index] ?? [])
      .filter((q) => keepQuery(q, line) && !WEAK_THEMES.has(q) && (!q.endsWith(" photograph") || FOOD_WORDS.test(line)))
      .map((q) => q.replace(/ photograph$/, ""));
    const subject = subjectOf(line);
    if (subject) last = { subject, at: index };
    const carried = last && index - last.at <= CARRY_LINES ? last.subject : null;
    const anchor = subject ?? carried;
    const rotate = (list: string[]) => list.map((_, k) => list[(index + k) % list.length]);
    let out: string[];
    if (subject) out = [subject.queries[0], ...own, ...subject.queries.slice(1)];
    // Model queries were already asked to stay on topic; keyword queries for a vague line are literal, so they are replaced.
    else if (fromModel && own.length) out = [...own, ...(anchor ? [anchor.queries[index % anchor.queries.length]] : [])];
    else if (isVague(line)) out = anchor ? [...rotate(anchor.queries), ...rotate(topic)] : rotate(topic);
    // A concrete line keeps its own picture; the topic pool is only a relevance checked fallback.
    else out = own.length ? [...own, ...(anchor ? [anchor.queries[index % anchor.queries.length]] : [])] : anchor ? rotate(anchor.queries) : rotate(topic);
    const unique = [...new Set(out.filter(Boolean))].slice(0, 3);
    return unique.length ? unique : topic.length ? topic.slice(0, 2) : (sq.scenes[index] ?? []).slice(0, 2);
  });
  return { scenes, topic };
}
