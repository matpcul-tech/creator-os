import { spreadStills } from "@/lib/cut/photo-pool";
import { splitClauses, splitSentences } from "@/lib/cut/sentences";
import { planScenes, type ScenePlan } from "@/lib/cut/scenes";
import type { Camera, Layout, Scene, StillId } from "@/lib/cut/types";

const CAMERAS: Camera[] = ["push", "driftL", "rise", "driftR", "hold"];

export const STILL_WORDS: Record<StillId, string[]> = {
  desk: ["desk", "write", "draft", "doc", "morning", "habit", "post", "open"],
  city: ["city", "night", "world", "grow", "online", "skyline"],
  mic: ["voice", "say", "speak", "talk", "podcast", "story", "sound"],
  path: ["path", "walk", "start", "keep", "consistent", "long", "journey", "done"],
  cafe: ["idea", "think", "quiet", "plan", "afternoon", "lose", "wait"],
  paper: ["number", "prove", "sentence", "page", "script", "word", "line"],
  crowd: ["people", "they", "creator", "community", "someone", "audience", "them"],
  phone: ["video", "export", "scroll", "watch", "tab", "screen", "phone", "file"],
};

function tidy(text: string): string {
  return (
    text
      // A dash inside a word ("long\u2013term") is a hyphen. A dash between words is a pause, so it
      // becomes a comma. Nothing else is added, and no sentence is split here.
      .replace(/(?<=\w)[\u2010\u2011\u2012\u2013](?=\w)/g, "-")
      .replace(/\s*[\u2012\u2013\u2014\u2015]\s*/g, ", ")
      .replace(/\s+--?\s+/g, ", ")
      .replace(/\s+/g, " ")
      .replace(/\s+([.!?,;:])/g, "$1")
      .replace(/,(?=[,.!?;:])/g, "")
      .replace(/^,\s*/, "")
      .trim()
  );
}

/**
 * One short line per sentence for the voice and the faceless cut. A long sentence is broken only
 * after a comma, semicolon or colon (or before a joining word when it has none), and the words and
 * punctuation stay exactly as written.
 */
export function shapeScript(script: string): string {
  const lines: string[] = [];
  for (const raw of script.split(/\n+/)) {
    const chunk = tidy(raw);
    if (!chunk) continue;
    for (const sentence of splitSentences(chunk)) {
      lines.push(...splitClauses(sentence, { trigger: 12, target: 12, hard: 24 }));
    }
  }
  return lines.join("\n\n");
}

