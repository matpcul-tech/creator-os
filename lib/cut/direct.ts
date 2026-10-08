import { spreadStills } from "@/lib/cut/photo-pool";
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
  return text
    .replace(/[\u2012\u2013\u2014\u2015]/g, ". ")
    .replace(/\s+--\s+/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .replace(/([.!?])\s*([a-z])/g, (_, mark: string, letter: string) => `${mark} ${letter.toUpperCase()}`)
    .replace(/(?:\. ){2,}/g, ". ")
    .trim();
}

export function shapeScript(script: string): string {
  const lines: string[] = [];
  for (const raw of script.split(/\n+/)) {
    const chunk = tidy(raw);
    if (!chunk) continue;
    const parts = chunk.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
    for (const sentence of parts.length ? parts : [chunk]) {
      const words = sentence.split(/\s+/);
      if (words.length <= 12) {
        lines.push(sentence);
        continue;
      }
      const clauses = sentence.split(/,\s+/);
      const bits = clauses.length > 1 ? clauses : [];
      if (!bits.length) {
        for (let index = 0; index < words.length; index += 10) bits.push(words.slice(index, index + 10).join(" "));
      }
      for (const bit of bits) {
        let line = bit.trim();
        if (!line) continue;
        if (!/[.!?]$/.test(line)) line += ".";
        lines.push(line.charAt(0).toUpperCase() + line.slice(1));
      }
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

function spokenSource(script: string): string {
  const blocks = [...script.matchAll(/\*\*VOICEOVER:\*\*([\s\S]*?)(?=\*\*(?:ON-SCREEN TEXT|B-ROLL|VOICEOVER):\*\*|$)/gi)];
  const source = blocks.length ? blocks.map((match) => match[1]).join("\n") : script;
  const spoken = source
    .split(/\n+/)
    .map(speakableLine)
    .filter((line) => line.length > 1 && !isLabel(line))
    .join("\n");
  return shapeScript(spoken);
}

export const SAMPLE_SCRIPT = `Most creators do not have a posting problem. They have a finishing problem.

You open a doc, write a decent idea, then lose the afternoon hunting for clips, a voice, and captions.

Cut the script into beats. One idea per line. The picture, the voice, and the words on screen should all say that one idea.

Give the first line the job of stopping the scroll. Give the last line the job of telling them what to do.

Then make the middle prove it. A number, a picture, a sentence someone could repeat.

When the cut is done, export it. Do not wait on another tab to finish your video.`;

// A spoken script is one short sentence per line, so a 60 to 90 second script
// runs 25 to 40 lines. The old cap of 20 cut longer scripts off mid way.
export const MAX_BEATS = 60;

export function beats(script: string): string[] {
  return script
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_BEATS);
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

export function directScript(script: string): Scene[] {
  const parts = beats(spokenSource(script.trim() || SAMPLE_SCRIPT));
  const last = parts.length - 1;
  // Spread the built-in stills evenly instead of bouncing between the top two.
  const stills = spreadStills(parts.map(stillScores), Object.keys(STILL_WORDS) as StillId[]);
  return parts.map((narration, index) => {
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
