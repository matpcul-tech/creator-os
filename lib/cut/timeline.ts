import type { Scene, WordMark } from "@/lib/cut/types";

const GAP = 0.32;

export function estimateTimeline(scenes: Scene[]): { words: WordMark[]; duration: number } {
  let time = 0.2;
  const words: WordMark[] = [];
  scenes.forEach((scene, sceneIndex) => {
    const parts = scene.narration.trim().split(/\s+/).filter(Boolean);
    const span = Math.min(9, Math.max(2.7, parts.length / 2.45));
    const each = span / Math.max(1, parts.length);
    parts.forEach((word, index) => {
      words.push({
        word,
        start: time + index * each,
        end: time + (index + 1) * each,
        scene: sceneIndex,
      });
    });
    time += span + (sceneIndex < scenes.length - 1 ? GAP : 0);
  });
  return { words, duration: Math.max(1.2, time + 0.45) };
}

type Stamp = { start: number; end: number };

function asStamp(value: unknown): Stamp | null {
  if (Array.isArray(value) && value.length >= 2) {
    const start = Number(value[0]);
    const end = Number(value[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) return { start, end };
  }
  if (value && typeof value === "object" && "start" in value && "end" in value) {
    const start = Number((value as { start: unknown }).start);
    const end = Number((value as { end: unknown }).end);
    if (Number.isFinite(start) && Number.isFinite(end)) return { start, end };
  }
  return null;
}

export function marksFromVoice(
  scenes: Scene[],
  spoken: string,
  ranges: { start: number; end: number }[],
  chars: string[],
  times: unknown[],
  durationHint: number,
): { words: WordMark[]; duration: number } {
  const joined = chars.join("");
  const stamps = times.map(asStamp);
  const aligned = joined === spoken && stamps.length === chars.length && stamps.every((stamp) => stamp !== null);
  if (!aligned) {
    const base = durationHint > 0.4 ? durationHint : estimateTimeline(scenes).duration;
    return scaleEstimate(scenes, base);
  }
  const words: WordMark[] = [];
  scenes.forEach((scene, sceneIndex) => {
    const range = ranges[sceneIndex];
    if (!range) return;
    const narration = spoken.slice(range.start, range.end);
    const pattern = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(narration))) {
      const startIndex = range.start + match.index;
      const endIndex = startIndex + match[0].length - 1;
      const start = stamps[startIndex]?.start ?? 0;
      const end = stamps[Math.min(endIndex, stamps.length - 1)]?.end ?? start + 0.2;
      words.push({ word: match[0], start, end, scene: sceneIndex });
    }
  });
  if (!words.length) {
    const base = durationHint > 0.4 ? durationHint : estimateTimeline(scenes).duration;
    return scaleEstimate(scenes, base);
  }
  const last = words[words.length - 1]?.end ?? 0;
  return { words, duration: Math.max(last, durationHint) + 0.45 };
}

function scaleEstimate(scenes: Scene[], duration: number): { words: WordMark[]; duration: number } {
  const estimate = estimateTimeline(scenes);
  if (estimate.duration <= 0.1) return { words: [], duration };
  const scale = duration / estimate.duration;
  return {
    duration,
    words: estimate.words.map((word) => ({
      ...word,
      start: word.start * scale,
      end: word.end * scale,
    })),
  };
}

export function sceneWindows(words: WordMark[], count: number, duration: number): { start: number; end: number }[] {
  const windows = Array.from({ length: count }, (_, index) => {
    const mine = words.filter((word) => word.scene === index);
    const start = mine[0]?.start ?? 0;
    const end = mine[mine.length - 1]?.end ?? start + 0.8;
    return { start, end };
  });
  if (windows[0]) windows[0].start = 0;
  for (let index = 0; index < windows.length; index++) {
    const next = index === windows.length - 1 ? duration : windows[index + 1].start;
    windows[index].end = Math.max(windows[index].end, next);
  }
  if (windows.length) windows[windows.length - 1].end = duration;
  return windows;
}

export function chunkAt(
  words: WordMark[],
  time: number,
  scene: number,
): { words: WordMark[]; active: number } {
  const mine = words.filter((word) => word.scene === scene);
  if (!mine.length) return { words: [], active: -1 };
  let index = mine.findIndex((word) => time >= word.start && time < word.end + 0.01);
  if (index < 0) {
    if (time >= mine[mine.length - 1].end) index = mine.length - 1;
    else index = Math.max(0, mine.findIndex((word) => word.start > time) - 1);
  }
  const size = 5;
  const group = Math.floor(index / size);
  const slice = mine.slice(group * size, group * size + size);
  return { words: slice, active: index - group * size };
}

export function fmtTime(time: number): string {
  const whole = Math.max(0, Math.floor(time));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
