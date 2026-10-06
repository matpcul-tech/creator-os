import type { Camera, Layout, Scene, StillId } from "@/lib/cut/types";

const CAMERAS: Camera[] = ["push", "driftL", "rise", "driftR", "hold"];

const STILL_WORDS: Record<StillId, string[]> = {
  desk: ["desk", "write", "draft", "doc", "morning", "habit", "post", "open"],
  city: ["city", "night", "world", "grow", "online", "skyline"],
  mic: ["voice", "say", "speak", "talk", "podcast", "story", "sound"],
  path: ["path", "walk", "start", "keep", "consistent", "long", "journey", "done"],
  cafe: ["idea", "think", "quiet", "plan", "afternoon", "lose", "wait"],
  paper: ["number", "prove", "sentence", "page", "script", "word", "line"],
  crowd: ["people", "they", "creator", "community", "someone", "audience", "them"],
  phone: ["video", "export", "scroll", "watch", "tab", "screen", "phone", "file"],
};

export const SAMPLE_SCRIPT = `Most creators do not have a posting problem. They have a finishing problem.

You open a doc, write a decent idea, then lose the afternoon hunting for clips, a voice, and captions.

Cut the script into beats. One idea per line. The picture, the voice, and the words on screen should all say that one idea.

Give the first line the job of stopping the scroll. Give the last line the job of telling them what to do.

Then make the middle prove it. A number, a picture, a sentence someone could repeat.

When the cut is done, export it. Do not wait on another tab to finish your video.`;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function beats(script: string): string[] {
  const paras = script
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let bits = paras.length >= 3 ? paras : sentences(script);
  bits = bits.flatMap((bit) => (bit.split(/\s+/).length > 34 ? sentences(bit) : [bit]));
  const merged: string[] = [];
  for (const bit of bits) {
    const count = bit.split(/\s+/).length;
    if (merged.length && count < 6) merged[merged.length - 1] += " " + bit;
    else merged.push(bit);
  }
  while (merged.length > 8) {
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < merged.length - 1; i++) {
      const weight = merged[i].length + merged[i + 1].length;
      if (weight < best) {
        best = weight;
        index = i;
      }
    }
    merged.splice(index, 2, `${merged[index]} ${merged[index + 1]}`);
  }
  return merged.filter(Boolean).slice(0, 8);
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
        .replace(/^[\s,:\-—]+/, "")
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
  const clause = clean.split(/,|—| - /)[0]?.trim() ?? clean;
  const clauseWords = clause.split(/\s+/);
  const chosen = clauseWords.length <= cap ? clauseWords : words.slice(0, cap);
  return chosen.join(" ");
}

function pickStill(text: string, previous: StillId | null): StillId {
  const hay = text.toLowerCase();
  const ranked = (Object.keys(STILL_WORDS) as StillId[])
    .map((id) => ({
      id,
      score: STILL_WORDS[id].reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  const top = ranked.find((item) => item.id !== previous) ?? ranked[0];
  return top?.id ?? "desk";
}

export function directScript(script: string): Scene[] {
  const parts = beats(script.trim() || SAMPLE_SCRIPT);
  const last = parts.length - 1;
  let previous: StillId | null = null;
  return parts.map((narration, index) => {
    const layout = layoutFor(narration, index, last);
    const still = pickStill(narration, previous);
    previous = still;
    return {
      id: `s${index + 1}-${narration.length}`,
      narration,
      onscreen: punch(narration, layout),
      layout,
      still,
      camera: CAMERAS[index % CAMERAS.length],
    };
  });
}

export function voiceKey(scenes: Scene[], voiceId: string): string {
  return `${voiceId}::${scenes.map((scene) => scene.narration.trim()).join("\n")}`;
}

export function spokenScript(scenes: Scene[]): { spoken: string; ranges: { start: number; end: number }[] } {
  const gap = " [long-pause] ";
  const ranges: { start: number; end: number }[] = [];
  let spoken = "";
  scenes.forEach((scene, index) => {
    const text = scene.narration.trim();
    const start = spoken.length;
    spoken += text;
    ranges.push({ start, end: spoken.length });
    if (index < scenes.length - 1) spoken += gap;
  });
  return { spoken, ranges };
}
