// Turns a studio script into scene cards. Every spoken line is used once, in order.
// Charts are only added when the line already states two or more numbers.

import { planScenes } from "@/lib/cut/scenes";
import type { SceneCard } from "@/lib/produce/types";
import { plain, wordCount } from "@/lib/produce/text";

const HEADING =
  /^(hook|setup|cta|beats?|main(\s+content)?|payoff|outro|intro|on-screen(\s+text)?|voiceover|b-roll|captions?|visual|scene\s*\d*)\b[:\s-]*$/i;

function spokenLines(script: string): string[] {
  return script
    .split(/\n+/)
    .map((line) => plain(line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "")))
    .filter((line) => line.length > 1 && !HEADING.test(line));
}

function shortTitle(narration: string, fallback: string): string {
  const words = plain(narration).split(/\s+/).filter(Boolean).slice(0, 6);
  const title = words.join(" ");
  return title || plain(fallback) || "Scene";
}

function labeledNumbers(narration: string): { label: string; value: string }[] {
  const found: { label: string; value: string }[] = [];
  const re = /([A-Za-z][A-Za-z ]{1,24}?)\s+(\d+(?:\.\d+)?%?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(narration))) {
    const label = match[1].trim();
    if (label.split(/\s+/).length > 3) continue;
    found.push({ label, value: match[2] });
  }
  return found.slice(0, 6);
}

function autoVisual(narration: string, title: string, index: number): string {
  const numbers = labeledNumbers(narration);
  if (numbers.length >= 2) {
    return `bar: ${numbers.map((item) => `${item.label} ${item.value}`).join(" | ")}`;
  }
  const clauses = narration
    .split(/,|\s+then\s+|\s+and\s+/i)
    .map((part) => plain(part))
    .filter((part) => wordCount(part) >= 1 && wordCount(part) <= 5);
  if (index % 3 === 1 && clauses.length >= 2) {
    return `diagram: ${clauses.slice(0, 4).join(" > ")}`;
  }
  if (index % 3 === 2) return `background: ${title}`;
  return `big-text: ${title}`;
}

export function estimateDuration(narration: string): number {
  return Math.max(2, Math.round(wordCount(narration) / 2.4));
}

/** Scene cards for a script. An empty script returns no cards. */
export function cardsFromScript(script: string, videoTitle: string): SceneCard[] {
  const lines = spokenLines(script);
  if (!lines.length && plain(script)) lines.push(plain(script));
  if (!lines.length) return [];
  const plan = planScenes(lines);
  return plan.scenes.map((narration, index) => {
    const title = index === 0 && plain(videoTitle) ? plain(videoTitle) : shortTitle(narration, videoTitle);
    return {
      title: title.slice(0, 80),
      narration: plain(narration),
      visual: autoVisual(plain(narration), title.slice(0, 80), index),
      duration: estimateDuration(narration),
    };
  });
}
