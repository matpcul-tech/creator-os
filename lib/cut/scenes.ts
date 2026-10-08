// Groups a script's spoken lines into scenes. Every line is used exactly once, in order, so the
// video always covers the whole script. Short lines are joined so a scene holds a sentence or two,
// roughly 4 to 8 seconds of narration, which keeps the scene count (and photo searches) sensible.

/** Words per scene. About 2.4 spoken words a second, so 10 to 20 words is roughly 4 to 8 seconds. */
export const SCENE_MIN_WORDS = 10;
export const SCENE_MAX_WORDS = 20;
/**
 * The most scenes one video holds: about 25 minutes of narration. A longer script is never cut
 * quietly. The plan reports how many lines did not fit and the UI says so.
 */
export const MAX_SCENES = 200;

export type SceneGroup = { text: string; lines: number[] };

function count(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// A line that ends mid sentence (after a comma, or with no mark at all) pulls the next line in.
function endsSentence(text: string): boolean {
  return /[.!?\u2026]["'\u201d\u2019)\]]*$/.test(text.trim());
}

/**
 * Joins consecutive lines into scenes. A scene keeps taking lines while it is under `min` words, or
 * while it ends mid sentence, as long as it stays within `max` words. A line longer than `max` is a
 * scene on its own; it is never split or shortened here.
 */
export function groupLines(lines: string[], opts: { min?: number; max?: number } = {}): SceneGroup[] {
  const min = opts.min ?? SCENE_MIN_WORDS;
  const max = opts.max ?? SCENE_MAX_WORDS;
  type Group = { parts: string[]; lines: number[]; words: number };
  const groups: Group[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const words = count(line);
    const current = groups[groups.length - 1];
    if (current) {
      const last = current.parts[current.parts.length - 1];
      if (current.words + words <= max && (current.words < min || !endsSentence(last))) {
        current.parts.push(line);
        current.lines.push(index);
        current.words += words;
        continue;
      }
    }
    groups.push({ parts: [line], lines: [index], words });
  }
  // A very short last line ("Tell me below.") joins the scene before it rather than flashing by.
  const tail = groups[groups.length - 1];
  const prev = groups[groups.length - 2];
  if (tail && prev && tail.words < 4 && prev.words + tail.words <= max + 4) {
    prev.parts.push(...tail.parts);
    prev.lines.push(...tail.lines);
    prev.words += tail.words;
    groups.pop();
  }
  return groups.map((group) => ({ text: group.parts.join(" "), lines: group.lines }));
}

export type ScenePlan = {
  /** Scene texts that are in the video. */
  scenes: string[];
  groups: SceneGroup[];
  /** Spoken lines found in the script. */
  lineCount: number;
  /** Lines that did not fit under MAX_SCENES. Zero for any normal script. */
  omittedLines: number;
  omittedScenes: number;
};

export function planScenes(lines: string[], opts: { min?: number; max?: number; maxScenes?: number } = {}): ScenePlan {
  const all = groupLines(lines, opts);
  const cap = opts.maxScenes ?? MAX_SCENES;
  const kept = all.slice(0, cap);
  const left = all.slice(cap);
  return {
    scenes: kept.map((group) => group.text),
    groups: kept,
    lineCount: lines.filter((line) => line.trim()).length,
    omittedLines: left.reduce((sum, group) => sum + group.lines.length, 0),
    omittedScenes: left.length,
  };
}

/** Plain words for the UI when a script is longer than one video holds. Empty when nothing is left out. */
export function overLimitNote(plan: Pick<ScenePlan, "omittedLines" | "lineCount">, unit = "scenes"): string {
  if (!plan.omittedLines) return "";
  const used = plan.lineCount - plan.omittedLines;
  return `This script is longer than one video can hold (${MAX_SCENES} ${unit}, about 25 minutes). The video covers the first ${used} of ${plan.lineCount} lines. Split the script into two videos to cover the last ${plan.omittedLines}.`;
}
