// Turns script lines into concrete, photographable stock photo searches.
// One small AI call per script, cached, with keyword queries as the fallback.

import { createHash } from "node:crypto";
import { photoPlan } from "./builder-cards";

export type SceneQueries = { scenes: string[][]; topic: string[] };

const MAX_PER_SCENE = 3;

/** Clean one query: plain words, no dashes, short enough to search well. */
export function cleanQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const words = raw
    .replace(/[\u2012\u2013\u2014\u2015\-_/]+/g, " ")
    .replace(/[^A-Za-z0-9' ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.join(" ").toLowerCase();
}

function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const q = cleanQuery(item);
    if (q.split(" ").length >= 1 && q.length >= 3 && !out.includes(q)) out.push(q);
    if (out.length >= MAX_PER_SCENE) break;
  }
  return out;
}

/** Keyword queries for a line, used when the AI step fails or is skipped. */
export function keywordQueries(line: string): string[] {
  return photoPlan(line).queries.slice(0, 2);
}

/**
 * Read the model's JSON answer. Any scene the model skipped or garbled gets
 * keyword queries, so the result always has one entry per line.
 */
export function parseQueries(text: string, lines: string[], topic: string): SceneQueries {
  let data: { scenes?: unknown; topic?: unknown } = {};
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      data = JSON.parse(text.slice(start, end + 1));
    } catch {
      data = {};
    }
  }
  const raw = Array.isArray(data.scenes) ? data.scenes : [];
  const scenes = lines.map((line, i) => {
    const got = cleanList(raw[i]);
    return got.length ? got : keywordQueries(line);
  });
  const topicList = cleanList(data.topic);
  return { scenes, topic: topicList.length ? topicList : topic ? keywordQueries(topic) : [] };
}

/** Queries that came back from the browser (for a reshuffle), checked and trimmed. */
export function sanitizeQueries(raw: unknown, lines: string[]): SceneQueries | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { scenes?: unknown; topic?: unknown };
  if (!Array.isArray(value.scenes) || value.scenes.length !== lines.length) return null;
  const scenes = value.scenes.map((list, i) => {
    const got = cleanList(list);
    return got.length ? got : keywordQueries(lines[i]);
  });
  return { scenes, topic: cleanList(value.topic) };
}

export function fallbackQueries(lines: string[], topic: string): SceneQueries {
  return { scenes: lines.map(keywordQueries), topic: topic ? keywordQueries(topic) : [] };
}

/** Queries per line: fewer for long scripts so one call answers inside the timeout. */
export function queriesPerLine(count: number): number {
  return count > 20 ? 1 : count > 10 ? 2 : 3;
}

export function visualPrompt(lines: string[], topic: string): string {
  const numbered = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const per = queriesPerLine(lines.length);
  return [
    `You pick stock photos for a faceless video. For each numbered line, write ${per === 1 ? "1 short stock photo search query" : `${per} short stock photo search queries`}`,
    "that a photographer could actually shoot: concrete people, objects, places, or actions. 2 to 4 words each.",
    "Never abstract words, never metaphors, never text or charts. Think what a viewer should see while the line is spoken.",
    "Keep every line on the video's topic. When a line is vague, show the product or subject the script is talking about right then (for example the Oura Ring or a glucose monitor), or the topic itself.",
    "Show people, children or food only when the line is about them.",
    'Examples: "Sleep is the first lever." -> ["person sleeping in bed", "bedroom at night"].',
    '"Muscle is the second." -> ["weightlifting gym", "strong arm dumbbell"].',
    '"Longevity science" -> ["elderly people exercising", "healthy senior couple", "laboratory scientist"].',
    "Also give 2 or 3 queries for the video as a whole in \"topic\".",
    topic ? `Video title: ${topic}` : "",
    `Lines:\n${numbered}`,
    `Answer with JSON only, no other text: {"scenes": [[...], [...]], "topic": [...]} with exactly ${lines.length} entries in "scenes".`,
  ]
    .filter(Boolean)
    .join("\n");
}

class QueryTimeout extends Error {}

// Same script, same queries, so reshuffles and repeat presses do not call the AI again.
const cache = new Map<string, SceneQueries>();
const CACHE_MAX = 300;

export function cacheKey(lines: string[], topic: string): string {
  return createHash("sha1").update(JSON.stringify([topic, lines])).digest("hex");
}

// The AI step must never hold up photos for long. Past this, keyword queries are used.
export const AI_QUERY_TIMEOUT_MS = 8000;

export async function visualQueries(
  lines: string[],
  topic: string,
  ask: (prompt: string, maxTokens: number) => Promise<string>,
  timeoutMs = AI_QUERY_TIMEOUT_MS,
): Promise<SceneQueries & { source: "ai" | "cache" | "keywords" | "timeout" }> {
  const key = cacheKey(lines, topic);
  const hit = cache.get(key);
  if (hit) return { ...hit, source: "cache" };
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new QueryTimeout()), timeoutMs);
    });
    const text = await Promise.race([ask(visualPrompt(lines, topic), Math.min(4000, 200 + lines.length * (queriesPerLine(lines.length) * 12 + 10))), timedOut]).finally(() =>
      clearTimeout(timer),
    );
    const parsed = parseQueries(text, lines, topic);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, parsed);
    return { ...parsed, source: "ai" };
  } catch (err) {
    const timeout = err instanceof QueryTimeout;
    console.warn(timeout ? `photo queries timed out after ${timeoutMs} ms, using keywords` : `photo queries fell back to keywords: ${err instanceof Error ? err.message : String(err)}`);
    return { ...fallbackQueries(lines, topic), source: timeout ? "timeout" : "keywords" };
  }
}