function speakableLine(line: string): string {
  return line
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\*\*(?:on-screen text|voiceover|b-roll):\*\*/gi, " ")
    .replace(/^(?:on-screen text|voiceover|b-roll|caption|visual)\s*:\s*/i, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/[#＃*_>`~|]+/g, " ")
    .replace(/^(?:captions?|hashes?|hashing|hashtags?|on[- ]?screen(?: text)?|voice ?over|b-roll|visual)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLabel(line: string): boolean {
  return /^(hook|setup|cta|beats?|main(\s+content)?|payoff|outro|intro|on-screen(\s+text)?|voiceover|b-roll|captions?|hashes?|hashing|hashtags?|visual|scene\s*\d*)\b[:\s-]*$/i.test(line);
}

function spokenLines(script: string): string[] {
  const blocks = [...script.matchAll(/\*\*VOICEOVER:\*\*([\s\S]*?)(?=\*\*(?:ON-SCREEN TEXT|B-ROLL|VOICEOVER):\*\*|$)/gi)];
  const source = blocks.length ? blocks.map((match) => match[1]).join("\n") : script;
  return source
    .split(/\n+/)
    .map(speakableLine)
    .filter((line) => line.length > 1 && !isLabel(line));
}

/**
 * Shaped lines for the voice and the cut, plus which script line each came from, so counts shown
 * to the user match the lines they wrote.
 */
function spokenParts(script: string): { lines: string[]; origin: number[]; scriptLines: number } {
  const raw = spokenLines(script);
  const lines: string[] = [];
  const origin: number[] = [];
  raw.forEach((line, index) => {
    for (const part of beats(shapeScript(line))) {
      lines.push(part);
      origin.push(index);
    }
  });
  return { lines, origin, scriptLines: new Set(origin).size };
}

export const SAMPLE_SCRIPT = `Most creators do not have a posting problem. They have a finishing problem.

You open a doc, write a decent idea, then lose the afternoon hunting for clips, a voice, and captions.

Cut the script into beats. One idea per line. The picture, the voice, and the words on screen should all say that one idea.

Give the first line the job of stopping the scroll. Give the last line the job of telling them what to do.

Then make the middle prove it. A number, a picture, a sentence someone could repeat.

When the cut is done, export it. Do not wait on another tab to finish your video.`;

/** Every spoken line of the script, in order. Nothing is capped here. */
export function beats(script: string): string[] {
  return script
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function layoutFor(text: string, index: number, last: number): Layout {
  if (index === 0) return "hook";
  if (index === last) return "close";
  if (/\d/.test(text)) return "stat";
  const commas = text.match(/,/g)?.length ?? 0;
  if (commas >= 2) return "list";
  return "statement";
}

function punch(narration: string, layout: Layout): string {
  const clean = narration.replace(/[.?!]+$/g, "").trim();
  if (layout === "stat") {
    const match = clean.match(/(\d[\d,]*(?:\.\d+)?%?)/);
    if (match) {
      const rest = clean
        .replace(match[1], "")
        .replace(/^[\s,:\-\u2014]+/, "")
        .split(/\s+/)
        .slice(0, 7)
        .join(" ");
      return rest ? `${match[1]}\n${rest}` : match[1];
    }
  }
  if (layout === "list") {
    const lines = clean
      .split(/,|;| and /)
      .map((line) => line.trim())
      .filter((line) => line.split(/\s+/).length > 1)
      .slice(0, 3);
    if (lines.length >= 2) return lines.map((line) => line.replace(/[.?!]+$/g, "")).join("\n");
  }
  const words = clean.split(/\s+/);
  const cap = layout === "hook" ? 8 : layout === "close" ? 10 : 12;
  const clause = clean.split(/,|\u2014| - /)[0]?.trim() ?? clean;
  const clauseWords = clause.split(/\s+/);
  const chosen = clauseWords.length <= cap ? clauseWords : words.slice(0, cap);
  return chosen.join(" ");
}

function stillScores(text: string): Record<StillId, number> {
  const hay = text.toLowerCase();
  const out = {} as Record<StillId, number>;
  for (const id of Object.keys(STILL_WORDS) as StillId[]) {
    out[id] = STILL_WORDS[id].reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
  }
  return out;
}

export type DirectPlan = { scenes: Scene[] } & Omit<ScenePlan, "scenes">;

/**
 * The whole script as scenes. Consecutive short lines share a scene (a sentence or two, about 4 to 8
 * seconds), and every spoken line lands in exactly one scene, in order. Only a script past
 * MAX_SCENES leaves lines out, and `omittedLines` says how many so the UI can show it.
 */
export function directPlan(script: string): DirectPlan {
  const spoken = spokenParts(script.trim() || SAMPLE_SCRIPT);
  const shaped = planScenes(spoken.lines);
  // Counts in the script's own lines. A line split across the limit counts as left out.
  const kept = shaped.groups.reduce((sum, group) => sum + group.lines.length, 0);
  const keptLines = kept < spoken.lines.length ? new Set(spoken.origin.slice(0, kept)).size - (spoken.origin[kept] === spoken.origin[kept - 1] ? 1 : 0) : spoken.scriptLines;
  const plan = { ...shaped, lineCount: spoken.scriptLines, omittedLines: spoken.scriptLines - keptLines };
  const parts = plan.scenes;
  const last = parts.length - 1;
  // Spread the built-in stills evenly instead of bouncing between the top two.
  const stills = spreadStills(parts.map(stillScores), Object.keys(STILL_WORDS) as StillId[]);
  const scenes = parts.map((narration, index) => {
    const layout = layoutFor(narration, index, last);
    return {
      id: `s${index + 1}-${narration.length}`,
      narration,
      onscreen: punch(narration, layout),
      layout,
      still: stills[index],
      camera: CAMERAS[index % CAMERAS.length],
    };
  });
  return { ...plan, scenes };
}

export function directScript(script: string): Scene[] {
  return directPlan(script).scenes;
}

export function voiceKey(scenes: Scene[], voiceId: string): string {
  return `${voiceId}::${scenes.map((scene) => scene.narration.trim()).join("\n")}`;
}

export function spokenScript(scenes: Scene[]): { spoken: string; ranges: { start: number; end: number }[] } {
  const ranges: { start: number; end: number }[] = [];
  let spoken = "";
  scenes.forEach((scene, index) => {
    const text = scene.narration.trim();
    const start = spoken.length;
    spoken += text;
    ranges.push({ start, end: spoken.length });
    if (index < scenes.length - 1) spoken += " ";
  });
  return { spoken, ranges };
}
